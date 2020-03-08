import { TextChannel, MessageEmbed, MessageEmbedOptions, DMChannel, EmojiIdentifierResolvable, User, Message } from 'discord.js';

import {getUnicode} from 'emoji-dictionary';
import {ReactionMessage} from './ReactionMessage';

import {UserQueue} from './UserQueue';
import {UserPrompt} from './UserPrompt';

interface QueueOptions {
    existingMessage?: Message;
    paired?: boolean;
    maxActive?: number;
    pendingTimeout?: number;
    queueEmoji?: EmojiIdentifierResolvable;
    availableEmoji?: EmojiIdentifierResolvable;
    acceptEmoji?: EmojiIdentifierResolvable;
    skipEmoji?: EmojiIdentifierResolvable;
}

export async function createQueue(
    channel: TextChannel | DMChannel,
    title: string,
    {
        existingMessage,
        paired,
        maxActive,
        pendingTimeout=600000,
        queueEmoji=getUnicode('stopwatch'),
        availableEmoji=getUnicode('ticket'),
        acceptEmoji=getUnicode('heavy_check_mark'),
        skipEmoji=getUnicode('heavy_multiplication_x')
    }: QueueOptions = {}
): Promise<ReactionMessage> {
    if(!paired && !maxActive) {
        throw 'Queue must either be paired or have a set maxActive';
    }

    const available = new UserQueue();
    const active = new UserQueue();
    const pending = new UserQueue();
    const queue = new UserQueue();
    const promptMap: {[key: string]: UserPrompt} = {};

    const getMaxActive = (): number => paired ? available.length : maxActive;

    const getMessage = (): MessageEmbed => {
        const options: MessageEmbedOptions = {
            title: title,
            fields: [],
            timestamp: new Date(),
            footer: {text: 'Last updated'}
        };

        if(paired) {
            options.fields.push({name: `Open`, value: available.length ? available.join("\n") : '-', inline: true});
        }

        const activeDisplay: any[] = active.concat(pending.map(user=>`_${user.toString()}_`));
        for(let i=active.length + pending.length; i<getMaxActive(); i++) {
            activeDisplay.push('-');
        }

        options.fields.push({name: `Active ${active.length}${pending.length ? `+${pending.length}` : ''}/${getMaxActive()}`, value: activeDisplay.length ? activeDisplay.join("\n") : '-', inline: true});
        options.fields.push({name: `Queued`, value: queue.length ? queue.join("\n") : '-', inline: true});

        return new MessageEmbed(options);
    };

    const message = existingMessage ? existingMessage : (await (channel as TextChannel).send(getMessage()));
    
    const updateMessage = async (): Promise<void> => {
        await message.edit(getMessage());
    };

    if(existingMessage) {
        updateMessage();
    }

    const moveUserToPending = (user: User): void => {
        pending.push(user);

        const prompt = new UserPrompt(user, pendingTimeout, [
            {
                emoji: acceptEmoji,
                callback: (user): void => {
                    pending.remove(user);
                    active.push(user);
                    updateMessage();
                    delete promptMap[user.id];
                }
            },
            {
                emoji: skipEmoji,
                callback: (user): void => {
                    pending.remove(user);
                    queue.unshift(user);
                    updateMessage();
                    delete promptMap[user.id];
                }
            },
        ], (user)=>{
            pending.remove(user);
            queue.unshift(user);
            updateMessage();
            delete promptMap[user.id];
        });

        promptMap[user.id] = prompt;

        prompt.prompt('Accept new active slot?');
    };

    const updateQueue = (): void => {
        if(active.length + pending.length < getMaxActive() && queue.length > 0) {
            moveUserToPending(queue.shift());
        }
    };

    return new ReactionMessage(message, [
        {
            emoji: availableEmoji,
            condition: (): boolean => paired,
            validate: (_, user): boolean => available.has(user),
            collect: (_, user): boolean => {
                available.push(user);

                updateQueue();
                updateMessage();
                return true;
            },
            remove: (_, user): void => {
                available.remove(user);
                updateMessage();
            }
        },
        {
            emoji: queueEmoji,
            validate: (_, user): boolean => active.has(user) || pending.has(user) || queue.has(user),
            collect: (_, user): boolean => {
                if(active.has(user) || pending.has(user) || queue.has(user)) {
                    return true;
                }
        
                if(active.length < getMaxActive()) {
                    active.push(user);
                } else {
                    queue.push(user);
                }
        
                updateQueue();
                updateMessage();
        
                return true;
            },
            remove: (_, user): void => {
                for(const list of [active, pending, queue]) {
                    if(list.has(user)) {
                        if(promptMap[user.id]) {
                            promptMap[user.id].cancel();
                            delete promptMap[user.id];
                        }

                        list.remove(user);
                    }
                }

                updateQueue();
                updateMessage();
            }
        }
    ], {autoRemove: true});
}