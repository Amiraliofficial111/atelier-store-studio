import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { QUALITY } from "./quality.js";

const SEGS = QUALITY.segs;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, SEGS);
const SPHERE = new THREE.SphereGeometry(1, Math.max(10, SEGS - 4), Math.max(8, SEGS - 6));
const TORUS = new THREE.TorusGeometry(1, 0.16, 8, SEGS);
const DISC = new THREE.CircleGeometry(1, SEGS);
const MAT = new Map();
const TEX = new Map();
const MASTER = { chrono: null, pocket: null };
let watchesLoad = null;

export const WATCH_LOOK = [
  { id: "or", metal: "#d4af37", dial: "#1a1208", name: "OR", brand: "AURUM", strap: "bracelet", style: "chrono" },
  { id: "argent", metal: "#c0c0c8", dial: "#14181e", name: "ARGENT", brand: "LINE", strap: "bracelet", style: "sport" },
  { id: "gmt", metal: "#b87333", dial: "#1c140e", name: "GMT", brand: "ATLAS", strap: "leather", style: "gmt" },
  { id: "ivoire", metal: "#e8d5a3", dial: "#f3efe6", name: "IVOIRE", brand: "SALON", strap: "leather", style: "dress" },
  { id: "noir", metal: "#1a1a1a", dial: "#0a0a0c", name: "NOIR", brand: "LUNA", strap: "leather", style: "moon" },
  { id: "aqua", metal: "#7aa0c4", dial: "#061018", name: "AQUA", brand: "MARINE", strap: "bracelet", style: "diver", accent: "#1e4d8c" },
  { id: "rose", metal: "#b76e79", dial: "#1a0e10", name: "ROSE", brand: "MAISON", strap: "leather", style: "calendar" },
  { id: "pulse", metal: "#2b2d32", dial: "#111318", name: "PULSE", brand: "CARBON", strap: "bracelet", style: "chrono" },
  { id: "platine", metal: "#e8eaee", dial: "#1c2230", name: "PLATINE", brand: "NORD", strap: "bracelet", style: "dress" },
  { id: "cuivre", metal: "#c4622d", dial: "#2a1208", name: "CUIVRE", brand: "FORGE", strap: "leather", style: "sport" },
  { id: "emeraude", metal: "#2f6b4f", dial: "#06140e", name: "EMERAUDE", brand: "VERT", strap: "leather", style: "dress" },
  { id: "saphir", metal: "#2a4a8c", dial: "#060c18", name: "SAPHIR", brand: "AZUR", strap: "bracelet", style: "diver", accent: "#3d7adf" },
  { id: "sand", metal: "#c4a574", dial: "#2a2214", name: "SABLE", brand: "DUNE", strap: "leather", style: "dress" },
  { id: "obsidienne", metal: "#3a2a28", dial: "#100808", name: "OBSIDIENNE", brand: "NOX", strap: "bracelet", style: "moon" },
  { id: "two-tone", metal: "#e6c36a", dial: "#141414", name: "DUO", brand: "PAIR", strap: "bracelet", style: "sport" },
  { id: "ruby", metal: "#8b1e3f", dial: "#14040a", name: "RUBIS", brand: "ROI", strap: "leather", style: "calendar" },
  { id: "titanium", metal: "#8a9098", dial: "#12161c", name: "TITANE", brand: "AERO", strap: "bracelet", style: "chrono" },
  { id: "olive", metal: "#6b6a38", dial: "#12140a", name: "OLIVE", brand: "GROVE", strap: "leather", style: "gmt" },
  { id: "ice", metal: "#b8d4e8", dial: "#0a1824", name: "GLACE", brand: "POLE", strap: "bracelet", style: "diver", accent: "#7ec8e8" },
  { id: "ambre", metal: "#c48a22", dial: "#1a1004", name: "AMBRE", brand: "SOL", strap: "leather", style: "dress" },
  { id: "violet", metal: "#5a3a78", dial: "#100818", name: "VIOLET", brand: "IRIS", strap: "leather", style: "moon" },
  { id: "graphite", metal: "#4a4d52", dial: "#0c0e12", name: "GRAPHITE", brand: "SLATE", strap: "bracelet", style: "sport" },
  { id: "peach", metal: "#d4a090", dial: "#1a1010", name: "PECHE", brand: "BLUSH", strap: "leather", style: "calendar" },
  { id: "forest", metal: "#1e4d3a", dial: "#041208", name: "FORET", brand: "PINE", strap: "bracelet", style: "gmt" },
];

