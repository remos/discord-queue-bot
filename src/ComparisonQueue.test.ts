import {ComparisonQueue} from './ComparisonQueue';

describe('ComparisonQueue', () => {
    it("initialises empty", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b
        );

        expect(queue.get()).toEqual([]);
    });

    it("initialises populated", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );

        expect(queue.get()).toEqual(
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );
    });

    it("join queue to string", () => {
        const queue = new ComparisonQueue(
            (a, b) => a==b,
            [1, 2, 3, 1]
        );

        expect(queue.join(', ')).toEqual('1, 2, 3, 1');
    });

    it("gets an individual entry by index", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );

        expect(queue.get(1)).toEqual({id: 2});
    });

    it("gets the full queue", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );

        expect(queue.get()).toEqual([
            {id: 1}, {id: 2}, {id: 3}, {id: 1}
        ]);
    });

    it("remove by value", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );

        expect(queue.remove({id: 1})).toEqual({id: 1});
        expect(queue.get()).toEqual([{id: 2}, {id: 3}]);

        expect(queue.remove({id: 3})).toEqual({id: 3});
        expect(queue.remove({id: 1})).toEqual(null);
        expect(queue.remove({id: 4})).toEqual(null);

        expect(queue.has({id: 2})).toEqual(true);
    });

    it("has", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );

        expect(queue.has({id: 2})).toEqual(true);
        expect(queue.has({id: 4})).toEqual(false);
    });

    it("push", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 1}]
        );

        expect(queue.push({id: 5})).toEqual(4);

        expect(queue.get()).toEqual([
            {id: 1}, {id: 2}, {id: 3}, {id: 1}, {id: 5}
        ]);
    });

    it("shift", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 4}]
        );

        expect(queue.shift()).toEqual({id: 1});

        expect(queue.get()).toEqual([
            {id: 2}, {id: 3}, {id: 4}
        ]);
    });

    it("unshift", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 4}]
        );

        expect(queue.unshift({id: 5})).toEqual(0);

        expect(queue.get()).toEqual([
            {id: 5}, {id: 1}, {id: 2}, {id: 3}, {id: 4}
        ]);
    });

    it("insert", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 1}, {id: 2}, {id: 3}, {id: 4}]
        );

        queue.insert({id: 5}, 1);

        expect(queue.get()).toEqual([
            {id: 1}, {id: 5}, {id: 2}, {id: 3}, {id: 4}
        ]);
    });

    it("map", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 5}, {id: 2}, {id: 3}, {id: 4}]
        );

        expect(queue.map(value => value.id)).toEqual([
            5, 2, 3, 4
        ]);
    });

    it("concat", () => {
        const queue = new ComparisonQueue(
            ({id: a}, {id: b}) => a==b,
            [{id: 5}, {id: 2}, {id: 3}, {id: 4}]
        );

        expect(queue.concat(
            [{id: 1}, {id: 1}],
            new ComparisonQueue(
                ({id: a}, {id: b}) => a==b,
                [{id: 2}, {id: 5}]
            )
        )).toEqual([
            {id: 5}, {id: 2}, {id: 3}, {id: 4},
            {id: 1}, {id: 1}, {id: 2}, {id: 5}
        ]);
    });
});