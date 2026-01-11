//import { CBOR } from "https://code4fukui.github.io/CBOR-es/CBOR.js";
import { CBOR } from "./CBOR.js";

const initial = { Hello: "World" };
const encoded = CBOR.encode(initial);
const decoded = CBOR.decode(encoded);

console.log({ encoded }, { decoded });

{
  const initial = { Hello: new Uint8Array([1, 2, 3]) };
  const encoded = CBOR.encode(initial);
  const decoded = CBOR.decode(encoded);

  console.log({ encoded }, { decoded });
}
