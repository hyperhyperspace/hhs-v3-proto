import { hash, Hash } from "./crypto";
import { Store, StoredItem } from "storage";
import { LiteralSet } from "./literal_set"
import * as lset from "./literal_set";

// https://inria.hal.science/hal-02303490/document

// a node looks like
// child_0 | key_0 | child_1 | key_1 | ... | child_n | key_n | child_n+1

// hence children.length + 1 == keys.length

// key_0 < key_1 < ... < key_n

// for all keys k in child_i:   key_i-1 < k < key_i

// values are optional, if present, values.length == keys.length

// by convention, an empty node has level 0

type Node<V> = { keys: Array<string>, values: Array<V>, children: Array<Hash>, childrenKeyCounts: Array<number>, keyCount: number };
type NodeMeta = { level: number };

type Delta<V> = {
    onlyThis: Map<string, V>, // removed
    modified: Map<string, V>, // changed values
    onlyOther: Map<string, V> // added
};

type LevelPosition = {
    this: number,
    other: number
};

type HashedNode<V> = {
    hash: Hash,
    node: Node<V>
};

type LevelQueue<V> = Array<HashedNode<V>>;
type TreeQueue<V> = Array<LevelQueue<V>>;
type TreePositions = Array<LevelPosition>;

class MerkleSearchTree<V> {

    store: Store;
    hashSeed: string;

    rootHash?: Hash;
    rootLevel?: number;

    constructor(store: Store, hashSeed: string) {
        this.store = store;
        this.hashSeed = hashSeed;

        // Correct thing would be to create an empty root node, but that's async and we 
        // can't do it here without leaving a promise hangling somewhere.

        // So by convention if rootHash / rootLevel are missing, the thing is empty.
    }

    async getRootHash(): Promise<Hash> {

        if (this.rootHash === undefined) {
            const empty: Node<V> = {
                keys: [],
                values: [],
                children: [],
                childrenKeyCounts: [],
                keyCount: 0
            }

            this.rootHash = await this.saveNode(empty, 0);
            this.rootLevel = 0;
        }

        return this.rootHash;
    }

    async changeRoot(rootHash: Hash) {
        const rootItem = await this.store.load(rootHash);

        if (rootItem === undefined) {
            throw new Error("Can't change root to " + rootHash + ": it is not present in the store.");
        }

        this.rootHash = rootHash;
        this.rootLevel = rootItem.meta.level;
    }

    async get(key: string): Promise<V|undefined> {

        let nextHash = this.rootHash;
        let value: V|undefined = undefined;

        while (nextHash != undefined) {
            const node = await this.loadNode(nextHash);
            
            if (node === undefined) {
                throw new Error('Retrieving ' + key + ': node w/hash ' + nextHash + ' is missing from store.');
            }

            nextHash = undefined;

            /*let i = 0;

            while (i < node.keys.length && key > node.keys[i]) {
                i++;
            }*/

            let i = MerkleSearchTree.search(key, node.keys);

            if (i === node.keys.length || key < node.keys[i]) {
                if (node.children.length > 0) {
                    nextHash = node.children[i];
                }
            } else {
                value = node.values[i];
            }
        }

        return value;
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== undefined;
    }

    private static search(key: string, keys: string[]): number {
        let step = Math.max(Math.floor(keys.length / 2), 1);
        
        let i = 0;

        while (i<keys.length && key > keys[i]) {
            
            if ((i+step < keys.length && key > keys[i+step]) || step === 1) {
                i = i+step;
            } else {
                step = Math.max(Math.floor(step / 2), 1);
            }
        }

        return i;
    }

    async at(idx: number): Promise<[string,V]|undefined> {

        if (this.rootHash === undefined || idx < 0) {
            return undefined;
        } else {
            const root = (await this.loadNode(this.rootHash))!;

            if (idx >= root.keyCount) {
                return undefined;
            } else {
                return this.subtreeAt(root, idx);
            }
        }
    }

