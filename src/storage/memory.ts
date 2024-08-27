import { Hash } from "model/crypto";
import { serialize } from "model/json";
import { Store, Config, Item } from "./store";
import * as iter from "util/iterators";

class MemoryStore extends Store {

    constructor(config?: Config) {
        super(config);

        this.items = new Map();
        this.indexes = new Map();
    }

    items: Map<Hash, Item>;
    indexes: Map<string, Map<string, Set<Hash>>>;

    async save(item: Partial<Item> & { literal: any; }): Promise<void> {
        
        const saved: Item = {
                                hash: item.hash || (await this.hashFunction(serialize(item.literal))),
                                literal: item.literal,
                                meta: item.meta || {},
                                indexes: item.indexes || {}
                            };
        
        Object.freeze(saved);

        this.items.set(saved.hash, saved);

        item.hash = item.hash || saved.hash;
        item.meta = item.meta || {};
        item.indexes = item.indexes || {};

        for (const [indexName, indexKey] of Object.entries(item.indexes)) {
            
            let idx = this.indexes.get(indexName);
            if (idx === undefined) {
                idx = new Map();
                this.indexes.set(indexName, idx);
            }

            let indexValues = idx.get(indexKey);
            if (indexValues === undefined) {
                indexValues = new Set();
                idx.set(indexKey, indexValues);
            }

            indexValues.add(item.hash);
        }
    }

    async load(hash: string): Promise<Item|undefined> {

        return this.items.get(hash);
    }

    async getByIndex(indexName: string, key: string): Promise<Item|undefined> {
        let values = this.indexes.get(indexName)?.get(key);

        if (values === undefined) {
            return undefined;
        } else {
            return this.load(values.values().next().value);
        }
    }

    getManyByIndex(indexName: string, key: string): IterableIterator<Promise<Item>> {
        let values = this.indexes.get(indexName)?.get(key);

        if (values === undefined) {
            return iter.map(new Set<Item>().values(), (item: Item) => Promise.resolve(item));
        } else {
            return iter.map(values.values(), async (hash: Hash) => (await this.load(hash))!);
        }
    }
    
}

export { MemoryStore };