import * as t from "https://deno.land/std/testing/asserts.ts";
import { CBOR } from "./CBOR.js";
import { Base16 } from "https://code4fukui.github.io/Base16/Base16.js";

Deno.test("key series", () => {
  const a = { a: 123, b: 456 };
  const b = { b: 456, a: 123 };
  t.assertEquals(CBOR.encode(a), CBOR.encode(b));
});

Deno.test("canonical 0", () => {
  const bins = [
    [0],
    [0x18, 0],
    [0x19, 0, 0],
    [0x1a, 0, 0, 0, 0],
  ].map(i => new Uint8Array(i));
  for (const bin of bins) {
    const n = CBOR.decode(bin);
    t.assertEquals(n, 0);
  }
  t.assertEquals(CBOR.encode(0), bins[0]);
});
Deno.test("canonical 23", () => {
  const bins = [
    [0x17],
    [0x18, 0x17],
    [0x19, 0, 0x17],
  ].map(i => new Uint8Array(i));
  for (const bin of bins) {
    const n = CBOR.decode(bin);
    t.assertEquals(n, 23);
  }
  t.assertEquals(CBOR.encode(23), bins[0]);
});
Deno.test("canonical 24", () => {
  const bins = [
    [0x18, 0x18],
    [0x19, 0, 0x18],
  ].map(i => new Uint8Array(i));
  for (const bin of bins) {
    const n = CBOR.decode(bin);
    t.assertEquals(n, 24);
  }
  t.assertEquals(CBOR.encode(24), bins[0]);
});

Deno.test("canonical 0.0", () => { // 0.0 -> 0
  t.assertEquals(CBOR.encode(0.0), new Uint8Array([0])); // 0.0 -> int
});
Deno.test("canonical -0.0", () => { // -0.0 -> 0
  t.assertEquals(CBOR.encode(-0.0), new Uint8Array([0])); // 0.0 -> int
});
Deno.test("canonical 1.5", () => {
  t.assertEquals(CBOR.encode(1.5), new Uint8Array([0xf9, 0x3e, 0x00])); // float16
});
Deno.test("canonical NaN", () => { // NaN -> 0
  t.assertEquals(CBOR.encode(NaN), new Uint8Array([0xf9, 0x7e, 0x00])); // NaN -> float16 （quiet, payload=0）
});
Deno.test("NaN", () => {
  const n = CBOR.decode(Base16.decode("fb7ff8000000000000")); // float64
  const m = CBOR.decode(Base16.decode("f97e00")); // float16
  t.assertEquals(n, m);
  t.assertEquals(CBOR.encode(n), Base16.decode("f97e00"));
  t.assertEquals(CBOR.encode(m), Base16.decode("f97e00"));
});
Deno.test("canonical Infinity", () => {
  t.assertEquals(CBOR.encode(Infinity), new Uint8Array([0xf9, 0x7c, 0x00])); // Infinity -> float16
});
Deno.test("canonical -Infinity", () => {
  t.assertEquals(CBOR.encode(-Infinity), new Uint8Array([0xf9, 0xfc, 0x00])); // -Infinity -> float16
});
Deno.test("canonical 1000.25", () => {
  t.assertEquals(CBOR.encode(1000.25), new Uint8Array([0xfa, 68, 122, 16, 0])); // float32
});
Deno.test("canonical 10000000.25", () => {
  t.assertEquals(CBOR.encode(10000000.25), new Uint8Array([0xfb, 65, 99, 18, 208, 8, 0, 0, 0])); // float64
});

Deno.test("canonical 0n", () => { // 0n -> 0
  t.assertEquals(CBOR.encode(0n), new Uint8Array([0])); // 0n -> int
});
Deno.test("canonical 1n", () => { // 1n -> 1
  t.assertEquals(CBOR.encode(1n), new Uint8Array([1])); // 1n -> int
});
Deno.test("canonical 9007199254740992n", () => { // 9007199254740992n -> 9007199254740992
  t.assertEquals(CBOR.encode(9007199254740992n), new Uint8Array([27, 0, 32, 0, 0, 0, 0, 0, 0])); // 9007199254740992n -> int
});
Deno.test("canonical 9007199254740993n", () => { // 9007199254740993n -> 9007199254740993n (bigint)
  t.assertEquals(CBOR.encode(9007199254740993n), new Uint8Array([194, 71, 32, 0, 0, 0, 0, 0, 1])); // 9007199254740993n -> bigint
});
Deno.test("canonical 0x10000000000000000n", () => { // 0x10000000000000000n -> bigint
  t.assertEquals(CBOR.encode(0x10000000000000000n), new Uint8Array([194, 73, 1, 0, 0, 0, 0, 0, 0, 0, 0])); // -> bigint
});
Deno.test("canonical -0x10000000000000000n", () => { // -0x10000000000000000n -> bigint
  t.assertEquals(CBOR.encode(-0x10000000000000000n), new Uint8Array([195, 72, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])); // -> bigint
});
