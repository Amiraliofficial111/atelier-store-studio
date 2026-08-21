import * as THREE from "three";
import { QUALITY } from "./quality.js";

const PRESET_CACHE = new Map();
const NORMAL_CACHE = new Map();
let wearCached = null;
let printCached = null;

function canvasTex(draw, size = 512, colorSpace = true) {
  size = Math.min(size, QUALITY.texSize);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d", { willReadFrequently: true }), size);
  const tex = new THREE.CanvasTexture(c);
  if (colorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = QUALITY.aniso;
  tex.generateMipmaps = size >= 256;
  tex.minFilter = size >= 256 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.needsUpdate = true;
  tex.userData.shared = true;
  return tex;
}

export const MATERIALS = [
  { id: "reeded-glass", label: "Reeded glass" },
  { id: "brushed-steel", label: "Brushed steel" },
  { id: "brushed-brass", label: "Brushed brass" },
  { id: "brushed-champagne", label: "Champagne metal" },
  { id: "statuario", label: "Statuario marble" },
  { id: "calacatta", label: "Calacatta marble" },
  { id: "travertine", label: "Travertine" },
  { id: "terrazzo-chips", label: "Color terrazzo" },
  { id: "terrazzo-noir", label: "Noir terrazzo" },
  { id: "polished-concrete", label: "Polished concrete" },
  { id: "concrete-grey", label: "Grey concrete" },
  { id: "zellige", label: "Emerald zellige" },
  { id: "limestone", label: "Honed limestone" },
  { id: "tadelakt", label: "Tadelakt" },
  { id: "stucco-fine", label: "Stucco plaster" },
  { id: "fluted-walnut", label: "Fluted walnut" },
  { id: "herringbone", label: "Walnut parquet" },
  { id: "corten", label: "Corten steel" },
  { id: "oxidized-steel", label: "Oxidized steel" },
  { id: "patina-copper", label: "Patinated copper" },
  { id: "velvet-teal", label: "Teal velvet" },
  { id: "boucle", label: "Bouclé" },
  { id: "chunky-knit", label: "Chunky knit" },
  { id: "wool-weave", label: "Woven wool" },
  { id: "woven-jute", label: "Woven jute" },
  { id: "braided-jute", label: "Braided jute" },
  { id: "rattan", label: "Woven rattan" },
  { id: "leather-emboss", label: "Embossed leather" },
  { id: "silk", label: "Silk paint" },
  { id: "limewash", label: "Lime plaster" },
  { id: "brick", label: "Brick" },
];

export const WALL_MATERIALS = MATERIALS;

export const WALL_FINISH = new Set([
  "drywall",
  "silk",
  "limewash",
  "venetian",
  "microcement",
  "clay",
  "travertine",
  "fluted",
  "linen",
  "concrete-wall",
  "paint",
  "plaster",
  "stucco",
  "wallpaper",
  "reeded-glass",
  "brushed-steel",
  "brushed-brass",
  "brushed-champagne",
  "statuario",
  "calacatta",
  "terrazzo-chips",
  "terrazzo-noir",
  "polished-concrete",
  "concrete-grey",
  "zellige",
  "limestone",
  "tadelakt",
  "stucco-fine",
  "fluted-walnut",
  "herringbone",
  "corten",
  "oxidized-steel",
  "patina-copper",
  "velvet-teal",
  "boucle",
  "chunky-knit",
  "wool-weave",
  "woven-jute",
  "braided-jute",
  "rattan",
  "leather-emboss",
]);

export function isWallFinish(id) {
  return WALL_FINISH.has(id);
}

const WALL_ALIAS = {
  paint: "drywall",
  plaster: "limewash",
  stucco: "microcement",
  wallpaper: "linen",
};

export function resolveWallId(id) {
  return WALL_ALIAS[id] || id;
}

export const SURFACE_PBR = {
  drywall: { roughness: 0.48, metalness: 0, clearcoat: 0.1 },
  silk: { roughness: 0.32, metalness: 0, clearcoat: 0.16 },
  limewash: { roughness: 0.64, metalness: 0, clearcoat: 0.03 },
  venetian: { roughness: 0.28, metalness: 0.02, clearcoat: 0.22 },
  microcement: { roughness: 0.42, metalness: 0.03, clearcoat: 0.08 },
  clay: { roughness: 0.72, metalness: 0, clearcoat: 0 },
  travertine: { roughness: 0.46, metalness: 0.04, clearcoat: 0.06 },
  fluted: { roughness: 0.38, metalness: 0.02, clearcoat: 0.12 },
  linen: { roughness: 0.78, metalness: 0, clearcoat: 0 },
  "concrete-wall": { roughness: 0.76, metalness: 0.02, clearcoat: 0 },
  paint: { roughness: 0.48, metalness: 0, clearcoat: 0.1 },
  stucco: { roughness: 0.42, metalness: 0.03, clearcoat: 0.08 },
  plaster: { roughness: 0.64, metalness: 0, clearcoat: 0.03 },
  wallpaper: { roughness: 0.78, metalness: 0, clearcoat: 0 },
  "reeded-glass": { roughness: 0.08, metalness: 0.04, clearcoat: 0.55 },
  "brushed-steel": { roughness: 0.28, metalness: 0.92, clearcoat: 0.08 },
  "brushed-brass": { roughness: 0.3, metalness: 0.9, clearcoat: 0.1 },
  "brushed-champagne": { roughness: 0.26, metalness: 0.88, clearcoat: 0.12 },
  statuario: { roughness: 0.06, metalness: 0.08, clearcoat: 0.42 },
  calacatta: { roughness: 0.055, metalness: 0.08, clearcoat: 0.4 },
  "terrazzo-chips": { roughness: 0.22, metalness: 0.03, clearcoat: 0.18 },
  "terrazzo-noir": { roughness: 0.08, metalness: 0.06, clearcoat: 0.48 },
  "polished-concrete": { roughness: 0.12, metalness: 0.06, clearcoat: 0.38 },
  "concrete-grey": { roughness: 0.82, metalness: 0.02, clearcoat: 0 },
  zellige: { roughness: 0.08, metalness: 0.06, clearcoat: 0.72 },
  limestone: { roughness: 0.78, metalness: 0, clearcoat: 0 },
  tadelakt: { roughness: 0.42, metalness: 0.02, clearcoat: 0.08 },
  "stucco-fine": { roughness: 0.76, metalness: 0, clearcoat: 0 },
  "fluted-walnut": { roughness: 0.4, metalness: 0.04, clearcoat: 0.08 },
  corten: { roughness: 0.72, metalness: 0.28, clearcoat: 0 },
  "oxidized-steel": { roughness: 0.68, metalness: 0.35, clearcoat: 0 },
  "patina-copper": { roughness: 0.55, metalness: 0.42, clearcoat: 0.04 },
  "velvet-teal": { roughness: 0.88, metalness: 0, clearcoat: 0 },
  boucle: { roughness: 0.92, metalness: 0, clearcoat: 0 },
  "chunky-knit": { roughness: 0.9, metalness: 0, clearcoat: 0 },
  "wool-weave": { roughness: 0.86, metalness: 0, clearcoat: 0 },
  "woven-jute": { roughness: 0.88, metalness: 0, clearcoat: 0 },
  "braided-jute": { roughness: 0.9, metalness: 0, clearcoat: 0 },
  rattan: { roughness: 0.7, metalness: 0.02, clearcoat: 0.04 },
  "leather-emboss": { roughness: 0.48, metalness: 0.04, clearcoat: 0.06 },
  brick: { roughness: 0.82, metalness: 0.02, clearcoat: 0 },
  wood: { roughness: 0.38, metalness: 0.03, clearcoat: 0.14 },
  tiles: { roughness: 0.055, metalness: 0.08, clearcoat: 0.35 },
  "tile-white": { roughness: 0.22, metalness: 0.05, clearcoat: 0.78 },
  "tile-ivory": { roughness: 0.22, metalness: 0.05, clearcoat: 0.74 },
  "tile-beige": { roughness: 0.22, metalness: 0.05, clearcoat: 0.72 },
  "tile-gray": { roughness: 0.22, metalness: 0.05, clearcoat: 0.76 },
  "tile-slate": { roughness: 0.22, metalness: 0.05, clearcoat: 0.74 },
  "tile-charcoal": { roughness: 0.22, metalness: 0.06, clearcoat: 0.8 },
  "tile-black": { roughness: 0.2, metalness: 0.07, clearcoat: 0.84 },
  "tile-subway": { roughness: 0.22, metalness: 0.05, clearcoat: 0.76 },
  "tile-hex": { roughness: 0.24, metalness: 0.04, clearcoat: 0.7 },
  "tile-check": { roughness: 0.22, metalness: 0.05, clearcoat: 0.78 },
  luxury: { roughness: 0.045, metalness: 0.1, clearcoat: 0.4 },
  carrara: { roughness: 0.05, metalness: 0.08, clearcoat: 0.35 },
  espresso: { roughness: 0.045, metalness: 0.12, clearcoat: 0.42 },
  photo: { roughness: 0.04, metalness: 0.1, clearcoat: 0.45 },
  mobileFloor: { roughness: 0.26, metalness: 0.05, clearcoat: 0.82 },
  concrete: { roughness: 0.8, metalness: 0.03, clearcoat: 0 },
  marble: { roughness: 0.08, metalness: 0.06, clearcoat: 0.28 },
  terrazzo: { roughness: 0.1, metalness: 0.04, clearcoat: 0.42 },
  "tz-dove": { roughness: 0.1, metalness: 0.04, clearcoat: 0.4 },
  "tz-cinnamon": { roughness: 0.1, metalness: 0.04, clearcoat: 0.4 },
  "tz-mint": { roughness: 0.11, metalness: 0.03, clearcoat: 0.38 },
  "tz-ginger": { roughness: 0.07, metalness: 0.05, clearcoat: 0.5 },
  "tz-spearmint": { roughness: 0.1, metalness: 0.04, clearcoat: 0.4 },
  "tz-cottage": { roughness: 0.1, metalness: 0.04, clearcoat: 0.42 },
  "tz-turtle": { roughness: 0.1, metalness: 0.04, clearcoat: 0.4 },
  "tz-glossy": { roughness: 0.05, metalness: 0.06, clearcoat: 0.58 },
  "tz-sage": { roughness: 0.09, metalness: 0.04, clearcoat: 0.45 },
  "tz-green": { roughness: 0.09, metalness: 0.04, clearcoat: 0.44 },
  granite: { roughness: 0.28, metalness: 0.05, clearcoat: 0.04 },
  herringbone: { roughness: 0.34, metalness: 0.03, clearcoat: 0.08 },
  walnut: { roughness: 0.4, metalness: 0.04, clearcoat: 0.06 },
  stone: { roughness: 0.16, metalness: 0.08, clearcoat: 0.22 },
  carpet: { roughness: 0.92, metalness: 0, clearcoat: 0 },
  checker: { roughness: 0.2, metalness: 0.03, clearcoat: 0.06 },
  metal: { roughness: 0.16, metalness: 0.84, clearcoat: 0.2 },
  "roof-goldleaf": { roughness: 0.22, metalness: 0.62, clearcoat: 0.28 },
  "roof-silk": { roughness: 0.1, metalness: 0.06, clearcoat: 0.52 },
  "roof-onyx": { roughness: 0.18, metalness: 0.12, clearcoat: 0.34 },
  "roof-noir": { roughness: 0.78, metalness: 0.08, clearcoat: 0.06 },
  "roof-marble": { roughness: 0.08, metalness: 0.08, clearcoat: 0.42 },
  "roof-champagne": { roughness: 0.28, metalness: 0.58, clearcoat: 0.2 },
  "roof-fluted": { roughness: 0.62, metalness: 0.03, clearcoat: 0.08 },
  "roof-walnutinlay": { roughness: 0.34, metalness: 0.08, clearcoat: 0.12 },
  "roof-crystal": { roughness: 0.14, metalness: 0.1, clearcoat: 0.38 },
  "roof-lacquer": { roughness: 0.05, metalness: 0.18, clearcoat: 0.62 },
  "roof-travertine": { roughness: 0.52, metalness: 0.04, clearcoat: 0.1 },
  "roof-bronze": { roughness: 0.3, metalness: 0.72, clearcoat: 0.16 },
  "roof-alabaster": { roughness: 0.2, metalness: 0.04, clearcoat: 0.24 },
  "roof-pearl": { roughness: 0.36, metalness: 0.05, clearcoat: 0.18 },
  "roof-inlay": { roughness: 0.42, metalness: 0.12, clearcoat: 0.14 },
  "roof-stepcove": { roughness: 0.72, metalness: 0.03, clearcoat: 0.08 },
};

export function loadPhotoTextures() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = QUALITY.aniso;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      tex.userData.shared = true;
      PRESET_CACHE.set("photo", tex);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "./textures/luxury-marble.png";
  });
}