    async subtreeAt(node: Node<V>, idx: number): Promise<[string, V]> {
        
        if (node.children.length === 0) {
            return [node.keys[idx], node.values[idx]];
        } else {
            let currIdx = 0;
            for (let i=0; i<node.childrenKeyCounts.length-1; i++) {
                if (idx === currIdx + node.childrenKeyCounts[i]) {
                    return [node.keys[i], node.values[i]]
                } else if (idx < currIdx + node.childrenKeyCounts[i]) {
                    const child = (await this.loadNode(node.children[i]))!;
                    return this.subtreeAt(child, idx-currIdx);
                }

                currIdx = currIdx + node.childrenKeyCounts[i] + 1;
            }

            const lastChild = (await this.loadNode(node.children[node.children.length-1]))!;
            return this.subtreeAt(lastChild, idx-currIdx);
        }
    }

    async remove(key: string): Promise<MerkleSearchTree<V>> {
        return this.setOrRemove(key, undefined);
    }

    async set(key: string, value: V): Promise<MerkleSearchTree<V>> {
        return this.setOrRemove(key, value);
    }

    async setOrRemove(key: string, value?: V): Promise<MerkleSearchTree<V>> {

        const mst = new MerkleSearchTree<V>(this.store, this.hashSeed);
        const keyLevel = await MerkleSearchTree.level(key, this.hashSeed);

        if (this.rootHash === undefined) {
            if (value !== undefined) {
               await mst.setFirstKey(key, value, keyLevel);
            }
        } else {
            const oldRoot = await this.loadNode(this.rootHash);

            if (oldRoot === undefined) {
                throw new Error('Setting ' + key + ': root w/hash ' + this.rootHash + ' is missing from store.');
            }
            
            const newRoot = await this.updateTree(oldRoot, this.rootLevel!, true, key, keyLevel, value); 

            mst.rootHash = newRoot.hash;
            mst.rootLevel = newRoot.level;
        }

        return mst;
    }

    private async setFirstKey(key: string, value: V, keyLevel: number) {
        const children = [];
        const childrenKeyCounts = [];
        if (keyLevel > 0) {
            let child: Node<V> = {
                keys: [],
                values: [],
                children: [],
                childrenKeyCounts: [],
                keyCount: 0
            };

            let childLevel = 0;
            let childHash = await this.saveNode(child, childLevel);

            while (childLevel < keyLevel-1) {
                child = {
                    keys: [],
                    values: [],
                    children: [childHash],
                    childrenKeyCounts: [],
                    keyCount: 0
                };

                childLevel = childLevel+1
                childHash = await this.saveNode(child, childLevel);
            }

            children.push(childHash);
            children.push(childHash);

            childrenKeyCounts.push(0);
            childrenKeyCounts.push(0);
        }

        const root: Node<V> = {
            keys: [key],
            values: [value],
            children: children,
            childrenKeyCounts: childrenKeyCounts,
            keyCount: 1
        }

        this.rootHash = await this.saveNode(root, keyLevel);
        this.rootLevel = keyLevel;
    }

