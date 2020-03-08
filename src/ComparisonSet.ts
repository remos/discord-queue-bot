interface Comparitor<K> {
    (a: K, b: K): boolean;
}

export class ComparisonSet<T> {
    list: T[];
    comparitor: Comparitor<T>;

    constructor(comparitor: Comparitor<T>, initial: T[] = []) {
        this.list = initial;
        this.comparitor = comparitor;
    }

    private indexOf(value: T): number {
        for(let i=0; i<this.list.length; i++) {
            const entry = this.list[i];

            if(this.comparitor(entry, value)) {
                return i;
            }
        }

        return -1;
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