export const WATCH_SWATCH = WATCH_LOOK.map((look) => look.metal);

export function watchLookAt(index = 0) {
  const i = Math.abs(Math.round(Number(index) || 0));
  if (i < WATCH_LOOK.length) return WATCH_LOOK[i];
  const hue = ((i * 137.508) % 360) / 360;
  const sat = 0.38 + (i % 5) * 0.09;
  const lit = 0.26 + (i % 4) * 0.11;
  const metal = new THREE.Color().setHSL(hue, sat, lit);
  const dial = new THREE.Color().setHSL((hue + 0.5) % 1, 0.35, 0.08 + (i % 3) * 0.03);
  const styles = ["chrono", "sport", "dress", "diver", "gmt", "calendar", "moon"];
  return {
    id: `u${i}`,
    metal: `#${metal.getHexString()}`,
    dial: `#${dial.getHexString()}`,
    name: `EDIT ${i}`,
    brand: "AURUM",
    strap: i % 2 ? "bracelet" : "leather",
    style: styles[i % styles.length],
    accent: `#${new THREE.Color().setHSL((hue + 0.12) % 1, 0.55, 0.42).getHexString()}`,
  };
}

export const SKETCHFAB_WATCHES = [
  { uid: "fbad4cb705104df9b60cab174680707a", name: "Digital Watch", author: "jeandiz", license: "CC BY", url: "https://sketchfab.com/3d-models/watch-fbad4cb705104df9b60cab174680707a" },
  { uid: "438651fc63e84a8aaf5f58202a79c157", name: "Old Wrist Watch DH", author: "twilightfox", license: "CC BY", url: "https://sketchfab.com/3d-models/old-wrist-watch-dh-438651fc63e84a8aaf5f58202a79c157" },
  { uid: "c896964ab7274bff810ac5ae9165cf8c", name: "Wrist watch (smartWatch)", author: "mohitdx", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-smartwatch-c896964ab7274bff810ac5ae9165cf8c" },
  { uid: "cd471b55a205468ba87a2e8494a99746", name: "Wrist Watch", author: "Vighneshn_TS", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-cd471b55a205468ba87a2e8494a99746" },
  { uid: "234cf83606af4c3ba77ecc83548bb960", name: "Wrist Watch", author: "Vlapogr", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-234cf83606af4c3ba77ecc83548bb960" },
  { uid: "8136799785b0440e8507b46574de282b", name: "BOCCIA Titanium Wrist Watch", author: "blackcube4", license: "CC BY", url: "https://sketchfab.com/3d-models/boccia-titanium-wrist-watch-animatable-8136799785b0440e8507b46574de282b" },
  { uid: "ef0253ad994a4f808c42fccafed066e8", name: "HW_XYZ Detailing wrist watch", author: "evgeniy_gubenok", license: "CC BY", url: "https://sketchfab.com/3d-models/hw-xyz-detailing-31-wrist-watch-ef0253ad994a4f808c42fccafed066e8" },
  { uid: "238930a5e57e49109dbb3350c316db62", name: "Light Yagami's Wrist watch", author: "1user", license: "CC BY", url: "https://sketchfab.com/3d-models/light-yagamis-wrist-watch-238930a5e57e49109dbb3350c316db62" },
  { uid: "d239ccd569ac4c6ebb5a49cd2217a118", name: "Pocket Watch", author: "saikumarg369", license: "CC BY", url: "https://sketchfab.com/3d-models/pocket-watch-d239ccd569ac4c6ebb5a49cd2217a118" },
  { uid: "cd9d71cd170d48fb9c925f8bf33b6863", name: "AMBASSADOR Heritage 1863 Watch", author: "mark-peters", license: "CC BY", url: "https://sketchfab.com/3d-models/ambassador-heritage-1863-watch-cd9d71cd170d48fb9c925f8bf33b6863" },
  { uid: "51ee70518aa742948575e70a36d1f42a", name: "Wrist watch", author: "twilightfox", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-51ee70518aa742948575e70a36d1f42a" },
  { uid: "64314e5c91c241efbcc47a7d95f4ba5d", name: "Wrist Watch", author: "samanthahaddock", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-64314e5c91c241efbcc47a7d95f4ba5d" },
  { uid: "e93cfa79936b4c8bac89daa07b6b436d", name: "Informatic Wrist Device", author: "Amine.Elouneg", license: "CC BY", url: "https://sketchfab.com/3d-models/informatic-wrist-device-e93cfa79936b4c8bac89daa07b6b436d" },
  { uid: "c5ceb5774c0f4e849e6614817bf4621a", name: "Watch (Artemis)", author: "continuumreed", license: "CC BY", url: "https://sketchfab.com/3d-models/watch-artemis-character-items-free-c5ceb5774c0f4e849e6614817bf4621a" },
  { uid: "8983ee9c36654e8ea1134bc42acaca45", name: "Watch", author: "kkbboutique", license: "CC BY", url: "https://sketchfab.com/3d-models/watch-8983ee9c36654e8ea1134bc42acaca45" },
  { uid: "50dcb83a78ae416cbfa122299543a211", name: "Citizen watch", author: "ahmadriazi", license: "CC BY", url: "https://sketchfab.com/3d-models/citizen-watch-50dcb83a78ae416cbfa122299543a211" },
  { uid: "bcde19f632744b4481d26f63d54f2377", name: "Watch", author: "kmunawar703", license: "CC BY", url: "https://sketchfab.com/3d-models/watch-bcde19f632744b4481d26f63d54f2377" },
  { uid: "20dd01bf520c43b09ea1f405629089db", name: "Sea-Gull 1963 Chronograph Watch", author: "johnny.buxton", license: "CC BY", url: "https://sketchfab.com/3d-models/sea-gull-1963-chronograph-watch-38mm-20dd01bf520c43b09ea1f405629089db" },
  { uid: "08b82f8e87294de4b32b26b143d7a1fd", name: "Wrist watch", author: "kishormettu", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-08b82f8e87294de4b32b26b143d7a1fd" },
  { uid: "88a72f698eda415d8217de52c86a650a", name: "Wrist watch", author: "a.aazhgirevich", license: "CC BY", url: "https://sketchfab.com/3d-models/wrist-watch-88a72f698eda415d8217de52c86a650a" },
  { uid: "057658eddc6a4729af79b02ca1e68513", name: "Joachim Liebermann's pocket watch", author: "WirtualneMuzeaMalopolski", license: "CC BY", url: "https://sketchfab.com/3d-models/joachim-liebermanns-pocket-watch-057658eddc6a4729af79b02ca1e68513" },
  { uid: "2e60626f61ba43e9b295ec27b4f56180", name: "Vintage pocket watch", author: "adsky_pes", license: "CC BY", url: "https://sketchfab.com/3d-models/vintage-pocket-watch-2e60626f61ba43e9b295ec27b4f56180" },
  { uid: "3de961297e0d4f228d0f5d01527ee64f", name: "Old pocket watch", author: "Kakobychno", license: "CC BY", url: "https://sketchfab.com/3d-models/old-pocket-watch-3de961297e0d4f228d0f5d01527ee64f" },
  { uid: "8f03299aecdd4382a04783c472139254", name: "Vintage Pocket Watch", author: "Dodocaedro", license: "CC BY", url: "https://sketchfab.com/3d-models/vintage-pocket-watch-8f03299aecdd4382a04783c472139254" },
  { uid: "a8a270561292434dbf22b7e65e1dcc24", name: "Pocket Watch", author: "eucocker", license: "CC BY", url: "https://sketchfab.com/3d-models/pocket-watch-a8a270561292434dbf22b7e65e1dcc24" },
  { uid: "acb7d4569b52426a8f0cd9266814ae9c", name: "Pocket Watch", author: "Smoggybeard", license: "CC BY", url: "https://sketchfab.com/3d-models/pocket-watch-acb7d4569b52426a8f0cd9266814ae9c" },
  { uid: "dbb40c6f9226401f88230d46a12fa50f", name: "Pocket watch", author: "Artem.Goyko", license: "CC BY", url: "https://sketchfab.com/3d-models/pocket-watch-dbb40c6f9226401f88230d46a12fa50f" },
  { uid: "fa99fca27aa54adaabb03473616ff117", name: "Antique Pocket Watch", author: "michael_grodkowski", license: "CC BY", url: "https://sketchfab.com/3d-models/antique-pocket-watch-fa99fca27aa54adaabb03473616ff117" },
  { uid: "90fdd00f391240ecb328097971c196fe", name: "Watch Series 7 Pro", author: "Rajarajan.Manoharan", license: "CC BY-ND", url: "https://sketchfab.com/3d-models/watch-series-7-pro-90fdd00f391240ecb328097971c196fe" },
  { uid: "c726328d0fd1441f9fc72c9d44b78374", name: "Wrist watch", author: "OyVeyKitty", license: "CC BY-NC-SA", url: "https://sketchfab.com/3d-models/wrist-watch-c726328d0fd1441f9fc72c9d44b78374" },
  { uid: "f78fcc4989cb45a6865b397af7fb2c98", name: "Apple Watch Series 11 Jet Black", author: "mark-peters", license: "CC BY-NC", url: "https://sketchfab.com/3d-models/apple-watch-series-11-jet-black-f78fcc4989cb45a6865b397af7fb2c98" },
  { uid: "4d253a5aa014454f808e61c7d2d3ecbe", name: "Old Pocket Watch", author: "StarTrekGuy", license: "CC BY-NC", url: "https://sketchfab.com/3d-models/old-pocket-watch-4d253a5aa014454f808e61c7d2d3ecbe" },
  { uid: "7c1ef69d70824318aad99bcdce3a849a", name: "Vintage Pocket Watch", author: "mreslan", license: "CC BY-NC", url: "https://sketchfab.com/3d-models/vintage-pocket-watch-7c1ef69d70824318aad99bcdce3a849a" },
];

const LOCAL_WATCH_GLBS = {
  chrono: {
    file: "./models/watches/chronograph.glb",
    credit: "Chronograph Watch — Darmstadt Graphics Group / Khronos, from Sketchfab graphiccompressor, CC BY 4.0",
  },
  pocket: {
    file: "./models/watches/pocket.glb",
    credit: "Pocket watch — antics.gg / CC BY 4.0",
  },
};

const POCKET_SLOTS = new Set([3]);

function canvasTex(key, w, h, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.userData.shared = true;
  TEX.set(key, tex);
  return tex;
}

function std(key, color, extra = {}) {
  const id = `${key}|${color}|${extra.roughness}|${extra.metalness}|${extra.mapKey || ""}`;
  if (MAT.has(id)) return MAT.get(id);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: extra.roughness ?? 0.4,
    metalness: extra.metalness ?? 0.08,
    map: extra.map || null,
    transparent: extra.transparent || false,
    opacity: extra.opacity ?? 1,
    envMapIntensity: extra.env ?? 0.85,
    side: extra.side || THREE.FrontSide,
  });
  m.userData.shared = true;
  MAT.set(id, m);
  return m;
}

function phys(key, color, extra = {}) {
  if (!QUALITY.physical) return std(key, color, extra);
  const id = `p|${key}|${color}|${extra.roughness}|${extra.clearcoat}`;
  if (MAT.has(id)) return MAT.get(id);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: extra.roughness ?? 0.18,
    metalness: extra.metalness ?? 0.9,
    map: extra.map || null,
    clearcoat: extra.clearcoat ?? 0.28,
    clearcoatRoughness: extra.ccr ?? 0.12,
    transparent: extra.transparent || false,
    opacity: extra.opacity ?? 1,
    envMapIntensity: extra.env ?? 1.25,
  });
  m.userData.shared = true;
  MAT.set(id, m);
  return m;
}

function mesh(geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (sx != null) m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function leatherMap() {
  return canvasTex("watch-leather", 256, 256, (ctx, s) => {
    ctx.fillStyle = "#8a7a68";
    ctx.fillRect(0, 0, s, s);
    const img = ctx.getImageData(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const i = (y * s + x) * 4;
        const n = ((x * 13 + y * 7) % 17) + ((x * 3 + y * 11) % 9) - 12;
        img.data[i] += n;
        img.data[i + 1] += n * 0.85;
        img.data[i + 2] += n * 0.65;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

function paintDial(look) {
  return canvasTex(`wdial:${look.id}`, 512, 512, (ctx, w) => {
    const cx = w / 2;
    const cy = w / 2;
    const light = look.style === "dress" && look.id === "ivoire";
    const g = ctx.createRadialGradient(cx - 40, cy - 48, 8, cx, cy, 250);
    g.addColorStop(0, look.dial);
    g.addColorStop(1, light ? "#d8cbb0" : "#050608");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 248, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = look.metal;
    ctx.lineWidth = 10;
    ctx.stroke();

    if (look.style === "diver") {
      ctx.fillStyle = look.accent || "#1e4d8c";
      ctx.beginPath();
      ctx.arc(cx, cy, 246, -Math.PI / 2, Math.PI / 6);
      ctx.arc(cx, cy, 210, Math.PI / 6, -Math.PI / 2, true);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = look.metal;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const hour = i % 5 === 0;
      const inner = hour ? 188 : 210;
      const len = hour ? 28 : 10;
      ctx.globalAlpha = hour ? 1 : 0.4;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.rotate(a);
      ctx.fillRect(hour ? -3 : -1.2, 0, hour ? 6 : 2.2, len);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (look.style === "gmt") {
      ctx.font = "600 18px DM Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#c45c26";
      for (let h = 0; h < 24; h += 6) {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        ctx.fillText(String(h), cx + Math.cos(a) * 168, cy + Math.sin(a) * 168 + 6);
      }
    }

    ctx.fillStyle = look.metal;
    ctx.font = "700 22px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(look.brand, cx, light ? 168 : 156);
    ctx.font = "600 16px DM Sans, sans-serif";
    ctx.globalAlpha = 0.8;
    ctx.fillText(look.name, cx, light ? 192 : 180);
    ctx.globalAlpha = 1;

    if (look.style === "moon" || look.style === "calendar") {
      ctx.fillStyle = light ? "#1a1410" : "#f4efe6";
      const rx = look.style === "moon" ? cx : cx + 52;
      const ry = look.style === "moon" ? cy + 58 : cy;
      ctx.fillRect(rx - 28, ry - 16, 56, 32);
      ctx.fillStyle = "#111";
      ctx.font = "700 20px DM Sans, sans-serif";
      ctx.fillText(look.style === "moon" ? "19" : "26", rx, ry + 7);
    }

    if (look.style === "chrono") {
      const subs = [
        [cx - 70, cy + 8],
        [cx + 70, cy + 8],
        [cx, cy + 86],
      ];
      ctx.strokeStyle = look.metal;
      ctx.lineWidth = 3;
      for (const [sx, sy] of subs) {
        ctx.beginPath();
        ctx.arc(sx, sy, 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 22, sy - 10);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "#f4efe6";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 118);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 96, cy + 28);
    ctx.stroke();
    ctx.strokeStyle = look.metal;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 72, cy + 78);
    ctx.stroke();
    ctx.fillStyle = look.metal;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function addCushion(g, index = 0) {
  const look = watchLookAt(index);
  const wood = std("wstand-wood", "#2a1c14", { roughness: 0.38, metalness: 0.06 });
  const suede = std("wstand-suede", "#d4c2a4", { roughness: 0.78, metalness: 0.02 });
  g.add(mesh(BOX, wood, 0, 0.008, 0, 0.15, 0.014, 0.1));
  const pad = mesh(BOX, suede, 0, 0.02, 0.006, 0.128, 0.016, 0.078);
  pad.rotation.x = -0.22;
  g.add(pad);
  g.add(mesh(BOX, phys(`wpiping:${look.id}`, look.metal, { roughness: 0.18, metalness: 0.86 }), 0, 0.012, 0.052, 0.08, 0.003, 0.012));
}

function addLugs(g, caseM, r) {
  const lug = (z, rot) => {
    const m = mesh(BOX, caseM, 0, 0.034, z, 0.016, 0.006, 0.012);
    m.rotation.x = rot;
    g.add(m);
  };
  lug(-r - 0.006, 0.18);
  lug(r + 0.006, -0.18);
}

function addLeatherStrap(g, look, r) {
  const leather = std(`wstrap:${look.id}`, look.id === "ivoire" ? "#5c3317" : "#1a1410", {
    roughness: 0.62,
    metalness: 0.04,
    map: leatherMap(),
    mapKey: "leather",
  });
  g.add(mesh(BOX, leather, 0, 0.024, 0, 0.015, 0.005, r * 3.6));
  g.add(mesh(BOX, leather, 0, 0.024, -r - 0.03, 0.013, 0.004, 0.028));
  g.add(mesh(BOX, leather, 0, 0.024, r + 0.03, 0.013, 0.004, 0.028));
}

function iceMat(hex = "#f7fbff") {
  const m = new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.05,
    metalness: 0.28,
    envMapIntensity: 2.1,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  m.emissive = new THREE.Color(hex).lerp(new THREE.Color("#fff2c8"), 0.45);
  m.emissiveIntensity = 0.16;
  return m;
}

function addIceBezel(g, r = 0.036, y = 0.046, hex = "#f7fbff") {
  const ice = iceMat(hex);
  const n = QUALITY.low ? 16 : 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = i % 2 ? 0.0017 : 0.0023;
    g.add(mesh(SPHERE, ice, Math.cos(a) * r, y, Math.sin(a) * r, s, s, s));
  }
}

function addBracelet(g, caseM, r) {
  const ice = iceMat();
  for (let k = 0; k < 6; k++) {
    const z = -0.034 + k * 0.013;
    g.add(mesh(BOX, caseM, 0, 0.024, z, 0.016, 0.004, 0.01));
    g.add(mesh(BOX, caseM, -0.007, 0.023, z, 0.006, 0.003, 0.009));
    g.add(mesh(BOX, caseM, 0.007, 0.023, z, 0.006, 0.003, 0.009));
    g.add(mesh(SPHERE, ice, 0, 0.027, z, 0.0016, 0.0016, 0.0016));
  }
  g.add(mesh(BOX, caseM, 0, 0.024, r + 0.028, 0.014, 0.003, 0.01));
}

function addBezel(g, look, caseM, r) {
  const bezel = mesh(TORUS, caseM, 0, 0.039, 0.001, r * 0.92, r * 0.92, r * 0.92);
  bezel.scale.set(1, 1, 0.22);
  g.add(bezel);
  if (look.style === "diver" || look.style === "gmt") {
    const accent = phys(`wbez:${look.id}`, look.accent || look.metal, { roughness: 0.22, metalness: 0.7, env: 1.1 });
    const ring = mesh(CYL, accent, 0, 0.041, 0, r * 1.02, 0.003, r * 1.02);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(mesh(BOX, caseM, Math.cos(a) * r * 0.96, 0.043, Math.sin(a) * r * 0.96, 0.0024, 0.0016, i % 3 === 0 ? 0.006 : 0.003));
    }
  }
}

function addCrown(g, caseM, r, chrono) {
  g.add(mesh(CYL, caseM, r + 0.004, 0.034, 0, 0.0034, 0.01, 0.0034));
  g.add(mesh(CYL, caseM, r + 0.004, 0.042, 0.005, 0.0024, 0.006, 0.0024));
  if (chrono) {
    g.add(mesh(CYL, caseM, r * 0.72, 0.038, -r * 0.72, 0.0022, 0.006, 0.0022));
    g.add(mesh(CYL, caseM, r * 0.72, 0.038, r * 0.72, 0.0022, 0.006, 0.0022));
  }
}

export function buildWatch(index = 0) {
  const look = watchLookAt(index);
  const g = new THREE.Group();
  g.name = `watch-${look.id}`;
  const r = look.style === "dress" ? 0.02 : look.style === "diver" ? 0.024 : 0.022;
  const caseH = look.style === "dress" ? 0.008 : 0.011;
  const caseM = phys(`wcase:${look.id}`, look.metal, { roughness: 0.12, metalness: 0.92, env: 1.35, clearcoat: 0.35, ccr: 0.12 });
  const face = mesh(CYL, caseM, 0, 0.034, 0, r, caseH, r);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  addLugs(g, caseM, r);
  addBezel(g, look, caseM, r);
  const faceMap = paintDial(look);
  g.add(mesh(DISC, std(`wdial:${look.id}`, "#ffffff", { map: faceMap, mapKey: `wf:${look.id}`, roughness: 0.14, env: 1.1 }), 0, 0.04, 0.002, r * 0.78, r * 0.78, 1));
  g.add(
    mesh(
      DISC,
      phys(`wcrystal:${look.id}`, "#eef6ff", { roughness: 0.04, metalness: 0.06, transparent: true, opacity: 0.2, env: 1.5, clearcoat: 0.62, ccr: 0.08 }),
      0,
      0.0435,
      0.003,
      r * 0.8,
      r * 0.8,
      1
    )
  );
  addCrown(g, caseM, r, look.style === "chrono");
  if (look.strap === "bracelet") addBracelet(g, caseM, r);
  else addLeatherStrap(g, look, r);
  if (look.strap === "bracelet") addIceBezel(g, r * 0.98, 0.046, look.metal);
  return g;
}

function fitWatchGlb(object, target = 0.14) {
  object.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(object);
  let size = box.getSize(new THREE.Vector3());
  if (size.y > size.x * 1.15 && size.y > size.z * 1.15) {
    object.rotation.x = -Math.PI / 2;
    object.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(object);
    size = box.getSize(new THREE.Vector3());
  }
  const s = target / Math.max(size.x, size.z, 0.001);
  object.scale.multiplyScalar(s);
  object.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(object);
  const mid = box.getCenter(new THREE.Vector3());
  object.position.x -= mid.x;
  object.position.z -= mid.z;
  object.position.y += 0.022 - box.min.y;
  object.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if (!m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.45);
      if (mat.metalness != null && mat.metalness > 0.35) mat.roughness = Math.min(mat.roughness ?? 0.2, 0.18);
      if (mat.clearcoat != null) mat.clearcoat = Math.max(mat.clearcoat, 0.35);
    }
  });
  return object;
}

function tintMat(mat, look) {
  const name = `${mat.name || ""}`.toLowerCase();
  const next = mat.clone();
  if (name.includes("glass")) {
    next.envMapIntensity = 1.7;
    next.transparent = true;
    next.opacity = Math.min(next.opacity ?? 1, 0.42);
    next.roughness = 0.04;
    return next;
  }
  if (name.includes("watch face") || name.includes("dial") || name.includes("screen")) {
    next.color.lerp(new THREE.Color(look.dial), 0.72);
    return next;
  }
  if (look.strap === "leather" && (name.includes("band") || name.includes("strap") || name.includes("leather") || name.includes("carbon") || name.includes("plastic"))) {
    next.color.set(look.id === "ivoire" ? "#5c3317" : "#1a1410");
    next.metalness = 0.08;
    next.roughness = 0.6;
    next.envMapIntensity = 0.7;
    return next;
  }
  next.color.set(look.metal);
  next.metalness = Math.max(next.metalness ?? 0.4, 0.9);
  next.roughness = Math.min(next.roughness ?? 0.2, 0.14);
  next.envMapIntensity = 1.85;
  return next;
}

function tintWatch(root, index) {
  const look = watchLookAt(index);
  root.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    if (Array.isArray(m.material)) m.material = m.material.map((mat) => tintMat(mat, look));
    else m.material = tintMat(m.material, look);
  });
}

function loadGlb(url) {
  return new Promise((resolve) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf), undefined, () => resolve(null));
  });
}

