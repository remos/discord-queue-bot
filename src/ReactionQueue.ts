import {
    TextChannel,
    MessageEmbed,
    MessageEmbedOptions,
    DMChannel,
    EmojiIdentifierResolvable,
    User,
    Message,
    MessageResolvable,
    MessageReaction
} from 'discord.js';
import {ReactionHandler, ReactionOption} from './ReactionHandler';

import {UserPrompt} from './UserPrompt';
import { ComparisonMap } from './ComparisonMap';
import { ComparisonQueue } from './ComparisonQueue';
import { Comparator } from './util';

import debounce = require('debounce-promise');
import {EventEmitter} from 'tsee';

type QueueType = 'available' | 'active' | 'pending' | 'queue';
type PassType = 'timeout' | 'skip';

export interface GetMessageFunction {
    (context: {
        user: User;
        counts: {
            skip: number;
            timeout: number;
        };
    }): string | MessageEmbed;
}

export interface ReactionQueueOptions {
    /** Reference to an existing message to use rather than posting a new message - will default to posting a new message */
    existingMessage?: MessageResolvable;
    /** Require a user to mark themselves available to increase the maximum active user size */
    requireAvailable?: boolean;
    /** Maximum number of users - overridden by `requireAvailable` if set true */
    maxActive?: number;

    /** Time to allow a user to accept an active slot before returning them to queue */
    pendingTimeout?: number;
    /** Number of times to allow a user to timeout before removing them from the queue */
    maxPendingTimeouts?: number;
    /** Number of times to allow a user to skip accepting a slot before removing them from the queue */
    maxPendingSkips?: number;

    /** Emoji used for button to queue */
    queueEmoji?: EmojiIdentifierResolvable;
    /** Emoji used for button to add to the available pool */
    availableEmoji?: EmojiIdentifierResolvable;
    /** Emoji used for button to accept open position */
    acceptEmoji?: EmojiIdentifierResolvable;
    /** Emoji used for button to skip open position and return to queue */
    skipEmoji?: EmojiIdentifierResolvable;

    /** Message to display when a user can either accept or skip */
    promptAcceptOrSkipMessage?: string | GetMessageFunction;
    /** Message to display when a user can only accept (i.e. no-one else in the queue behind them) */
    promptAcceptMessage?: string | GetMessageFunction;

    /** Any additional options to add to the message */
    additionalOptions?: ReactionOption[];

    messageDebounceTimeout?: number;

    /** Style/transform a user's name to display in the queue */
    userToString?: (user: User, queueType: QueueType) => string;
}

function defaultUserToString(user: User, queueType: QueueType): string {
    const str = user.toString();

    return queueType === 'pending' ? `_${str}_` : str;
}

type UserQueue = ComparisonQueue<User>;
const USER_COMPARATOR: Comparator<User> = (a: User, b: User): boolean => a.id === b.id;

