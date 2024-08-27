import { run, assertTrue, assertEquals, TestPRNG, assertFalse } from './test';

import { TreeDelta, MerkleSearchTree } from 'model/mst';
import { MemoryStore } from 'storage';

async function main() {

    /*for (let i=0; i<1000000; i++) {
        const k = i.toString(16);
        const l = await MerkleSearchTree.level(k);

        if (l>0) {
            console.log(k + ' has level ' + l);
        }
    }*/

    /*const s1 = new MemoryStore();
    let mst1 = new MerkleSearchTree(s1);

    mst1 = await mst1.set('3', '3');
    mst1 = await mst1.set('5', '5');

    console.log('before')
    console.log('root: ' + mst1.rootHash + ' (level ' + mst1.rootLevel + ')');
    for (const [hash, stored] of s1.items.entries()) {
        console.log('hash: ' + hash + ' (level ' + stored.meta.level + ')');
        console.log(JSON.stringify(stored.literal));
    }
    console.log()

    mst1 = await mst1.set('4a', '4a');

    console.log('after')
    console.log('root: ' + mst1.rootHash + ' (level ' + mst1.rootLevel + ')');
    for (const [hash, stored] of s1.items.entries()) {
        console.log('hash: ' + hash + ' (level ' + stored.meta.level + ')');
        console.log(JSON.stringify(stored.literal));
    }
    console.log()

    mst1 = await mst1.set('4b', '4b');

    console.log('after after')
    console.log('root: ' + mst1.rootHash + ' (level ' + mst1.rootLevel + ')');
    for (const [hash, stored] of s1.items.entries()) {
        console.log('hash: ' + hash + ' (level ' + stored.meta.level + ')');
        console.log(JSON.stringify(stored.literal));
    }
    console.log()*/

}

//main();

function mapsAreEqual(m: Map<string, string>, n: Map<string, string>): boolean {
    if (m.size != n.size) {
        return false;
    }

    for (const [k, v] of m.entries()) {
        if (n.get(k) !== v) {
            return false;
        }
    }

    return true;
}

const hashSeed = 'XzeqEwGqwprqix0f6pnVO7i1kfpq9bCf4JGI';

