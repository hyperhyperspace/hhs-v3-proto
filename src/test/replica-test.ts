import { ReplicatedSet } from "model/lib/set";
import { assertFalse, assertTrue, TestPRNG } from "./test";
import * as crypto from 'model/crypto';
import { Replica } from "model/replica";

const hashSeed = 'XzeqEwGqwprqix0f6pnVO7i1kfpq9bCf4JGI';

function checkReplicatedSet(repl: ReplicatedSet, orig: Set<string>) {



}

const suite = {title: '[REP] Replca sync in a simulated environment', tests: [

    {
        
        name: '[REP00] Empty sync',
        invoke: async () => {

            const id = crypto.b64random(8);
            const s1 = new ReplicatedSet({id: id, hashSeed: hashSeed});
            const repl1 = new Replica();

            s1.attachTo(repl1);

            const s1again = new ReplicatedSet({id: id, hashSeed: hashSeed});
            const repl1again = new Replica();

            s1again.attachTo(repl1again);

            await repl1.syncWith(repl1again);
        }
    },
    {
        
        name: '[REP01] One way sync',
        invoke: async () => {

            const id = crypto.b64random(8);
            const s1 = new ReplicatedSet({id: id, hashSeed: hashSeed});
            const repl1 = new Replica();

            s1.attachTo(repl1);

            const s1again = new ReplicatedSet({id: id, hashSeed: hashSeed});
            const repl1again = new Replica();

            s1again.attachTo(repl1again);

            await s1.add('hello');

            await repl1.syncWith(repl1again);

            

            assertTrue(await s1again.has('hello'));
        }
    },
    {
        
        
        name: '[REP02] Two way sync',
        invoke: async () => {

            const id = crypto.b64random(8);
            const s1 = new ReplicatedSet({id: id, hashSeed: hashSeed});
            const repl1 = new Replica();

            s1.attachTo(repl1);

            const s1again = new ReplicatedSet({id: id, hashSeed: hashSeed});
            const repl1again = new Replica();

            s1again.attachTo(repl1again);

            await s1.add('hello');
            await s1again.add('bye');

            //await repl1.syncWith(repl1again);
            //assertTrue(await s1again.has('hello'));
            //assertTrue(await s1.has('bye'));
        }
    }

]};

export default suite;