export function makePresetTexture(id) {
  if (!id) return null;
  id = resolveWallId(id);
  if (id.startsWith("roof-")) id = resolveRoofId(id);
  if (PRESET_CACHE.has(id)) return PRESET_CACHE.get(id);
  const built = buildPresetTexture(id);
  if (built) PRESET_CACHE.set(id, built);
  return built;
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export const TERRAZZO_SPECS = {
  "tz-dove": {
    base: "#c4bbb0",
    chips: [
      { c: "#1c1c1c", w: 0.88 },
      { c: "#3d3a38", w: 0.72 },
      { c: "#6a6560", w: 0.4 },
      { c: "#d4c4a0", w: 0.16 },
      { c: "#eee8e0", w: 0.28 },
    ],
    count: 3400,
    min: 1.1,
    max: 3.5,
    squash: 0.7,
    noise: 10,
    seed: 11,
  },
  "tz-cinnamon": {
    base: "#8f4a32",
    chips: [
      { c: "#3a1810", w: 0.82 },
      { c: "#e6d2bc", w: 0.46 },
      { c: "#6b2a1c", w: 0.52 },
      { c: "#c46a48", w: 0.34 },
    ],
    count: 2700,
    min: 1.2,
    max: 3.8,
    squash: 0.64,
    noise: 12,
    seed: 22,
  },
  "tz-mint": {
    base: "#b7c4b2",
    chips: [
      { c: "#2a3328", w: 0.55 },
      { c: "#1a1c18", w: 0.42 },
      { c: "#dce6d6", w: 0.32 },
      { c: "#6a7a64", w: 0.26 },
    ],
    count: 3800,
    min: 0.8,
    max: 2.3,
    squash: 0.76,
    noise: 8,
    seed: 33,
  },
  "tz-ginger": {
    base: "#c9a46a",
    chips: [
      { c: "#f0e4c8", w: 0.52 },
      { c: "#8a5a28", w: 0.34 },
      { c: "#5a3a18", w: 0.2 },
      { c: "#e8d4a0", w: 0.4 },
    ],
    count: 1700,
    min: 1.7,
    max: 5,
    squash: 0.58,
    noise: 10,
    seed: 44,
  },
  "tz-spearmint": {
    base: "#4a8a4a",
    chips: [
      { c: "#142214", w: 0.86 },
      { c: "#1a2e1a", w: 0.7 },
      { c: "#2a5a2a", w: 0.38 },
      { c: "#c8e0c0", w: 0.14 },
    ],
    count: 3100,
    min: 1.1,
    max: 3.2,
    squash: 0.7,
    noise: 10,
    seed: 55,
  },
  "tz-cottage": {
    base: "#d8d6d2",
    chips: [
      { c: "#2a2a2a", w: 0.72 },
      { c: "#5a5856", w: 0.55 },
      { c: "#f4f2ee", w: 0.48 },
      { c: "#8a8682", w: 0.3 },
    ],
    count: 2500,
    min: 1.8,
    max: 4.6,
    squash: 0.64,
    noise: 8,
    seed: 66,
  },
  "tz-turtle": {
    base: "#8a8682",
    chips: [
      { c: "#1a1a1a", w: 0.9 },
      { c: "#f2f0ec", w: 0.72 },
      { c: "#3a3a38", w: 0.58 },
      { c: "#c8c4c0", w: 0.34 },
    ],
    count: 4000,
    min: 0.85,
    max: 2.5,
    squash: 0.8,
    noise: 9,
    seed: 77,
  },
  "tz-glossy": {
    base: "#3a2a22",
    chips: [
      { c: "#f0e6d4", w: 0.46 },
      { c: "#c4a882", w: 0.4 },
      { c: "#8a6a48", w: 0.34 },
      { c: "#1a1210", w: 0.28 },
    ],
    count: 1500,
    min: 2.2,
    max: 6.6,
    squash: 0.54,
    noise: 8,
    seed: 88,
    chunky: true,
  },
  "tz-sage": {
    base: "#8a8a6e",
    chips: [
      { c: "#f4f0e4", w: 0.72 },
      { c: "#e8e0d0", w: 0.55 },
      { c: "#d4ccb8", w: 0.3 },
      { c: "#4a4a38", w: 0.14 },
    ],
    count: 380,
    min: 5.2,
    max: 14,
    squash: 0.7,
    noise: 8,
    seed: 99,
    chunky: true,
  },
  "tz-green": {
    base: "#1e4a42",
    chips: [
      { c: "#e8f0e8", w: 0.72 },
      { c: "#a8c4b0", w: 0.44 },
      { c: "#0a1c18", w: 0.4 },
      { c: "#3a7a6a", w: 0.3 },
    ],
    count: 3300,
    min: 0.9,
    max: 2.8,
    squash: 0.74,
    noise: 8,
    seed: 101,
  },
};

export function isTerrazzo(id) {
  return id === "terrazzo" || (id && id.startsWith("tz-"));
}

export const FLOOR_MATERIALS = [
  { id: "tz-dove", label: "Morning Dove" },
  { id: "tz-cinnamon", label: "Cinnamon" },
  { id: "tz-mint", label: "Mint Julep" },
  { id: "tz-ginger", label: "Ginger Terrazzo" },
  { id: "tz-spearmint", label: "Spearmint" },
  { id: "tz-cottage", label: "Cottage Gray" },
  { id: "tz-turtle", label: "Turtle Dove" },
  { id: "tz-glossy", label: "Glossy Terrazzo" },
  { id: "tz-sage", label: "Sage Terrazzo" },
  { id: "tz-green", label: "Green Terrazzo" },
  { id: "tile-white", label: "White gloss tiles" },
  { id: "tile-ivory", label: "Ivory tiles" },
  { id: "tile-beige", label: "Beige tiles" },
  { id: "tile-gray", label: "Gray tiles" },
  { id: "tile-slate", label: "Slate tiles" },
  { id: "tile-charcoal", label: "Charcoal tiles" },
  { id: "tile-black", label: "Black gloss tiles" },
  { id: "tile-subway", label: "Subway tiles" },
  { id: "tile-hex", label: "Hex mosaic" },
  { id: "tile-check", label: "Checker tiles" },
  { id: "tiles", label: "Cream tiles" },
  { id: "luxury", label: "Luxury mix" },
  { id: "carrara", label: "Carrara" },
  { id: "espresso", label: "Espresso" },
  { id: "photo", label: "Photo marble" },
  { id: "marble", label: "Marble slab" },
  { id: "mobileFloor", label: "Mobile porcelain" },
  { id: "stone", label: "Taupe stone" },
  { id: "terrazzo", label: "Classic terrazzo" },
];

export function isTileTexture(id) {
  return id === "tiles" || (id && id.startsWith("tile-"));
}

export function isShineTexture(id) {
  return FLOOR_MATERIALS.some((m) => m.id === id) || isTerrazzo(id) || isTileTexture(id);
}

export function isRoofTexture(id) {
  return id && id.startsWith("roof-");
}

const ROOF_ALIAS = {
  "roof-coffered": "roof-goldleaf",
  "roof-gold": "roof-goldleaf",
  "roof-tin": "roof-goldleaf",
  "roof-stretch": "roof-silk",
  "roof-wave": "roof-silk",
  "roof-dark": "roof-noir",
  "roof-stars": "roof-noir",
  "roof-border": "roof-noir",
  "roof-walnut": "roof-walnutinlay",
  "roof-slats": "roof-walnutinlay",
  "roof-beam": "roof-walnutinlay",
  "roof-combo": "roof-walnutinlay",
  "roof-rattan": "roof-walnutinlay",
  "roof-tray": "roof-champagne",
  "roof-island": "roof-champagne",
  "roof-cove": "roof-stepcove",
  "roof-pop": "roof-stepcove",
  "roof-ripple": "roof-stepcove",
  "roof-nested": "roof-stepcove",
  "roof-double": "roof-stepcove",
  "roof-plus": "roof-stepcove",
  "roof-brass": "roof-bronze",
  "roof-metal": "roof-bronze",
  "roof-perforated": "roof-bronze",
  "roof-industrial": "roof-bronze",
  "roof-grid": "roof-pearl",
  "roof-acoustic": "roof-pearl",
  "roof-tech": "roof-pearl",
  "roof-gypsum": "roof-pearl",
  "roof-plaster": "roof-pearl",
  "roof-vault": "roof-pearl",
  "roof-cloud": "roof-pearl",
  "roof-mirror": "roof-lacquer",
  "roof-dome": "roof-crystal",
  "roof-rings": "roof-crystal",
  "roof-circles": "roof-crystal",
  "roof-skylight": "roof-alabaster",
  "roof-baffle": "roof-fluted",
  "roof-slots": "roof-fluted",
  "roof-board": "roof-fluted",
  "roof-shiplap": "roof-fluted",
  "roof-jaali": "roof-inlay",
  "roof-diamond": "roof-inlay",
  "roof-hex": "roof-inlay",
  "roof-waffle": "roof-travertine",
};

export function resolveRoofId(id) {
  return ROOF_ALIAS[id] || id;
}

export const ROOF_MATERIALS = [
  { id: "roof-goldleaf", label: "Gold leaf coffers" },
  { id: "roof-silk", label: "Silk stretch" },
  { id: "roof-marble", label: "Calacatta marble" },
  { id: "roof-champagne", label: "Champagne tray" },
  { id: "roof-stepcove", label: "Stepped ivory cove" },
  { id: "roof-pearl", label: "Pearl gypsum" },
  { id: "roof-onyx", label: "Backlit onyx" },
  { id: "roof-alabaster", label: "Alabaster glow" },
  { id: "roof-noir", label: "Noir hotel" },
  { id: "roof-lacquer", label: "Piano lacquer" },
  { id: "roof-walnutinlay", label: "Walnut + brass" },
  { id: "roof-bronze", label: "Bronze linear" },
  { id: "roof-fluted", label: "Fluted plaster" },
  { id: "roof-travertine", label: "Travertine coffers" },
  { id: "roof-crystal", label: "Crystal well" },
  { id: "roof-inlay", label: "Gold geometric inlay" },
];

function paintTerrazzo(ctx, s, spec) {
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, s, s);
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash(i * 0.013 + spec.seed) - 0.5) * spec.noise;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.92));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.85));
  }
  ctx.putImageData(img, 0, 0);
  const chipsN = QUALITY.high ? spec.count : QUALITY.mid ? Math.min(spec.count, 900) : Math.min(spec.count, 380);
  for (let i = 0; i < chipsN; i++) {
    const ch = spec.chips[Math.floor(hash(i * 19.7 + spec.seed) * spec.chips.length)];
    if (hash(i * 7.3 + spec.seed * 3) > ch.w) continue;
    const x = hash(i * 31.1 + 1.4) * s;
    const y = hash(i * 47.9 + 2.2) * s;
    const sc = spec.min + hash(i * 11.6) * (spec.max - spec.min);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(hash(i * 5.4) * Math.PI * 2);
    ctx.fillStyle = ch.c;
    ctx.beginPath();
    const sides = spec.chunky ? 6 : 4;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const r = sc * (0.52 + hash(i * 13.2 + k * 1.7) * 0.58);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * spec.squash;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function paintMarble(ctx, x, y, w, h, kind, seed) {
  const pal = {
    cream: { r: 246, g: 238, b: 224, vein: "rgba(168,138,98,0.22)", hi: "rgba(255,252,246,0.16)" },
    grey: { r: 172, g: 164, b: 168, vein: "rgba(78,68,80,0.28)", hi: "rgba(232,226,230,0.2)" },
    dark: { r: 36, g: 24, b: 20, vein: "rgba(244,236,220,0.55)", hi: "rgba(198,165,106,0.22)" },
  };
  const p = pal[kind] || pal.cream;
  ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
  ctx.fillRect(x, y, w, h);
  const img = ctx.getImageData(x, y, w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const n = (hash(px * 0.07 + seed) + hash(py * 0.09 + seed * 1.7) - 1) * 10;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.85));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.7));
    }
  }
  ctx.putImageData(img, x, y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineCap = "round";
  const veins = kind === "dark" ? 16 : 10;
  for (let k = 0; k < veins; k++) {
    const a = hash(seed + k * 11);
    ctx.strokeStyle = k % 3 ? p.vein : p.hi;
    ctx.lineWidth = kind === "dark" ? 1 + (k % 4) * 0.7 : 0.8 + (k % 3) * 0.5;
    ctx.beginPath();
    const x0 = x + a * w;
    const y0 = y + hash(seed + k * 19) * h;
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x + hash(seed + k * 3) * w,
      y + hash(seed + k * 5) * h,
      x + hash(seed + k * 7) * w,
      y + hash(seed + k * 9) * h,
      x + hash(seed + k * 13) * w,
      y + hash(seed + k * 17) * h
    );
    ctx.stroke();
  }
  ctx.restore();
}