    private async updateTree(node: Node<V>, nodeLevel: number, isRoot: boolean, key: string, keyLevel: number, value?: V): Promise<{hash: Hash, level: number, keyCount: number}> {

        if (nodeLevel > keyLevel) {
            let i = MerkleSearchTree.search(key, node.keys);
            
            const childHash = node.children[i];
            const child = await this.loadNode(childHash);

            if (child === undefined) {
                throw new Error('Setting ' + key + ': child node w/hash ' + childHash + ' is missing from store.');
            }
            
            const updateResult = await this.updateTree(child, nodeLevel-1, false, key, keyLevel, value);

            const children = node.children.slice();
            children[i] = updateResult.hash;
            const childrenKeyCounts = node.childrenKeyCounts.slice();
            childrenKeyCounts[i] = updateResult.keyCount;

            const newNode: Node<V> = {
                keys: node.keys,
                values: node.values,
                children: children,
                childrenKeyCounts: childrenKeyCounts,
                keyCount: node.keyCount - child.keyCount + updateResult.keyCount
            };

            return {
                hash: await this.saveNode(newNode, nodeLevel),
                level: nodeLevel, 
                keyCount: newNode.keyCount
            };

        } else if (nodeLevel === keyLevel) {
            let i = MerkleSearchTree.search(key, node.keys);

            const keys = node.keys.slice();
            const values = node.values.slice();
            const children = node.children.slice();
            const childrenKeyCounts = node.childrenKeyCounts.slice();
            let keyCount = node.keyCount;
            

            if (key === node.keys[i]) {
                if (value !== undefined) {
                    values[i] = value;
                } else {

                    keys.splice(i, 1);
                    values.splice(i, 1);

                    keyCount = keyCount - 1;

                    if (nodeLevel > 0) {

                        const mergedChild = await this.mergeNodes(node.children[i], node.children[i+1], nodeLevel-1, isRoot);

                        // If we "merge away" the root node (by removing its only key), the new root should be the first descendent
                        // that actually has a key

                        if (isRoot && keys.length === 0) {
                            return { 
                                hash: mergedChild.hash,
                                level: mergedChild.level,
                                keyCount: mergedChild.keyCount
                            };
                        }

                        children.splice(i, 2, mergedChild.hash);
                        childrenKeyCounts.splice(i, 2, mergedChild.keyCount);
                    }
                }
                
            } else {
                if (value !== undefined) { // otherwise, we're removing the value of a key not present in this MST, so do nothing
                    keys.splice(i, 0, key);
                    values.splice(i, 0, value);

                    keyCount = keyCount + 1;

                    if (node.children.length > 0) {

                        const oldChildHash = node.children[i];
                        const oldChild = await this.loadNode(oldChildHash);

                        if (oldChild === undefined) {
                            throw new Error('Setting ' + key + ': child node w/hash ' + oldChildHash + ' is missing from store.');
                        }

                        const splitResult = await this.splitNode(oldChild, key, nodeLevel-1);

                        children.splice(i, 1, splitResult.leftHash, splitResult.rightHash);
                        childrenKeyCounts.splice(i, 1, splitResult.leftKeyCount, splitResult.rightKeyCount);
                    }
                }
            }

            const newNode: Node<V> = {
                keys: keys,
                values: values,
                children: children,
                childrenKeyCounts: childrenKeyCounts,
                keyCount: keyCount
            };

            return {hash: await this.saveNode(newNode, nodeLevel), level: nodeLevel, keyCount: newNode.keyCount};
            
        } else { // nodeLevel < keyLevel

            if (value !== undefined) {
                let splitResult = await this.splitNode(node, key, nodeLevel);

                while (nodeLevel < keyLevel-1) {
                    const leftNode: Node<V> = {
                        keys: [],
                        values: [],
                        children: [splitResult.leftHash],
                        childrenKeyCounts: [splitResult.leftKeyCount],
                        keyCount: splitResult.leftKeyCount
                    };
    
                    splitResult.leftHash = await this.saveNode(leftNode, nodeLevel);
    
                    const rightNode: Node<V> = {
                        keys: [],
                        values: [],
                        children: [splitResult.rightHash],
                        childrenKeyCounts: [splitResult.rightKeyCount],
                        keyCount: splitResult.rightKeyCount
                    }
    
                    splitResult.rightHash = await this.saveNode(rightNode, nodeLevel);
    
                    nodeLevel = nodeLevel + 1;
                }
    
                const newNode: Node<V> = {
                    keys: [key],
                    values: [value],
                    children: [splitResult.leftHash, splitResult.rightHash],
                    childrenKeyCounts: [splitResult.leftKeyCount, splitResult.rightKeyCount],
                    keyCount: node.keyCount + 1
                }
    
                return {hash: await this.saveNode(newNode, keyLevel), level: keyLevel, keyCount: newNode.keyCount};
            } else {
                return { hash: await this.saveNode(node, nodeLevel), level: nodeLevel, keyCount: node.keyCount};
            }
            
        }

    }

