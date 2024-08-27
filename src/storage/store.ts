import { Hash, b64hash } from "model/crypto";

type Config = {
    hashFunction?: (literal: any) => Promise<Hash>;
}

type Item = { hash: Hash, literal: any, meta: any, indexes: {[key: string]: string}};


abstract class Store {

    constructor(config?: Config) {
        this.hashFunction = config?.hashFunction || b64hash;
    }

    hashFunction: (literal: any) => Promise<Hash>;

    abstract save(item: Partial<Item> & { literal: any}): Promise<void>;
    abstract load(hash: Hash): Promise<Item|undefined>;

    abstract getByIndex(indexName: string, key: string): Promise<any|undefined>;
    abstract getManyByIndex(indexName: string, key: string): IterableIterator<Promise<Item>>;
}
export { Store, Config, Item };