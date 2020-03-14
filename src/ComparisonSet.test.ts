import {ComparisonSet} from './ComparisonSet';

describe('ComparisonSet', ()=>{
    it("initialises empty", ()=>{
        const set = new ComparisonSet(
            ({id: a}, {id: b})=>a==b
        );

        expect(set.get()).toEqual([]);
    });

    it("shouldn't allow duplicates when initialising", ()=>{
        const set = new ComparisonSet(
            ({id: a}, {id: b})=>a==b,
            [{id: 1}, {id: 2}, {id: 1}]
        );

        expect(set.get()).toEqual([
            {id: 1},
            {id: 2}
        ]);
    });

    it("shouldn't allow duplicates when manually adding", ()=>{
        const set = new ComparisonSet(
            ({id: a}, {id: b})=>a==b,
            [{id: 1}, {id: 2}, {id: 1}]
        );

        set.add({id: 2});

        expect(set.get()).toEqual([
            {id: 1},
            {id: 2}
        ]);
    });

    it("removes items", ()=>{
        const set = new ComparisonSet(
            ({id: a}, {id: b})=>a==b,
            [{id: 1}, {id: 2}, {id: 1}]
        );

        expect(set.remove({id: 2})).toEqual({id: 2});

        expect(set.get()).toEqual([
            {id: 1}
        ]);
    });

    it("non-existent items are not removed", ()=>{
        const set = new ComparisonSet(
            ({id: a}, {id: b})=>a==b,
            [{id: 1}, {id: 2}, {id: 1}]
        );

        expect(set.remove({id: 3})).toEqual(null);

        expect(set.get()).toEqual([
            {id: 1},
            {id: 2}
        ]);
    });

    it("has item", ()=>{
        const set = new ComparisonSet(
            ({id: a}, {id: b})=>a==b,
            [{id: 1}, {id: 2}, {id: 1}]
        );

        expect(set.has({id: 1})).toEqual(true);
        expect(set.has({id: 3})).toEqual(false);
    });
});