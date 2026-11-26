/**
 * Rex 运行时没有 TextEncoder / TextDecoder，而 @media-ref/client 依赖的 @bufbuild/protobuf
 * 在模块加载时就要用它们解码内嵌的 proto 描述符。这里补一个只支持 UTF-8 的最小实现，
 * 运行时自带时不覆盖。必须在任何 protobuf 相关模块之前导入。
 */

export class Utf8TextEncoder {
  readonly encoding = "utf-8";

  encode(input = ""): Uint8Array {
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i += 1) {
      let code = input.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
        const next = input.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          i += 1;
        }
      }
      // 落单的代理项按 WHATWG 规范编码为 U+FFFD。
      if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      }
    }
    return new Uint8Array(bytes);
  }

  encodeInto(input: string, dest: Uint8Array): { read: number; written: number } {
    const bytes = this.encode(input);
    if (bytes.length > dest.length) throw new RangeError("encodeInto: destination too small");
    dest.set(bytes);
    return { read: input.length, written: bytes.length };
  }
}

export class Utf8TextDecoder {
  readonly encoding = "utf-8";
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;

  constructor(label = "utf-8", options: { fatal?: boolean; ignoreBOM?: boolean } = {}) {
    if (!/^utf-?8$/i.test(label.trim())) throw new RangeError(`Unsupported encoding: ${label}`);
    this.fatal = options.fatal === true;
    this.ignoreBOM = options.ignoreBOM === true;
  }

  decode(input?: ArrayBuffer | ArrayBufferView): string {
    if (!input) return "";
    const bytes = ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input);
    let out = "";
    let i = 0;
    if (!this.ignoreBOM && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
    const invalid = () => {
      if (this.fatal) throw new TypeError("The encoded data was not valid utf-8");
      return 0xfffd;
    };
    while (i < bytes.length) {
      const b0 = bytes[i];
      let code: number;
      let need = 0;
      let min = 0;
      if (b0 < 0x80) {
        code = b0;
      } else if (b0 >= 0xc2 && b0 < 0xe0) {
        code = b0 & 0x1f;
        need = 1;
        min = 0x80;
      } else if (b0 >= 0xe0 && b0 < 0xf0) {
        code = b0 & 0x0f;
        need = 2;
        min = 0x800;
      } else if (b0 >= 0xf0 && b0 < 0xf5) {
        code = b0 & 0x07;
        need = 3;
        min = 0x10000;
      } else {
        out += String.fromCharCode(invalid());
        i += 1;
        continue;
      }
      let j = 1;
      for (; j <= need; j += 1) {
        const b = bytes[i + j];
        if (b === undefined || (b & 0xc0) !== 0x80) break;
        code = (code << 6) | (b & 0x3f);
      }
      if (j <= need || code < min || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        out += String.fromCharCode(invalid());
        i += Math.max(1, j);
        continue;
      }
      i += need + 1;
      out += String.fromCodePoint(code);
    }
    return out;
  }
}

const globals = globalThis as { TextEncoder?: unknown; TextDecoder?: unknown };
if (typeof globals.TextEncoder !== "function") globals.TextEncoder = Utf8TextEncoder;
if (typeof globals.TextDecoder !== "function") globals.TextDecoder = Utf8TextDecoder;
