import {compareEmoji} from './util';

const Emoji = (identifier: string): {identifier: string} => ({identifier});

interface IdentifiedFunction {
    (): void;
    identifier: string;
}
const identifier = (identifier: string): IdentifiedFunction => {
    const f = (): void => null;
    f.identifier = identifier;
    return f;
};

describe('compareEmoji', () => {
    it('Evaluates empty strings/falsy objects', () => {
        expect(compareEmoji(null, undefined)).toStrictEqual(false);
        expect(compareEmoji(undefined, undefined)).toStrictEqual(false);
        expect(compareEmoji('', '')).toStrictEqual(true);
        expect(compareEmoji('', 'a')).toStrictEqual(false);
        expect(compareEmoji('b', '')).toStrictEqual(false);

        expect(compareEmoji(Emoji(''), '')).toStrictEqual(true);
        expect(compareEmoji('', Emoji(''))).toStrictEqual(true);
    });

    it('Evaluates emoji strings and class types', () => {
        expect(compareEmoji('a', 'a')).toStrictEqual(true);
        expect(compareEmoji(Emoji('a'), 'a')).toStrictEqual(true);
        expect(compareEmoji('b', Emoji('b'))).toStrictEqual(true);
        expect(compareEmoji(Emoji('c'), Emoji('c'))).toStrictEqual(true);

        expect(compareEmoji('a', 'b')).toStrictEqual(false);
        expect(compareEmoji(Emoji('a'), 'b')).toStrictEqual(false);
        expect(compareEmoji('b', Emoji('a'))).toStrictEqual(false);
        expect(compareEmoji(Emoji('a'), Emoji('b'))).toStrictEqual(false);
    });

    it('Evaluates odd types', () => {
        /* eslint-disable @typescript-eslint/ban-ts-ignore */

        // @ts-ignore
        expect(compareEmoji({value: 'a'}, 'a')).toStrictEqual(false);

        expect(compareEmoji(identifier('a'), 'a')).toStrictEqual(false);
        expect(compareEmoji(identifier('a'), identifier('a'))).toStrictEqual(false);
        expect(compareEmoji(Emoji('a'), identifier('a'))).toStrictEqual(false);

        const a = (): void => null;
        a['identifier'] = 'asd';
        // @ts-ignore
        expect(compareEmoji({value: 'a'}, {value: 'b'})).toStrictEqual(false);

        // @ts-ignore
        expect(compareEmoji(1, 'a')).toStrictEqual(false);
        
        // @ts-ignore
        expect(compareEmoji(Emoji('a'), 1)).toStrictEqual(false);
        /* eslint-enable @typescript-eslint/ban-ts-ignore */
    });
});