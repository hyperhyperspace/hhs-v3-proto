import * as json from "model/json";
import * as crypto from "model/crypto";
import * as lset from "model/literal_set";
import { LiteralSet } from "model/literal_set";

import { MerkleSearchTree } from "model/mst";
import { Op, OpLog } from "model/op_log";
import { MemoryStore, Store } from "storage";
import { Refs } from "model/state";

type Token = string;
const tokenSeedLength = 128 / 8;

type SetState = {
    insertTokensByElement: MerkleSearchTree<LiteralSet>,
    removeTokensByInsertToken: MerkleSearchTree<LiteralSet>
};

type SetOpLog = OpLog<SetState, SetOp>;

async function join(s1: SetState, s2: SetState): Promise<SetState> {

    return {
        insertTokensByElement: 
            await MerkleSearchTree.multimapUnion(s1.insertTokensByElement, 
                                                 s2.insertTokensByElement),

        removeTokensByInsertToken: 
            await MerkleSearchTree.multimapUnion(s1.removeTokensByInsertToken, 
                                                s2.removeTokensByInsertToken)
    };
}

type AddOp = Op & { type: 'add', payload: {element: string, tokenSeed: string }};

type RemoveOp = Op & { type: 'remove', payload: { element: string, tokenSeed: string, tokens: LiteralSet }};

type SetOp = AddOp | RemoveOp;

function emptyState(store: Store, hashSeed: string): SetState {
    return {
        insertTokensByElement: new MerkleSearchTree(store, hashSeed),
        removeTokensByInsertToken: new MerkleSearchTree(store, hashSeed)
    }
}

async function createAddOp(log: SetOpLog, element: string): Promise<AddOp> {
    return {
        target: log.id,
        
        allPrevOps: log.ops.rootHash,
        prevOps: lset.make(log.last.values()),
        
        type: 'add',
        payload: {element: element, tokenSeed: crypto.b64random(tokenSeedLength)},
    }
}

async function createRemoveOp(log: SetOpLog, element: string): Promise<RemoveOp|undefined> {
    const state = log.state as SetState;

    const tokens = await state.insertTokensByElement.get(element);

    if (tokens === undefined) {
       return undefined;
    }

    const toRemove = new Set<string>();

    for (const token of lset.elements(tokens)) {
        if (!(await state.removeTokensByInsertToken.has(token))) {
            toRemove.add(token);
        }
    }

    if (toRemove.size === 0) {
        return undefined;
    }

    return {
        target: log.id,

        allPrevOps: log.ops.rootHash,
        prevOps: lset.make(log.last.values()),
        
        type: 'remove',
        payload: { 
            element: element,
            tokenSeed: crypto.b64random(tokenSeedLength),
            tokens: lset.make(toRemove.values())
        }
    }
}

async function applySetOp(state: SetState, op: SetOp): Promise<SetState> {
    
    const type = op.type;
    
    if (type === 'add') {
        return applyAddOp(state, op);
    } else if (type === 'remove') {
        return applyRemoveOp(state, op);
    }

    throw new Error('Unexpected op type for Set: "' + type + '"');
}

async function applyAddOp(state: SetState, op: AddOp): Promise<SetState> {
    
    const currentTokens = await state.insertTokensByElement.get(op.payload.element);
    const modifiedTokens = currentTokens === undefined? lset.create() : lset.copy(currentTokens);
    
    const newToken = await createToken(op.payload.tokenSeed, op.payload.element, op.prevOps);
    
    lset.add(modifiedTokens, newToken);
    
    return {
        insertTokensByElement: await state.insertTokensByElement.set(op.payload.element, modifiedTokens),
        removeTokensByInsertToken: state.removeTokensByInsertToken
    };
}

async function applyRemoveOp(state: SetState, op: RemoveOp): Promise<SetState> {
    
    let removedTokens = state.removeTokensByInsertToken;

    const newToken = await createToken(op.payload.tokenSeed, op.payload.element, op.prevOps, op.payload.tokens);

    for (const token of lset.elements(op.payload.tokens)) {
        const currentTokens = await state.removeTokensByInsertToken.get(token)
        const modifiedTokens = currentTokens === undefined? lset.create() : lset.copy(currentTokens);
        lset.add(modifiedTokens, newToken);
        removedTokens = await removedTokens.set(token, modifiedTokens);
    }

    return {
        insertTokensByElement: state.insertTokensByElement,
        removeTokensByInsertToken: removedTokens
    }
}

async function reverseSetOp(state: SetState, op: SetOp): Promise<SetState> {

    const type = op.type;
    
    if (type === 'add') {
        return reverseAddOp(state, op);
    } else if (type === 'remove') {
        return reverseRemoveOp(state, op);
    }

    throw new Error('Unexpected op type for Set: "' + type + '"');
    
}

