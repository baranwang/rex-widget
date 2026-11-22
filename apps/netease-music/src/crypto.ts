import { EAPI_KEY } from "./constants";

/**
 * Pure-JS UTF-8 encoder (Rex's JS runtime does not guarantee TextEncoder).
 */
export function utf8Bytes(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let codePoint = text.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4,
  11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

function rotl32(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

function toLittleEndianHex(word: number): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Pure-JS RFC 1321 MD5 digest returning 32-char lowercase hex.
 */
export function md5Hex(text: string): string {
  const input = utf8Bytes(text);
  const bitLen = input.length * 8;
  const paddedLen = (((input.length + 8) >>> 6) + 1) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(input);
  buf[input.length] = 0x80;

  const lowBits = bitLen >>> 0;
  const highBits = Math.floor(bitLen / 0x100000000) >>> 0;
  const lenOffset = paddedLen - 8;
  buf[lenOffset] = lowBits & 0xff;
  buf[lenOffset + 1] = (lowBits >>> 8) & 0xff;
  buf[lenOffset + 2] = (lowBits >>> 16) & 0xff;
  buf[lenOffset + 3] = (lowBits >>> 24) & 0xff;
  buf[lenOffset + 4] = highBits & 0xff;
  buf[lenOffset + 5] = (highBits >>> 8) & 0xff;
  buf[lenOffset + 6] = (highBits >>> 16) & 0xff;
  buf[lenOffset + 7] = (highBits >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const words = new Uint32Array(16);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4;
      words[i] = (buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24)) >>> 0;
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) & 15;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) & 15;
      }
      const nextD = d;
      d = c;
      c = b;
      const sum = (a + f + MD5_K[i] + words[g]) | 0;
      b = (b + rotl32(sum, MD5_SHIFTS[i])) | 0;
      a = nextD;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  return toLittleEndianHex(a0) + toLittleEndianHex(b0) + toLittleEndianHex(c0) + toLittleEndianHex(d0);
}

// Standard FIPS-197 AES S-box
const AES_SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9,
  0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f,
  0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07,
  0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3,
  0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58,
  0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3,
  0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f,
  0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88,
  0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac,
  0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a,
  0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70,
  0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11,
  0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42,
  0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

const AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function xtime(byte: number): number {
  return ((byte << 1) ^ (byte & 0x80 ? 0x1b : 0)) & 0xff;
}

function expandAes128Key(key: Uint8Array): Uint8Array {
  if (key.length !== 16) {
    throw new Error(`AES-128 key must be 16 bytes, got ${key.length}`);
  }
  const roundKeys = new Uint8Array(176);
  roundKeys.set(key);

  for (let i = 4; i < 44; i++) {
    const prev = (i - 1) * 4;
    let t0 = roundKeys[prev];
    let t1 = roundKeys[prev + 1];
    let t2 = roundKeys[prev + 2];
    let t3 = roundKeys[prev + 3];

    if (i % 4 === 0) {
      const tmp = t0;
      t0 = AES_SBOX[t1] ^ AES_RCON[i / 4 - 1];
      t1 = AES_SBOX[t2];
      t2 = AES_SBOX[t3];
      t3 = AES_SBOX[tmp];
    }

    const base = (i - 4) * 4;
    const dst = i * 4;
    roundKeys[dst] = roundKeys[base] ^ t0;
    roundKeys[dst + 1] = roundKeys[base + 1] ^ t1;
    roundKeys[dst + 2] = roundKeys[base + 2] ^ t2;
    roundKeys[dst + 3] = roundKeys[base + 3] ^ t3;
  }
  return roundKeys;
}

function encryptAes128Block(block: Uint8Array, roundKeys: Uint8Array): void {
  // Initial AddRoundKey
  for (let i = 0; i < 16; i++) {
    block[i] ^= roundKeys[i];
  }

  for (let round = 1; round <= 10; round++) {
    // SubBytes
    for (let i = 0; i < 16; i++) {
      block[i] = AES_SBOX[block[i]];
    }

    // ShiftRows (column-major 4x4 state)
    let tmp = block[1];
    block[1] = block[5];
    block[5] = block[9];
    block[9] = block[13];
    block[13] = tmp;

    tmp = block[2];
    block[2] = block[10];
    block[10] = tmp;
    tmp = block[6];
    block[6] = block[14];
    block[14] = tmp;

    tmp = block[15];
    block[15] = block[11];
    block[11] = block[7];
    block[7] = block[3];
    block[3] = tmp;

    // MixColumns (omitted on final round)
    if (round < 10) {
      for (let col = 0; col < 16; col += 4) {
        const s0 = block[col];
        const s1 = block[col + 1];
        const s2 = block[col + 2];
        const s3 = block[col + 3];
        const xorAll = s0 ^ s1 ^ s2 ^ s3;
        block[col] = s0 ^ xorAll ^ xtime(s0 ^ s1);
        block[col + 1] = s1 ^ xorAll ^ xtime(s1 ^ s2);
        block[col + 2] = s2 ^ xorAll ^ xtime(s2 ^ s3);
        block[col + 3] = s3 ^ xorAll ^ xtime(s3 ^ s0);
      }
    }

    // AddRoundKey
    const rkOffset = round * 16;
    for (let i = 0; i < 16; i++) {
      block[i] ^= roundKeys[rkOffset + i];
    }
  }
}

/**
 * Pure-JS AES-128-ECB encryption with PKCS#7 padding, returning uppercase hex.
 */
export function aes128EcbEncryptHex(plaintext: string, keyText = EAPI_KEY): string {
  const input = utf8Bytes(plaintext);
  const roundKeys = expandAes128Key(utf8Bytes(keyText));
  const padLen = 16 - (input.length % 16);
  const padded = new Uint8Array(input.length + padLen);
  padded.set(input);
  padded.fill(padLen, input.length);

  const block = new Uint8Array(16);
  let out = "";
  for (let offset = 0; offset < padded.length; offset += 16) {
    block.set(padded.subarray(offset, offset + 16));
    encryptAes128Block(block, roundKeys);
    for (let i = 0; i < 16; i++) {
      out += block[i].toString(16).padStart(2, "0").toUpperCase();
    }
  }
  return out;
}

/**
 * Encodes a NetEase EAPI request body `params` parameter.
 */
export function encodeEapiPayload(path: string, payload: Record<string, unknown>, keyText = EAPI_KEY): string {
  const jsonText = JSON.stringify(payload);
  const digest = md5Hex(`nobody${path}use${jsonText}md5forencrypt`);
  const message = `${path}-36cd479b6b5-${jsonText}-36cd479b6b5-${digest}`;
  return aes128EcbEncryptHex(message, keyText);
}
