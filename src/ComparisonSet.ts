import {Comparitor} from './util';

export class ComparisonSet<T> {
    list: T[];
    comparitor: Comparitor<T>;

    constructor(comparitor: Comparitor<T>, initial: T[] = []) {
        this.list = initial;
        this.comparitor = comparitor;
    }

    private indexOf(value: T): number {
        return this.list.findIndex(testValue=>this.comparitor(value, testValue));
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