    private async splitNode(node: Node<V>, key: string, level: number): Promise<{leftHash: Hash, leftKeyCount: number, rightHash: Hash, rightKeyCount: number}> {
        const i = MerkleSearchTree.search(key, node.keys);

        if (key === node.keys[i]) {
            throw new Error('Attempting to split a node, but key is present');
        }

        const leftChildren: Hash[] = [];
        const rightChildren: Hash[] = [];

        const leftChildrenKeyCounts: number[] = [];
        const rightChildrenKeyCounts: number[] = [];

        let leftKeyCount = i;
        let rightKeyCount = node.keys.length - i;

        if (node.children.length > 0) {
            const childToSplitHash = node.children[i];
            const childToSplit = await this.loadNode(childToSplitHash);

            if (childToSplit === undefined) {
                throw new Error('Setting ' + key + ': child to split w/hash ' + childToSplitHash + ' is missing from store.');
            }

            const splitResult = await this.splitNode(childToSplit, key, level-1);

            
            for (let j=0; j<node.children.length; j++) {
                if (j<i) {
                    leftChildren.push(node.children[j]);
                    leftChildrenKeyCounts.push(node.childrenKeyCounts[j])
                    leftKeyCount = leftKeyCount + node.childrenKeyCounts[j];
                } else if (j===i) {
                    leftChildren.push(splitResult.leftHash);
                    leftChildrenKeyCounts.push(splitResult.leftKeyCount);
                    leftKeyCount = leftKeyCount + splitResult.leftKeyCount;
                    rightChildren.push(splitResult.rightHash);
                    rightChildrenKeyCounts.push(splitResult.rightKeyCount);
                    rightKeyCount = rightKeyCount + splitResult.rightKeyCount;
                } else { // j>i
                    rightChildren.push(node.children[j]);
                    rightChildrenKeyCounts.push(node.childrenKeyCounts[j])
                    rightKeyCount = rightKeyCount + node.childrenKeyCounts[j];
                }
            }
            
            
        }

        const newLeft: Node<V> = {
            keys: node.keys.slice(0, i),
            values: node.values.slice(0, i),
            children: leftChildren,
            childrenKeyCounts: leftChildrenKeyCounts,
            keyCount: leftKeyCount
        }

        const newLeftHash = await this.saveNode(newLeft, level);

        const newRight: Node<V> = {
            keys: node.keys.slice(i, node.keys.length),
            values: node.values.slice(i, node.values.length),
            children: rightChildren,
            childrenKeyCounts: rightChildrenKeyCounts,
            keyCount: rightKeyCount
        }

        const newRightHash = await this.saveNode(newRight, level);

        return {
            leftHash: newLeftHash,
            leftKeyCount: leftKeyCount,
            rightHash: newRightHash,
            rightKeyCount: rightKeyCount
        };
    }

    private async mergeNodes(leftHash: Hash, rightHash: Hash, level: number, skipEmpty: boolean): Promise<{hash: Hash, level: number, keyCount: number}> {
        
        const left = await this.loadNode(leftHash);
        const right = await this.loadNode(rightHash);

        if (left === undefined) {
            throw new Error('Left child to be merged w/hash ' + leftHash + ' is missing from store.');
        }

        if (right === undefined) {
            throw new Error('Right child to be merged w/hash ' + rightHash + ' is missing from store.');
        }

        const keys = left.keys.concat(right.keys);
        const values = left.values.concat(right.values);
        let children: Hash[] = [];
        let childrenKeyCounts: number[] = [];
        const keyCount = left.keyCount + right.keyCount;

        if (level > 0) {
            const lastLeftChildHash = left.children[left.children.length-1];
            const firstRightChildHash = right.children[0];

            const mergeResult = await this.mergeNodes(lastLeftChildHash, firstRightChildHash, level-1, skipEmpty && keys.length === 0);
            
            children = left.children.slice(0, left.children.length-1).concat([mergeResult.hash], right.children.slice(1, right.children.length));
            childrenKeyCounts = left.childrenKeyCounts.slice(0, left.children.length-1).concat([mergeResult.keyCount], right.childrenKeyCounts.slice(1, right.children.length));
        }

        let node: Node<V> = {
            keys: keys,
            values: values,
            children: children,
            childrenKeyCounts: childrenKeyCounts,
            keyCount: keyCount
        }

        if (skipEmpty && node.keys.length === 0 && level > 0) {
            let lastHash: Hash;
            while (node.keys.length === 0 && level > 0) {
                lastHash = node.children[0]
                level = level - 1;
                
                node = (await this.loadNode(lastHash))!
            }

            return {hash: lastHash!, level: level-1, keyCount: keyCount};
        } else {
            return {hash: await this.saveNode(node, level), level: level, keyCount: keyCount};
        }
        
    }

