export function parseRatioParam(param: string | null | undefined, fallback = 16 / 9) {
  if (!param) return fallback;
  const [wStr, hStr] = param.split(":");
  const w = Number(wStr);
  const h = Number(hStr);
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return fallback;
  return w / h;
}

