# CBOR-es

決定論的な正規化（カノニカライゼーション）ルールを備えた、ピュアJavaScript（ESモジュール）による Concise Binary Object Representation (CBOR) データフォーマット ([RFC 8949](https://datatracker.ietf.org/doc/html/rfc8949)) の実装です。

## 特徴

- **Mapのキー**は**NFC正規化**された上で**UTF-8のバイト辞書順**にソートされ、**キーの重複は許可されません**。
- **数値**は**最短形式**でエンコードされます:
  - 整数は最小のCBOR整数エンコーディングを使用します。
  - 浮動小数点数は、値を損なわない最短のIEEE 754ビット幅を使用します。
  - JavaScriptの安全な整数範囲を超える値（≥ 9007199254740992 または ≤ -9007199254740992）は、**BigInt**（CBOR bignumタグ）としてエンコードされます。

## 使い方

HTMLページで `CBOR.js` をインポートします:
```js
import { CBOR } from "https://code4fukui.github.io/CBOR-es/CBOR.js";

const initial = { Hello: "World" };
const encoded = CBOR.encode(initial);
const decoded = CBOR.decode(encoded);
```
この例を実行すると、`initial` と `decoded` は同じ値になります。

### WebSocketとの組み合わせ

このAPIは、ブラウザの `WebSocket` オブジェクトと連携しやすいように設計されています:
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

## テスト

```sh
deno test --allow-import=code4fukui.github.io,deno.land
```

## ライセンス

MIT License — 詳細は [LICENSE](LICENSE) を参照してください。
