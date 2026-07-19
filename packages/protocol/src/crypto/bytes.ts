// Byte codecs for the secure channel. hex/concat/equal reuse noble's audited helpers; base64 and
// utf8 are hand-written because Hermes' `atob`/`TextDecoder` availability is version-fuzzy and the
// wire byte contract must not depend on them - the same code runs under Node and on-device, and the
// cross-language vectors exercise it.
export { equalBytes as equal } from '@noble/ciphers/utils.js';
export {
  bytesToHex as toHex,
  concatBytes as concat,
  hexToBytes as fromHex,
} from '@noble/hashes/utils.js';

const STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function buildLookup(): Int16Array {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < STD.length; i++) table[STD.charCodeAt(i)] = i;
  table['-'.charCodeAt(0)] = 62;
  table['_'.charCodeAt(0)] = 63;
  return table;
}
const LOOKUP = buildLookup();

function encodeBase64(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += (alphabet[(n >> 18) & 63] ?? '') + (alphabet[(n >> 12) & 63] ?? '');
    out += (alphabet[(n >> 6) & 63] ?? '') + (alphabet[n & 63] ?? '');
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += (alphabet[(n >> 18) & 63] ?? '') + (alphabet[(n >> 12) & 63] ?? '');
    if (pad) out += '==';
  } else if (rem === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out +=
      (alphabet[(n >> 18) & 63] ?? '') +
      (alphabet[(n >> 12) & 63] ?? '') +
      (alphabet[(n >> 6) & 63] ?? '');
    if (pad) out += '=';
  }
  return out;
}

// Accepts both alphabets and ignores padding / whitespace, so it decodes standard and url base64.
function decodeBase64(str: string): Uint8Array {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 0x3d) break; // '='
    const val = c < 128 ? (LOOKUP[c] ?? -1) : -1;
    if (val < 0) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

export const toBase64 = (bytes: Uint8Array): string => encodeBase64(bytes, STD, true);
export const toBase64Url = (bytes: Uint8Array): string => encodeBase64(bytes, URL, false);
export const fromBase64 = (str: string): Uint8Array => decodeBase64(str);
export const fromBase64Url = (str: string): Uint8Array => decodeBase64(str);

export function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      continue;
    }
    let cp: number;
    let extra: number;
    if (b0 >= 0xf0) {
      cp = b0 & 0x07;
      extra = 3;
    } else if (b0 >= 0xe0) {
      cp = b0 & 0x0f;
      extra = 2;
    } else {
      cp = b0 & 0x1f;
      extra = 1;
    }
    for (let k = 0; k < extra; k++) cp = (cp << 6) | ((bytes[i++] ?? 0) & 0x3f);
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return out;
}

export function isAllZero(bytes: Uint8Array): boolean {
  let acc = 0;
  for (let i = 0; i < bytes.length; i++) acc |= bytes[i] ?? 0;
  return acc === 0;
}
