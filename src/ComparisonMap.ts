import {Comparitor} from './util';

export interface InefficientMapEntry<K, V> {
    key: K;
    value: V;
}

export class ComparisonMap<K, V> {
    list: InefficientMapEntry<K, V>[];
    comparitor: Comparitor<K>;

    constructor(comparitor: Comparitor<K>, initial: InefficientMapEntry<K, V>[] = []) {
        this.list = initial;
        this.comparitor = comparitor;
    }

    private indexOf(key: K): number {
        for(let i=0; i<this.list.length; i++) {
            const entry = this.list[i];

            if(this.comparitor(entry.key, key)) {
                return i;
            }
        }

        return -1;
    }

    add(key: K,  value: V): void {
        const index = this.indexOf(key);

        if(index >= 0) {
            this.list[index].value = value;
        } else {
            this.list.push({
                key: key,
                value: value
            });
        }
    }

    remove(key: K): V {
        const index = this.indexOf(key);
        
        if(index < 0) {
            return;
        }

        return this.list.splice(index, 1)[0].value;
    }

    get(key: K, defaultValue: V = undefined): V {
        const index = this.indexOf(key);
        
        return index >= 0 ? this.list[index].value : defaultValue;
    }

    has(key: K): boolean {
        return this.indexOf(key) >= 0;
    }

    getEntries(): InefficientMapEntry<K, V>[] {
        return this.list;
    }

    getKeys(): K[] {
        return this.list.map(entry => entry.key);
    }

    getValues(): V[] {
        return this.list.map(entry => entry.value);
    }
}