import { MessageReaction, User, EmojiIdentifierResolvable, Message} from "discord.js";

import {compareEmoji} from './util';

interface ReactionCallback {
    collect?: (reaction: MessageReaction, user: User) => boolean;
    remove?: (reaction: MessageReaction, user: User) => void;
    dispose?: (reaction: MessageReaction, user: User) => void;
    validate?: (reaction: MessageReaction, user: User) => boolean;
    condition?: () => boolean;
}

interface DefaultReactionCallback extends ReactionCallback {
    autoRemove?: boolean;
}

interface SpecificReactionCallback extends ReactionCallback {
    emoji: EmojiIdentifierResolvable;
}

export class ReactionMessage {
    message: Message;
    options: SpecificReactionCallback[];
    defaultCallback: DefaultReactionCallback;

    constructor(message: Message, options: SpecificReactionCallback[], defaultCallback?: DefaultReactionCallback) {
        this.message = message;
        this.options = options;
        this.defaultCallback = defaultCallback;

        this.prepare();
    }

    getSpecificOptionByEmoji(emoji: EmojiIdentifierResolvable): [SpecificReactionCallback, number] {
        for(let i=0; i<this.options.length; i++) {
            const option = this.options[i];

            if(compareEmoji(option.emoji, emoji)) {
                return [option, i];
            }
        }

        return [null, -1];
    }

    getSpecificOption(reaction: MessageReaction): [SpecificReactionCallback, number] {
        return this.getSpecificOptionByEmoji(reaction.emoji);
    }

    getCallback(reaction: MessageReaction): DefaultReactionCallback | SpecificReactionCallback {
        const [callback] = this.getSpecificOption(reaction);

        return callback || this.defaultCallback;
    }

    addOption(option: SpecificReactionCallback): void {
        const [,i] = this.getSpecificOptionByEmoji(option.emoji);

        if(i>=0) {
            this.options.splice(i, 1);
        }

        this.options.push(option);

        this.rebuildReactions();
    }

    removeOption(option: SpecificReactionCallback): void {
        const [,i] = this.getSpecificOptionByEmoji(option.emoji);

        if(i>=0) {
            this.options.splice(i, 1);
        }

        this.rebuildReactions();
    }

    async rebuildReactions(): Promise<MessageReaction[]> {
        this.message = await this.message.fetch();

        const existingReactions = [];
        const promises = [];

        for(const reaction of this.message.reactions.cache.array()) {
            promises.push(reaction.users.fetch().then((users)=>{
                if(users.size) {
                    const [option, i] = this.getSpecificOption(reaction);
                    if(!option || (option.condition && !option.condition())) {
                        if(this.defaultCallback && this.defaultCallback.autoRemove) {
                            reaction.remove();
                        } else {
                            reaction.users.remove(this.message.client.user);
                        }
                    } else if(option) {
                        existingReactions.push(i);
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
        for(let i=0; i<this.options.length; i++) {
            const option = this.options[i];
            if(existingReactions.indexOf(i) < 0 && (!option.condition || option.condition())) {
                reactionPromises.push(this.message.react(option.emoji));
            }
        }

        return Promise.all(reactionPromises);
    }

    async prepare(): Promise<void> {
        await this.rebuildReactions();

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
    }
}