export class ReactionQueue extends EventEmitter<{
    userPass: (user: User, passType: PassType, returnedToQueue: boolean) => void;
    userQueued: (user: User) => void;
    userActive: (user: User) => void;
    userPending: (user: User) => void;
    userAdd: (user: User) => void;
    userRemove: (user: User, queueName: QueueType) => void;
    messageUpdated: (message: MessageEmbed) => void;
}> {
    private channel: TextChannel | DMChannel;
    title: string;
    message: Message;
    reactionHandler: ReactionHandler;

    requireAvailable: boolean;
    maxActive?: number;

    private available?: UserQueue;
    private active: UserQueue;
    private pending: UserQueue;
    private queue: UserQueue;

    additionalOptions: ReactionOption[];

    promptMap: ComparisonMap<User, {
        prompt: UserPrompt;
        skippable: boolean;
    }>;

    promptTimeoutCountMap: ComparisonMap<User, {
        timeout: number;
        skip: number;
    }>;

    promptAcceptOrSkipMessage: string | GetMessageFunction;
    promptAcceptMessage: string | GetMessageFunction;

    pendingTimeout: number;
    maxPendingTimeouts: number;
    maxPendingSkips: number;

    queueEmoji: EmojiIdentifierResolvable;
    availableEmoji: EmojiIdentifierResolvable;
    acceptEmoji: EmojiIdentifierResolvable;
    skipEmoji: EmojiIdentifierResolvable;

    userToString: ReactionQueueOptions['userToString'];

    private debouncedUpdate: () => Promise<void>;

    constructor(
        channel: TextChannel | DMChannel,
        title: string,
        {
            existingMessage,
            requireAvailable,
            maxActive,
            pendingTimeout=600000,
            maxPendingTimeouts=1,
            maxPendingSkips = 3,
            queueEmoji='🎫',
            availableEmoji='📋',
            acceptEmoji='✔️',
            skipEmoji='✖️',
            userToString=defaultUserToString,
            promptAcceptOrSkipMessage=({user}): string => `${user.toString()} - Accept newly active slot or return to the front of the queue?`,
            promptAcceptMessage=({user}): string => `${user.toString()} - Accept newly active slot?`,
            additionalOptions=[],
            messageDebounceTimeout=300,
        }: ReactionQueueOptions = {}
    ) {
        super();

        if(!requireAvailable && !maxActive) {
            throw 'Queue must either be paired or have a set maxActive';
        }

        this.channel = channel;
        this.title = title;

        this.requireAvailable = !!requireAvailable;
        this.maxActive = maxActive;
        this.pendingTimeout = pendingTimeout;
        this.maxPendingTimeouts = maxPendingTimeouts;
        this.maxPendingSkips = maxPendingSkips;

        this.queueEmoji = queueEmoji;
        this.availableEmoji = availableEmoji;
        this.acceptEmoji = acceptEmoji;
        this.skipEmoji = skipEmoji;

        this.userToString = userToString;
        this.promptAcceptOrSkipMessage = promptAcceptOrSkipMessage;
        this.promptAcceptMessage = promptAcceptMessage;

        this.additionalOptions = additionalOptions;

        this.debouncedUpdate = debounce(this.updateMessage, messageDebounceTimeout);

        this.active = new ComparisonQueue(USER_COMPARATOR);
        this.pending = new ComparisonQueue(USER_COMPARATOR);
        this.queue = new ComparisonQueue(USER_COMPARATOR);
        this.available = new ComparisonQueue(USER_COMPARATOR);

        this.promptMap = new ComparisonMap((a, b)=>a.id===b.id);
        this.promptTimeoutCountMap = new ComparisonMap((a, b)=>a.id===b.id);

        if(existingMessage) {
            (
                existingMessage instanceof Message ?
                Promise.resolve(existingMessage) :
                channel.messages.fetch(existingMessage)
            ).then(message=>{
                this.message = message;
                this.createReactionHandler();
                this.updateMessage();
            });
        } else {
            this.channel.send(this.getMessage()).then(message=>{
                this.message = message;
                this.createReactionHandler();
            });
        }
    }

    private updateMessage: () => Promise<void> = async () => {
        const message = this.getMessage();
        await this.message.edit(message);
        this.emit('messageUpdated', message);
    };

    private userAcceptPrompt = (_: MessageReaction, user: User): boolean | void => {
        this.moveUserToActive(user);
    };

    private userPassPromptFactory = (passType: PassType, max: number) => (_: MessageReaction, user: User): boolean | void => {
        this.promptMap.remove(user);
        this.pending.remove(user);

        const counts = this.promptTimeoutCountMap.get(user);
        if(!counts || ++counts[passType] < max) {
            this.queue.insert(user, 1);
            this.emit('userPass', user, passType, true);
        } else {
            this.reactionHandler.rebuildReactions();
            this.emit('userPass', user, passType, false);
        }

        this.checkQueueAndPromote();
        this.debouncedUpdate();
    };

    private sendPendingPrompt(user: User): void {
        const options = [{
            emoji: this.acceptEmoji,
            collect: this.userAcceptPrompt
        }];

        if(this.queue.length > 0) {
            options.push({
                emoji: this.skipEmoji,
                collect: this.userPassPromptFactory('skip', this.maxPendingSkips)
            });
        }

        const prompt = this.promptMap.has(user) ? this.promptMap.get(user).prompt : new UserPrompt(user, this.channel);

        this.promptMap.add(user, {
            prompt: prompt,
            skippable: !!this.queue.length
        });

        prompt.prompt(
            options, 
            this.queue.length ? this.pendingTimeout : 0,
            {
                timeoutCallback: this.userPassPromptFactory('timeout', this.maxPendingTimeouts)
            },
            this.templateToMessage(user, this.queue.length ? this.promptAcceptOrSkipMessage : this.promptAcceptMessage)
        );
    }

    private templateToMessage(user: User, template: string | GetMessageFunction): string | MessageEmbed {
        if(typeof template === 'string') {
            return template;
        }

        return template({
            user: user,
            counts: this.promptTimeoutCountMap.get(user)
        });
    }

    private checkQueueAndPromote(): void {
        while(this.active.length + this.pending.length < this.getMaxActive() && this.queue.length > 0) {
            this.moveUserToPending(this.queue.shift());
        }
    }

    private checkAndUpdatePrompts(): void {
        for(const entry of [...this.promptMap.getEntries()]) {
            if(entry.value.skippable !== !!this.queue.length) {
                this.sendPendingPrompt(entry.key);
            }
        }
    }

    private createReactionHandler(): ReactionHandler {
        const options: ReactionOption[] = [
            {
                emoji: this.queueEmoji,
                validate: (_, user): boolean => this.isUserQueued(user),
                collect: (_, user): boolean => this.addUser(user),
                remove: (_, user): void => this.removeUser(user)
            },
            ...this.additionalOptions
        ];

        if(this.requireAvailable) {
            options.unshift({
                emoji: this.availableEmoji,
                condition: (): boolean => this.requireAvailable,
                validate: (_, user): boolean => this.available.has(user),
                collect: (_, user): boolean => this.addAvailableUser(user),
                remove: (_, user): void => this.removeAvailableUser(user)
            });
        }

        return this.reactionHandler = new ReactionHandler(
            this.message,
            options,
            {
                defaultOption: {validate: (): boolean => false}
            }
        );
    }

    private getQueueByQueueType(queueType: QueueType): UserQueue {
        switch(queueType) {
            case 'available':
                return this.available;
            case 'active':
                return this.active;
            case 'pending':
                return this.pending;
            case 'queue':
                return this.queue;
            default:
                return null;
        }
    }
    
    private getQueueFieldMessage(queueTypes: QueueType[] | QueueType, expectedLength = 1): string[] {
        const out = [];

        if(!Array.isArray(queueTypes)) {
            queueTypes = [queueTypes];
        }

        for(const queueType of queueTypes) {
            const queue = this.getQueueByQueueType(queueType);
            if(!queue) {
                continue;
            }

            out.push(...queue.map(user=>this.userToString(user, queueType)));
        }

        // Display remaining slots - must be at least one or discord errors
        for(let i=out.length; i<Math.max(1, expectedLength); i++) {
            out.push('-');
        }

        return out;
    }

    private getMessage(): MessageEmbed {
        const messageOptions: MessageEmbedOptions = {
            title: this.title,
            fields: [],
            timestamp: new Date(),
            footer: {text: 'Last updated'}
        };

        if(this.requireAvailable) {
            messageOptions.fields.push({name: `Open`, value: this.getQueueFieldMessage('available').join('\n'), inline: true});
        }

        const active = this.getQueueFieldMessage(['active', 'pending'], this.getMaxActive());

        messageOptions.fields.push({name: `Active ${this.active.length}${this.pending.length ? `+${this.pending.length}` : ''}/${this.getMaxActive()}`, value: active.join("\n"), inline: true});
        messageOptions.fields.push({name: `Queued`, value: this.getQueueFieldMessage('queue').join('\n'), inline: true});

        return new MessageEmbed(messageOptions);
    }

    async setMaxActive(maxActive: number): Promise<void> {
        this.maxActive = maxActive;
        await this.debouncedUpdate();
    }

    getMaxActive(): number {
        return this.requireAvailable ? this.available.length : this.maxActive;
    }

    getActiveUsers(): UserQueue {
        return this.active;
    }

    getPendingUsers(): UserQueue {
        return this.pending;
    }

    getAvailableUsers(): UserQueue {
        return this.available;
    }

    getQueuedUsers(): UserQueue {
        return this.queue;
    }

    isUserQueued = (user: User): boolean => (
        this.active.has(user) || this.pending.has(user) || this.queue.has(user)
    );

    moveUserToQueue = (user: User): void => {
        this.promptMap.remove(user);

        this.active.remove(user);
        this.pending.remove(user);

        this.queue.push(user);

        this.debouncedUpdate();

        this.emit('userActive', user);
    };

    moveUserToActive = (user: User): void => {
        this.promptMap.remove(user);

        this.queue.remove(user);
        this.pending.remove(user);

        this.active.push(user);

        this.debouncedUpdate();

        this.emit('userQueued', user);
    };

    moveUserToPending = (user: User): void => {
        this.queue.remove(user);
        this.active.remove(user);

        this.pending.push(user);

        this.sendPendingPrompt(user);
        this.debouncedUpdate();

        this.emit('userPending', user);
    };

    resetUserPromptCounts = (user: User): void => {
        this.promptTimeoutCountMap.add(user, {
            timeout: 0,
            skip: 0
        });
    };

    addUser = (user: User): boolean => {
        if(this.active.has(user) || this.pending.has(user) || this.queue.has(user)) {
            return true;
        }

        if(this.active.length + this.pending.length < this.getMaxActive()) {
            this.moveUserToActive(user);
        } else {
            this.resetUserPromptCounts(user);
            this.moveUserToQueue(user);

            // Check if someone has just joined the queue behind people who are pending
            // And offer skipping to the pending people
            this.checkAndUpdatePrompts();
        }

        this.checkQueueAndPromote();
        this.debouncedUpdate();

        this.emit('userAdd', user);

        return true;
    };

    removeUser = (user: User): void => {
        let queueName: 'active' | 'pending' | 'queue' = null;
        for(const checkingQueueName of ['active', 'pending', 'queue']) {
            const queue = this[checkingQueueName];
            if(queue.has(user)) {
                queueName = checkingQueueName as 'active' | 'pending' | 'queue';
                queue.remove(user);
            }
        }

        if(this.promptMap.has(user)) {
            this.promptMap.remove(user).prompt.cancel();
        }

        this.checkAndUpdatePrompts();
        this.checkQueueAndPromote();
        this.debouncedUpdate();

        this.emit('userRemove', user, queueName);
    };

    addAvailableUser = (user: User): boolean => {
        this.available.push(user);
    
        this.checkQueueAndPromote();
        this.debouncedUpdate();

        return true;
    };

    removeAvailableUser = (user: User): void => {
        this.available.remove(user);
        this.debouncedUpdate();

        this.emit('userRemove', user, 'available');
    };
}