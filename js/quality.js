const cores = navigator.hardwareConcurrency || 4;
const mem = navigator.deviceMemory;
const nativeDpr = window.devicePixelRatio || 1;
const phone = window.innerWidth < 880 || /Mobi|Android/i.test(navigator.userAgent);
const weak = phone || cores <= 4 || (typeof mem === "number" && mem <= 4);
const desktop = !phone;
const high = desktop && cores >= 8 && (typeof mem !== "number" || mem >= 8);
const low = phone || weak;
const mid = !low && !high;

export const QUALITY = {
  low,
  mid,
  high,
  dprCap: phone ? 1 : high ? 1.35 : 1.15,
  dpr: Math.min(nativeDpr, phone ? 1 : high ? 1.35 : 1.15),
  antialias: !phone,
  shadow: phone ? 512 : 1024,
  shadowSoft: !phone,
  maxLights: phone ? 2 : high ? 4 : 3,
  physical: false,
  aniso: phone ? 2 : high ? 8 : 4,
  pmrem: 0.04,
  texSize: phone ? 256 : high ? 512 : 384,
  fabricSize: phone ? 256 : high ? 1024 : 512,
  clothSegs: phone ? 20 : high ? 48 : 32,
  normals: high,
  wear: high,
  segs: phone ? 10 : high ? 16 : 12,
  stockLite: !high,
  damping: !low,
};

export function currentDpr() {
  return Math.min(window.devicePixelRatio || 1, QUALITY.dprCap);
}

export function capTex(w, h) {
  const cap = QUALITY.texSize;
  const scale = Math.min(1, cap / Math.max(w, h));
  return {
    w: Math.max(64, Math.round(w * scale)),
    h: Math.max(32, Math.round(h * scale)),
  };
}

export function dropQuality() {
  const nextDpr = Math.max(1, QUALITY.dprCap - 0.2);
  const nextShadow = QUALITY.shadow <= 384 ? 0 : Math.floor(QUALITY.shadow * 0.65);
  if (nextDpr === QUALITY.dprCap && nextShadow === QUALITY.shadow) return false;
  QUALITY.dprCap = nextDpr;
  QUALITY.dpr = Math.min(nativeDpr, nextDpr);
  QUALITY.shadow = nextShadow;
  QUALITY.maxLights = Math.max(1, QUALITY.maxLights - 1);
  QUALITY.shadowSoft = false;
  return true;
}
