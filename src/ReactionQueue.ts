import { TextChannel, MessageEmbed, MessageEmbedOptions, DMChannel, EmojiIdentifierResolvable, User, Message } from 'discord.js';

import {getUnicode} from 'emoji-dictionary';
import {ReactionMessage} from './ReactionMessage';

import {UserQueue} from './UserQueue';
import {UserPrompt} from './UserPrompt';
import { ComparisonMap } from './ComparisonMap';

type QueueType = 'available' | 'active' | 'pending' | 'queue';

export interface GetMessageFunction {
    (vars: {
        user: User;
        counts: {
            skips: number;
            timeouts: number;
        }
    }): string;
}

interface QueueOptions {
    existingMessage?: Message;
    paired?: boolean;
    maxActive?: number;

    pendingTimeout?: number;
    maxPendingTimeouts?: number;
    maxPendingSkips?: number;

    queueEmoji?: EmojiIdentifierResolvable;
    availableEmoji?: EmojiIdentifierResolvable;
    acceptEmoji?: EmojiIdentifierResolvable;
    skipEmoji?: EmojiIdentifierResolvable;

    promptAcceptOrSkipMessage?: string | GetMessageFunction;
    promptAcceptMessage?: string | GetMessageFunction;

    userToString?: (user: User, queueType: QueueType) => string;
}

function defaultUserToString(user: User, queueType: QueueType): string {
    const str = user.toString();

    return queueType === 'pending' ? `_${str}_` : str;
}

export class ReactionQueue {
    channel: TextChannel | DMChannel;
    title: string;
    message: Message;
    reactionMessage: ReactionMessage;

    paired: boolean;
    maxActive?: number;

    available?: UserQueue;
    active: UserQueue;
    pending: UserQueue;
    queue: UserQueue;

    promptMap: ComparisonMap<User, {
        prompt: UserPrompt;
        skippable: boolean;
        count: number;
    }>;