function paintPorcelain(ctx, x, y, w, h, seed) {
  const warm = hash(seed) * 10;
  const br = 214 + warm;
  const bg = 212 + warm * 0.55;
  const bb = 206 + warm * 0.25;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(x, y, w, h);
  const img = ctx.getImageData(x, y, w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const n1 = hash(px * 0.012 + seed) + hash(py * 0.011 + seed * 1.3);
      const n2 = hash(px * 0.038 + py * 0.034 + seed * 2);
      const n3 = hash(px * 0.14 + py * 0.12 + seed * 3.1);
      const cloud = (n1 - 1) * 11 + (n2 - 0.5) * 5.5 + (n3 - 0.5) * 2.2;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + cloud));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + cloud * 0.93));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + cloud * 0.82));
    }
  }
  ctx.putImageData(img, x, y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineCap = "round";
  for (let k = 0; k < 9; k++) {
    ctx.strokeStyle = k % 2 ? "rgba(78,76,74,0.075)" : "rgba(255,255,255,0.055)";
    ctx.lineWidth = 0.7 + (k % 4) * 0.4;
    ctx.beginPath();
    ctx.moveTo(x + hash(seed + k * 11) * w, y + hash(seed + k * 19) * h);
    ctx.bezierCurveTo(
      x + hash(seed + k * 3) * w,
      y + hash(seed + k * 5) * h,
      x + hash(seed + k * 7) * w,
      y + hash(seed + k * 9) * h,
      x + hash(seed + k * 13) * w,
      y + hash(seed + k * 17) * h
    );
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  for (let i = 0; i < 90; i++) {
    const px = x + hash(seed + i * 4.1) * w;
    const py = y + hash(seed + i * 6.7) * h;
    ctx.fillRect(px, py, 1.1, 1.1);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = "rgba(40,38,36,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function buildMobileFloor() {
  const s = 1536;
  const albedo = document.createElement("canvas");
  albedo.width = albedo.height = s;
  const actx = albedo.getContext("2d");
  const rough = document.createElement("canvas");
  rough.width = rough.height = s;
  const rctx = rough.getContext("2d");
  actx.fillStyle = "#8d8b87";
  actx.fillRect(0, 0, s, s);
  rctx.fillStyle = "#d0d0d0";
  rctx.fillRect(0, 0, s, s);
  const cols = 3;
  const gap = 3;
  const tw = (s - gap * (cols + 1)) / cols;
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      const x = gap + col * (tw + gap);
      const y = gap + row * (tw + gap);
      paintPorcelain(actx, x, y, tw, tw, 41 + row * 11 + col * 17);
      rctx.fillStyle = "#2c2c2c";
      rctx.fillRect(x, y, tw, tw);
      const rim = rctx.getImageData(x, y, tw, tw);
      for (let i = 0; i < rim.data.length; i += 4) {
        const n = ((i * 17 + row * 9 + col * 5) % 13) - 5;
        const v = Math.max(22, Math.min(58, 40 + n));
        rim.data[i] = rim.data[i + 1] = rim.data[i + 2] = v;
      }
      rctx.putImageData(rim, x, y);
    }
  }
  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = QUALITY.aniso;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;
  map.userData.shared = true;
  const rmap = new THREE.CanvasTexture(rough);
  rmap.colorSpace = THREE.NoColorSpace;
  rmap.wrapS = rmap.wrapT = THREE.RepeatWrapping;
  rmap.anisotropy = QUALITY.aniso;
  rmap.generateMipmaps = true;
  rmap.minFilter = THREE.LinearMipmapLinearFilter;
  rmap.needsUpdate = true;
  rmap.userData.shared = true;
  map.userData.roughnessMap = rmap;
  return map;
}

const TILE_COLORS = {
  "tile-white": [236, 234, 230],
  "tile-ivory": [236, 228, 214],
  "tile-beige": [214, 198, 176],
  "tile-gray": [176, 176, 174],
  "tile-slate": [132, 142, 148],
  "tile-charcoal": [62, 62, 64],
  "tile-black": [22, 22, 24],
  "tile-subway": [238, 236, 232],
  "tile-hex": [210, 208, 202],
};

function fillCeramicTile(ctx, x, y, w, h, rgb, seed) {
  const cnv = ctx.canvas;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const cw = Math.min(cnv.width, Math.ceil(x + w)) - x0;
  const ch = Math.min(cnv.height, Math.ceil(y + h)) - y0;
  if (cw < 2 || ch < 2) return;
  const n0 = (hash(seed) - 0.5) * 12;
  ctx.fillStyle = `rgb(${rgb[0] + n0},${rgb[1] + n0 * 0.9},${rgb[2] + n0 * 0.75})`;
  ctx.fillRect(x0, y0, cw, ch);
  const img = ctx.getImageData(x0, y0, cw, ch);
  for (let py = 0; py < ch; py++) {
    for (let px = 0; px < cw; px++) {
      const i = (py * cw + px) * 4;
      const n = (hash(px * 0.07 + seed) + hash(py * 0.06 + seed * 1.4) - 1) * 5.5;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.94));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.88));
    }
  }
  ctx.putImageData(img, x0, y0);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x0 + 1.4, y0 + 1.4, cw - 2.8, ch - 2.8);
}

function makeMaps(s, grout) {
  const albedo = document.createElement("canvas");
  albedo.width = albedo.height = s;
  const actx = albedo.getContext("2d");
  const rough = document.createElement("canvas");
  rough.width = rough.height = s;
  const rctx = rough.getContext("2d");
  actx.fillStyle = grout;
  actx.fillRect(0, 0, s, s);
  rctx.fillStyle = "#c8c8c8";
  rctx.fillRect(0, 0, s, s);
  return { albedo, actx, rough, rctx };
}

function finishTileMaps(albedo, rough) {
  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = QUALITY.aniso;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;
  map.userData.shared = true;
  const rmap = new THREE.CanvasTexture(rough);
  rmap.colorSpace = THREE.NoColorSpace;
  rmap.wrapS = rmap.wrapT = THREE.RepeatWrapping;
  rmap.anisotropy = QUALITY.aniso;
  rmap.generateMipmaps = true;
  rmap.minFilter = THREE.LinearMipmapLinearFilter;
  rmap.needsUpdate = true;
  rmap.userData.shared = true;
  map.userData.roughnessMap = rmap;
  return map;
}

function markTileRough(rctx, x, y, w, h) {
  rctx.fillStyle = "#2a2a2a";
  rctx.fillRect(x, y, w, h);
}

function buildCeramicTiles(id) {
  const s = 1024;
  const grout = id === "tile-black" || id === "tile-charcoal" ? "#3a3a3c" : "#9a9894";
  const { albedo, actx, rough, rctx } = makeMaps(s, grout);

  if (id === "tile-subway") {
    const rows = 8;
    const cols = 4;
    const gap = 4;
    const tw = (s - gap * (cols + 1)) / cols;
    const th = (s - gap * (rows + 1)) / rows;
    const rgb = TILE_COLORS[id];
    for (let r = 0; r < rows; r++) {
      const ox = r % 2 ? tw * 0.5 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = gap + c * (tw + gap) + ox;
        const y = gap + r * (th + gap);
        fillCeramicTile(actx, x, y, tw, th, rgb, 20 + r * 8 + c * 5);
        markTileRough(rctx, x, y, tw, th);
      }
    }
    return finishTileMaps(albedo, rough);
  }

  if (id === "tile-hex") {
    const radius = 46;
    const h = radius * Math.sqrt(3);
    const rgb = TILE_COLORS[id];
    let n = 0;
    for (let row = -1, y = radius; y < s + radius; y += h * 0.75, row++) {
      const ox = row % 2 ? radius * 0.866 : 0;
      for (let x = -radius + ox; x < s + radius; x += radius * 1.732) {
        actx.save();
        actx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = x + Math.cos(a) * (radius - 2.2);
          const py = y + Math.sin(a) * (radius - 2.2);
          if (k === 0) actx.moveTo(px, py);
          else actx.lineTo(px, py);
        }
        actx.closePath();
        actx.clip();
        fillCeramicTile(actx, x - radius, y - radius, radius * 2, radius * 2, rgb, 30 + n);
        actx.restore();
        rctx.save();
        rctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = x + Math.cos(a) * (radius - 2.2);
          const py = y + Math.sin(a) * (radius - 2.2);
          if (k === 0) rctx.moveTo(px, py);
          else rctx.lineTo(px, py);
        }
        rctx.closePath();
        rctx.fillStyle = "#2a2a2a";
        rctx.fill();
        rctx.restore();
        n += 1;
      }
    }
    return finishTileMaps(albedo, rough);
  }

  const cols = 4;
  const gap = 5;
  const tw = (s - gap * (cols + 1)) / cols;
  for (let r = 0; r < cols; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gap + c * (tw + gap);
      const y = gap + r * (tw + gap);
      let rgb = TILE_COLORS[id] || [230, 226, 218];
      if (id === "tile-check") rgb = (r + c) % 2 ? [236, 234, 230] : [24, 24, 26];
      fillCeramicTile(actx, x, y, tw, tw, rgb, 12 + r * 9 + c * 7);
      markTileRough(rctx, x, y, tw, tw);
    }
  }
  return finishTileMaps(albedo, rough);
}

function marbleTiles(kinds, cols = 2) {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#cfc6ba";
    ctx.fillRect(0, 0, s, s);
    const rows = Math.ceil(kinds.length / cols);
    const gap = 3;
    const tw = (s - gap * (cols + 1)) / cols;
    const th = (s - gap * (rows + 1)) / rows;
    kinds.forEach((kind, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      paintMarble(ctx, gap + c * (tw + gap), gap + r * (th + gap), tw, th, kind, 11 + i * 17);
    });
  }, 1024);
}

function n2(x, y, seed = 0) {
  return hash(x * 12.9898 + y * 78.233 + seed * 37.719);
}

function fbm(x, y, seed, oct = 2) {
  let v = 0;
  let a = 1;
  let f = 1;
  let tot = 0;
  for (let i = 0; i < oct; i++) {
    v += n2(x * f, y * f, seed + i * 9.17) * a;
    tot += a;
    a *= 0.52;
    f *= 2.05;
  }
  return v / tot;
}

function shadePixels(ctx, s, fn) {
  if (s > 256 && !QUALITY.high) {
    const step = 2;
    const img = ctx.getImageData(0, 0, s, s);
    const d = img.data;
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        fn(d, (y * s + x) * 4, x, y);
        if (step > 1 && x + 1 < s && y + 1 < s) {
          const i = (y * s + x) * 4;
          for (let oy = 0; oy < step; oy++) {
            for (let ox = 0; ox < step; ox++) {
              if (!ox && !oy) continue;
              const j = ((y + oy) * s + (x + ox)) * 4;
              d[j] = d[i];
              d[j + 1] = d[i + 1];
              d[j + 2] = d[i + 2];
              d[j + 3] = d[i + 3];
            }
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return;
  }
  const img = ctx.getImageData(0, 0, s, s);
  const d = img.data;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      fn(d, (y * s + x) * 4, x, y);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function addPits(ctx, s, count, size, color, seed, alpha = 0.08) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = n2(i, 1.7, seed) * s;
    const y = n2(i, 4.2, seed) * s;
    ctx.beginPath();
    ctx.ellipse(x, y, size + n2(i, 8, seed) * size, size * 0.62 + n2(i, 11, seed) * size, n2(i, 13, seed) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintDrywall(ctx, s, opts = {}) {
  const seed = opts.seed || 3;
  const orange = opts.orange ?? 17;
  ctx.fillStyle = opts.base || "#f1ece4";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const compound = (fbm(x * 0.012, y * 0.01, seed, 2) - 0.5) * 15;
    const peel =
      (n2(x * 0.93, y * 0.71, seed) - 0.5) * orange +
      (n2(x * 2.16, y * 1.88, seed + 2) - 0.5) * orange * 0.58;
    const roller = (n2(x * 0.068, Math.floor(y * 0.36), seed + 4) - 0.5) * (opts.grain ?? 11);
    const nap = Math.sin(x * 0.41 + n2(Math.floor(y / 2), 0, seed) * 6.2) * 2.2;
    const joint = Math.pow(Math.abs(Math.sin(x * (Math.PI * 2) / (s * 0.48) + seed)), 22) * -5.2;
    const v = compound + peel + roller + nap + joint;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.94));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.86));
  });
  addPits(ctx, s, opts.pits ?? 280, opts.pitSize ?? 0.85, opts.dust || "#cfc4b4", seed, 0.07);
}

function paintSilk(ctx, s) {
  paintDrywall(ctx, s, { base: "#f5f1ea", grain: 4.5, orange: 7.5, pits: 40, pitSize: 0.5, dust: "#d8d0c4", seed: 8 });
}

