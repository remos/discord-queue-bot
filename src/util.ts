import {
    EmojiIdentifierResolvable
} from 'discord.js';

export interface Comparator<K> {
    (a: K, b: K): boolean;
}

interface Identifier {
    identifier: string;
}

type EmojiIdentifier = EmojiIdentifierResolvable | Identifier;

function hasIdentifier(object: EmojiIdentifier): object is Identifier {
    return (
        !!object &&
        typeof object === 'object' &&
        'identifier' in object
    );
}

/**
 * Compares two EmojiIdentifiers e.g. a GuildEmoji and the unicode emoji string
 * @param a emoji to compare
 * @param b emoji to compare to
 * @returns true if `a` represents the same emoji as `b`
 */
export function compareEmoji(a: EmojiIdentifier, b: EmojiIdentifier): boolean {
    if(typeof a === 'string') {
        if(hasIdentifier(b)) {
            return a === b.identifier;
        }

        return a === b;
    } else if(hasIdentifier(a)) {
        if(typeof b === 'string') {
            return a.identifier === b;
        } else if(hasIdentifier(b)) {
            return a.identifier === b.identifier;
        }
    }

    return false;
}