async function reverseAddOp(state: SetState, op: AddOp): Promise<SetState> {
    const currentTokens = await state.insertTokensByElement.get(op.payload.element);
        
    if (currentTokens === undefined) {
        throw new Error("Cannot reverse AddOp " + json.hash(op) + ", its token is not present in insertTokensByElement with root " + state.insertTokensByElement.rootHash);
    }

    const newToken = await createToken(op.payload.tokenSeed, op.payload.element, op.prevOps);
    
    let modifiedTokens: LiteralSet|undefined = lset.copy(currentTokens);

    lset.remove(modifiedTokens, newToken);

    if (lset.isEmpty(modifiedTokens)) {
        modifiedTokens = undefined;
    }
    
    return {
        insertTokensByElement: await state.insertTokensByElement.setOrRemove(op.payload.element, modifiedTokens),
        removeTokensByInsertToken: state.removeTokensByInsertToken
    };
}

async function reverseRemoveOp(state: SetState, op: RemoveOp): Promise<SetState> {
    let removedTokens = state.removeTokensByInsertToken;

    const newToken = await createToken(op.payload.tokenSeed, op.payload.element, op.prevOps, op.payload.tokens);

    for (const token of lset.elements(op.payload.tokens)) {
        const currentTokens = await state.removeTokensByInsertToken.get(token);
        
        if (currentTokens === undefined) {
            throw new Error("Cannot reverse RemoveOp " + json.hash(op) + ", its token is not present in removeTokensByInsertToken with root " + state.removeTokensByInsertToken.rootHash + " for insert token " + token)
        }
        
        let modifiedTokens: LiteralSet|undefined = lset.copy(currentTokens);
        lset.remove(modifiedTokens, newToken);

        if (lset.isEmpty(modifiedTokens)) {
            modifiedTokens = undefined;
        }

        removedTokens = await removedTokens.setOrRemove(token, modifiedTokens);
    }

    return {
        insertTokensByElement: state.insertTokensByElement,
        removeTokensByInsertToken: removedTokens
    }
}

async function precondition(state: SetState, op: SetOp, updatedRefs?: Refs): Promise<boolean> {
    return true;
}

async function has(element: string, state: SetState) {
    const tokens = await state.insertTokensByElement.get(element);

    if (tokens !== undefined) {
        for (const token of lset.elements(tokens)) {
            if (!(await state.removeTokensByInsertToken.has(token))) {
                return true;
            }
        }
    }

    return false;
}

async function createToken(seed: string, element: string, prevOps: LiteralSet, removedTokens?: LiteralSet) {
    const seedBytes = crypto.b64ToArray(seed);
    const elementHash = await crypto.hash(element);
    const prevOpsHash = await crypto.hash(json.serialize(prevOps));
    const removedTokensHash = removedTokens === undefined? undefined : await crypto.hash(json.serialize(removedTokens));

    const totalLength = seedBytes.byteLength + elementHash.byteLength + prevOpsHash.byteLength + (removedTokensHash?.byteLength || 0);

    var tmp = new Uint8Array(totalLength);
    let counter = 0;
    
    tmp.set(new Uint8Array(seedBytes), counter);
    counter = counter + seedBytes.byteLength;

    tmp.set(new Uint8Array(elementHash), counter);
    counter = counter + elementHash.byteLength;

    tmp.set(new Uint8Array(prevOpsHash), counter);

    if (removedTokensHash !== undefined) {
        counter = counter + prevOpsHash.byteLength;
        tmp.set(new Uint8Array(removedTokensHash), counter);
    }

    return crypto.b64((await crypto.hashUint8Array(tmp)));
}

type ReplicatedSetConfig = {
    store?: Store,
    hashSeed?: string // if present, should be a b64-encoded string
}

class ReplicatedSetView {

    state: SetState;

    constructor(state: SetState) {
        this.state = state;
    }

    async has(element: string): Promise<Boolean> {
        return has(element, this.state);
    }
}

class ReplicatedSet {

    log: OpLog<SetState, SetOp>;

    constructor(config?: ReplicatedSetConfig) {

        const store: Store = config?.store || new MemoryStore();
        const hashSeed: string = config?.hashSeed || crypto.b64random(8);

        this.log = new OpLog(
                crypto.b64random(8),
                new MerkleSearchTree(store, hashSeed), 
                new Set(), 
                emptyState(store, hashSeed), 
                applySetOp,
                reverseSetOp,
                precondition,
                join);
    }

    async has(element: string) {
        return has(element, this.log.state);
    }

    async add(element: string) {

        const addOp = await createAddOp(this.log, element);

        await this.log.applyOp(addOp);
    }

    async remove(element: string) {

        const removeOp = await createRemoveOp(this.log, element);

        if (removeOp !== undefined) {
            await this.log.applyOp(removeOp);
        }
    }

}

export { ReplicatedSet, ReplicatedSetView, SetState };