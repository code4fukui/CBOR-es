export function float64ToFloat16(val) {
  const floatView = new Float32Array(1);
  const int32View = new Uint32Array(floatView.buffer);

  floatView[0] = val;
  const x = int32View[0];

  const sign = (x >> 31) & 1;
  let exp = (x >> 23) & 0xff;
  let mant = x & 0x7fffff;

  if (exp === 0xff) {
    // Inf or NaN
    return (sign << 15) | 0x7c00 | (mant ? 1 : 0);
  }

  exp -= 127;
  if (exp < -14) {
    // subnormal or zero
    if (exp < -24) return sign << 15;
    mant |= 0x800000;
    const shift = -exp - 1;
    mant = mant >> (shift + 13);
    return (sign << 15) | mant;
  }

  if (exp > 15) {
    // overflow → Inf
    return (sign << 15) | 0x7c00;
  }

  return (sign << 15) | ((exp + 15) << 10) | (mant >> 13);
}

export function float16ToFloat64(h) {
  const sign = (h & 0x8000) ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const mant = h & 0x3ff;

  if (exp === 0) {
    if (mant === 0) return sign * 0;
    return sign * mant * 2 ** -24;
  }
  if (exp === 31) {
    return mant ? NaN : sign * Infinity;
  }
  return sign * (1 + mant / 1024) * 2 ** (exp - 15);
}

/**
 * Returns true if the number can be represented exactly as IEEE754 float16.
 */
export function fitsFloat16(x) {
  // NaN / Infinity は用途次第だが、ここでは true にする
  if (!Number.isFinite(x)) return true;

  // -0.0 は IEEE754 的には別表現だが、数値比較では 0 と等しい
  // 許可したくない場合は Object.is(x, -0) を弾く
  if (Object.is(x, -0)) return true;

  // float16 の最小・最大正規値
  const MAX = 65504;
  if (Math.abs(x) > MAX) return false;

  // サブノーマル最小値
  const MIN_SUBNORMAL = 2 ** -24;
  if (x !== 0 && Math.abs(x) < MIN_SUBNORMAL) return false;

  // 丸めて戻して一致するか
  return x === float16ToFloat64(float64ToFloat16(x));
}


export function float64ToFloat32(x) {
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = x;      // JSがfloat32に丸める
  return u32[0];   // ビット列として取得
}

export function float32ToFloat64(bits) {
  const u32 = new Uint32Array(1);
  const f32 = new Float32Array(u32.buffer);
  u32[0] = bits;
  return f32[0];   // number（float64）として読む
}

/**
 * Returns true if the number can be represented exactly as IEEE754 float32.
 */
export function fitsFloat32(x) {
  // NaN / Infinity は用途次第。正規化用途では false にするのが無難
  if (!Number.isFinite(x)) return false;

  // -0.0 をどう扱うかはポリシー次第
  // 許可するなら true、禁止するなら以下を false に
  if (Object.is(x, -0)) return true;

  // float32 の最大有限値
  const MAX = 3.4028234663852886e38;
  if (Math.abs(x) > MAX) return false;

  // サブノーマル最小値
  const MIN_SUBNORMAL = 2 ** -149;
  if (x !== 0 && Math.abs(x) < MIN_SUBNORMAL) return false;

  // 丸めて戻して一致するか
  return x === float32ToFloat64(float64ToFloat32(x));
}
