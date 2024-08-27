import { Hash, b64hash } from './crypto';

type Literal = string|number|Array<Literal>|{[key: string]: Literal};

function serialize(literal: Literal) {
    var plain = '';
    
    if (typeof literal === 'object') {

        const arr = Array.isArray(literal);

        plain = plain + (arr? '[' : '{');

        var keys = Object.keys(literal);
        keys.sort();

        keys.forEach(key => {
        plain = plain +
                (arr? '' : escapeString(key) + ':') + serialize((literal as any)[key]) + ',';
        });

        plain = plain + (arr? ']' : '}');
    } else if (typeof literal === 'string') {
        plain = escapeString(literal);
    } else if (typeof literal === 'boolean' || typeof literal === 'number') {
        plain = literal.toString();
        // important notice: because of how the javascript number type works, we are sure that
        //                   integer numbers always get serialized without a fractional part
        //                   (e.g. '1.0' cannot happen)
    } else {
        throw new Error('Cannot serialize ' + literal + ', its type ' + (typeof literal) + ' is illegal for a literal.');
    }

    return plain;
}

function escapeString(text: string) {
    return '"' + text.replaceAll('"', '\\"') + '"';
}

function hash(literal: Literal): Promise<Hash> {
    return b64hash(serialize(literal));
}

export { Literal, serialize, hash };