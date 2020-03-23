import {
    User,
    EmojiIdentifierResolvable,
    StringResolvable,
    Message,
    APIMessage,
    MessageEditOptions,
    MessageEmbed,
    DMChannel,
    MessageReaction,
    TextChannel,
    DiscordAPIError
} from 'discord.js';
import {ComparisonQueue} from './ComparisonQueue';
import { ReactionMessage, ReactionCallback } from './ReactionMessage';

export interface PromptOption {
    emoji: EmojiIdentifierResolvable;
    collect: ReactionCallback<boolean | void>;
}

export class UserQueue extends ComparisonQueue<User> {
    constructor(initial?: User[]) {
        super((a: User, b: User)=>a.id === b.id, initial);
    }
}

export interface UserPromptPromptOptions {
    timeoutCallback?: ReactionCallback<void>;
}

export class UserPrompt {
    user: User;
    message: Message;
    reactionMessage: ReactionMessage;
    cancelled: boolean;
    fallbackChannel: TextChannel | DMChannel;

    constructor(user: User, fallbackChannel?: TextChannel | DMChannel) {
        this.user = user;
        this.fallbackChannel = fallbackChannel;
        this.cancelled = false;
    }

    private async getDMChannel(): Promise<DMChannel> {
        return this.user.dmChannel || await this.user.createDM();
    }

    private async clearDMChannel(exclude: Message[] = []): Promise<Message[]> {
        const channel = await this.getDMChannel();

        // Bulk delete doesn't exist on DMChannel?
        return Promise.all(
            (await channel.messages.fetch())
            .filter(({id})=>exclude.findIndex(({id: excludeId})=>id===excludeId) < 0)
            .map(message=>message.delete().catch(()=>null))
        ).catch(()=>[]);
    }

    // Proxy the arguments for discord.js' PartialTextBasedChannelFields.send
    async prompt(
        promptOptions: PromptOption[],
        timeout: number,
        additionalOptions: UserPromptPromptOptions,
        options: MessageEditOptions | MessageEmbed | APIMessage,
    ): Promise<EmojiIdentifierResolvable>;
    async prompt(
        promptOptions: PromptOption[],
        timeout: number,
        additionalOptions: UserPromptPromptOptions,
        content: StringResolvable,
        options?: MessageEditOptions | MessageEmbed,
        onTimeout?: ReactionCallback<void>
    ): Promise<EmojiIdentifierResolvable>;
    async prompt(
        promptOptions: PromptOption[],
        timeout: number,
        additionalOptions: UserPromptPromptOptions,
        a: unknown,
        b?: unknown
    ): Promise<EmojiIdentifierResolvable> {
        if(this.cancelled) {
            return;
        }

        if(this.reactionMessage) {
            this.reactionMessage.stop();
        }

        const dmChannel = await this.getDMChannel();
        await this.clearDMChannel(this.message ? [this.message] : []);

        if(this.message && this.message.editable) {
            this.message = await this.message.edit(a, b);
        } else {
            this.removeMessage();

            try {
                this.message = await dmChannel.send(a, b);
            } catch(e) {
                if(e instanceof DiscordAPIError && e.code === 50007 && this.fallbackChannel) {
                    this.message = await this.fallbackChannel.send(a, b);
                } else {
                    throw e;
                }
            }
        }

        if(this.cancelled) {
            this.removeMessage();
            return;
        }

        promptOptions = promptOptions.map(promptOption=>({
            emoji: promptOption.emoji,
            collect: (reaction: MessageReaction, user: User): boolean=>{
                if(user.id !== this.user.id) {
                    return false;
                }

                this.removeMessage();
                promptOption.collect(reaction, user);
            }
        }));

        this.reactionMessage = new ReactionMessage(
            this.message,
            promptOptions,
            {
                timeout: timeout,
                timeoutCallback: (): void => {
                    this.removeMessage();
                    if(additionalOptions.timeoutCallback) {
                        additionalOptions.timeoutCallback(null, this.user);
                    }
                }
            }
        );
    }

    private async removeMessage(): Promise<void> {
        if(!this.message) {
            return;
        }

        if(this.message) {
            const message = this.message;
            delete this.message;
            return message.fetch().then(async message=>{
                if(message) {
                    await message.delete().catch(()=>null);
                }
            });
        }
    }

    cancel(): void {
        if(!this.cancelled) {
            this.cancelled = true;
            if(this.reactionMessage) {
                this.reactionMessage.stop();
            }
            this.removeMessage();
        }
    }
}