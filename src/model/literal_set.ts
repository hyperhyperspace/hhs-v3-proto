// A set that can be serialized and hashed deterministically (see json.js)

type LiteralSet = {[key: string]: ''};

function create(): LiteralSet {
    return {};
}

function add(l: LiteralSet, s: string) {
    l[s] = '';
}

function remove(l: LiteralSet, s: string) {
    delete l[s];
}

function make(elements: IterableIterator<string>): LiteralSet {
    const literal: LiteralSet = {};
    for (const e of elements) {
        literal[e] = '';
    }

    return literal;
}

function from(l: LiteralSet): IterableIterator<string> {

    for (const v of Object.values(l)) {
        if (v !== '') {
            throw new Error('Malformed LiteralSet: ' + l.toString() + ' (all values should be empty strings, found "' + v + '" instead).');
        }
    }

    return Object.keys(l).values();
}

function copy(l: LiteralSet): LiteralSet {

    return Object.assign({}, l);
}

function union(l1: LiteralSet, l2: LiteralSet): LiteralSet {

    return Object.assign(Object.assign({}, l1), l2);
}

function elements(l: LiteralSet): string[] {
    return Object.keys(l);
}

function size(l: LiteralSet): number {
    return Object.keys(l).length;
}

function isEmpty(l: LiteralSet): boolean {
    return Object.keys(l).length === 0;
}


export { LiteralSet, create, add, remove, copy, make, from, union, elements, size, isEmpty };