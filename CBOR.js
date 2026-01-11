/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014-2016 Patrick Gansterer <paroga@paroga.com>
 * Copyright (c) 2021 Taisuke Fukuno <fukuno@jig.jp>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { fitsFloat16, fitsFloat32 } from "./floatutil.js";

const POW_2_24 = 5.960464477539063e-8;
const POW_2_32 = 4294967296;
const POW_2_53 = 9007199254740992;

/**
 * Encode a BigInt as CBOR bignum (tags 2/3) per RFC 8949.
 *
 * - Positive: tag(2) + bstr(magnitude)
 * - Negative: tag(3) + bstr(magnitude of (-1 - value))
 *
 * Returns Uint8Array (CBOR bytes).
 */
export function getBigNumBytes(bignum) {
  if (typeof bignum !== "bigint") {
    throw new TypeError("writeBigNum expects a BigInt");
  }

  // Tag 2 for positive, tag 3 for negative (using -1 - n encoding)
  const isNeg = bignum < 0n;
  const tag = isNeg ? 3 : 2;

  // For negative numbers CBOR bignum uses: value = -1 - n, where n is unsigned
  const n = isNeg ? (-1n - bignum) : bignum;

  // Magnitude as minimal big-endian bytes (0 => empty bstr)
  const mag = bigIntToMinimalBE(n);

  // Assemble: tag + bstr header + mag
  const out = new Uint8Array(1 + bstrHeaderLength(mag.length) + mag.length);
  let o = 0;

  // tag(2) = 0xC2, tag(3) = 0xC3 (both small tags fit in one byte)
  out[o++] = 0xC0 | tag;

  // bstr header
  o += writeBstrHeader(out, o, mag.length);

  // magnitude bytes
  out.set(mag, o);

  return out;
}

function bigIntToMinimalBE(n) {
  if (n < 0n) throw new RangeError("Magnitude must be non-negative");
  if (n === 0n) return new Uint8Array(0);

  const bytes = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  bytes.reverse();
  return Uint8Array.from(bytes);
}

function bstrHeaderLength(len) {
  if (len <= 23) return 1;
  if (len <= 0xff) return 2;
  if (len <= 0xffff) return 3;
  if (len <= 0xffffffff) return 5;
  // JS typed arrays can't exceed 2^32-1 length anyway, but keep for completeness
  return 9;
}

function writeBstrHeader(out, offset, len) {
  // major type 2 (bstr)
  if (len <= 23) {
    out[offset] = 0x40 | len;
    return 1;
  }
  if (len <= 0xff) {
    out[offset] = 0x58;
    out[offset + 1] = len;
    return 2;
  }
  if (len <= 0xffff) {
    out[offset] = 0x59;
    out[offset + 1] = (len >>> 8) & 0xff;
    out[offset + 2] = len & 0xff;
    return 3;
  }
  if (len <= 0xffffffff) {
    out[offset] = 0x5a;
    out[offset + 1] = (len >>> 24) & 0xff;
    out[offset + 2] = (len >>> 16) & 0xff;
    out[offset + 3] = (len >>> 8) & 0xff;
    out[offset + 4] = len & 0xff;
    return 5;
  }
  // 64-bit length (rare in JS)
  out[offset] = 0x5b;
  // write 8-byte big-endian length
  const hi = Math.floor(len / 2 ** 32);
  const lo = len >>> 0;
  out[offset + 1] = (hi >>> 24) & 0xff;
  out[offset + 2] = (hi >>> 16) & 0xff;
  out[offset + 3] = (hi >>> 8) & 0xff;
  out[offset + 4] = hi & 0xff;
  out[offset + 5] = (lo >>> 24) & 0xff;
  out[offset + 6] = (lo >>> 16) & 0xff;
  out[offset + 7] = (lo >>> 8) & 0xff;
  out[offset + 8] = lo & 0xff;
  return 9;
}

const encoder = new TextEncoder();

const sortByBytes = (keys) => {
  const cache = new Map(
    keys.map(k => [k, encoder.encode(k.normalize("NFC"))])
  );

  return keys.sort((a, b) => {
    const ba = cache.get(a);
    const bb = cache.get(b);
    const len = Math.min(ba.length, bb.length);
    for (let i = 0; i < len; i++) {
      if (ba[i] !== bb[i]) return ba[i] - bb[i];
    }
    return ba.length - bb.length;
  });
};

