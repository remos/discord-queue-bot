import { ReactionCollector, MessageReaction, User, Snowflake, Message, CollectorFilter, ReactionCollectorOptions } from "discord.js";

export class StatelessReactionCollector extends ReactionCollector {
    dispose(reaction: MessageReaction, user: User): Snowflake | null {
        if (reaction.message.id !== this.message.id) return null;

        this.emit('remove', reaction, user);
        return reaction.count ? null : ReactionCollector.key(reaction);
    }
}