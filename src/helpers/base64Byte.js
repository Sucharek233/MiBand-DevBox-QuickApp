// Custom base64 encoder/decoder made by AI
// Iterated and optimized 4 times over 4 different models

export default class Base64 {
    static chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    static lookup = new Uint8Array(256).fill(255);
}
// Kept outside a `static {}` block for broader engine compatibility (ES2022
// static init blocks may not exist in older QuickJS/Vela builds).
for (let i = 0; i < 64; i++) {
    Base64.lookup[Base64.chars.charCodeAt(i)] = i;
}

Base64.encode = function (input) {
    const bytes = Base64._toUint8Array(input);
    const len = bytes.length;
    if (len === 0) return "";

    const chars = Base64.chars;
    const fullGroups = (len / 3) | 0;
    const rem = len - fullGroups * 3;
    const outLen = (fullGroups + (rem ? 1 : 0)) * 4;
    const out = new Array(outLen); // preallocated, filled by index -> join() once
    let o = 0;
    let i = 0;
    const mainEnd = fullGroups * 3;

    for (; i < mainEnd; i += 3) {
        const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
        out[o++] = chars[b0 >> 2];
        out[o++] = chars[((b0 & 3) << 4) | (b1 >> 4)];
        out[o++] = chars[((b1 & 15) << 2) | (b2 >> 6)];
        out[o++] = chars[b2 & 63];
    }

    if (rem === 1) {
        const b0 = bytes[i];
        out[o++] = chars[b0 >> 2];
        out[o++] = chars[(b0 & 3) << 4];
        out[o++] = "="; out[o++] = "=";
    } else if (rem === 2) {
        const b0 = bytes[i], b1 = bytes[i + 1];
        out[o++] = chars[b0 >> 2];
        out[o++] = chars[((b0 & 3) << 4) | (b1 >> 4)];
        out[o++] = chars[(b1 & 15) << 2];
        out[o++] = "=";
    }

    return out.join("");
};

Base64.decode = function (str, strict) {
    const len = str.length;
    if (len === 0) return new Uint8Array(0);
    if (len % 4 !== 0) {
        throw new Error("Base64.decode: invalid input length " + len);
    }

    const lookup = Base64.lookup;
    let padding = 0;
    if (str.charCodeAt(len - 1) === 61) { // '='
        padding = 1;
        if (str.charCodeAt(len - 2) === 61) padding = 2;
    }

    const outLen = (len >> 2) * 3 - padding;
    const bytes = new Uint8Array(outLen);
    let outIdx = 0;
    const mainLen = len - (padding > 0 ? 4 : 0);

    for (let i = 0; i < mainLen; i += 4) {
        const c1 = lookup[str.charCodeAt(i)];
        const c2 = lookup[str.charCodeAt(i + 1)];
        const c3 = lookup[str.charCodeAt(i + 2)];
        const c4 = lookup[str.charCodeAt(i + 3)];
        if (strict && (c1 === 255 || c2 === 255 || c3 === 255 || c4 === 255)) {
            throw new Error("Base64.decode: invalid character near position " + i);
        }
        bytes[outIdx++] = (c1 << 2) | (c2 >> 4);
        bytes[outIdx++] = ((c2 & 15) << 4) | (c3 >> 2);
        bytes[outIdx++] = ((c3 & 3) << 6) | c4;
    }

    if (padding > 0) {
        const i = mainLen;
        const c1 = lookup[str.charCodeAt(i)];
        const c2 = lookup[str.charCodeAt(i + 1)];
        bytes[outIdx++] = (c1 << 2) | (c2 >> 4);
        if (padding === 1) {
            const c3 = lookup[str.charCodeAt(i + 2)];
            bytes[outIdx++] = ((c2 & 15) << 4) | (c3 >> 2);
        }
    }

    return bytes;
};

Base64._toUint8Array = function (input) {
    if (input instanceof Uint8Array) return input;
    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    return new Uint8Array(input); // plain array-like
};