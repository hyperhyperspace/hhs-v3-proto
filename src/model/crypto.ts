type Hash = string;

function hash(text: string): Promise<ArrayBuffer> {

    let buffer = new TextEncoder().encode(text);
    
    return crypto.subtle.digest('SHA-256', buffer);
}

function hashUint8Array(data: Uint8Array): Promise<ArrayBuffer> {
    return crypto.subtle.digest('SHA-256', data);
}

async function b64hash(text: string): Promise<Hash> {

    let digest = await hash(text);
    return b64(digest);
}

function random(bytes: number) {

    let arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    
    return arr;
}

function b64random(bytes: number) {
    return b64(random(bytes));
}

function b64(digest: ArrayBuffer) {
    let binary = '';
    let bytes = new Uint8Array(digest);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function b64ToArray(b64: string): ArrayBuffer /* Uint8Array? */{
    const raw = atob(b64);

    const array = new Uint8Array(raw.length);

    for (let i=0; i<raw.length; i++) {
        array[i] = raw.charCodeAt(i);
    }

    return array;    
} 

export type { Hash };
export { hash, hashUint8Array, b64hash, random, b64random, b64, b64ToArray };