function encode(value) {
  let data = new ArrayBuffer(256);
  let dataView = new DataView(data);
  let lastLength;
  let offset = 0;

  function prepareWrite(length) {
    let newByteLength = data.byteLength;
    const requiredLength = offset + length;
    while (newByteLength < requiredLength)
      newByteLength <<= 1;
    if (newByteLength !== data.byteLength) {
      const oldDataView = dataView;
      data = new ArrayBuffer(newByteLength);
      dataView = new DataView(data);
      const uint32count = (offset + 3) >> 2;
      for (let i = 0; i < uint32count; ++i)
        dataView.setUint32(i << 2, oldDataView.getUint32(i << 2));
    }

    lastLength = length;
    return dataView;
  }
  function commitWrite() {
    offset += lastLength;
  }
  function writeFloat16(value) {
    commitWrite(prepareWrite(2).setFloat16(offset, value));
  }
  function writeFloat32(value) {
    commitWrite(prepareWrite(4).setFloat32(offset, value));
  }
  function writeFloat64(value) {
    commitWrite(prepareWrite(8).setFloat64(offset, value));
  }
  function writeUint8(value) {
    commitWrite(prepareWrite(1).setUint8(offset, value));
  }
  function writeUint8Array(value) {
    const dataView = prepareWrite(value.length);
    for (let i = 0; i < value.length; ++i)
      dataView.setUint8(offset + i, value[i]);
    commitWrite();
  }
  function writeUint16(value) {
    commitWrite(prepareWrite(2).setUint16(offset, value));
  }
  function writeUint32(value) {
    commitWrite(prepareWrite(4).setUint32(offset, value));
  }
  function writeUint64(value) {
    const low = value % POW_2_32;
    const high = (value - low) / POW_2_32;
    const dataView = prepareWrite(8);
    dataView.setUint32(offset, high);
    dataView.setUint32(offset + 4, low);
    commitWrite();
  }
  function writeTypeAndLength(type, length) {
    if (length < 24) {
      writeUint8(type << 5 | length);
    } else if (length < 0x100) {
      writeUint8(type << 5 | 24);
      writeUint8(length);
    } else if (length < 0x10000) {
      writeUint8(type << 5 | 25);
      writeUint16(length);
    } else if (length < 0x100000000) {
      writeUint8(type << 5 | 26);
      writeUint32(length);
    } else {
      writeUint8(type << 5 | 27);
      writeUint64(length);
    }
  }

  function encodeItem(value) {
    if (value === false)
      return writeUint8(0xf4);
    if (value === true)
      return writeUint8(0xf5);
    if (value === null)
      return writeUint8(0xf6);
    if (value === undefined)
      return writeUint8(0xf7);

    switch (typeof value) {
      case "bigint":
        if (value > POW_2_53 || value < -POW_2_53) {
          const b = getBigNumBytes(value);
          return writeUint8Array(b);
        }
        value = Number(value);
      case "number":
        if (Math.floor(value) === value) {
          if (0 <= value && value <= POW_2_53)
            return writeTypeAndLength(0, value);
          if (-POW_2_53 <= value && value < 0)
            return writeTypeAndLength(1, -(value + 1));
        }
        
        if (fitsFloat16(value)) {
          writeUint8(0xf9); // float16
          return writeFloat16(value);
        } else if (fitsFloat32(value)) {
          writeUint8(0xfa); // float32
          return writeFloat32(value);
        } else {
          writeUint8(0xfb); // float64
          return writeFloat64(value);
        }

      case "string":
        const utf8data = new TextEncoder().encode(value);
        writeTypeAndLength(3, utf8data.length);
        return writeUint8Array(utf8data);

      default:
        let length;
        if (Array.isArray(value)) {
          length = value.length;
          writeTypeAndLength(4, length);
          for (let i = 0; i < length; ++i) {
            encodeItem(value[i]);
          }
        } else if (value instanceof Uint8Array) {
          writeTypeAndLength(2, value.length);
          writeUint8Array(value);
        } else {
          const keys = Object.keys(value);
          sortByBytes(keys);
          length = keys.length;
          writeTypeAndLength(5, length);
          for (let i = 0; i < length; ++i) {
            const key = keys[i];
            encodeItem(key);
            encodeItem(value[key]);
          }
        }
    }
  }

  encodeItem(value);

  return new Uint8Array(data, 0, offset);
}

