import { Store } from "storage";
import { State } from "./state";
import { OpLog } from "./op_log";
import { Hash } from "./crypto";


class Replica {

    logs: Map<string, OpLog>;

    constructor() {
        this.logs = new Map();
    }

    add(log: OpLog) {
        this.logs.set(log.id, log);
    }

    getLogs(): Map<string, OpLog> {
        return this.logs;
    }

    async syncWith(other: Replica) {
        for (const [id, log] of this.logs.entries()) {
            await other.logs.get(id)!.sync(log);
        }
    }
}

export { Replica };