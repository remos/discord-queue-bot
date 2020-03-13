import {Comparitor} from './util';

export class ComparisonQueue<T> {
    queue: T[];
    length: number;
    comparitor: Comparitor<T>;

    constructor(comparitor: Comparitor<T>, initial: T[] = []) {
        this.queue = initial;
        this.length = 0;
        this.comparitor = comparitor;
    }

    join(joiner: string): string {
        return this.queue.join(joiner);
    }

    get(index: number): T {
        return this.queue[index];
    }

    indexOf(value: T): number {
        return this.queue.findIndex(testValue=>this.comparitor(value, testValue));
    }

    remove(value: T): T {
        const index = this.indexOf(value);
        if(index < 0) {
            return;
        }

        const removedValue = this.queue.splice(index, 1)[0];
        this.length = this.queue.length;

        return removedValue;
    }

    has(value: T): boolean {
        return this.indexOf(value) >= 0;
    }

    push(value: T): void {
        this.queue.push(value);
        this.length = this.queue.length;
    }

    shift(): T {
        const value = this.queue.shift();
        this.length = this.queue.length;
        return value;
    }

    unshift(value: T): void {
        this.queue.unshift(value);
        this.length = this.queue.length;
    }

    insert(value: T, index: number): void {
        this.queue.splice(Math.min(this.queue.length, index), 0, value);
        this.length = this.queue.length;
    }

    map<R>(callbackFn: (value: T) => R): R[] {
        return this.queue.map(callbackFn);
    }

    concat(...queues: (ComparisonQueue<T> | T[])[]): T[] {
        return this.queue.concat(
            ...queues.map(
                (queue: ComparisonQueue<T> | T[])=>(
                    queue instanceof ComparisonQueue ? queue.queue : queue
                )
            )
        );
    }
}