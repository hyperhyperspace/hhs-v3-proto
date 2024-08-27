

async function run(name:string, test: () => Promise<void>) {
    console.log("\nRunning \"" + name + "\"");
    try {
        await test();
        console.log("Success");
    } catch (e: any) {
        console.log("Failure");
        if (e.msg !== undefined) {
            console.log(e.msg)
        } else {
            console.log(e);
        }
    }
}

async function skip(name: string) {
    console.log("\nSkipping \"" + name + "\"");
}

function assertTrue(exp: boolean, msg?: string) {

    const err = new Error();

    if (!exp) throw new Error(msg || 'Failed assertion at\n' + err.stack)
}

function assertFalse(exp: boolean, msg?: string) {
    const err = new Error();

    if (exp) throw new Error(msg || 'Failed assertion at\n' + err.stack)
}

function assertEquals(received: any, expected: any, msg?: string) {
    const err = new Error();

    if (received !== expected) throw new Error((msg? msg + ' ': '') + 'Received ' + received + ' (expected ' + expected + ')\nFailed assertion at\n' + err.stack)
}

class TestPRNG {
    seed: number;

    constructor(seed:number) {
        this.seed = seed % 2147483647;

        if (this.seed <= 0) {
            this.seed += 2147483646;
        }
    }

    next() {
        this.seed = this.seed * 16807 % 2147483647;
        return this.seed;
    }
}

export { run, skip, assertTrue, assertFalse, assertEquals, TestPRNG };