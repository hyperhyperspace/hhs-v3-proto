import mst from './mst-test';
import set from './set-test';

import { run, skip } from './test';

async function main() {

    const allTests = new Map<string, Array<{name: string, invoke: () => Promise<void>}>>();

    const filters = process.argv.slice(2);

    allTests.set(mst.title, mst.tests);
    allTests.set(set.title, set.tests);

    console.log('Running tests for Hyper Hyper Space v3' + (filters.length > 0? ' (applying filter: ' + filters.toString() + ')' : '') + '\n');    

    for (const [title, tests] of allTests.entries()) {
        console.log(title);

        for (const test of tests) {

            let match = true;
            for (const filter of filters) {
                match = match && (/*title.indexOf(filter) >= 0 || */test.name.indexOf(filter) >= 0)
            }

            if (match) {
                await run(test.name, test.invoke);
            } else {
                await skip(test.name);
            }
        }

        console.log();
    }
}

main();