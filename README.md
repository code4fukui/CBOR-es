# CBOR-es

The Concise Binary Object Representation (CBOR) data format ([RFC 8949](https://datatracker.ietf.org/doc/html/rfc8949)) implemented in pure JavaScript (ES Module), with deterministic canonicalization rules:

- **Map keys** are **NFC-normalized** and sorted by **UTF-8 byte lexicographic order**, with **no duplicate keys** allowed.
- **Numbers** are encoded in the **shortest form**:
  - integers use the smallest CBOR integer encoding,
  - floating-point values use the shortest IEEE 754 width that preserves the value,
  - values beyond JavaScript’s safe integer range (≥ 9007199254740992 or ≤ -9007199254740992) are encoded as **BigInt** (CBOR bignum tags).

## API

The `CBOR`-object provides the following two functions:

CBOR.**decode**(*data*)
> Take the Uint8Array object *data* and return it decoded as a JavaScript object.

CBOR.**encode**(*data*)
> Take the JavaScript object *data* and return it encoded as a Uint8Array object.

## Usage

Include `CBOR.js` in your or HTML page:
```js
import { CBOR } from "https://code4fukui.github.io/CBOR-es/CBOR.js";

const initial = { Hello: "World" };
const encoded = CBOR.encode(initial);
const decoded = CBOR.decode(encoded);
```
After running this example `initial` and `decoded` represent the same value.

### Combination with WebSocket

The API was designed to play well with the `WebSocket` object in the browser:
```javascript
const websocket = new WebSocket(url);
websocket.binaryType = "arraybuffer";
...
websocket.onmessage = (event) => {
  const message = CBOR.decode(new Uint8Array(event.data));
};
...
websocket.send(CBOR.encode(message));
```

## Test

```sh
deno test --allow-import=code4fukui.github.io,deno.land
```
