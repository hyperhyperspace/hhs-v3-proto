import { Store } from "storage";
import { Hash } from "./crypto"
import { Literal } from "./json";
import * as json from "./json";
import { MerkleSearchTree } from "./mst"

// definitions for MST-based state and state deltas

type State = {[key: string]: MerkleSearchTree<any>};
type StateDelta = {[key: string]: Map<string, any>};

// the refs indicate the state of each of the references for this instance
type StateRefs = { refs: MerkleSearchTree<Hash> };

type DeltaJoin = (state: State, delta: StateDelta) => Promise<State>;
type Join<S extends State=State> = (s1: S, s2: S) => Promise<S>;

type Refs = Map<string, Hash>;

/*async function apply(state: State, delta: StateDelta, join: StateJoin): Promise<State> {

    const result: State = {};

    for (const [key, mst] of Object.entries(state)) {

        const joinFun = join[key];
        let newTree = mst;

        const treeDelta = delta[key];

        if (treeDelta !== undefined) {
            for (const [treeKey, treeVal] of treeDelta.entries()) {
                const newTreeVal = joinFun(treeKey, mst.get(treeKey), treeVal);

                newTree = await newTree.setOrRemove(treeKey, newTreeVal);
            }
        }
        
        result[key] = newTree;
    }

    return result;
}*/

async function toLiteral(s: State): Promise<Literal> {
    let l: Literal = {};

    for (const [name, mst] of Object.entries(s)) {
        l[name] = await mst.getRootHash();
    }

    return l;
}

async function fromLiteral(literal: Literal, store: Store, hashSeed: string): Promise<State> {
    let s: State = {};

    for (const [name, hash] of Object.entries(literal)) {

        const mst = new MerkleSearchTree(store, hashSeed);
        await mst.changeRoot(hash);

        s[name] = mst;
    }

    return s;
}

async function hash(s: State): Promise<Hash> {

    return json.hash(await toLiteral(s));
}

/*
type StateX = {

    headOps: Set<Hash>,         // Ops with no successors
                                // (viewed as a set, a succint signature of current state)

    allOps: MerkleSearchTree,   // The entire state can be recomputed from this set of ops
                                // (plus the referenced states)

    

    validOps: MerkleSearchTree, // Ops whose preconditions are currently satisfied

    stateImportOps: MerkleSearchTree,  // Currently valid state import ops
    stateReferences: MerkleSearchTree, // Current state references

    contents: Map<string, MerkleSearchTree>
}
*/
/*type LiteralState = {
    opsRootHash: Hash,
    abortsRootHash: Hash,
    foreignStateRefsRootHash: Hash,
    contentRootHashes: {[key:string]: Hash}
}*/

export { State, Refs, StateRefs, StateDelta, DeltaJoin, Join };