import { Hash } from "model/crypto";
import { Item, Store } from "./store";


class StoreDelta extends Store {

    save(item: Partial<Item> & { literal: any; }): Promise<void> {
        throw new Error("Method not implemented.");
    }

    load(hash: Hash): Promise<Item | undefined> {
        throw new Error("Method not implemented.");
    }

    getByIndex(indexName: string, key: string): Promise<any | undefined> {
        throw new Error("Method not implemented.");
    }
    
    getManyByIndex(indexName: string, key: string): IterableIterator<Promise<Item>> {
        throw new Error("Method not implemented.");
    }
}