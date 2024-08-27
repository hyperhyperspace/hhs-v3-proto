import { Store } from "storage";
import { State } from "./state";
import { OpLog } from "./op_log";
import { Hash } from "./crypto";


class Replica {

    store: Store;
    logs: Map<string, OpLog>;

    constructor(store: Store) {
        this.store = store;
        this.logs = new Map();
    }

    attach() {

    }

    add(log: OpLog) {
        this.logs.set(log.id, log);
    }

}

class Item {

}