    async isEmpty(): Promise<boolean> {
        if (this.rootHash === undefined) {
            return true;
        } else {
            const root = await this.loadNode(this.rootHash);
            
            if (root === undefined) {
                throw new Error("The root is missing, its hash is " + this.rootHash);
            }

            return root.keys.length === 0 && root.children.length === 0;
        }
    }

    async size(): Promise<number> {
        if (this.rootHash === undefined) {
            return 0;
        } else {
            const root = await this.loadNode(this.rootHash);
            
            if (root === undefined) {
                throw new Error("The root is missing, its hash is " + this.rootHash);
            }

            return root.keyCount;
        }

    }

    public static async fromMap<V>(map: Map<string, V>, store: Store, hashSeed: string): Promise<MerkleSearchTree<V>> {
        const mst = new MerkleSearchTree<V>(store, hashSeed);

        const levels = new Map<number, Array<[string, V]>>();
        let maxLevel = 0;

        for (const [key, val] of map.entries()) {
            const level = await MerkleSearchTree.level(key, hashSeed);

            if (level>maxLevel) {
                maxLevel = level;
            }

            let a = levels.get(level);
            if (a == undefined) {
                a = [];
                levels.set(level, a);
            }
            a.push([key, val]);
        }

        for (const arr of levels.values()) {
            arr.sort(MerkleSearchTree.entryCompare);
        }

        mst.rootHash = (await mst.sliceTree(maxLevel, levels, new Map(), undefined, undefined)).hash;
        mst.rootLevel = maxLevel;

        return mst;
    }

    private async sliceTree(level: number, levels: Map<number, Array<[string, V]>>, entryStartingPos?: Map<number, number>, left?: string, right?: string): Promise<{hash: Hash, keyCount: number}> {

        const allEntries: [string, V][] = levels.get(level) || [];
        const entries: [string, V][] = [];
        const children: Hash[] = [];
        const childrenKeyCounts: number[] = [];

        let startPos = entryStartingPos?.get(level) || 0;

        const keys: string[] = []
        const values: V[] = [];

        let i = startPos;

        while (i  < allEntries.length &&
               (left === undefined || left < allEntries[i][0]) &&
               (right === undefined || allEntries[i][0] < right)) {
                keys.push(allEntries[i][0]);
                values.push(allEntries[i][1]);
                i++;
        }

        const endPos = i;
        entryStartingPos?.set(level, endPos);
        
        let keyCount = 0;

        if (level > 0) {
            let prevKey: string|undefined = left;
            for (let i=startPos; i<endPos; i++) {
                const key = allEntries[i][0]
                const child = await this.sliceTree(level-1, levels, entryStartingPos, prevKey, key);
                children.push(child.hash);
                childrenKeyCounts.push(child.keyCount);
                keyCount += child.keyCount;
                prevKey = key;
            }
            const lastChild = await this.sliceTree(level-1, levels, entryStartingPos, prevKey, right)
            children.push(lastChild.hash);
            childrenKeyCounts.push(lastChild.keyCount);
            keyCount += lastChild.keyCount;
        }

        for (const entry of entries) {
            keys.push(entry[0]);
            values.push(entry[1]);
        }

        keyCount += keys.length;

        const node: Node<V> = { 
            keys: keys,
            values: values,
            children: children,
            childrenKeyCounts: childrenKeyCounts,
            keyCount: keyCount
        };
        
        return {hash: await this.saveNode(node, level), keyCount: keyCount};
        
    }

    public async toMap(): Promise<Map<string, V>> {
        const map: Map<string, V> = new Map();

        if (this.rootHash != undefined) {
            await this.addTree(this.rootHash, map);
        }

        return map;
    }

    private async addTree(nodeHash: Hash, map: Map<string, V>) {

        const node = await this.loadNode(nodeHash);

        if (node === undefined) {
            throw new Error('Encountered node missing from store while creating map for MST, hash=' + nodeHash);
        }

        for (let i=0; i<node.keys.length; i++) {
            if (i < node.children.length) {
                await this.addTree(node.children[i], map);
            }
            map.set(node.keys[i], node.values[i]);
        }

        if (node.keys.length < node.children.length) { // true except level is 0
            await this.addTree(node.children[node.keys.length], map)
        }
    }

