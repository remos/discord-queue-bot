import {EmojiMap} from './EmojiMap';
import {Client} from 'discord.js';
import {mockDeep, mockReset} from 'jest-mock-extended';

jest.mock('discord.js');
jest.mock('./ComparisonMap');

describe('EmojiMap', ()=>{
    const client = mockDeep<Client>();

    beforeEach(()=>{
        mockReset(client);
    });

    describe('constructor', ()=>{
        it("initialises empty with no options", ()=>{
            const map = new EmojiMap(client);
            expect(map.map.add).toHaveBeenCalledTimes(0);
        });

        it("initialises empty", ()=>{
            const map = new EmojiMap(client, []);
            expect(map.map.add).toHaveBeenCalledTimes(0);
        });
    
        it("initialises with values", ()=>{
            client.emojis.resolveIdentifier
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2')
                .mockReturnValueOnce('1');
    
            const map = new EmojiMap(
                client,
                [
                    {emoji: 'a'},
                    {emoji: 'b'},
                    {emoji: 'c'},
                ]
            );

            expect(map.map.add).toHaveBeenCalledTimes(3);
            expect(map.map.add).toHaveBeenNthCalledWith(1, '1', {emoji: 'a'});
            expect(map.map.add).toHaveBeenNthCalledWith(2, '2', {emoji: 'b'});
            expect(map.map.add).toHaveBeenNthCalledWith(3, '1', {emoji: 'c'});
        });
    });
    
    describe('add', ()=>{
        it("should resolve identifier", ()=>{
            const map = new EmojiMap(client);

            client.emojis.resolveIdentifier.mockReturnValueOnce('1');
            map.add({emoji: '🎫'});
            expect(client.emojis.resolveIdentifier).toBeCalledTimes(1);
            expect(map.map.add).toHaveBeenLastCalledWith('1', {emoji: '🎫'});
    
            client.emojis.resolveIdentifier.mockReturnValueOnce('2');
            map.add({emoji: 'b'});
            expect(client.emojis.resolveIdentifier).toBeCalledTimes(2);
            expect(map.map.add).toHaveBeenLastCalledWith('2', {emoji: 'b'});
    
            client.emojis.resolveIdentifier.mockReturnValueOnce('1');
            map.add({emoji: '🎫🎫'});
            expect(map.map.add).toHaveBeenLastCalledWith('1', {emoji: '🎫🎫'});
        });
    });
    
    describe('remove', ()=>{
        it("should resolve identifier", ()=>{
            const map = new EmojiMap(client);
    
            client.emojis.resolveIdentifier.mockReturnValueOnce('1');
            map.remove({emoji: 'a'});
            expect(map.map.remove).toHaveBeenLastCalledWith('1');
        });
    });

    describe('get', ()=>{
        it("should resolve identifier", ()=>{
            const map = new EmojiMap(client);

            client.emojis.resolveIdentifier.mockReturnValueOnce('1');
            map.get('a');
            expect(map.map.get).toHaveBeenLastCalledWith('1');
        });
    });

    describe('has', ()=>{
        it("should resolve identifier", ()=>{
            const map = new EmojiMap(client);

            client.emojis.resolveIdentifier.mockReturnValueOnce('1');
            map.has('a');
            expect(map.map.has).toHaveBeenLastCalledWith('1');
        });
    });

    describe('getValues', ()=>{
        it("should resolve identifier", ()=>{
            const map = new EmojiMap(client);

            const value = {};
            map.map.getValues = jest.fn().mockReturnValue(value);
            expect(map.getValues()).toStrictEqual(value);
            expect(map.map.getValues).toHaveBeenCalled();
        });
    });
});