function decode(data, tagger, simpleValue, decodeFirstFlag = false) {
  const dataByteLength = data.length;
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  
  if (typeof tagger !== "function")
    tagger = function(value) { return value; };
  if (typeof simpleValue !== "function")
    simpleValue = function() { return undefined; };

  function commitRead(length, value) {
    offset += length;
    return value;
  }
  function readArrayBuffer(length) {
    return commitRead(length, new Uint8Array(data.buffer, data.byteOffset + offset, length));
  }
  function readFloat16() {
    const tempArrayBuffer = new ArrayBuffer(4);
    const tempDataView = new DataView(tempArrayBuffer);
    const value = readUint16();

    const sign = value & 0x8000;
    let exponent = value & 0x7c00;
    const fraction = value & 0x03ff;

    if (exponent === 0x7c00)
      exponent = 0xff << 10;
    else if (exponent !== 0)
      exponent += (127 - 15) << 10;
    else if (fraction !== 0)
      return (sign ? -1 : 1) * fraction * POW_2_24;

    tempDataView.setUint32(0, sign << 16 | exponent << 13 | fraction << 13);
    return tempDataView.getFloat32(0);
  }
  function readFloat32() {
    return commitRead(4, dataView.getFloat32(offset));
  }
  function readFloat64() {
    return commitRead(8, dataView.getFloat64(offset));
  }
  function readUint8() {
    return commitRead(1, dataView.getUint8(offset));
  }
  function readUint16() {
    return commitRead(2, dataView.getUint16(offset));
  }
  function readUint32() {
    return commitRead(4, dataView.getUint32(offset));
  }
  function readUint64() {
    return readUint32() * POW_2_32 + readUint32();
  }
  function readBreak() {
    if (dataView.getUint8(offset) !== 0xff)
      return false;
    offset += 1;
    return true;
  }
  function readLength(additionalInformation) {
    if (additionalInformation < 24)
      return additionalInformation;
    if (additionalInformation === 24)
      return readUint8();
    if (additionalInformation === 25)
      return readUint16();
    if (additionalInformation === 26)
      return readUint32();
    if (additionalInformation === 27)
      return readUint64();
    if (additionalInformation === 31)
      return -1;
    throw "Invalid length encoding";
  }
  function readIndefiniteStringLength(majorType) {
    const initialByte = readUint8();
    if (initialByte === 0xff)
      return -1;
    const length = readLength(initialByte & 0x1f);
    if (length < 0 || (initialByte >> 5) !== majorType)
      throw "Invalid indefinite length element";
    return length;
  }
  function decodeItem() {
    const initialByte = readUint8();
    const majorType = initialByte >> 5;
    const additionalInformation = initialByte & 0x1f;
    let length;

    if (majorType === 7) {
      switch (additionalInformation) {
        case 25:
          return readFloat16();
        case 26:
          return readFloat32();
        case 27:
          return readFloat64();
      }
    }

    length = readLength(additionalInformation);
    if (length < 0 && (majorType < 2 || 6 < majorType))
      throw "Invalid length";

    switch (majorType) {
      case 0:
        return length;
      case 1:
        return -1 - length;
      case 2:
        if (length < 0) {
          const elements = [];
          let fullArrayLength = 0;
          while ((length = readIndefiniteStringLength(majorType)) >= 0) {
            fullArrayLength += length;
            elements.push(readArrayBuffer(length));
          }
          const fullArray = new Uint8Array(fullArrayLength);
          let fullArrayOffset = 0;
          for (let i = 0; i < elements.length; ++i) {
            fullArray.set(elements[i], fullArrayOffset);
            fullArrayOffset += elements[i].length;
          }
          return fullArray;
        }
        return readArrayBuffer(length);
      case 3:
        const data = (() => { // copy from case 2
          if (length < 0) {
            const elements = [];
            let fullArrayLength = 0;
            while ((length = readIndefiniteStringLength(majorType)) >= 0) {
              fullArrayLength += length;
              elements.push(readArrayBuffer(length));
            }
            const fullArray = new Uint8Array(fullArrayLength);
            let fullArrayOffset = 0;
            for (let i = 0; i < elements.length; ++i) {
              fullArray.set(elements[i], fullArrayOffset);
              fullArrayOffset += elements[i].length;
            }
            return fullArray;
          }
          return readArrayBuffer(length);
        })();
        return new TextDecoder().decode(data);
      case 4:
        let retArray;
        if (length < 0) {
          retArray = [];
          while (!readBreak())
            retArray.push(decodeItem());
        } else {
          retArray = new Array(length);
          for (let i = 0; i < length; ++i)
            retArray[i] = decodeItem();
        }
        return retArray;
      case 5:
        const retObject = {};
        for (let i = 0; i < length || length < 0 && !readBreak(); ++i) {
          const key = decodeItem();
          retObject[key] = decodeItem();
        }
        return retObject;
      case 6:
        return tagger(decodeItem(), length);
      case 7:
        switch (length) {
          case 20:
            return false;
          case 21:
            return true;
          case 22:
            return null;
          case 23:
            return undefined;
          default:
            return simpleValue(length);
        }
    }
  }

  const ret = decodeItem();
  if (offset !== dataByteLength && !decodeFirstFlag) {
    throw new Error("Remaining bytes: " + offset + " is not " + dataByteLength);
  }
  return ret;
}
function decodeFirst(data, tagger, simpleValue) {
  return decode(data, tagger, simpleValue, true);
}

export { encode, decode };