    public async compare(other: MerkleSearchTree<V>): Promise<Delta<V>> {

        if (this.hashSeed !== other.hashSeed) {
            // there's probably nothing better than iterating over both trees anyway, so:
            throw new Error('Comparing two MerkleSearchTrees with different hash seeds is not supported ATM.');
        }

        const delta: Delta<V> = {
            onlyThis: new Map(),
            modified: new Map(),
            onlyOther: new Map()
        }

        if (this.rootLevel === undefined && other.rootLevel === undefined) {
            // ok, both empty, delta should be empty
        } else if (this.rootLevel === undefined) {
            delta.onlyOther = await other.toMap();
        } else if (other.rootLevel === undefined) {
            delta.onlyThis = await this.toMap();
        } else {
            let maxLevel = Math.max(this.rootLevel, other.rootLevel);

            const thisQueues: TreeQueue<V> = new Array(maxLevel+1);
            const otherQueues: TreeQueue<V> = new Array(maxLevel+1);
            
            const positions: TreePositions = new Array(maxLevel+1);

            for (let i=0; i<=maxLevel; i++) {
                thisQueues[i] = [];
                otherQueues[i] = [];
                positions[i] = {this: 0, other: 0};
            }

            thisQueues[this.rootLevel].push({hash: this.rootHash!, node: (await this.loadNode(this.rootHash!))!});
            otherQueues[other.rootLevel].push({hash: other.rootHash!, node: (await other.loadNode(other.rootHash!))!});

            let level = maxLevel;

            while (thisQueues[maxLevel].length > 0 || otherQueues[maxLevel].length > 0) {

                const thisQueue = thisQueues[level];
                const otherQueue = otherQueues[level];
                const position = positions[level];
                
                if (thisQueue.length === 0 && otherQueue.length === 0) {
                    level = level + 1;
                } else if (thisQueue.length === 0) {
                    
                    if (level === maxLevel) {
                        const children = level>0 ? otherQueues[level-1] : undefined;
                        const next = otherQueue.shift()!;
                        await MerkleSearchTree.collectUnmatchedNode(other, next.node, position.other, delta.onlyOther, children);
                        position.other = 0;
                        if (otherQueue.length === 0 && maxLevel > 0) {
                            maxLevel = maxLevel - 1;
                        }

                        if (level > 0) {
                            level = level - 1;
                        }
                    } else {
                        level = level + 1;
                    }
                    
                } else if (otherQueue.length === 0) {
                    
                    if (level === maxLevel) {
                        const children = level>0 ? thisQueues[level-1] : undefined;
                        const next = thisQueue.shift()!;
                        await MerkleSearchTree.collectUnmatchedNode(this, next.node, position.this, delta.onlyThis, children);
                        position.this = 0;
                        if (thisQueue.length === 0 && maxLevel > 0) {
                            maxLevel = maxLevel - 1;
                        }

                        if (level > 0) {
                            level = level - 1;
                        } 
                    } else {
                        level = level + 1;
                    }

                } else {
                    const nextThis = thisQueue.shift()!;
                    const nextOther = otherQueue.shift()!;

                    const childrenThisQueue = level > 0? thisQueues[level-1] : undefined;
                    const childrenOtherQueue = level > 0? otherQueues[level-1] : undefined;

                    await this.collectAndMerge(delta, other, nextThis, nextOther, positions[level], childrenThisQueue, childrenOtherQueue);

                    if (positions[level].this < nextThis.node.keys.length) {
                        thisQueue.unshift(nextThis);
                    } else {
                        positions[level].this = 0;
                    }

                    if (positions[level].other < nextOther.node.keys.length) {
                        otherQueue.unshift(nextOther);
                    } else {
                        positions[level].other = 0;
                    }

                    if (level > 0 && level === maxLevel && thisQueue.length === 0 && otherQueue.length === 0) {
                        maxLevel = maxLevel - 1;
                        level = level - 1;
                    }
                }
            }
        }

        return delta;
    }

