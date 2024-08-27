import { Hash } from "./crypto";
import { LiteralSet } from "./literal_set";
import * as lset from "./literal_set";
import * as json from "./json";
import { MerkleSearchTree } from "./mst";
import { State, Join, Refs } from "./state";

type Op = {
    target: Hash,
    
    allPrevOps?: Hash,
    prevOps: LiteralSet,

    allStateRefUpdates?: Hash,

    type: string,
    payload: any,
};

type Mutator<S extends State=State, O extends Op=Op> = (s: S, op: O) => Promise<S>;

type Precondition<S extends State=State, O extends Op=Op> = (s: S, op: O, updatedRefs: Refs) => Promise<boolean>;

class OpLog<S extends State = State, O extends Op = Op> {
    
    id: Hash;

    ops: MerkleSearchTree<Hash>;
    last: Set<Hash>;

    state: S;

    mutator: Mutator<S, O>;
    reverseMutator: Mutator<S, O>;
    precondition?: Precondition<S, O>;
    
    join: Join<S>;

    private pendingOpsProcessing?: Promise<void>;

    constructor(target: Hash, ops: MerkleSearchTree<Hash>, last: Set<Hash>, state: S, mutator: Mutator<S, O>, reverseMutator: Mutator<S, O>, precondition: Precondition<S, O>, join: Join<S>) {
        this.id = target;
        
        this.ops = ops;
        this.last = last;

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
    
    applyOp(op: O): Promise<boolean> {
    
        const p = new Promise((resolve: (value: boolean) => void, reject) => {
            if (this.pendingOpsProcessing === undefined) {
                this.pendingOpsProcessing = this.applyOpSerial(op).then(resolve, reject);
            } else {
                this.pendingOpsProcessing = this.pendingOpsProcessing.finally(() => { this.applyOpSerial(op).then(resolve, reject) });
            }
        });
        
        return p;

    }


    private async applyOpSerial(op: O): Promise<boolean> {
        const opHash = await json.hash(op.prevOps)
            
        if (!(await this.ops.has(opHash))) {
            const newLast = new Set(this.last);
    
            for (const prevOpHash of lset.elements(op.prevOps)) {
                newLast.delete(prevOpHash);
            }
    
            newLast.add(opHash);
            const newOps = await this.ops.set(opHash, '');
            const newState = await this.mutator(this.state, op);

            

            this.ops = newOps;
            this.last = newLast;
            this.state = newState;

            return true;
        } else {
            return false;
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