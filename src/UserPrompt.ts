import {User, EmojiIdentifierResolvable, MessageReaction, StringResolvable, Message, MessageOptions, MessageAdditions, APIMessage} from 'discord.js';
import { compareEmoji } from './util';
import { ComparisonQueue } from './ComparisonQueue';

interface PromptCallback {
    (user: User, emoji: EmojiIdentifierResolvable): void;
}

export interface PromptOption {
    emoji: EmojiIdentifierResolvable;
    callback?: PromptCallback;
}

export class UserQueue extends ComparisonQueue<User> {
    constructor(initial?: User[]) {
        super((a: User, b: User)=>a.id === b.id, initial);
    }
}

export class UserPrompt {
    user: User;
    message: Message;
    timeout: number;
    promptOptions: PromptOption[];
    failure?: PromptCallback;

    startTime?: number;

    cancelled: boolean;
    removed: boolean;

    constructor(user: User, timeout: number, promptOptions: PromptOption[], failure?: PromptCallback) {
        this.user = user;
        this.timeout = timeout;
        this.promptOptions = promptOptions;
        this.failure = failure;

        this.cancelled = false;
        this.removed = false;
    }
    
    async prompt(
        options?:
            | MessageOptions
            | MessageAdditions
            | APIMessage
            | (MessageOptions & { split?: false })
            | MessageAdditions
            | APIMessage,
    ): Promise<EmojiIdentifierResolvable>;
    async prompt(
        content?: StringResolvable,
        options?: MessageOptions | MessageAdditions | (MessageOptions & { split?: false }) | MessageAdditions,
    ): Promise<EmojiIdentifierResolvable>;
    async prompt(...args: unknown[]): Promise<EmojiIdentifierResolvable> {
        if(this.cancelled) {
            return;
        }

        const dmChannel = this.user.dmChannel || await this.user.createDM();

        this.message = await dmChannel.send(...args);

        if(this.cancelled) {
            return;
        }

        for(const promptOption of this.promptOptions) {
            this.message.react(promptOption.emoji);
        }

        this.startTime = Date.now();
        const reactions = await this.message.awaitReactions(
            (reaction: MessageReaction, user: User)=>(
                user != user.client.user &&
                this.promptOptions.findIndex(
                    promptOption=>compareEmoji(promptOption.emoji, reaction.emoji)
                ) >= 0
            ),
            {max: 1, time: this.timeout}
        );

        this.removeMessage();

        if(this.cancelled) {
            return;
        }

        const emoji: EmojiIdentifierResolvable = reactions.size ? reactions.first().emoji : null;
        if(emoji) {
            const promptOption = this.promptOptions.find(promptOption=>compareEmoji(promptOption.emoji, emoji));
            if(promptOption.callback) {
                promptOption.callback(this.user, emoji);
            }
        } else if(this.failure) {
            this.failure(this.user, emoji);
        }

        return emoji;
    }

    private removeMessage(): void {
        if(this.removed) {
            return;
        }

        this.removed = true;

        if(this.message) {
            this.message.fetch().then(async message=>{
                if(message) {
                    try {
                        await message.delete();
                    } catch(ignored) {
                        // Ignore failure to delete the message
                    }
                }
            });
        }
    }

    /**
     * @returns the time remaining on the prompt
     */
    cancel(): number {
        if(!this.cancelled) {
            this.cancelled = true;
            this.removeMessage();
        }

        return Date.now() - this.startTime;
    }
}