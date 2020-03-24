import {
    MessageReaction, 
    User,
    EmojiIdentifierResolvable,
    Message,
    ReactionCollector,
    DiscordAPIError
} from "discord.js";

import {compareEmoji} from './util';
import {ComparisonSet} from './ComparisonSet';
import {EmojiMap} from './EmojiMap';

import debounce = require('debounce-promise');
import { StatelessReactionCollector } from "./StatelessReactionCollector";

export interface ReactionCallback<T> {
    (reaction: MessageReaction, user: User): T;
}

interface ReactionCallbacks {
    /** Called when receiving the reaction, return false to remove the reaction (button behaviour) otherwise the reaction will stay */
    collect?: ReactionCallback<boolean | void>;
    remove?: ReactionCallback<void>;
    dispose?: ReactionCallback<void>;
    /** Validate whether a user's reaction should remain or not - return true to keep a reaction, false to remove */
    validate?: ReactionCallback<boolean>;
    /** Return true to display the option (have the bot react with at least 1) */
    condition?: () => boolean;
}

type CallbackMethodName = 'collect' | 'remove' | 'dispose';

export interface ReactionOption extends ReactionCallbacks {
    emoji: EmojiIdentifierResolvable;
}

interface ReactionMessageOptions {
    timeout?: number;
    defaultOption?: ReactionCallbacks;
    timeoutCallback?: () => void;
}

function ignore404Errors(e: unknown): void {
    if(e instanceof DiscordAPIError && e.httpStatus === 404) {
        return;
    }

    throw e;
}

export class ReactionHandler {
    message: Message;
    timeout: number;
    optionMap: EmojiMap<ReactionOption>;
    defaultOption: ReactionCallbacks;
    timeoutCallback: () => void;
    collector: ReactionCollector;

    stopped = false;

    constructor(message: Message,
        options: ReactionOption[],
        {
            timeout=0,
            defaultOption,
            timeoutCallback
        }: ReactionMessageOptions,
    ) {
        if(!message) {
            throw 'Message must be provided';
        }

        this.message = message;
        this.timeout = timeout;
        this.optionMap = new EmojiMap<ReactionOption>(message.client, options);
        this.defaultOption = defaultOption;
        this.timeoutCallback = timeoutCallback;

        this.rebuildReactions().then(this.createReactionCollector);
        this.rebuildReactions = debounce(this.rebuildReactions, 300);
    }

    private callbackProxy = (callbackMethodName: CallbackMethodName) => (reaction: MessageReaction, user: User): void => {
        if(!user || user.id !== user.client.user.id) {
            const callback = this.getCallback(reaction);
            if(callback) {
                if(callback[callbackMethodName]) {
                    const result = callback[callbackMethodName](reaction, user);
                    if(callbackMethodName === 'collect' && result === false) {
                        reaction.users.remove(user);
                    }
                }
            }
        }

        this.rebuildReactions();
    };

    private createReactionCollector = (): void => {
        this.collector = new StatelessReactionCollector(
            this.message,
            (_, user) => user.id != user.client.user.id,
            {
                dispose: true,
                time: this.timeout
            }
        )
            .on('collect', this.callbackProxy('collect'))
            .on('remove', this.callbackProxy('remove'))
            .on('dispose', this.callbackProxy('dispose'))
            .on('end', (_, reason) => {
                if(reason === 'time') {
                    this.timeoutCallback();
                }
            });
    };

    getOption(reaction: MessageReaction): ReactionOption {
        return this.optionMap.get(reaction.emoji);
    }

    getCallback(reaction: MessageReaction): ReactionCallbacks {
        const callback = this.optionMap.get(reaction.emoji);

        return callback || this.defaultOption;
    }

    addOption(option: ReactionOption): void {
        this.optionMap.add(option);
        this.rebuildReactions();
    }

    removeOption(option: ReactionOption): void {
        this.optionMap.remove(option);
        this.rebuildReactions();
    }

    stop(): void {
        this.stopped = true;
        if(this.collector) {
            this.collector.stop();
        }
    }

    async rebuildReactions(): Promise<void | MessageReaction[]> {
        if(this.stopped) {
            return;
        }

        const existingReactions = new ComparisonSet(compareEmoji);
        const promises = [];

        for(const reaction of this.message.reactions.cache.array()) {
            promises.push(
                reaction.users.fetch().then((users) => {
                    if(users.size) {
                        const removalPromises = [];
                        const option = this.getOption(reaction);

                        if(!option || (option.condition && !option.condition())) {
                            if(this.defaultOption && this.defaultOption.validate && !this.defaultOption.validate(reaction, null)) {
                                removalPromises.push(
                                    reaction.remove()
                                );
                            } else {
                                removalPromises.push(
                                    reaction.users.remove(this.message.client.user)
                                );
                            }
                        } else if(option) {
                            existingReactions.add(option.emoji);
                        }
        
                        if(option && option.validate) {
                            for(const user of users.array()) {
                                if(user !== user.client.user && !option.validate(reaction, user)) {
                                    removalPromises.push(
                                        reaction.users.remove(user)
                                    );
                                }
                            }
                        }

                        return removalPromises;
                    }
                }).catch(ignore404Errors)
            );
        }

        await Promise.all(promises);

        const reactionPromises: Promise<MessageReaction>[] = [];
        for(const option of this.optionMap.getValues()) {
            if(!existingReactions.has(option.emoji) && (!option.condition || option.condition())) {
                reactionPromises.push(this.message.react(option.emoji));
            }
        }

        return Promise.all(reactionPromises).catch(ignore404Errors);
    }
}
