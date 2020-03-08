import {EmojiIdentifierResolvable, GuildEmoji, ReactionEmoji} from 'discord.js';

export function compareEmoji(a: EmojiIdentifierResolvable, b: EmojiIdentifierResolvable): boolean {
    if(!a || !b) {
        return a === b;
    }

    if(typeof a === 'string') {
        if(b instanceof GuildEmoji || b instanceof ReactionEmoji) {
            return a === b.name;
        }

        return a === b;
    } else if(a instanceof GuildEmoji || a instanceof ReactionEmoji) {
        if(b instanceof GuildEmoji || b instanceof ReactionEmoji) {
            return a.identifier === b.identifier;
        }

        return false;
    }
}