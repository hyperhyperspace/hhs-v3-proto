import { ReplicatedSet } from "model/lib/set";
import { assertFalse, assertTrue, TestPRNG } from "./test";

const hashSeed = 'XzeqEwGqwprqix0f6pnVO7i1kfpq9bCf4JGI';

const suite = {title: '[SET] OR-Set implementation over Merkle Search Trees', tests: [

    {
        
        name: '[SET00] set membership',
        invoke: async () => {

            const s1 = new ReplicatedSet({hashSeed: hashSeed});

            assertFalse(await s1.has('hello'));

            await s1.add('hello');

            assertTrue(await s1.has('hello'));

            await s1.remove('hello');

            assertFalse(await s1.has('hello'))
            
            await s1.add('hello')
            await s1.add('friend')

            assertTrue(await s1.has('hello'));
            assertTrue(await s1.has('friend'));

            await s1.remove('hello');

            assertFalse(await s1.has('hello'));
            assertTrue(await s1.has('friend'));

        }
    },
    {
        
        name: '[SET01] large sets',
        invoke: async () => {

            const seeds = [];

            for (let i=1000000; i<1000005; i++) {
                seeds.push(i);
            }
        
            let count = 0;
            for (const seed of seeds) {


                process.stdout.write(".");
                

                const prng = new TestPRNG(seed);

                
                const size = Math.abs(prng.next() % 2048);

                const testSet = new Set<string>();
                const s1 = new ReplicatedSet({hashSeed: hashSeed});
                for (let i=0; i<size; i++) {
                    const next = prng.next().toString(16);
                    testSet.add(next)
                    assertFalse(await s1.has(next));
                    await s1.add(next);
                    assertTrue(await s1.has(next));
                }

                const elements = Array.from(testSet);
                elements.sort();

                for (const e of elements) {
                    assertTrue(await s1.has(e));
                    await s1.remove(e);
                    assertFalse(await s1.has(e));
                }
            
                for (const e of elements) {
                    assertFalse(await s1.has(e));
                    await s1.add(e);
                    await s1.add(e);
                    assertTrue(await s1.has(e));
                }

                for (const e of elements) {
                    assertTrue(await s1.has(e));
                    await s1.remove(e);
                    assertFalse(await s1.has(e));
                }
            }

            console.log();

        }
    }
]};

export default suite;