    queuePendingCountMap: ComparisonMap<User, {
        timeouts: number;
        skips: number;
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

    userToString: QueueOptions['userToString'];

    constructor(
        channel: TextChannel | DMChannel,
        title: string,
        {
            existingMessage,
            paired,
            maxActive,
            pendingTimeout=600000,
            maxPendingTimeouts=1,
            maxPendingSkips = 3,
            queueEmoji=getUnicode('stopwatch'),
            availableEmoji=getUnicode('ticket'),
            acceptEmoji=getUnicode('heavy_check_mark'),
            skipEmoji=getUnicode('heavy_multiplication_x'),
            userToString=defaultUserToString,
            promptAcceptOrSkipMessage='Accept newly active slot or return to the front of the queue?',
            promptAcceptMessage='Accept newly active slot?',
        }: QueueOptions = {}
    ) {
        if(!paired && !maxActive) {
            throw 'Queue must either be paired or have a set maxActive';
        }

        this.channel = channel;
        this.title = title;

        this.paired = !!paired;
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

        if(paired) {
            this.available = new UserQueue();
        }

        this.active = new UserQueue();
        this.pending = new UserQueue();
        this.queue = new UserQueue();
        this.promptMap = new ComparisonMap((a, b)=>a.id===b.id);
        this.queuePendingCountMap = new ComparisonMap((a, b)=>a.id===b.id);

        if(existingMessage) {
            this.message = existingMessage;
            this.initReactionMessage();
            this.updateMessage();
        } else {
            channel.send(this.getMessage()).then(message=>{
                this.message = message;
                this.initReactionMessage();
            });
        }
    }

    async setMaxActive(maxActive: number): Promise<void> {
        this.maxActive = maxActive;
        await this.updateMessage();
    }

    getMaxActive(): number {
        return this.paired ? this.available.length : this.maxActive;
    }

    private sendPendingPrompt(user: User): void {
        const options = [{
            emoji: this.acceptEmoji,
            callback: (user: User): void => {
                this.promptMap.remove(user);
                this.pending.remove(user);
                this.active.push(user);
                this.updateMessage();
            }
        }];

        if(this.queue.length > 0) {
            options.push({
                emoji: this.skipEmoji,
                callback: (user): void => {
                    this.promptMap.remove(user);
                    this.pending.remove(user);

                    const counts = this.queuePendingCountMap.get(user);
                    if(!counts || ++counts.skips < this.maxPendingSkips) {
                        this.queue.insert(user, 1);
                    } else {
                        this.reactionMessage.rebuildReactions();
                    }

                    this.checkQueueAndPromote();
                    this.updateMessage();
                }
            });
        }

        const prompt = new UserPrompt(user, this.queue.length ? this.pendingTimeout : 0, options, 
            (user)=>{
                this.promptMap.remove(user);
                this.pending.remove(user);

                const counts = this.queuePendingCountMap.get(user);
                if(!counts || ++counts.timeouts < this.maxPendingTimeouts) {
                    this.queue.insert(user, 1);
                } else {
                    this.reactionMessage.rebuildReactions();
                }

                this.checkQueueAndPromote();
                this.updateMessage();
            }
        );

        this.promptMap.add(user, {
            prompt: prompt,
            skippable: !!this.queue.length,
            count: 0
        });

        prompt.prompt(this.getMessageTemplate(user, this.queue.length ? this.promptAcceptOrSkipMessage : this.promptAcceptMessage));
    }

    private getMessageTemplate(user: User, template: string | GetMessageFunction): string {
        if(typeof template === 'string') {
            return template;
        }

        return template({
            user: user,
            counts: this.queuePendingCountMap.get(user)
        });
    }

    private checkQueueAndPromote(): void {
        while(this.active.length + this.pending.length < this.getMaxActive() && this.queue.length > 0) {
            this.moveUserToPending(this.queue.shift());
        }
    }

    private moveUserToPending(user: User): void {
        this.pending.push(user);
        this.sendPendingPrompt(user);
    }

    private checkAndUpdatePrompts(): void {
        for(const entry of [...this.promptMap.getEntries()]) {
            if(entry.value.skippable !== !!this.queue.length) {
                entry.value.prompt.cancel();
                this.promptMap.remove(entry.key);
                this.sendPendingPrompt(entry.key);
            }
        }
    }

    private async updateMessage(): Promise<void> {
        await this.message.edit(this.getMessage());
    }

    private initReactionMessage(): ReactionMessage {
        return this.reactionMessage = new ReactionMessage(this.message, [
            {
                emoji: this.availableEmoji,
                condition: (): boolean => this.paired,
                validate: (_, user): boolean => this.available.has(user),
                collect: (_, user): boolean => {
                    this.available.push(user);
    
                    this.checkQueueAndPromote();
                    this.updateMessage();
                    return true;
                },
                remove: (_, user): void => {
                    this.available.remove(user);
                    this.updateMessage();
                }
            },
            {
                emoji: this.queueEmoji,
                validate: (_, user): boolean => this.active.has(user) || this.pending.has(user) || this.queue.has(user),
                collect: (_, user): boolean => {
                    if(this.active.has(user) || this.pending.has(user) || this.queue.has(user)) {
                        return true;
                    }
            
                    if(this.active.length + this.pending.length < this.getMaxActive()) {
                        this.active.push(user);
                    } else {
                        this.queuePendingCountMap.add(user, {
                            timeouts: 0,
                            skips: 0
                        });
                        this.queue.push(user);
                        this.checkAndUpdatePrompts();
                    }
            
                    this.checkQueueAndPromote();
                    this.updateMessage();
            
                    return true;
                },
                remove: (_, user): void => {
                    for(const list of [this.active, this.pending, this.queue]) {
                        if(list.has(user)) {
                            if(this.promptMap.has(user)) {
                                this.promptMap.remove(user).prompt.cancel();
                            }
    
                            list.remove(user);
                        }
                    }
    
                    this.checkAndUpdatePrompts();
                    this.checkQueueAndPromote();
                    this.updateMessage();
                }
            }
        ], {autoRemove: true});
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
    
    private getQueueFieldValue(queueTypes: QueueType[] | QueueType, expectedLength = 1): string[] {
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

    getMessage(): MessageEmbed {
        const options: MessageEmbedOptions = {
            title: this.title,
            fields: [],
            timestamp: new Date(),
            footer: {text: 'Last updated'}
        };

        if(this.paired) {
            options.fields.push({name: `Open`, value: this.getQueueFieldValue('available').join('\n'), inline: true});
        }

        const active =this.getQueueFieldValue(['active', 'pending'], this.getMaxActive());

        options.fields.push({name: `Active ${this.active.length}${this.pending.length ? `+${this.pending.length}` : ''}/${this.getMaxActive()}`, value: active.join("\n"), inline: true});
        options.fields.push({name: `Queued`, value: this.getQueueFieldValue('queue').join('\n'), inline: true});

        return new MessageEmbed(options);
    }
}