export function loadWatchModels() {
  if (watchesLoad) return watchesLoad;
  watchesLoad = Promise.all([loadGlb(LOCAL_WATCH_GLBS.chrono.file), loadGlb(LOCAL_WATCH_GLBS.pocket.file)]).then(
    ([chrono, pocket]) => {
      if (chrono?.scene) MASTER.chrono = fitWatchGlb(chrono.scene, 0.2);
      if (pocket?.scene) MASTER.pocket = fitWatchGlb(pocket.scene, 0.16);
      return true;
    }
  );
  return watchesLoad;
}

export function cloneWatchModel(index) {
  const i = Math.abs(Math.round(Number(index) || 0));
  const src = POCKET_SLOTS.has(i % WATCH_LOOK.length) && MASTER.pocket ? MASTER.pocket : MASTER.chrono;
  if (!src) return null;
  const clone = src.clone(true);
  tintWatch(clone, i);
  clone.rotation.y = i % 2 ? 0.18 : -0.14;
  return clone;
}

export function buildWatchDisplay(index = 0, extra = {}) {
  const look = watchLookAt(index);
  const g = new THREE.Group();
  if (extra.stand !== false) addCushion(g, index);
  const glb = cloneWatchModel(index);
  if (glb) {
    g.add(glb);
    if (extra.ice !== false && look.strap === "bracelet") addIceBezel(g, 0.038, 0.05, look.metal);
  } else g.add(buildWatch(index));
  g.rotation.x = extra.tilt ?? -0.32;
  return g;
}
