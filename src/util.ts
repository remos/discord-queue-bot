import {EmojiIdentifierResolvable, GuildEmoji, ReactionEmoji} from 'discord.js';

export interface Comparitor<K> {
    (a: K, b: K): boolean;
}

/**
 * Compares two EmojiIdentifiers e.g. a GuildEmoji and the unicode emoji string
 * @param a emoji to compare
 * @param b emoji to compare to
 * @returns true if `a` represents the same emoji as `b`
 */
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