    private async collectAndMerge(delta: Delta<V>, other: MerkleSearchTree<V>, nextThis: HashedNode<V>, nextOther: HashedNode<V>, position: LevelPosition, childrenThis?: LevelQueue<V>, childrenOther?: LevelQueue<V>) {


        const thisNode = nextThis.node;
        const otherNode = nextOther.node;

        if (nextThis.hash === nextOther.hash) {

            position.this = thisNode.keys.length;
            position.other = otherNode.keys.length;

            //console.log('KABOOM')

            return;
        }

        let i = position.this;
        let j = position.other;
        

        while (i<thisNode.keys.length && j<otherNode.keys.length) {

            const prevI = i;
            const prevJ = j;

            if (thisNode.keys[i] < otherNode.keys[j]) {
                delta.onlyThis.set(thisNode!.keys[i], thisNode!.values[i]);
                i = i+1;
            } else if (thisNode.keys[i] > otherNode.keys[j]) {
                delta.onlyOther.set(otherNode.keys[j], otherNode.values[j]);
                j = j+1;
            } else {
                if (thisNode.values[i] !== otherNode.values[j]) {
                    delta.modified.set(thisNode.keys[i], otherNode.values[j]);
                }

                i = i+1;
                j = j+1;
            }

            if (thisNode.children.length > 0 && prevI < i) {
                const hash = thisNode.children[prevI];
                childrenThis?.push({hash: hash, node: (await this.loadNode(hash))!})
            }

            if (otherNode.children.length > 0 && prevJ < j) {
                const hash = otherNode.children[prevJ];
                childrenOther?.push({hash: hash, node: (await other.loadNode(hash))!})
            }

        }

        if (thisNode.children.length > 0 && i === thisNode.keys.length) {
            const hash = thisNode.children[thisNode.keys.length];
            childrenThis?.push({hash: hash, node: (await this.loadNode(hash))!})
        }

        if (otherNode.children.length > 0 && j === otherNode.keys.length) {
            const hash = otherNode.children[otherNode.keys.length];
            childrenOther?.push({hash: hash, node: (await other.loadNode(hash))!})
        }

        position.this = i;
        position.other = j;

    }

    private static async collectUnmatchedNode<V>(tree: MerkleSearchTree<V>, node: Node<V>, position: number, where: Map<string, V>, children?: LevelQueue<V>) {
        
        for (let i=position; i<node.keys.length; i++) {
            where.set(node.keys[i], node.values[i]);
            if (node.children.length > 0) {
                const childHash = node.children[i];
                children?.push({hash: childHash, node: (await tree.loadNode(childHash))!})
            }
        }
        
        if (node.children.length > 0) {
            const childHash = node.children[node.keys.length];
            children?.push({hash: childHash, node: (await tree.loadNode(childHash))!})
        }
    }

    static async level(key: string, hashSeed: string): Promise<number> {
    
        let digest = await hash(hashSeed+key);
        let bytes = new Uint8Array(digest);
        let len = bytes.byteLength;
    
        let level = 0;
    
        for (let i = 0; i < len && bytes[i] == 0; i++) {
            level = level + 1;
        }
        
        return level;
    }

    //async findPath(key: string, level: number): Array<

    private static keyCompare(a: string, b: string): number {
        return (a > b ? 1 : (b > a ? -1 : 0));
    }

    private static entryCompare<V>(a: [string, V], b: [string, V]): number {
        return MerkleSearchTree.keyCompare(a[0], b[0]);
    }

    private async saveNode(node: Node<V>, level: number): Promise<Hash> {

        const item: Partial<StoredItem> = {literal: node, meta: {level: level}};
        await this.store.save(item as {literal: any});

        return item.hash!;
    }

    private async loadNode(nodeHash: Hash): Promise<Node<V>|undefined> {
        const stored = await this.store.load(nodeHash);
        
        return stored?.literal as Node<V>|undefined;
    }

    public static async multimapUnion(mmap1: MerkleSearchTree<LiteralSet>, mmap2: MerkleSearchTree<LiteralSet>): Promise<MerkleSearchTree<LiteralSet>> {
        const delta = await mmap1.compare(mmap2);

        let union = mmap1;

        for (const [key, otherVal] of delta.modified) {
            const thisVal = (await mmap1.get(key)) as LiteralSet;
            union = await union.set(key, lset.union(thisVal, otherVal))
        }

        for (const [key, otherVal] of delta.onlyOther) {
            union = await union.set(key, otherVal);
        }

        return union;
    }
}

export { MerkleSearchTree, Delta as TreeDelta};
