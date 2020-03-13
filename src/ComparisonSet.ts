import {Comparator} from './util';

export class ComparisonSet<T> {
    list: T[];
    comparator: Comparator<T>;

    constructor(comparator: Comparator<T>, initial: T[] = []) {
        this.list = initial;
        this.comparator = comparator;
    }

    private indexOf(value: T): number {
        return this.list.findIndex(testValue=>this.comparator(value, testValue));
    }

    add(value: T): void {
        const index = this.indexOf(value);

        if(index >= 0) {
            return;
        }

        this.list.push(value);
    }

    remove(value: T): T {
        const index = this.indexOf(value);
        
        if(index < 0) {
            return;
        }

        return this.list.splice(index, 1)[0];
    }

    has(value: T): boolean {
        return this.indexOf(value) >= 0;
    }

    get(): T[] {
        return this.list;
    }
}