const suite = {title: '[MST] Test Merkle Search Tree implementation', tests: [

    {
        
        name: '[MST00] batch creation / check contents',
        invoke: async () => {

            
            const seeds = [12345, 66, -22, 832922, 7];

            for (let i=1000000; i<100100; i++) {
                seeds.push(i);
            }

            let k = 0;

            for (const seed of seeds) {

                if (++k % 33 === 0) {
                    process.stdout.write(".");
                }

                const prng = new TestPRNG(seed);

                const s1 = new MemoryStore();

                const data = new Map<string, string>();

                const size = Math.abs(prng.next() % 2048);

                for (let i=0; i<size; i++) {
                    const next = prng.next().toString(16);
                    data.set(next, next);
                }

                const nonKeys: string[] = [];

                for (let i=0; i<16; i++) {
                    const next = prng.next().toString(16);
                    if (!data.has(next)) {
                        nonKeys.push(next);
                    }
                }

                const mst = await MerkleSearchTree.fromMap(data, s1, hashSeed);

                for (const [k, v] of data.entries()) {
                    assertEquals(await mst.get(k), v, "using seed " + seed);
                }

                for (const k of nonKeys) {
                    assertEquals(await mst.get(k), undefined, "using seed " + seed);
                }

                assertEquals(await mst.size(), data.size);

                const contents = Array.from(data.entries());
                contents.sort((a: [string, string], b: [string, string]) => {
                    if (a[0] < b[0]) {
                        return -1;
                    } else if (a[0] > b[0]) {
                        return 1;
                    } else {
                        return 0;
                    }
                });

                for (let i=0; i<contents.length; i++) {
                    //console.log(i);
                    const entry = await mst.at(i);
                    assertFalse(entry === undefined);
                    assertEquals(entry![0], contents[i][0]);
                    assertEquals(entry![1], contents[i][1]);
                }

            }

            console.log();

            /*const s2 = new MemoryStore();
            let mst2 = new MerkleSearchTree(s2);

            for (const [k,v] of data.entries()) {
                mst2 = await mst2.set(k, v);
            }

            for (const [k, v] of data.entries()) {
                assertEquals(await mst2.get(k), v);
            }

            for (const k of nonKeys) {
                assertEquals(await mst2.get(k), undefined);
            }*/

            /*
            console.log('nodes: ' + s1.items.size);
            console.log(s1.items);
            console.log('nodes: ' + s2.items.size);
            console.log(s2.items);
            */

            //assertEquals(mst.rootHash, mst2.rootHash);

        }
    },

    
    { 
        name: '[MST01] batch creation & set updating root hash congruence', 
        invoke: async () => {
            let seeds = [2345, 667, -122, 8329225, 71];

            for (let i=1000000; i<1000010; i++) {
                seeds.push(i);
            }

            //seeds = [1000152];

            let k = 0;

            for (const seed of seeds) {

                if (++k % 1 === 0) {
                    process.stdout.write(".");
                }
                
                const prng = new TestPRNG(seed);

                const s1 = new MemoryStore();

                const data = new Map<string, string>();
                let mst1 = new MerkleSearchTree(s1, hashSeed);

                const size = Math.abs(prng.next() % 1024);

                //console.log("seed is " + seed + " (size is " + size + ")");

                for (let i=0; i<size; i++) {
                    const next = prng.next().toString(16);
                    //console.log(i, next);
                    //if (i===286) {
                    //    console.log('stop')
                    //}
                    data.set(next, next);
                    mst1 = await mst1.set(next, next);

                    const s2 = new MemoryStore();
                    const mst2 = await MerkleSearchTree.fromMap(data, s2, hashSeed);

                    if (mst1.rootHash !== mst2.rootHash) {

                        console.log(i, next);

                        console.log();
                        const root1 = (await mst1.store.load(mst1.rootHash!))!;
                        console.log(JSON.stringify(root1));
                        const child1 = await mst1.store.load(root1.literal.children[0]);
                        console.log(JSON.stringify(child1));
                        console.log();
                        const root2 = (await mst2.store.load(mst2.rootHash!))!;
                        console.log(JSON.stringify(root2));
                        const child2 = await mst2.store.load(root2.literal.children[0]);
                        console.log(JSON.stringify(child2));
                        console.log();

                        console.log("pitufo")
                    }

                    assertEquals(mst1.rootHash, mst2.rootHash, "seed is " + seed);
                    assertEquals(mst1.rootLevel, mst2.rootLevel, "seed is " + seed);
                    
                    assertEquals(await mst1.size(), await mst2.size(), "seed is " + seed);
                    assertEquals(data.size, await mst1.size());
                }

                /*const mst = await MerkleSearchTree.createFromMap(data, s1);

                for (const [k, v] of data.entries()) {
                    assertEquals(await mst.get(k), v, "using seed " + seed);
                }

                for (const k of nonKeys) {
                    assertEquals(await mst.get(k), undefined, "using seed " + seed);
                }*/

            }

            console.log();
        }
    },

    {
        name: '[MST02] set + remove root hash congruence',
        invoke: async () => {
            let seeds = [2625, 1166, 80, 1136189770, 44];

            for (let i=1000000; i<1000100; i++) {
                seeds.push(i);
            }

            //seeds = [1000655];

            let k = 0;

            for (const seed of seeds) {

                if (++k % 33 === 0) {
                    process.stdout.write(".");
                }

                const prng = new TestPRNG(seed);

                const s1 = new MemoryStore();

                const data = new Map<string, string>();
                let mst1 = new MerkleSearchTree<string>(s1, hashSeed);

                const size = Math.abs(prng.next() % 512);

                for (let i=0; i<size; i++) {
                    const next = prng.next().toString(16);
                    data.set(next, next);
                    
                    const mst1_ori = mst1;
                    let mst1_back: MerkleSearchTree<string>;

                    try {
                        mst1 = await mst1.set(next, next);
                        mst1_back = await mst1.remove(next);
                    } catch (e) {
                        console.log('seed is ' + seed);
                        console.log('i= ' + i);
                        throw e;
                    }
                    if (await mst1_ori.isEmpty()) {
                        assertTrue(await mst1_back.isEmpty())
                    } else {
                        /*if (mst1_ori.rootHash !== mst1_back.rootHash) {
                            const root_ori = await s1.load(mst1_ori.rootHash!)
                            const root_back = await s1.load(mst1_back.rootHash!)

                            console.log('root_ori')
                            console.log(JSON.stringify(root_ori))
                            console.log()

                            console.log('root_back')
                            console.log(JSON.stringify(root_back))
                            console.log()
                        }*/

                        assertEquals(mst1_ori.rootHash, mst1_back.rootHash, "key is '" + next + "', level="+await MerkleSearchTree.level(next, hashSeed)+", seed is " + seed + " (i="+i+")");
                        assertEquals(await mst1_ori.size(), await mst1_back.size());
                    }

                }

                /*const mst = await MerkleSearchTree.createFromMap(data, s1);

                for (const [k, v] of data.entries()) {
                    assertEquals(await mst.get(k), v, "using seed " + seed);
                }

                for (const k of nonKeys) {
                    assertEquals(await mst.get(k), undefined, "using seed " + seed);
                }*/

            }

            console.log();
        }
    },

    {
        name: '[MST03] difference correctness on random trees',
        invoke: async () => {
            let seeds = [12345, 66, -22, 832922, 7];

            for (let i=1000000; i<100040; i++) {
                seeds.push(i);
            }

            let maxLevel = 0;
            let maxLevelDelta = 0;

            //seeds = [1100008]
            //seeds = [1187601];

            let k=0;
            for (const seed of seeds) {

                if (++k % 33 === 0) {
                    process.stdout.write(".");
                }

                const prng = new TestPRNG(seed);

                const data1 = new Map<string, string>();
                const data2 = new Map<string, string>();

                const onlyData1 = new Map<string, string>();
                const modified = new Map<string, string>();
                const onlyData2 = new Map<string, string>();

                const all = new Set<string>();

                const chunkSize = Math.abs(prng.next() % 400);

                for (let i=0; i<chunkSize*4; i++) {

                    const next = prng.next().toString(16);

                    if (all.has(next)) {
                        continue;
                    }

                    all.add(next);

                    if (i<chunkSize) {
                        data1.set(next, next);
                        onlyData1.set(next, next);
                    } else if (i<chunkSize * 2) {
                        data2.set(next, next);
                        onlyData2.set(next, next);
                    } else if (i<chunkSize * 3) {
                        data1.set(next, next);
                        data2.set(next, next);
                    } else {
                        data1.set(next, next+'1');
                        data2.set(next, next+'2');
                        modified.set(next, next+'2');
                    }
                }

                const s1 = new MemoryStore();
                const mst1 = await MerkleSearchTree.fromMap(data1, s1, hashSeed);

                const s2 = new MemoryStore();
                const mst2 = await MerkleSearchTree.fromMap(data2, s2, hashSeed);

                maxLevel = Math.max(maxLevel, Math.max(mst1.rootLevel!, mst2.rootLevel!));
                maxLevelDelta = Math.max(maxLevelDelta, Math.abs(mst1.rootLevel!-mst2.rootLevel!))

                const data1Copy = await mst1.toMap()
                const data2Copy = await mst2.toMap();

                assertTrue(mapsAreEqual(data1, data1Copy));
                assertTrue(mapsAreEqual(data2, data2Copy));
                
                let diff: TreeDelta<string>;
                
                try {
                    diff = await mst1.compare(mst2);
                } catch (e) {
                    console.log('seed is ' + seed);
                    throw e;
                }
                

                if (!mapsAreEqual(diff.onlyThis, onlyData1)) {
                    console.log(diff.onlyThis.size);
                    console.log(Array.from(diff.onlyThis.entries()));
                    console.log(onlyData1.size);
                    console.log(Array.from(onlyData1.entries()));
                }
                assertTrue(mapsAreEqual(diff.onlyThis, onlyData1), "seed is " + seed);

                if (!mapsAreEqual(diff.onlyOther, onlyData2)) {
                    console.log(diff.onlyOther.size);
                    console.log(Array.from(diff.onlyOther.entries()));
                    console.log(onlyData2.size);
                    console.log(Array.from(onlyData2.entries()));
                }
                assertTrue(mapsAreEqual(diff.onlyOther, onlyData2), "seed is " + seed);

                if (!mapsAreEqual(diff.modified, modified)) {
                    console.log(diff.modified.size);
                    console.log(Array.from(diff.modified));
                    console.log(modified.size);
                    console.log(Array.from(modified.entries()), "seed is " + seed);
                }
                assertTrue(mapsAreEqual(diff.modified, modified));
            }

            console.log();
        }
    }
    ,

    {
        name: '[MST04] difference correctness on similar trees',
        invoke: async () => {
            let seeds = [12345, 66, -22, 832922, 7];

            for (let i=1000000; i<1000040; i++) {
                seeds.push(i);
            }

            let maxLevel = 0;
            let maxLevelDelta = 0;

            //seeds = [1100008]
            //seeds = [1187601];
            //seeds = [66];
            //seeds = [1000081];

            let k=0;
            for (const seed of seeds) {

                if (++k % 33 === 0) {
                    process.stdout.write(".");
                }

                const prng = new TestPRNG(seed);

                const data = new Map<string, string>();

                const all = new Set<string>();
                
                const size = Math.abs(prng.next() % 2048);

                for (let i=0; i<size; i++) {

                    const next = prng.next().toString(16);

                    if (all.has(next)) {
                        continue;
                    }

                    all.add(next);

                    data.set(next, next);
                }

                const s1 = new MemoryStore();
                let mst1 = await MerkleSearchTree.fromMap(data, s1, hashSeed);

                const dataCopy = await mst1.toMap()

                assertTrue(mapsAreEqual(data, dataCopy));
                
                let diff: TreeDelta<string>;
                
                const onlyThis = new Map();
                const onlyOther = new Map();
                const modified = new Map();
                const check = (what: string) => {
                    if (!mapsAreEqual(diff.onlyThis, onlyThis )) {
                        console.log('onlyThis')
                        console.log(diff.onlyThis.size);
                        console.log(Array.from(diff.onlyThis.entries()));
                        console.log(onlyThis.size);
                        console.log(Array.from(onlyThis.entries()));
                    }
                    assertTrue(mapsAreEqual(diff.onlyThis, onlyThis), "seed is " + seed + " (" + what + ")");

                    if (!mapsAreEqual(diff.onlyOther, onlyOther)) {
                        console.log('onlyOther')
                        console.log(diff.onlyOther.size);
                        console.log(Array.from(diff.onlyOther.entries()));
                        console.log(onlyOther.size);
                        console.log(Array.from(onlyOther.entries()));
                    }
                    assertTrue(mapsAreEqual(diff.onlyOther, onlyOther), "seed is " + seed + " (" + what + ")");

                    if (!mapsAreEqual(diff.modified, modified)) {
                        console.log('modified')
                        console.log(diff.modified.size);
                        console.log(Array.from(diff.modified));
                        console.log(modified.size);
                        console.log(Array.from(modified.entries()), "seed is " + seed + " (" + what + ")");
                    }
                    assertTrue(mapsAreEqual(diff.modified, modified));
                }

                try {
                    diff = await mst1.compare(mst1);
                } catch (e) {
                    console.log('seed is ' + seed);
                    throw e;
                }

                check('no changes');

                let mst2 = await mst1.set('meat', 'machine');

                onlyOther.set('meat', 'machine');

                try {
                    diff = await mst1.compare(mst2);
                } catch (e) {
                    console.log('seed is ' + seed);
                    throw e;
                }

                check('key only in other');

                mst1 = await mst1.set('meat', 'salad');

                modified.set('meat', 'machine');
                onlyOther.delete('meat');

                try {
                    diff = await mst1.compare(mst2);
                } catch (e) {
                    console.log('seed is ' + seed);
                    throw e;
                }

                check('modified key');

                try {
                    modified.delete('meat');
                    mst2 = await mst2.remove('meat');
                    onlyThis.set('meat', 'salad');
                    diff = await mst1.compare(mst2);
                } catch (e) {
                    console.log('seed is ' + seed);
                    throw e;
                }

                check('key only in this');



            }

            console.log();
        }
    },
    {
        name: '[MST05] empty tree',
        invoke: async () => {
            


            const prng = new TestPRNG(1);

            let next = prng.next().toString(16);

            const s1 = new MemoryStore();
            let mst1 = new MerkleSearchTree(s1, hashSeed);;

            while (await MerkleSearchTree.level(next, hashSeed) === 0) {
                next = prng.next().toString(16);
            }

            mst1 = await mst1.set(next, "");

            //console.log(JSON.stringify(await s1.load(mst1.rootHash!)));

            mst1 = await mst1.set(next, undefined);

            //console.log(JSON.stringify(await s1.load(mst1.rootHash!)));

            assertFalse(await mst1.has(next));

            mst1 = await mst1.set(next, "");

            assertTrue(await mst1.has(next));

            next = prng.next().toString(16);

            assertFalse(await mst1.has(next));

            mst1 = await mst1.set(next, "");

            assertTrue(await mst1.has(next));
        }
    }]
}

//test();

export default suite;