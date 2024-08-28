import { Hash } from "./crypto";
import { LiteralSet } from "./literal_set";
import * as lset from "./literal_set";
import * as json from "./json";
import { MerkleSearchTree } from "./mst";
import { State, Join, Refs } from "./state";
import { Store } from "storage";
import { MultiMap } from "util/multimap";

type Op = {
    target: Hash,
    
    allPrevOps?: Hash,
    prevOps: LiteralSet,
    
    lastNonForkedOp?: Hash // if this op is a merge (meaning: prevOps has more than one element), 
                           // this is the op where the merged op logs are all merged.

    allStateRefUpdates?: Hash,

    type: string,
    payload: any,
};

type StateRefUpdateOp = Op & {
    refTarget: Hash;
    refOp: Hash;

    lastUnaffectedOp?: Hash; // last op whose precondition was not re-evaluated after this update,
                             // or undefined if no preconditions were re-evaluated.
};

type Mutator= (s: State, op: Op) => Promise<State>;

type Precondition = (s: State, op: Op, updatedRefs: Refs) => Promise<boolean>;

class OpLog {
    
    id: Hash;

    ops: MerkleSearchTree<Hash>;
    last: Set<Hash>;

    stateRefUpdateOps: MerkleSearchTree<Hash>;

    state: State;

    mutator: Mutator;
    reverseMutator: Mutator;
    precondition?: Precondition;
    
    join: Join;

    private pendingOpsProcessing?: Promise<void>;

    constructor(id: Hash, ops: MerkleSearchTree<Hash>, last: Set<Hash>, stateRefUpdateOps: MerkleSearchTree<Hash>, state: State, mutator: Mutator, reverseMutator: Mutator, precondition: Precondition, join: Join) {
        this.id = id;
        
        this.ops = ops;
        this.last = last;

        this.stateRefUpdateOps = stateRefUpdateOps;

        this.state = state;
        this.mutator = mutator;
        this.reverseMutator = reverseMutator;
        this.precondition = precondition;
        this.join = join;

        this.pendingOpsProcessing = undefined;
    }

    async canApplyOp(op: Op): Promise<boolean> {

        if (op.target !== this.id) {
            return false;
        }
    
        for (const hash of lset.elements(op.prevOps)) {
            if (await this.ops.get(hash) === undefined) {
                return false;
            }
        }
    
        return true;
    }
    
    applyOp(op: Op): Promise<boolean> {
    
        const p = new Promise((resolve: (value: boolean) => void, reject) => {
            if (this.pendingOpsProcessing === undefined) {
                this.pendingOpsProcessing = this.applyOpSerial(op).then(resolve, reject);
            } else {
                this.pendingOpsProcessing = this.pendingOpsProcessing.finally(() => { this.applyOpSerial(op).then(resolve, reject) });
            }
        });
        
        return p;

    }


    private async applyOpSerial(op: Op): Promise<boolean> {
        const opHash = await json.hash(op)
            
        if (!(await this.ops.has(opHash))) {
            const newLast = new Set(this.last);
    
            for (const prevOpHash of lset.elements(op.prevOps)) {
                newLast.delete(prevOpHash);
            }
    
            newLast.add(opHash);
            const newOps = await this.ops.set(opHash, '');
            const newState = await this.mutator(this.state, op);

            this.ops.store.save({hash: opHash, literal: op});

            this.ops = newOps;
            this.last = newLast;
            this.state = newState;

            return true;
        } else {
            return false;
        }
    }


    // a simultaed sync op, useful for testing

    async sync(other: OpLog) {

        if (this.id !== other.id) {
            throw new Error("Trying to sync two different op logs: " + this.id + " and " + other.id);
        }

        const opDelta = await this.ops.compare(other.ops);

        await this.importOps(opDelta.onlyOther, other.ops.store);
        await other.importOps(opDelta.onlyThis, this.ops.store);
    }
    
    private async importOps(opHashes: Map<Hash, string>, store: Store) {

        console.log('importing ' + opHashes.size + ' ops')

        const queue: Hash[] = [];

        const missingDeps = new MultiMap<Hash, Hash>();
        const reverseDeps = new MultiMap<Hash, Hash>();

        for (const opHash of opHashes.keys()) {
            const op = (await store.load(opHash))?.literal! as Op;

            const missing = new Set<Hash>();

            for (const prevOpHash of lset.elements(op.prevOps)) {
                if (!(await this.ops.has(prevOpHash))) {
                    missing.add(prevOpHash);
                }
            }

            if (missing.size === 0) {
                queue.push(opHash);
            } else {
                missingDeps.addMany(opHash, missing.values());
                for (const missingDep of missing.values()) {
                    reverseDeps.add(missingDep, opHash);
                }
            }
        }

        while (queue.length > 0) {
            const opHash = queue.pop()!;
            const op = (await store.load(opHash))?.literal! as Op;

            await this.applyOp(op);

            for (const reverseDep of reverseDeps.get(opHash)) {
                missingDeps.delete(reverseDep, opHash);
                if (missingDeps.hasKey(reverseDep)) {
                    queue.push(reverseDep);
                }
            }

            reverseDeps.deleteKey(opHash);
        }
    }


    /*private async mergeRefsAndApply(op: O): Promise<boolean> {
        const refForks = new Map<string, Set<Hash>>();

        for (const hash of lset.elements(op.prevOps)) {
            const op = await 
        }
    }*/
}



export { Op, OpLog, Mutator, Precondition };