function paintLimewash(ctx, s) {
  ctx.fillStyle = "#eee6d9";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const cloud = (fbm(x * 0.0064, y * 0.0072, 19, 2) - 0.5) * 28;
    const wash = (fbm(x * 0.018, y * 0.004, 22, 2) - 0.5) * 16;
    const chalk = (n2(x * 1.4, y * 1.2, 5) - 0.5) * 9;
    const drip = Math.sin(x * 0.09 + fbm(x * 0.02, y * 0.01, 4, 2) * 8) * 3.2;
    const v = cloud + wash + chalk + drip;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.9));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.72));
  });
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = "#f7f1e6";
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse(n2(i, 1, 9) * s, n2(i, 2, 9) * s, 28 + n2(i, 3, 9) * 50, 16 + n2(i, 4, 9) * 28, n2(i, 5, 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  addPits(ctx, s, 90, 1.6, "#d2c4b0", 19, 0.06);
}

function paintVenetian(ctx, s) {
  ctx.fillStyle = "#e7dccf";
  ctx.fillRect(0, 0, s, s);
  const tones = ["rgba(255,248,238,0.16)", "rgba(214,196,174,0.14)", "rgba(236,222,204,0.12)", "rgba(196,174,150,0.1)"];
  for (let i = 0; i < 86; i++) {
    ctx.save();
    ctx.translate(n2(i, 1, 12) * s, n2(i, 2, 12) * s);
    ctx.rotate((n2(i, 3, 12) - 0.5) * 1.4);
    ctx.fillStyle = tones[i % tones.length];
    ctx.beginPath();
    ctx.ellipse(0, 0, 38 + n2(i, 4, 12) * 70, 10 + n2(i, 5, 12) * 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  shadePixels(ctx, s, (d, i, x, y) => {
    const trowel =
      Math.sin((x * 0.72 + y * 0.28) * 0.046) * 7.5 +
      Math.sin((x * -0.4 + y * 0.9) * 0.034) * 5.2;
    const burnish = Math.pow(Math.max(0, fbm(x * 0.02, y * 0.018, 31, 2) - 0.42), 1.6) * 18;
    const grit = (n2(x * 1.7, y * 1.5, 6) - 0.5) * 6;
    const v = trowel + burnish + grit;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.92));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.8));
  });
}

function paintMicrocement(ctx, s) {
  ctx.fillStyle = "#e4ddd4";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const sand = (n2(x * 1.9, y * 1.7, 11) - 0.5) * 18 + (n2(x * 3.4, y * 3.1, 12) - 0.5) * 10;
    const trowel =
      Math.sin((x * 0.68 + y * 0.32) * 0.05) * 6.4 +
      Math.sin((x * -0.42 + y * 0.88) * 0.036) * 4.8;
    const blotch = (fbm(x * 0.01, y * 0.012, 14, 2) - 0.5) * 14;
    const v = sand + trowel + blotch;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.96));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.9));
  });
  ctx.strokeStyle = "rgba(90,78,66,0.12)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const x0 = n2(i, 1, 40) * s;
    const y0 = n2(i, 2, 40) * s;
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + 40, y0 + 18, x0 + 90, y0 - 12, x0 + 140, y0 + 8);
    ctx.stroke();
  }
  addPits(ctx, s, 70, 2.4, "#c4b6a2", 11, 0.08);
}

function paintClay(ctx, s) {
  ctx.fillStyle = "#e8d5c0";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const earth = (fbm(x * 0.009, y * 0.01, 27, 2) - 0.5) * 24;
    const pore = (n2(x * 1.6, y * 1.45, 8) - 0.5) * 14;
    const trowel = Math.sin((x * 0.5 + y * 0.4) * 0.04) * 5;
    const v = earth + pore + trowel;
    d[i] = Math.max(0, Math.min(255, d[i] + v * 0.9));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.72));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.48));
  });
  addPits(ctx, s, 160, 2.2, "#c4a888", 27, 0.1);
}

function paintTravertine(ctx, s) {
  ctx.fillStyle = "#e6d7c2";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const bed = Math.sin(y * 0.034 + fbm(x * 0.008, y * 0.02, 44, 2) * 4) * 10;
    const vein = (fbm(x * 0.015, y * 0.006, 45, 2) - 0.5) * 16;
    const grit = (n2(x * 0.9, y * 0.85, 16) - 0.5) * 8;
    const v = bed + vein + grit;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.88));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.7));
  });
  for (let i = 0; i < 220; i++) {
    const x = n2(i, 1, 50) * s;
    const y = n2(i, 2, 50) * s;
    const filled = n2(i, 3, 50) > 0.42;
    ctx.fillStyle = filled ? "rgba(214,196,168,0.55)" : "rgba(92,74,58,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, 1.4 + n2(i, 4, 50) * 5.5, 0.7 + n2(i, 5, 50) * 2.2, n2(i, 6, 50) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintFluted(ctx, s) {
  ctx.fillStyle = "#efe8dc";
  ctx.fillRect(0, 0, s, s);
  const n = 16;
  const w = s / n;
  for (let i = 0; i < n; i++) {
    const x = i * w;
    const tone = 232 + Math.round((n2(i, 2, 61) - 0.5) * 10);
    ctx.fillStyle = `rgb(${tone},${tone - 6},${tone - 16})`;
    ctx.fillRect(x, 0, w, s);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(255,252,246,0.38)");
    g.addColorStop(0.18, "rgba(255,255,255,0)");
    g.addColorStop(0.72, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(40,28,18,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, s);
    ctx.fillStyle = "rgba(28,20,14,0.22)";
    ctx.fillRect(x + w - 1.6, 0, 1.6, s);
  }
  shadePixels(ctx, s, (d, i, x, y) => {
    const grain = (n2(x * 0.35, y * 1.8, 62) - 0.5) * 7;
    d[i] = Math.max(0, Math.min(255, d[i] + grain));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain * 0.92));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain * 0.8));
  });
}

function paintLinen(ctx, s) {
  ctx.fillStyle = "#efe6d6";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const warp = ((x + Math.floor(n2(Math.floor(x / 3), y, 70) * 1.4)) % 4 < 2) ? 8 : -6;
    const weft = ((y + Math.floor(n2(x, Math.floor(y / 3), 71) * 1.4)) % 4 < 2) ? 6 : -5;
    const slub = (n2(x * 0.08, y * 0.7, 72) - 0.5) * 10;
    const v = warp + weft + slub;
    d[i] = Math.max(0, Math.min(255, d[i] + v * 0.55));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.48));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.32));
  });
}

function paintConcreteWall(ctx, s) {
  ctx.fillStyle = "#c8c4bc";
  ctx.fillRect(0, 0, s, s);
  const boards = 7;
  const bw = s / boards;
  for (let i = 0; i < boards; i++) {
    const x = i * bw;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)";
    ctx.fillRect(x, 0, bw, s);
    ctx.fillStyle = "rgba(40,38,34,0.12)";
    ctx.fillRect(x + bw - 2, 0, 2, s);
  }
  shadePixels(ctx, s, (d, i, x, y) => {
    const laitance = (fbm(x * 0.008, y * 0.01, 80, 2) - 0.5) * 18;
    const grain = (n2(x * 0.22, y * 1.6, 81) - 0.5) * 8;
    const speckle = (n2(x * 2.4, y * 2.2, 82) - 0.5) * 12;
    const v = laitance + grain + speckle;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.98));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.92));
  });
  for (let i = 0; i < 90; i++) {
    const x = n2(i, 1, 83) * s;
    const y = n2(i, 2, 83) * s;
    const r = 1.2 + n2(i, 3, 83) * 4.8;
    ctx.fillStyle = `rgba(70,66,60,${0.18 + n2(i, 4, 83) * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBrushedMetal(ctx, s, base) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const stroke = (n2(x * 0.35, Math.floor(y * 0.9), 4) - 0.5) * 22;
    const fine = (n2(x * 2.4, y * 0.15, 5) - 0.5) * 10;
    const v = stroke + fine;
    d[i] = Math.max(0, Math.min(255, d[i] + v));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v * 0.96));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.9));
  });
}

function paintMarbleVeins(ctx, s, base, veins, seed = 1) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const n = (fbm(x * 0.01, y * 0.012, seed, 2) - 0.5) * 10;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.92));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.86));
  });
  ctx.lineCap = "round";
  veins.forEach((vn, k) => {
    ctx.strokeStyle = vn;
    ctx.lineWidth = 1.2 + (k % 3);
    ctx.globalAlpha = 0.22 + (k % 4) * 0.08;
    ctx.beginPath();
    const y0 = ((k * 73 + seed * 17) % s);
    ctx.moveTo(-20, y0);
    ctx.bezierCurveTo(s * 0.3, y0 + 50, s * 0.62, y0 - 40, s + 20, y0 + 18);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function paintChipField(ctx, s, base, chips, count, min, max) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const n = (n2(x * 0.08, y * 0.08, 9) - 0.5) * 8;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  });
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = chips[i % chips.length];
    const x = n2(i, 1, 12) * s;
    const y = n2(i, 2, 12) * s;
    const w = min + n2(i, 3, 12) * (max - min);
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * (0.5 + n2(i, 4, 12) * 0.6), n2(i, 5, 12) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintReededGlass(ctx, s) {
  ctx.fillStyle = "#d4e4ee";
  ctx.fillRect(0, 0, s, s);
  const n = 16;
  const w = s / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(i * w, 0, i * w + w, 0);
    g.addColorStop(0, "rgba(255,255,255,0.62)");
    g.addColorStop(0.42, "rgba(190,210,220,0.12)");
    g.addColorStop(1, "rgba(30,50,70,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(i * w, 0, w, s);
  }
}

function paintZellige(ctx, s) {
  const n = 6;
  const t = s / n;
  ctx.fillStyle = "#1a2a22";
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const tone = 28 + Math.round(n2(x, y, 20) * 36);
      ctx.fillStyle = `rgb(${tone},${tone + 42},${tone + 28})`;
      const ox = (n2(x, y, 21) - 0.5) * 3;
      const oy = (n2(x, y, 22) - 0.5) * 3;
      ctx.fillRect(x * t + 3 + ox, y * t + 3 + oy, t - 6, t - 6);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x * t + 5 + ox, y * t + 5 + oy, t - 14, 4);
    }
  }
}

function paintVelvet(ctx, s) {
  ctx.fillStyle = "#12363c";
  ctx.fillRect(0, 0, s, s);
  const g = ctx.createRadialGradient(s * 0.5, s * 0.45, 10, s * 0.5, s * 0.5, s * 0.72);
  g.addColorStop(0, "rgba(8,22,26,0.35)");
  g.addColorStop(1, "rgba(70,130,128,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const nap = (n2(x * 1.6, y * 1.6, 30) - 0.5) * 8;
    d[i] += nap;
    d[i + 1] += nap;
    d[i + 2] += nap;
  });
}

function paintBasket(ctx, s, a, b, cell) {
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, s, s);
  const c = s / cell;
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * c + 1, y * c + 1, c - 2, c - 2);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x * c, y * c + c * 0.45, c, 2);
      ctx.fillRect(x * c + c * 0.45, y * c, 2, c);
    }
  }
}

function paintCorten(ctx, s) {
  ctx.fillStyle = "#6a2e16";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const blotch = (fbm(x * 0.012, y * 0.014, 40, 2) - 0.5) * 36;
    d[i] = Math.max(0, Math.min(255, d[i] + blotch * 1.2));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + blotch * 0.4));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + blotch * 0.15));
  });
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = n2(i, 1, 41) > 0.55 ? "rgba(20,16,14,0.28)" : "rgba(200,90,30,0.2)";
    ctx.beginPath();
    ctx.ellipse(n2(i, 2, 41) * s, n2(i, 3, 41) * s, 18 + n2(i, 4, 41) * 40, 10 + n2(i, 5, 41) * 22, n2(i, 6, 41) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPatina(ctx, s) {
  ctx.fillStyle = "#3a2218";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const rust = (fbm(x * 0.014, y * 0.012, 50, 2) - 0.5) * 28;
    d[i] += rust;
    d[i + 1] += rust * 0.45;
    d[i + 2] += rust * 0.2;
  });
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(40,140,130,${0.16 + n2(i, 1, 51) * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(n2(i, 2, 51) * s, n2(i, 3, 51) * s, 12 + n2(i, 4, 51) * 30, 8 + n2(i, 5, 51) * 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBoucle(ctx, s) {
  ctx.fillStyle = "#efe8de";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 420; i++) {
    const x = n2(i, 1, 60) * s;
    const y = n2(i, 2, 60) * s;
    const r = 2 + n2(i, 3, 60) * 5;
    ctx.strokeStyle = n2(i, 4, 60) > 0.5 ? "rgba(255,255,255,0.55)" : "rgba(160,148,132,0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 1.6);
    ctx.stroke();
  }
}

function paintKnit(ctx, s) {
  ctx.fillStyle = "#2a2c30";
  ctx.fillRect(0, 0, s, s);
  const cell = 18;
  ctx.strokeStyle = "rgba(210,214,220,0.22)";
  ctx.lineWidth = 3;
  for (let y = -cell; y < s + cell; y += cell) {
    for (let x = -cell; x < s + cell; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cell * 0.5, y + cell * 0.55);
      ctx.lineTo(x + cell, y);
      ctx.stroke();
    }
  }
}

function paintRattan(ctx, s) {
  ctx.fillStyle = "#c4a06a";
  ctx.fillRect(0, 0, s, s);
  const step = s / 8;
  ctx.strokeStyle = "#8a6238";
  ctx.lineWidth = 7;
  for (let i = -2; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step + s, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * step + s, 0);
    ctx.lineTo(i * step, s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(244,230,200,0.25)";
  ctx.lineWidth = 2;
  for (let i = -2; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step + 3, 0);
    ctx.lineTo(i * step + s + 3, s);
    ctx.stroke();
  }
}

function paintFlutedWalnut(ctx, s) {
  ctx.fillStyle = "#4a3426";
  ctx.fillRect(0, 0, s, s);
  const n = 12;
  const w = s / n;
  for (let i = 0; i < n; i++) {
    const x = i * w;
    const tone = 68 + Math.round((n2(i, 2, 70) - 0.5) * 14);
    ctx.fillStyle = `rgb(${tone + 22},${tone - 6},${tone - 18})`;
    ctx.fillRect(x, 0, w, s);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(255,220,170,0.16)");
    g.addColorStop(0.2, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(20,10,6,0.32)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, s);
  }
}

function paintLeather(ctx, s) {
  ctx.fillStyle = "#1a1a1c";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const x = n2(i, 1, 80) * s;
    const y = n2(i, 2, 80) * s;
    ctx.fillStyle = `rgba(255,255,255,${0.03 + n2(i, 3, 80) * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2, 1.6, n2(i, 4, 80) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintTadelakt(ctx, s) {
  ctx.fillStyle = "#c45a32";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const cloud = (fbm(x * 0.008, y * 0.01, 90, 2) - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + cloud));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + cloud * 0.7));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + cloud * 0.35));
  });
}

