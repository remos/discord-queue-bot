import {ComparisonMap} from './ComparisonMap';

describe('ComparisonMap', ()=>{
    it("initialises empty", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b
        );

        expect(map.getEntries()).toEqual([]);
    });

    it("should overwrite duplicates when initialising", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'},
                {key: {id: 1}, value: 'c'}
            ]
        );

        expect(map.getEntries()).toEqual([
            {key: {id: 1}, value: 'c'},
            {key: {id: 2}, value: 'b'}
        ]);
    });

    it("should allow adding entries", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'}
            ]
        );

        map.add({id: 4}, 'another value');

        expect(map.getEntries()).toEqual([
            {key: {id: 1}, value: 'a'},
            {key: {id: 4}, value: 'another value'}
        ]);
    });

    it("should overwrite entries with the same key when adding", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'}
            ]
        );

        map.add({id: 1}, 'b');

        expect(map.getEntries()).toEqual([
            {key: {id: 1}, value: 'b'}
        ]);
    });

    it("should not remove missing entries", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.remove({id: 3})).toEqual(null);

        expect(map.getEntries()).toEqual([
            {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
        ]);
    });

    it("should remove entries", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.remove({id: 1})).toEqual('a');

        expect(map.getEntries()).toEqual([
            {key: {id: 2}, value: 'b'}
        ]);
    });

    it("should support get", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.get({id: 1})).toEqual('a');
        expect(map.get({id: 3})).toEqual(undefined);
    });

    it("should support get with a default value", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.get({id: 3}, 'c')).toEqual('c');
    });

    it("should support has", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.has({id: 1})).toEqual(true);
        expect(map.has({id: 2})).toEqual(true);
        expect(map.has({id: 3})).toEqual(false);
    });

    it("should support getKeys", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.getKeys()).toEqual([
            {id: 1}, {id: 2}
        ]);
    });

    it("should support getValues", ()=>{
        const map = new ComparisonMap(
            ({id: a}, {id: b})=>a==b,
            [
                {key: {id: 1}, value: 'a'},
                {key: {id: 2}, value: 'b'}
            ]
        );

        expect(map.getValues()).toEqual([
            'a', 'b'
        ]);
    });
});