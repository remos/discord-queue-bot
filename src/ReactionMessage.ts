import { MessageReaction, User, EmojiIdentifierResolvable, Message } from "discord.js";

import {compareEmoji} from './util';
import { ComparisonMap } from "./ComparisonMap";
import { ComparisonSet } from './ComparisonSet';

interface ReactionCallbacks {
    /** Called when receiving the reaction, return false to remove the reaction (button behaviour) otherwise the reaction will stay */
    collect?: (reaction: MessageReaction, user: User) => boolean;
    remove?: (reaction: MessageReaction, user: User) => void;
    dispose?: (reaction: MessageReaction, user: User) => void;
    /** Validate whether a user's reaction should remain or not - return true to keep a reaction, false to remove */
    validate?: (reaction: MessageReaction, user: User) => boolean;
    /** Return true to display the option (have the bot react with at least 1) */
    condition?: () => boolean;
}

export interface ReactionOption extends ReactionCallbacks {
    emoji: EmojiIdentifierResolvable;
}

export class ReactionMap {
    map: ComparisonMap<EmojiIdentifierResolvable, ReactionOption>;

    constructor(options: ReactionOption[]) {
        this.map = new ComparisonMap(compareEmoji, options.map(
            option=>({
                key: option.emoji,
                value: option
            })
        ));
    }

    add(option: ReactionOption): void {
        this.map.add(option.emoji, option);
    }

    remove(option: ReactionOption): ReactionOption {
        return this.map.remove(option.emoji);
    }

    get(emoji: EmojiIdentifierResolvable): ReactionOption {
        return this.map.get(emoji);
    }

    has(emoji: EmojiIdentifierResolvable): boolean {
        return this.map.has(emoji);
    }

    getValues(): ReactionOption[] {
        return this.map.getValues();
    }
}

export class ReactionMessage {
    message: Message;
    optionMap: ReactionMap;
    defaultOption: ReactionCallbacks;

    constructor(message: Message, options: ReactionOption[], defaultOption?: ReactionCallbacks) {
        this.message = message;
        this.optionMap = new ReactionMap(options);
        this.defaultOption = defaultOption;

        this.rebuildReactions().then(this.createReactionCollector);
    }

    private createReactionCollector = (): void => {
        this.message.createReactionCollector((_, user)=>{
            return user != user.client.user;
        }, {dispose: true})
            .on('collect', (reaction, user) =>{
                if(user !== user.client.user) {
                    const callback = this.getCallback(reaction);
                    if(callback) {
                        if(callback.collect) {
                            if(callback.collect(reaction, user) == false) {
                                reaction.users.remove(user);
                            }
                        }
                    }
                }

                this.rebuildReactions();
            })
            .on('remove', (reaction, user) => {
                if(user !== user.client.user) {
                    const callback = this.getCallback(reaction);
                    if(callback) {
                        callback.remove && callback.remove(reaction, user);
                    }
                }

                this.rebuildReactions();
            })
            .on('dispose', (reaction, user) => {
                if(user !== user.client.user) {
                    const callback = this.getCallback(reaction);
                    if(callback) {
                        callback.dispose && callback.dispose(reaction, user);
                    }
                }

                this.rebuildReactions();
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

    async rebuildReactions(): Promise<MessageReaction[]> {
        this.message = await this.message.fetch();

        const existingReactions = new ComparisonSet(compareEmoji);
        const promises = [];

        for(const reaction of this.message.reactions.cache.array()) {
            promises.push(reaction.users.fetch().then((users)=>{
                if(users.size) {
                    const option = this.getOption(reaction);
                    if(!option || (option.condition && !option.condition())) {
                        if(this.defaultOption && this.defaultOption.validate && !this.defaultOption.validate(reaction, null)) {
                            reaction.remove();
                        } else {
                            reaction.users.remove(this.message.client.user);
                        }
                    } else if(option) {
                        existingReactions.add(option.emoji);
                    }
    
                    if(option && option.validate) {
                        for(const user of users.array()) {
                            if(user !== user.client.user && !option.validate(reaction, user)) {
                                reaction.users.remove(user);
                            }
                        }
                    }
                }
            }));
        }

        await Promise.all(promises);

        const reactionPromises: Promise<MessageReaction>[] = [];
        for(const option of this.optionMap.getValues()) {
            if(!existingReactions.has(option.emoji) && (!option.condition || option.condition())) {
                reactionPromises.push(this.message.react(option.emoji));
            }
        }

        return Promise.all(reactionPromises);
    }
}