function paintLimestone(ctx, s) {
  ctx.fillStyle = "#e4d4b8";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const mottled = (fbm(x * 0.01, y * 0.012, 95, 2) - 0.5) * 16;
    d[i] += mottled;
    d[i + 1] += mottled * 0.9;
    d[i + 2] += mottled * 0.7;
  });
}

function paintPolishedConcrete(ctx, s) {
  ctx.fillStyle = "#9aa0a6";
  ctx.fillRect(0, 0, s, s);
  shadePixels(ctx, s, (d, i, x, y) => {
    const n = (fbm(x * 0.01, y * 0.01, 96, 2) - 0.5) * 14 + (n2(x * 2, y * 2, 97) - 0.5) * 8;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  });
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, s * 0.32, s, 18);
  ctx.fillRect(0, s * 0.7, s, 8);
}

function paintBraided(ctx, s) {
  ctx.fillStyle = "#c4a574";
  ctx.fillRect(0, 0, s, s);
  const h = 22;
  for (let y = 0, row = 0; y < s; y += h, row++) {
    for (let x = -20; x < s + 20; x += 28) {
      ctx.strokeStyle = row % 2 ? "#8a6238" : "#d8b888";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 8, y + 6, x + 16, y + 6, x + 28, y);
      ctx.stroke();
    }
  }
}

function buildPresetTexture(id) {
  id = resolveWallId(id);

  const wallSize = Math.min(512, QUALITY.texSize);
  if (id === "drywall") {
    return canvasTex((ctx, s) => paintDrywall(ctx, s), wallSize);
  }
  if (id === "silk") {
    return canvasTex((ctx, s) => paintSilk(ctx, s), wallSize);
  }
  if (id === "limewash") {
    return canvasTex((ctx, s) => paintLimewash(ctx, s), wallSize);
  }
  if (id === "venetian") {
    return canvasTex((ctx, s) => paintVenetian(ctx, s), wallSize);
  }
  if (id === "microcement") {
    return canvasTex((ctx, s) => paintMicrocement(ctx, s), wallSize);
  }
  if (id === "clay") {
    return canvasTex((ctx, s) => paintClay(ctx, s), wallSize);
  }
  if (id === "travertine") {
    return canvasTex((ctx, s) => paintTravertine(ctx, s), wallSize);
  }
  if (id === "fluted") {
    return canvasTex((ctx, s) => paintFluted(ctx, s), wallSize);
  }
  if (id === "linen") {
    return canvasTex((ctx, s) => paintLinen(ctx, s), wallSize);
  }
  if (id === "concrete-wall") {
    return canvasTex((ctx, s) => paintConcreteWall(ctx, s), wallSize);
  }
  if (id === "reeded-glass") {
    return canvasTex((ctx, s) => paintReededGlass(ctx, s), wallSize);
  }
  if (id === "brushed-steel") {
    return canvasTex((ctx, s) => paintBrushedMetal(ctx, s, "#8a929a"), wallSize);
  }
  if (id === "brushed-brass") {
    return canvasTex((ctx, s) => paintBrushedMetal(ctx, s, "#c4a05a"), wallSize);
  }
  if (id === "brushed-champagne") {
    return canvasTex((ctx, s) => paintBrushedMetal(ctx, s, "#d8c49a"), wallSize);
  }
  if (id === "statuario") {
    return canvasTex((ctx, s) => paintMarbleVeins(ctx, s, "#f4f1ea", ["#6a6e74", "#9aa0a6", "#c8c2b8"], 3), wallSize);
  }
  if (id === "calacatta") {
    return canvasTex((ctx, s) => paintMarbleVeins(ctx, s, "#f7f4ee", ["#4a4e54", "#c4a574", "#8a8680"], 7), wallSize);
  }
  if (id === "terrazzo-chips") {
    return canvasTex((ctx, s) => paintChipField(ctx, s, "#e8e4dc", ["#1c1c1c", "#c45c26", "#2f5d50", "#6a4228", "#f4efe6"], 220, 2.2, 7), wallSize);
  }
  if (id === "terrazzo-noir") {
    return canvasTex((ctx, s) => paintChipField(ctx, s, "#1c1e22", ["#f4f0e8", "#b8bcc0", "#d4c4a0", "#6a6864"], 180, 2, 6.5), wallSize);
  }
  if (id === "polished-concrete") {
    return canvasTex((ctx, s) => paintPolishedConcrete(ctx, s), wallSize);
  }
  if (id === "concrete-grey") {
    return canvasTex((ctx, s) => paintConcreteWall(ctx, s), wallSize);
  }
  if (id === "zellige") {
    return canvasTex((ctx, s) => paintZellige(ctx, s), wallSize);
  }
  if (id === "limestone") {
    return canvasTex((ctx, s) => paintLimestone(ctx, s), wallSize);
  }
  if (id === "tadelakt") {
    return canvasTex((ctx, s) => paintTadelakt(ctx, s), wallSize);
  }
  if (id === "stucco-fine") {
    return canvasTex((ctx, s) => paintMicrocement(ctx, s), wallSize);
  }
  if (id === "fluted-walnut") {
    return canvasTex((ctx, s) => paintFlutedWalnut(ctx, s), wallSize);
  }
  if (id === "corten") {
    return canvasTex((ctx, s) => paintCorten(ctx, s), wallSize);
  }
  if (id === "oxidized-steel") {
    return canvasTex((ctx, s) => {
      paintCorten(ctx, s);
      ctx.fillStyle = "rgba(18,16,14,0.38)";
      ctx.fillRect(0, 0, s, s);
    }, wallSize);
  }
  if (id === "patina-copper") {
    return canvasTex((ctx, s) => paintPatina(ctx, s), wallSize);
  }
  if (id === "velvet-teal") {
    return canvasTex((ctx, s) => paintVelvet(ctx, s), wallSize);
  }
  if (id === "boucle") {
    return canvasTex((ctx, s) => paintBoucle(ctx, s), wallSize);
  }
  if (id === "chunky-knit") {
    return canvasTex((ctx, s) => paintKnit(ctx, s), wallSize);
  }
  if (id === "wool-weave") {
    return canvasTex((ctx, s) => paintBasket(ctx, s, "#2a2c30", "#3a3e44", 24), wallSize);
  }
  if (id === "woven-jute") {
    return canvasTex((ctx, s) => paintBasket(ctx, s, "#c4a06a", "#a88854", 10), wallSize);
  }
  if (id === "braided-jute") {
    return canvasTex((ctx, s) => paintBraided(ctx, s), wallSize);
  }
  if (id === "rattan") {
    return canvasTex((ctx, s) => paintRattan(ctx, s), wallSize);
  }
  if (id === "leather-emboss") {
    return canvasTex((ctx, s) => paintLeather(ctx, s), wallSize);
  }

  if (id === "brick") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#5a3228";
      ctx.fillRect(0, 0, s, s);
      const bh = 42;
      const bw = 86;
      const gap = 7;
      for (let y = 0, row = 0; y < s; y += bh + gap, row++) {
        const ox = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < s + bw; x += bw + gap) {
          const shade = 118 + ((x * 13 + y * 7) % 28);
          ctx.fillStyle = `rgb(${shade + 20},${shade - 28},${shade - 42})`;
          ctx.fillRect(x + ox, y, bw, bh);
          ctx.fillStyle = "rgba(255,230,210,0.1)";
          ctx.fillRect(x + ox, y, bw, 5);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(x + ox, y + bh - 4, bw, 4);
        }
      }
    });
  }

  if (id === "wood") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#8a6238";
      ctx.fillRect(0, 0, s, s);
      const planks = 10;
      const ph = s / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * ph;
        const tone = 148 + ((i * 37) % 36);
        ctx.fillStyle = `rgb(${tone + 28},${tone - 8},${tone - 48})`;
        ctx.fillRect(0, y, s, ph - 3);
        const img = ctx.getImageData(0, y, s, Math.max(1, ph - 3));
        for (let p = 0; p < img.data.length; p += 4) {
          const n = ((p * 13 + i * 17) % 17) - 8;
          img.data[p] += n;
          img.data[p + 1] += n * 0.7;
          img.data[p + 2] += n * 0.4;
        }
        ctx.putImageData(img, 0, y);
        ctx.strokeStyle = "rgba(62,32,10,0.28)";
        ctx.lineWidth = 1.1;
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.moveTo(0, y + 8 + k * 8);
          ctx.bezierCurveTo(s * 0.2, y + 14 + k * 6, s * 0.65, y + 3 + k * 7, s, y + 10 + k * 5);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(30,14,6,0.32)";
        ctx.fillRect(0, y + ph - 3, s, 3);
        ctx.fillStyle = "rgba(255,220,170,0.08)";
        ctx.fillRect(0, y + 1, s, 3);
      }
    });
  }

  if (id === "tiles") {
    return marbleTiles(["cream", "cream", "cream", "cream"], 2);
  }
  if (id && id.startsWith("tile-")) {
    return buildCeramicTiles(id);
  }

  if (id === "luxury") {
    return marbleTiles(["cream", "grey", "grey", "dark"], 2);
  }

  if (id === "carrara") {
    return marbleTiles(["grey", "grey", "grey", "grey"], 2);
  }

  if (id === "espresso") {
    return marbleTiles(["dark", "dark", "dark", "dark"], 2);
  }

  if (id === "mobileFloor") {
    return buildMobileFloor();
  }

  if (id === "concrete") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#9a9aa2";
      ctx.fillRect(0, 0, s, s);
      const img = ctx.getImageData(0, 0, s, s);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 42;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 80, 2);
    });
  }

  if (id === "marble") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#efe8dc";
      ctx.fillRect(0, 0, s, s);
      const img = ctx.getImageData(0, 0, s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const i = (y * s + x) * 4;
          const n = ((x * 17 + y * 13) % 23) + ((x * 7 + y * 31) % 11) - 16;
          img.data[i] = Math.min(255, img.data[i] + n * 0.45);
          img.data[i + 1] = Math.min(255, img.data[i + 1] + n * 0.35);
          img.data[i + 2] = Math.min(255, img.data[i + 2] + n * 0.22);
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.lineCap = "round";
      for (let k = 0; k < 9; k++) {
        ctx.strokeStyle = k % 2 ? "rgba(176,150,118,0.1)" : "rgba(255,250,242,0.08)";
        ctx.lineWidth = 1 + (k % 3) * 0.6;
        ctx.beginPath();
        const y0 = (k * 73 + 40) % s;
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(s * 0.28, y0 + 36, s * 0.62, y0 - 28, s, y0 + 18);
        ctx.stroke();
      }
    }, 512);
  }

  if (id === "terrazzo") {
    return canvasTex((ctx, s) => paintTerrazzo(ctx, s, TERRAZZO_SPECS["tz-cottage"]), 1024);
  }
  if (TERRAZZO_SPECS[id]) {
    return canvasTex((ctx, s) => paintTerrazzo(ctx, s, TERRAZZO_SPECS[id]), 1024);
  }

  if (id === "granite") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#6e6862";
      ctx.fillRect(0, 0, s, s);
      const chips = ["#8a847c", "#4a4642", "#cfc8c0", "#2f2c2a", "#a39b92"];
      const img = ctx.getImageData(0, 0, s, s);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = ((i * 17) % 21) - 10;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = chips[i % chips.length];
        ctx.fillRect((i * 59) % s, (i * 83) % s, 1 + (i % 3), 1 + (i % 2));
      }
    }, 512);
  }

  if (id === "herringbone") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#c9a06a";
      ctx.fillRect(0, 0, s, s);
      const pl = 52;
      const pw = 16;
      for (let y = -pl; y < s + pl; y += pl) {
        for (let x = -pl; x < s + pl; x += pl) {
          const tone = 158 + (((x + y) * 11) % 28);
          ctx.save();
          ctx.translate(x + pl / 2, y + pl / 2);
          ctx.rotate((((x + y) / pl) % 2 ? 1 : -1) * Math.PI / 4);
          ctx.fillStyle = `rgb(${tone + 36},${tone + 4},${tone - 36})`;
          ctx.fillRect(-pw / 2, -pl / 2, pw - 1.2, pl - 1.2);
          ctx.strokeStyle = "rgba(90,52,22,0.12)";
          ctx.lineWidth = 0.7;
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.moveTo(-pw / 2 + 2, -pl / 2 + 6 + k * 8);
            ctx.bezierCurveTo(0, -pl / 2 + 10 + k * 7, pw / 4, -pl / 2 + 4 + k * 8, pw / 2 - 2, -pl / 2 + 8 + k * 8);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }, 1024);
  }

  if (id === "walnut") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#4a3426";
      ctx.fillRect(0, 0, s, s);
      const slats = 12;
      const sw = s / slats;
      for (let i = 0; i < slats; i++) {
        const tone = 68 + ((i * 17) % 18);
        ctx.fillStyle = `rgb(${tone + 18},${tone - 8},${tone - 22})`;
        ctx.fillRect(i * sw + 1, 0, sw - 2, s);
        ctx.strokeStyle = "rgba(20,10,6,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * sw + sw * 0.35, 0);
        ctx.lineTo(i * sw + sw * 0.4, s);
        ctx.stroke();
      }
    }, 512);
  }

  if (id === "stone") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#6f6964";
      ctx.fillRect(0, 0, s, s);
      const img = ctx.getImageData(0, 0, s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const i = (y * s + x) * 4;
          const n = ((x * 13 + y * 9) % 19) - 9;
          img.data[i] += n;
          img.data[i + 1] += n * 0.9;
          img.data[i + 2] += n * 0.8;
        }
      }
      ctx.putImageData(img, 0, 0);
      ctx.lineCap = "round";
      for (let k = 0; k < 14; k++) {
        ctx.strokeStyle = k % 2 ? "rgba(236,232,226,0.22)" : "rgba(40,36,32,0.12)";
        ctx.lineWidth = 0.8 + (k % 3) * 0.5;
        ctx.beginPath();
        const y0 = (k * 61 + 20) % s;
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(s * 0.3, y0 + 40, s * 0.65, y0 - 28, s, y0 + 16);
        ctx.stroke();
      }
    }, 1024);
  }

  if (id === "fabric") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#d8d0c6";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      for (let y = 0; y < s; y += 3) ctx.fillRect(0, y, s, 1);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      for (let x = 0; x < s; x += 3) ctx.fillRect(x, 0, 1, s);
    }, 256);
  }

  if (id === "carpet") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#c9b8a0";
      ctx.fillRect(0, 0, s, s);
      const img = ctx.getImageData(0, 0, s, s);
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const i = (y * s + x) * 4;
          const n = ((x * 3 + y * 11) % 13) + ((x + y * 5) % 7) - 9;
          img.data[i] += n;
          img.data[i + 1] += n * 0.8;
          img.data[i + 2] += n * 0.55;
        }
      }
      ctx.putImageData(img, 0, 0);
    }, 512);
  }

  if (id === "checker") {
    return canvasTex((ctx, s) => {
      ctx.fillStyle = "#ddd6cc";
      ctx.fillRect(0, 0, s, s);
      const n = 2;
      const t = s / n;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          ctx.fillStyle = (x + y) % 2 ? "#f3eee6" : "#e4dcd0";
          ctx.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
        }
      }
    }, 512);
  }

  if (id === "metal") {
    return canvasTex((ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, 0);
      g.addColorStop(0, "#7d848c");
      g.addColorStop(0.45, "#d4dae0");
      g.addColorStop(1, "#8a9198");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 30; i++) ctx.fillRect(0, i * (s / 30), s, 1);
    });
  }

  if (id && id.startsWith("roof-")) {
    return buildRoofTexture(id);
  }

  return null;
}

