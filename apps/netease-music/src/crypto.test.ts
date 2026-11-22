import crypto from "node:crypto";
import { describe, expect, test } from "@rstest/core";
import { EAPI_KEY } from "./constants";
import { aes128EcbEncryptHex, encodeEapiPayload, md5Hex, utf8Bytes } from "./crypto";

function nodeAes128EcbHex(plaintext: string, key = EAPI_KEY): string {
  const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    .toString("hex")
    .toUpperCase();
}

describe("crypto", () => {
  test("utf8Bytes matches Buffer.from for ASCII, CJK, and emoji", () => {
    const samples = ["", "hello world", "网易云音乐 123", "🎵🎧🎶", "aé中🚀"];
    for (const sample of samples) {
      expect(Array.from(utf8Bytes(sample))).toEqual(Array.from(Buffer.from(sample, "utf8")));
    }
  });

  test("md5Hex matches node:crypto MD5 across varied lengths and UTF-8 inputs", () => {
    const samples = [
      "",
      "a",
      "abc",
      "message digest",
      "abcdefghijklmnopqrstuvwxyz",
      "The quick brown fox jumps over the lazy dog",
      'nobody/api/song/enhance/player/url/v1use{"ids":"[12345]"}md5forencrypt',
      "网易云音乐测试字符串🎵".repeat(12),
    ];
    for (const sample of samples) {
      const expected = crypto.createHash("md5").update(sample, "utf8").digest("hex");
      expect(md5Hex(sample)).toBe(expected);
    }
  });

  test("aes128EcbEncryptHex matches node:crypto AES-128-ECB with PKCS#7 padding", () => {
    const samples = [
      "",
      "a",
      "123456789012345", // 15 bytes -> 1 byte pad
      "1234567890123456", // 16 bytes -> full 16-byte pad block
      "12345678901234567", // 17 bytes -> 15 bytes pad
      "网易云音乐 EAPI 加密载荷 🎧",
      "x".repeat(257),
    ];
    for (const sample of samples) {
      expect(aes128EcbEncryptHex(sample, EAPI_KEY)).toBe(nodeAes128EcbHex(sample, EAPI_KEY));
    }
  });

  test("encodeEapiPayload produces exact NetEase EAPI ciphertext", () => {
    const path = "/api/song/enhance/player/url/v1";
    const payload = {
      ids: "[186016]",
      level: "exhigh",
      encodeType: "mp3",
      header: { os: "pc", deviceId: "ABCDEF123456" },
      e_r: false,
    };
    const jsonText = JSON.stringify(payload);
    const expectedDigest = crypto.createHash("md5").update(`nobody${path}use${jsonText}md5forencrypt`).digest("hex");
    const expectedCipher = nodeAes128EcbHex(`${path}-36cd479b6b5-${jsonText}-36cd479b6b5-${expectedDigest}`);

    expect(encodeEapiPayload(path, payload)).toBe(expectedCipher);
  });
});
