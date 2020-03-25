import {Comparator} from './util';

export class ComparisonQueue<T> {
    queue: T[];
    length: number;
    comparator: Comparator<T>;

    constructor(comparator: Comparator<T>, initial: T[] = []) {
        this.queue = [];
        this.length = 0;
        this.comparator = comparator;

        for(const queued of initial) {
            this.push(queued);
        }
    }

    join(joiner: string): string {
        return this.queue.join(joiner);
    }

    get(): T[];
    get(index: number): T;
    get(index: number = null): T | T[] {
        if(index === null) {
            return this.queue;
        }

        return this.queue[index];
    }

    indexOf(value: T): number {
        return this.queue.findIndex(testValue => this.comparator(value, testValue));
    }

    remove(value: T): T {
        let index;
        let removedValue = null;
        while((index = this.indexOf(value)) >= 0) {
            removedValue = this.queue.splice(index, 1)[0];
            this.length = this.queue.length;
        }

        return removedValue;
    }

    has(value: T): boolean {
        return this.indexOf(value) >= 0;
    }

    push(value: T): number {
        return (this.length = this.queue.push(value)) - 1;
    }

    shift(): T {
        const value = this.queue.shift();
        this.length = this.queue.length;
        return value;
    }

    unshift(value: T): number {
        this.length = this.queue.unshift(value);
        return 0;
    }

    insert(value: T, index: number): number {
        index = Math.min(this.queue.length, index);
        this.queue.splice(index, 0, value);
        this.length = this.queue.length;

        return index;
    }

    map<R>(callbackFn: (value: T) => R): R[] {
        return this.queue.map(callbackFn);
    }

    concat(...queues: (ComparisonQueue<T> | T[])[]): T[] {
        return this.queue.concat(
            ...queues.map(
                (queue: ComparisonQueue<T> | T[]) => (
                    queue instanceof ComparisonQueue ? queue.queue : queue
                )
            )
        );
    }
}