function noiseFill(ctx, s, base, amp = 10) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash(i * 0.017) - 0.5) * amp;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.92));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.85));
  }
  ctx.putImageData(img, 0, 0);
}

function paintPinterestRoofSwatch(ctx, s, id) {
  const mid = s / 2;
  const strokeGold = () => {
    ctx.strokeStyle = "rgba(198,165,106,0.55)";
    ctx.lineWidth = 6;
  };
  const creamIds = {
    "roof-nested": "#f6f1e8",
    "roof-circles": "#f2eee6",
    "roof-plus": "#efe8dc",
    "roof-island": "#f4efe6",
    "roof-slots": "#eee8de",
    "roof-double": "#f6f0e6",
    "roof-cloud": "#f7f3ec",
    "roof-wave": "#efe8dc",
    "roof-board": "#f3efe6",
    "roof-shiplap": "#f7f3ec",
    "roof-vault": "#f0ebe3",
    "roof-rings": "#f0ebe2",
  };
  if (creamIds[id]) {
    noiseFill(ctx, s, creamIds[id], 8);
    strokeGold();
    if (id === "roof-nested") {
      for (const p of [28, 58, 88]) ctx.strokeRect(p, p, s - p * 2, s - p * 2);
    } else if (id === "roof-circles") {
      for (const r of [40, 70, 100]) {
        ctx.beginPath();
        ctx.arc(mid, mid, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (id === "roof-plus") {
      ctx.fillStyle = "rgba(198,165,106,0.28)";
      ctx.fillRect(mid - 22, 36, 44, s - 72);
      ctx.fillRect(36, mid - 22, s - 72, 44);
    } else if (id === "roof-island" || id === "roof-double") {
      ctx.strokeRect(48, 48, s - 96, s - 96);
      if (id === "roof-double") ctx.strokeRect(78, 78, s - 156, s - 156);
    } else if (id === "roof-slots") {
      for (let i = 0; i < 5; i++) ctx.fillRect(40 + i * 36, 36, 10, s - 72);
      ctx.fillStyle = "rgba(255,230,160,0.7)";
      for (let i = 0; i < 5; i++) ctx.fillRect(43 + i * 36, 36, 4, s - 72);
    } else if (id === "roof-cloud") {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(mid - 28, mid, 42, 0, Math.PI * 2);
      ctx.arc(mid + 24, mid + 6, 36, 0, Math.PI * 2);
      ctx.arc(mid, mid - 18, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "roof-wave") {
      ctx.beginPath();
      for (let x = 20; x < s - 20; x += 8) ctx.lineTo(x, mid + Math.sin(x * 0.08) * 28);
      ctx.stroke();
    } else if (id === "roof-board" || id === "roof-shiplap") {
      const n = id === "roof-board" ? 5 : 8;
      for (let i = 0; i < n; i++) ctx.fillRect(i * (s / n) + 4, 16, 8, s - 32);
    } else if (id === "roof-vault") {
      ctx.beginPath();
      ctx.moveTo(24, s - 40);
      ctx.quadraticCurveTo(mid, 28, s - 24, s - 40);
      ctx.stroke();
    } else if (id === "roof-rings") {
      for (const r of [36, 68]) {
        ctx.beginPath();
        ctx.arc(mid, mid, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return true;
  }
  if (id === "roof-hex") {
    noiseFill(ctx, s, "#e8e0d4", 7);
    ctx.strokeStyle = "rgba(90,80,70,0.28)";
    ctx.lineWidth = 4;
    const r = 28;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 36 + col * r * 1.75 + (row % 2 ? r * 0.88 : 0);
        const y = 32 + row * r * 1.52;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    return true;
  }
  if (id === "roof-stars") {
    ctx.fillStyle = "#1a1c22";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 48; i++) {
      ctx.fillStyle = `rgba(255,236,200,${0.35 + hash(i * 9) * 0.6})`;
      ctx.beginPath();
      ctx.arc(hash(i) * s, hash(i + 3) * s, 1.2 + hash(i + 7) * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  }
  if (id === "roof-industrial") {
    noiseFill(ctx, s, "#2c2a28", 6);
    ctx.fillStyle = "#1a1816";
    for (let i = 0; i < 4; i++) ctx.fillRect(0, 30 + i * 56, s, 16);
    return true;
  }
  if (id === "roof-skylight") {
    noiseFill(ctx, s, "#d8e8f4", 5);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(24, 24, s - 48, s - 48);
    ctx.strokeStyle = "rgba(180,190,200,0.7)";
    ctx.lineWidth = 10;
    ctx.strokeRect(24, 24, s - 48, s - 48);
    ctx.beginPath();
    ctx.moveTo(mid, 24);
    ctx.lineTo(mid, s - 24);
    ctx.moveTo(24, mid);
    ctx.lineTo(s - 24, mid);
    ctx.stroke();
    return true;
  }
  if (id === "roof-combo") {
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#7a5a38";
    ctx.fillRect(0, 0, 36, s);
    ctx.fillRect(s - 36, 0, 36, s);
    ctx.fillRect(0, 0, s, 36);
    ctx.fillRect(0, s - 36, s, 36);
    return true;
  }
  if (id === "roof-tin") {
    ctx.fillStyle = "#c8b898";
    ctx.fillRect(0, 0, s, s);
    const n = 4;
    const tw = s / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        ctx.strokeStyle = "rgba(80,70,50,0.25)";
        ctx.strokeRect(c * tw + 6, r * tw + 6, tw - 12, tw - 12);
        ctx.fillStyle = "rgba(255,240,210,0.18)";
        ctx.beginPath();
        ctx.arc(c * tw + tw / 2, r * tw + tw / 2, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return true;
  }
  if (id === "roof-waffle") {
    noiseFill(ctx, s, "#9a9690", 8);
    const n = 4;
    const tw = s / n;
    ctx.strokeStyle = "rgba(40,40,40,0.28)";
    ctx.lineWidth = 10;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tw, 0);
      ctx.lineTo(i * tw, s);
      ctx.moveTo(0, i * tw);
      ctx.lineTo(s, i * tw);
      ctx.stroke();
    }
    return true;
  }
  if (id === "roof-border") {
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#2a2826";
    ctx.lineWidth = 36;
    ctx.strokeRect(18, 18, s - 36, s - 36);
    return true;
  }
  if (id === "roof-dome") {
    noiseFill(ctx, s, "#f8f4ec", 6);
    const g = ctx.createRadialGradient(mid, mid, 10, mid, mid, 110);
    g.addColorStop(0, "#fffdf6");
    g.addColorStop(1, "rgba(230,220,200,0.2)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mid, mid, 88, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (id === "roof-jaali") {
    noiseFill(ctx, s, "#e6d8c4", 7);
    ctx.strokeStyle = "rgba(90,70,40,0.35)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * (s / 8), 0);
      ctx.lineTo(i * (s / 8), s);
      ctx.moveTo(0, i * (s / 8));
      ctx.lineTo(s, i * (s / 8));
      ctx.stroke();
    }
    return true;
  }
  if (id === "roof-rattan") {
    ctx.fillStyle = "#c4a06a";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(90,60,30,0.28)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 22, 0);
      ctx.lineTo(i * 22, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * 22);
      ctx.lineTo(s, i * 22);
      ctx.stroke();
    }
    return true;
  }
  if (id === "roof-mirror") {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#d8dee4");
    g.addColorStop(0.5, "#f4f6f8");
    g.addColorStop(1, "#b8c0c8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return true;
  }
  if (id === "roof-diamond") {
    noiseFill(ctx, s, "#e4dcc8", 7);
    ctx.strokeStyle = "rgba(90,80,60,0.3)";
    ctx.lineWidth = 5;
    const step = 64;
    for (let y = -step; y < s + step; y += step) {
      for (let x = -step; x < s + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + step / 2, y);
        ctx.lineTo(x + step, y + step / 2);
        ctx.lineTo(x + step / 2, y + step);
        ctx.lineTo(x, y + step / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
    return true;
  }
  return false;
}

function goldStroke(ctx, alpha = 0.62) {
  ctx.strokeStyle = `rgba(198,165,106,${alpha})`;
  ctx.lineWidth = 7;
}

function leafSpeckle(ctx, s, n = 90) {
  for (let i = 0; i < n; i++) {
    const x = hash(i * 4.1) * s;
    const y = hash(i * 9.7) * s;
    ctx.fillStyle = `rgba(212,176,106,${0.08 + hash(i) * 0.18})`;
    ctx.fillRect(x, y, 1 + hash(i * 2) * 2, 1 + hash(i * 3) * 2);
  }
}

function buildRoofTexture(id) {
  return canvasTex((ctx, s) => {
    const mid = s / 2;
    if (id === "roof-goldleaf") {
      noiseFill(ctx, s, "#f3ead8", 8);
      const n = 3;
      const tw = s / n;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const x = c * tw;
          const y = r * tw;
          const g = ctx.createLinearGradient(x, y, x + tw, y);
          g.addColorStop(0, "#8a6a32");
          g.addColorStop(0.45, "#e8c878");
          g.addColorStop(1, "#9a7438");
          ctx.fillStyle = g;
          ctx.fillRect(x + 6, y + 6, tw - 12, 18);
          ctx.fillRect(x + 6, y + tw - 24, tw - 12, 18);
          ctx.fillRect(x + 6, y + 6, 18, tw - 12);
          ctx.fillRect(x + tw - 24, y + 6, 18, tw - 12);
          ctx.fillStyle = "#f7f1e6";
          ctx.fillRect(x + 28, y + 28, tw - 56, tw - 56);
        }
      }
      leafSpeckle(ctx, s, 120);
      return;
    }
    if (id === "roof-silk") {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "#fffaf3");
      g.addColorStop(0.35, "#f0e6d4");
      g.addColorStop(0.7, "#f8f1e6");
      g.addColorStop(1, "#efe4d2");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      for (let i = 0; i < 28; i++) ctx.fillRect(0, i * (s / 28), s, 1);
      return;
    }
    if (id === "roof-onyx") {
      noiseFill(ctx, s, "#14110e", 16);
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = `rgba(214,154,62,${0.16 + hash(i) * 0.28})`;
        ctx.lineWidth = 1.2 + hash(i * 3) * 3;
        ctx.beginPath();
        ctx.moveTo(hash(i * 2) * s, 0);
        ctx.bezierCurveTo(hash(i * 5) * s, mid, hash(i * 7) * s, mid, hash(i * 11) * s, s);
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(mid, mid, 20, mid, mid, s * 0.62);
      glow.addColorStop(0, "rgba(255,176,72,0.22)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, s, s);
      return;
    }
    if (id === "roof-noir") {
      noiseFill(ctx, s, "#1a1714", 12);
      goldStroke(ctx, 0.42);
      ctx.strokeRect(36, 36, s - 72, s - 72);
      ctx.strokeRect(72, 72, s - 144, s - 144);
      leafSpeckle(ctx, s, 40);
      return;
    }
    if (id === "roof-marble") {
      noiseFill(ctx, s, "#f6f2ea", 7);
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = `rgba(170,150,128,${0.18 + hash(i) * 0.22})`;
        ctx.lineWidth = 1 + hash(i * 2) * 2.2;
        ctx.beginPath();
        ctx.moveTo(-20, hash(i) * s);
        ctx.bezierCurveTo(mid * 0.6, hash(i * 3) * s, mid * 1.3, hash(i * 5) * s, s + 20, hash(i * 7) * s);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(198,165,106,0.35)";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, s - 20, s - 20);
      return;
    }
    if (id === "roof-champagne") {
      const g = ctx.createLinearGradient(0, 0, s, 0);
      g.addColorStop(0, "#8d6a38");
      g.addColorStop(0.5, "#e6c888");
      g.addColorStop(1, "#a07a40");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      noiseFill(ctx, s, "#f4ead8", 6);
      goldStroke(ctx, 0.7);
      ctx.strokeRect(40, 40, s - 80, s - 80);
      ctx.strokeRect(70, 70, s - 140, s - 140);
      return;
    }
    if (id === "roof-fluted") {
      noiseFill(ctx, s, "#f3eee6", 6);
      const n = 14;
      const sw = s / n;
      for (let i = 0; i < n; i++) {
        const g = ctx.createLinearGradient(i * sw, 0, i * sw + sw, 0);
        g.addColorStop(0, "#e4ddd2");
        g.addColorStop(0.5, "#fbf7f0");
        g.addColorStop(1, "#d8d0c4");
        ctx.fillStyle = g;
        ctx.fillRect(i * sw + 1, 0, sw - 2, s);
      }
      return;
    }
    if (id === "roof-walnutinlay") {
      ctx.fillStyle = "#2a1a12";
      ctx.fillRect(0, 0, s, s);
      const n = 8;
      const sw = s / n;
      for (let i = 0; i < n; i++) {
        const tone = 72 + ((i * 17) % 26);
        ctx.fillStyle = `rgb(${tone + 38},${tone},${tone - 20})`;
        ctx.fillRect(i * sw + 3, 0, sw - 8, s);
        ctx.fillStyle = "rgba(20,10,6,0.28)";
        ctx.fillRect(i * sw + sw - 6, 0, 3, s);
        ctx.fillStyle = "rgba(212,176,106,0.7)";
        ctx.fillRect(i * sw + sw - 3, 0, 1.6, s);
      }
      return;
    }
    if (id === "roof-crystal") {
      noiseFill(ctx, s, "#f5f0e6", 7);
      goldStroke(ctx, 0.55);
      for (const r of [48, 82, 118]) {
        ctx.beginPath();
        ctx.arc(mid, mid, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,230,170,0.55)";
      ctx.beginPath();
      ctx.arc(mid, mid, 22, 0, Math.PI * 2);
      ctx.fill();
      leafSpeckle(ctx, s, 50);
      return;
    }
    if (id === "roof-lacquer") {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "#2a2420");
      g.addColorStop(0.4, "#6a5a48");
      g.addColorStop(0.55, "#d8c4a4");
      g.addColorStop(1, "#1c1814");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, s * 0.28, s, 10);
      return;
    }
    if (id === "roof-travertine") {
      noiseFill(ctx, s, "#e4d4ba", 18);
      ctx.fillStyle = "rgba(120,96,70,0.16)";
      for (let i = 0; i < 70; i++) {
        ctx.beginPath();
        ctx.ellipse(hash(i * 3) * s, hash(i * 8) * s, 3 + hash(i) * 10, 1.5 + hash(i * 2) * 4, hash(i * 4) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      goldStroke(ctx, 0.28);
      ctx.strokeRect(24, 24, s - 48, s - 48);
      return;
    }
    if (id === "roof-bronze") {
      ctx.fillStyle = "#1c1610";
      ctx.fillRect(0, 0, s, s);
      const n = 9;
      const sw = s / n;
      for (let i = 0; i < n; i++) {
        const g = ctx.createLinearGradient(i * sw, 0, i * sw + sw, 0);
        g.addColorStop(0, "#4a3218");
        g.addColorStop(0.5, "#b88848");
        g.addColorStop(1, "#5a3a1c");
        ctx.fillStyle = g;
        ctx.fillRect(i * sw + 7, 0, sw - 16, s);
      }
      return;
    }
    if (id === "roof-alabaster") {
      noiseFill(ctx, s, "#f3ead8", 8);
      const glow = ctx.createRadialGradient(mid, mid, 10, mid, mid, s * 0.7);
      glow.addColorStop(0, "rgba(255,220,160,0.55)");
      glow.addColorStop(1, "rgba(244,232,210,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, s, s);
      goldStroke(ctx, 0.4);
      ctx.strokeRect(28, 28, s - 56, s - 56);
      return;
    }
    if (id === "roof-pearl") {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "#fbf6ee");
      g.addColorStop(0.5, "#eee4d4");
      g.addColorStop(1, "#f7f0e6");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      noiseFill(ctx, s, "#f4efe6", 5);
      goldStroke(ctx, 0.22);
      ctx.strokeRect(18, 18, s - 36, s - 36);
      return;
    }
    if (id === "roof-inlay") {
      noiseFill(ctx, s, "#f2ebe0", 6);
      goldStroke(ctx, 0.7);
      ctx.save();
      ctx.translate(mid, mid);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-70, -70, 140, 140);
      ctx.strokeRect(-42, -42, 84, 84);
      ctx.restore();
      ctx.strokeRect(22, 22, s - 44, s - 44);
      return;
    }
    if (id === "roof-stepcove") {
      noiseFill(ctx, s, "#f6f1e8", 7);
      goldStroke(ctx, 0.5);
      for (const p of [22, 52, 84]) ctx.strokeRect(p, p, s - p * 2, s - p * 2);
      ctx.fillStyle = "rgba(255,230,170,0.35)";
      ctx.fillRect(56, 50, s - 112, 6);
      ctx.fillRect(56, s - 56, s - 112, 6);
      return;
    }
    noiseFill(ctx, s, "#f3efe8", 8);
  }, 1024);
}

export function makeNormalFromAlbedo(tex, strength = 2.4) {
  if (!QUALITY.normals) return null;
  const img = tex && tex.image;
  if (!img || !img.width) return null;
  const key = tex.uuid + "|" + strength;
  if (NORMAL_CACHE.has(key)) return NORMAL_CACHE.get(key);
  const cap = QUALITY.low ? 96 : QUALITY.high ? 256 : 160;
  const w = Math.min(img.width, cap);
  const h = Math.min(img.height, cap);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const lum = (x, y) => {
    const i = (((y + h) % h) * w + ((x + w) % w)) * 4;
    return (src.data[i] * 0.3 + src.data[i + 1] * 0.59 + src.data[i + 2] * 0.11) / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      const len = Math.hypot(-dx, -dy, 1) || 1;
      const i = (y * w + x) * 4;
      dst.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      dst.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (1 / len) * 0.5 * 255 + 128;
      dst.data[i + 3] = 255;
    }
  }
  ctx.putImageData(dst, 0, 0);
  const n = new THREE.CanvasTexture(c);
  n.colorSpace = THREE.NoColorSpace;
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  n.anisotropy = QUALITY.aniso;
  n.needsUpdate = true;
  n.userData.shared = true;
  NORMAL_CACHE.set(key, n);
  return n;
}

export function applySurface(material, surface, extraMap = null) {
  const old = material.map;
  const oldN = material.normalMap;
  const oldR = material.roughnessMap;
  let map = null;
  if (extraMap) map = extraMap;
  else if (surface.texture) map = makePresetTexture(surface.texture);
  material.map = map;
  if (old && old !== map && !old.userData?.shared) old.dispose();
  if (oldN && !oldN.userData?.shared) oldN.dispose();
  if (oldR && !oldR.userData?.shared) oldR.dispose();
  material.normalMap = null;
  material.roughnessMap = null;
  if (map) {
    if (map.userData?.shared) {
      map = map.clone();
      map.needsUpdate = true;
    }
    material.map = map;
    map.repeat.set(surface.repeat || 1, surface.repeat || 1);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = QUALITY.aniso;
    const tex = resolveWallId(surface.texture);
    const wall = isWallFinish(surface.texture);
    if (QUALITY.normals && (wall || surface.texture === "wood" || surface.texture === "brick" || surface.texture === "herringbone" || surface.texture === "walnut" || surface.texture === "stone" || surface.texture === "mobileFloor" || isTileTexture(surface.texture) || isTerrazzo(surface.texture) || isRoofTexture(surface.texture))) {
      const WALL_N = {
        drywall: { str: 1.12, sc: 0.34 },
        silk: { str: 0.58, sc: 0.16 },
        limewash: { str: 1.18, sc: 0.4 },
        venetian: { str: 1.32, sc: 0.46 },
        microcement: { str: 1.4, sc: 0.54 },
        clay: { str: 1.34, sc: 0.5 },
        travertine: { str: 1.62, sc: 0.64 },
        fluted: { str: 2.35, sc: 0.98 },
        linen: { str: 1.05, sc: 0.34 },
        "concrete-wall": { str: 1.52, sc: 0.6 },
        "reeded-glass": { str: 2.4, sc: 1.05 },
        "brushed-steel": { str: 0.9, sc: 0.28 },
        "brushed-brass": { str: 0.9, sc: 0.28 },
        "brushed-champagne": { str: 0.88, sc: 0.26 },
        statuario: { str: 0.55, sc: 0.16 },
        calacatta: { str: 0.58, sc: 0.16 },
        "terrazzo-chips": { str: 0.7, sc: 0.22 },
        "terrazzo-noir": { str: 0.55, sc: 0.16 },
        "polished-concrete": { str: 0.48, sc: 0.14 },
        "concrete-grey": { str: 1.45, sc: 0.55 },
        zellige: { str: 1.35, sc: 0.42 },
        limestone: { str: 0.85, sc: 0.28 },
        tadelakt: { str: 0.95, sc: 0.32 },
        "stucco-fine": { str: 1.15, sc: 0.38 },
        "fluted-walnut": { str: 2.2, sc: 0.95 },
        herringbone: { str: 1.15, sc: 0.4 },
        corten: { str: 1.2, sc: 0.42 },
        "oxidized-steel": { str: 1.18, sc: 0.4 },
        "patina-copper": { str: 1.1, sc: 0.36 },
        "velvet-teal": { str: 0.7, sc: 0.22 },
        boucle: { str: 1.7, sc: 0.62 },
        "chunky-knit": { str: 1.85, sc: 0.7 },
        "wool-weave": { str: 1.15, sc: 0.38 },
        "woven-jute": { str: 1.55, sc: 0.58 },
        "braided-jute": { str: 1.75, sc: 0.68 },
        rattan: { str: 1.6, sc: 0.6 },
        "leather-emboss": { str: 1.25, sc: 0.42 },
      };
      const wn = WALL_N[tex];
      const nrm = makeNormalFromAlbedo(
        map,
        wn
          ? wn.str
          : surface.texture === "herringbone"
            ? 0.7
            : surface.texture === "walnut"
              ? 0.9
              : surface.texture === "stone"
                ? 0.65
                : isTerrazzo(surface.texture)
                  ? 0.48
                  : surface.texture === "mobileFloor" || isTileTexture(surface.texture)
                    ? 0.42
                    : isRoofTexture(surface.texture)
                      ? surface.texture === "roof-slats" || surface.texture === "roof-baffle" || surface.texture === "roof-perforated"
                        ? 1.15
                        : surface.texture === "roof-acoustic" || surface.texture === "roof-grid" || surface.texture === "roof-coffered"
                          ? 0.72
                          : 0.4
                      : surface.texture === "wood"
                        ? 1.35
                        : 2.1
      );
      if (nrm) {
        nrm.repeat.copy(map.repeat);
        material.normalMap = nrm;
        const sc = wn
          ? wn.sc
          : surface.texture === "herringbone"
            ? 0.28
            : surface.texture === "stone"
              ? 0.26
              : surface.texture === "mobileFloor" || isTileTexture(surface.texture)
                ? 0.14
                : isTerrazzo(surface.texture)
                  ? 0.2
                  : isRoofTexture(surface.texture)
                    ? 0.26
                    : 0.5;
        material.normalScale = new THREE.Vector2(sc, sc);
      }
    }
  }
  const tex = resolveWallId(surface.texture);
  const roofId = isRoofTexture(surface.texture) ? resolveRoofId(surface.texture) : surface.texture;
  const wall = isWallFinish(surface.texture);
  const pbr = SURFACE_PBR[tex] || SURFACE_PBR[roofId] || SURFACE_PBR[surface.texture] || SURFACE_PBR.drywall;
  const mapWhite = tex === "reeded-glass" || tex === "statuario" || tex === "calacatta" || tex === "terrazzo-chips" || tex === "terrazzo-noir" || tex === "zellige" || tex === "brushed-steel" || tex === "brushed-brass" || tex === "brushed-champagne" || tex === "corten" || tex === "oxidized-steel" || tex === "patina-copper" || tex === "velvet-teal" || tex === "boucle" || tex === "chunky-knit" || tex === "wool-weave" || tex === "woven-jute" || tex === "braided-jute" || tex === "rattan" || tex === "leather-emboss" || tex === "fluted-walnut" || tex === "polished-concrete" || tex === "limestone" || tex === "tadelakt" || tex === "herringbone";
  material.color.set(isShineTexture(surface.texture) || isRoofTexture(surface.texture) || mapWhite ? "#ffffff" : surface.color || "#ffffff");
  material.roughness = pbr.roughness;
  material.metalness = pbr.metalness;
  if ("transmission" in material) {
    material.transmission = tex === "reeded-glass" ? 0.68 : 0;
    material.thickness = tex === "reeded-glass" ? 0.12 : 0;
    if (tex === "reeded-glass" && "ior" in material) material.ior = 1.52;
  }
  if ("anisotropy" in material) {
    material.anisotropy = tex && tex.startsWith("brushed-") ? 0.82 : 0;
  }
  material.transparent = tex === "reeded-glass";
  material.opacity = tex === "reeded-glass" ? 0.9 : 1;
  if ("clearcoat" in material) {
    material.clearcoat = pbr.clearcoat;
    material.clearcoatRoughness =
      surface.texture === "mobileFloor" || isTileTexture(surface.texture)
        ? 0.04
        : surface.texture === "marble" || isTerrazzo(surface.texture) || tex === "statuario" || tex === "calacatta" || tex === "zellige" || tex === "terrazzo-noir"
          ? 0.06
          : tex === "silk" || tex === "venetian"
            ? 0.38
            : wall
              ? 0.58
              : pbr.clearcoat > 0.2
                ? 0.22
                : 0.45;
  }
  const glossy = ["tiles", "luxury", "carrara", "espresso", "photo", "marble", "stone", "mobileFloor", "statuario", "calacatta", "zellige", "terrazzo-noir", "polished-concrete", "reeded-glass"];
  const satin = ["herringbone", "walnut", "brushed-steel", "brushed-brass", "brushed-champagne", "leather-emboss"];
  const polished = glossy.includes(surface.texture) || isTerrazzo(surface.texture) || isTileTexture(surface.texture);
  const flatFloor = [...glossy, ...satin, "terrazzo", "granite", "carpet", "checker"];
  if (QUALITY.wear && !wall && !flatFloor.includes(surface.texture) && !isTerrazzo(surface.texture) && !isTileTexture(surface.texture) && !isRoofTexture(surface.texture)) {
    const wear = makeWearMap();
    wear.repeat.set(2.4, 2.4);
    material.roughnessMap = wear;
  }
  if (wall && "sheen" in material) {
    material.sheen = tex === "velvet-teal" ? 0.85 : tex === "boucle" || tex === "chunky-knit" ? 0.4 : tex === "silk" ? 0.28 : tex === "drywall" ? 0.16 : tex === "venetian" ? 0.12 : tex === "fluted" ? 0.08 : 0.04;
    material.sheenRoughness = tex === "velvet-teal" ? 0.35 : tex === "silk" ? 0.52 : 0.8;
    if (material.sheenColor && material.sheenColor.set) material.sheenColor.set(tex === "velvet-teal" ? "#7ec8c4" : "#f4efe6");
  }
  if (surface.texture === "mobileFloor" || (isTileTexture(surface.texture) && surface.texture !== "tiles")) {
    const src = makePresetTexture(surface.texture);
    const rsrc = src && src.userData.roughnessMap;
    if (rsrc) {
      const rmap = rsrc.clone();
      rmap.repeat.copy(map ? map.repeat : new THREE.Vector2(1, 1));
      rmap.wrapS = rmap.wrapT = THREE.RepeatWrapping;
      rmap.needsUpdate = true;
      material.roughnessMap = rmap;
    }
    if ("ior" in material) material.ior = 1.52;
    if ("specularIntensity" in material) material.specularIntensity = 1.12;
  }
  if (map && (surface.texture === "luxury" || surface.texture === "photo")) {
    map.center.set(0.5, 0.5);
    map.rotation = Math.PI / 4;
  }
  const WALL_ENV = {
    drywall: 0.78,
    silk: 0.96,
    limewash: 0.5,
    venetian: 1.08,
    microcement: 0.48,
    clay: 0.44,
    travertine: 0.7,
    fluted: 0.74,
    linen: 0.4,
    "concrete-wall": 0.38,
    "reeded-glass": 1.55,
    "brushed-steel": 1.35,
    "brushed-brass": 1.38,
    "brushed-champagne": 1.4,
    statuario: 1.45,
    calacatta: 1.48,
    "terrazzo-chips": 0.85,
    "terrazzo-noir": 1.42,
    "polished-concrete": 1.28,
    "concrete-grey": 0.4,
    zellige: 1.55,
    limestone: 0.42,
    tadelakt: 0.62,
    "stucco-fine": 0.4,
    "fluted-walnut": 0.72,
    herringbone: 0.78,
    corten: 0.55,
    "oxidized-steel": 0.52,
    "patina-copper": 0.7,
    "velvet-teal": 0.35,
    boucle: 0.28,
    "chunky-knit": 0.26,
    "wool-weave": 0.3,
    "woven-jute": 0.32,
    "braided-jute": 0.3,
    rattan: 0.48,
    "leather-emboss": 0.62,
  };
  material.envMapIntensity = surface.texture === "mobileFloor" || isTileTexture(surface.texture)
    ? 1.85
    : polished
    ? isTerrazzo(surface.texture)
      ? 1.42
      : 1.35
    : surface.texture === "roof-stretch" ||
        surface.texture === "roof-mirror" ||
        surface.texture === "roof-skylight" ||
        surface.texture === "roof-metal" ||
        surface.texture === "roof-gold"
      ? 1.28
    : surface.texture === "herringbone"
      ? 0.95
      : wall
        ? WALL_ENV[tex] ?? 0.62
      : satin.includes(surface.texture)
        ? 0.68
        : flatFloor.includes(surface.texture)
          ? 0.75
          : isRoofTexture(surface.texture)
            ? 0.55
            : 1.05;
  material.needsUpdate = true;
}

export function makeWearMap() {
  if (wearCached) return wearCached;
  wearCached = canvasTex((ctx, s) => {
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = ((i * 19) % 23) + Math.floor(Math.random() * 18);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 110 + n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#dedede";
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.lineTo(Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#c8c8c8";
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 50, 12 + Math.random() * 28, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, 512, false);
  return wearCached;
}

export function makeFingerprintMap() {
  if (printCached) return printCached;
  printCached = canvasTex((ctx, s) => {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#8a8a8a";
    for (let i = 0; i < 9; i++) {
      const x = 80 + Math.random() * (s - 160);
      const y = 80 + Math.random() * (s - 160);
      for (let r = 4; r < 28; r += 3) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.72, i, 0, Math.PI * 1.6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.lineTo(Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, 512, false);
  return printCached;
}

export function makeRoughnessFromAlbedo(tex) {
  const img = tex && tex.image;
  if (!img || !img.width) return null;
  const cap = QUALITY.low ? 256 : 512;
  const w = Math.min(img.width, cap);
  const h = Math.min(img.height, cap);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const lum = data.data[i] * 0.3 + data.data[i + 1] * 0.59 + data.data[i + 2] * 0.11;
    const r = Math.min(255, 90 + (255 - lum) * 0.55);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = r;
  }
  ctx.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = QUALITY.aniso;
  t.needsUpdate = true;
  return t;
}

export function loadImageBitmap(fileOrUrl) {
  return new Promise((resolve, reject) => {
    const url = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      if (typeof fileOrUrl !== "string") URL.revokeObjectURL(url);
      resolve({ texture: tex, dataUrl });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function makeAsphalt() {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#4a5058";
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 28;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }, 512);
}

export function makePavers() {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#c8c4bc";
    ctx.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const shade = 198 + ((x * 17 + y * 23) % 18);
        ctx.fillStyle = `rgb(${shade + 8},${shade + 4},${shade - 4})`;
        ctx.fillRect(x * t + 5, y * t + 5, t - 10, t - 10);
        ctx.fillStyle = "rgba(90,86,80,0.22)";
        ctx.fillRect(x * t, y * t, t, 5);
        ctx.fillRect(x * t, y * t, 5, t);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x * t + 8, y * t + 8, t * 0.35, 4);
        if ((x + y) % 3 === 0) {
          ctx.fillStyle = "rgba(140,120,90,0.08)";
          ctx.beginPath();
          ctx.ellipse(x * t + t * 0.6, y * t + t * 0.7, 18, 10, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
}

export function makeBlindWood() {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = "#8a6238";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 28) {
      ctx.fillStyle = y % 56 ? "#9a7044" : "#7a552e";
      ctx.fillRect(0, y, s, 26);
      ctx.strokeStyle = "rgba(50,28,10,0.25)";
      ctx.beginPath();
      ctx.moveTo(0, y + 8);
      ctx.bezierCurveTo(s * 0.3, y + 12, s * 0.7, y + 4, s, y + 10);
      ctx.stroke();
    }
  });
}

export function makeLuxuryGround() {
  return canvasTex((ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#1c1b1a");
    g.addColorStop(0.45, "#141312");
    g.addColorStop(1, "#1a1816");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = ((i * 17) % 13) - 6;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#8a8074";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, 0);
      ctx.bezierCurveTo(Math.random() * s, s * 0.35, Math.random() * s, s * 0.7, Math.random() * s, s);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = "#d8c8a8";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, Math.random() * s);
      ctx.lineTo(Math.random() * s, Math.random() * s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}
