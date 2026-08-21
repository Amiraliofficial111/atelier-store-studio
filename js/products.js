import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makePresetTexture } from "./textures.js";
import { QUALITY, capTex } from "./quality.js";
import { buildGarment } from "./garments.js";
import { buildWatchDisplay, WATCH_SWATCH } from "./watches.js";

const FABRIC_WEAVE = makePresetTexture("fabric");

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, QUALITY.segs);
const TAPER = new THREE.CylinderGeometry(0.78, 1, 1, QUALITY.segs);
const CUP = new THREE.CylinderGeometry(1, 0.82, 1, QUALITY.segs);
const SPHERE = new THREE.SphereGeometry(1, QUALITY.segs, Math.max(8, QUALITY.segs - 2));
const TORUS = new THREE.TorusGeometry(1, 0.18, 8, QUALITY.segs);
const HANGER = new THREE.TorusGeometry(0.078, 0.005, 6, QUALITY.segs, Math.PI);
const DISC = new THREE.CircleGeometry(1, QUALITY.segs);
const dummy = new THREE.Object3D();
const tint = new THREE.Color();

const TEX = new Map();
const MAT = new Map();
const SHIRT_URLS = [
  "./textures/clothes/shirt-06.jpg",
  "./textures/clothes/shirt-05.jpg",
  "./textures/clothes/shirt-07.jpg",
  "./textures/clothes/shirt-01.jpg",
  "./textures/clothes/shirt-08.jpg",
  "./textures/clothes/shirt-09.jpg",
  "./textures/clothes/dress-04.jpg",
  "./textures/clothes/hang-07.jpg",
];
const PANTS_URLS = [
  "./textures/clothes/pants-08.jpg",
  "./textures/clothes/pants-01.jpg",
  "./textures/clothes/pants-02.jpg",
  "./textures/clothes/pants-07.jpg",
  "./textures/clothes/pants-09.jpg",
  "./textures/clothes/pants-10.jpg",
  "./textures/clothes/pants-03.jpg",
];
const JACKET_URLS = [
  "./textures/clothes/jacket-02.jpg",
  "./textures/clothes/hang-05.jpg",
  "./textures/clothes/jacket-01.jpg",
  "./textures/clothes/01.jpg",
  "./textures/clothes/03.jpg",
];
const DRESS_PHOTO_URLS = [
  "./textures/clothes/hang-10.jpg",
  "./textures/clothes/hang-09.jpg",
  "./textures/clothes/dress-01.jpg",
  "./textures/clothes/dress-02.jpg",
  "./textures/clothes/dress-03.jpg",
  "./textures/clothes/06.jpg",
];
const MODEL_URLS = [
  "./textures/clothes/model-suit.jpg",
  "./textures/clothes/model-runway.jpg",
  "./textures/clothes/hang-10.jpg",
  "./textures/clothes/05.jpg",
  "./textures/clothes/06.jpg",
];
const SHOE_PHOTO_URLS = ["./textures/clothes/hang-08.jpg"];
const SHIRT_TEX = [];
const PANTS_TEX = [];
const JACKET_TEX = [];
const DRESS_TEX = [];
const CLOTH_TEX = [];
const MODEL_TEX = [];
const SHOE_PHOTO_TEX = [];
let clothesLoad = null;

function canvasFromImage(img) {
  const max = 900;
  const iw = img.width || img.naturalWidth || 1;
  const ih = img.height || img.naturalHeight || 1;
  const scale = Math.min(1, max / Math.max(iw, ih));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(iw * scale));
  c.height = Math.max(2, Math.round(ih * scale));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function finishPhotoTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  tex.userData.shared = true;
  return tex;
}

function isolateSubject(source) {
  const img = source.image || source;
  if (!img || !(img.width || img.naturalWidth)) return source;
  const src = canvasFromImage(img);
  const ctx = src.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, src.width, src.height);
  const px = data.data;
  const w = src.width;
  const h = src.height;
  const samples = [];
  const pick = (x, y) => {
    const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;
    samples.push([px[i], px[i + 1], px[i + 2]]);
  };
  const stepX = Math.max(1, Math.floor(w / 18));
  const stepY = Math.max(1, Math.floor(h / 18));
  for (let x = 0; x < w; x += stepX) {
    pick(x, 2);
    pick(x, h - 3);
  }
  for (let y = 0; y < h; y += stepY) {
    pick(2, y);
    pick(w - 3, y);
  }
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const s of samples) {
    br += s[0];
    bg += s[1];
    bb += s[2];
  }
  br /= samples.length;
  bg /= samples.length;
  bb /= samples.length;
  const dist = (r, g, b) => Math.hypot(r - br, g - bg, b - bb);
  let spread = 0;
  for (const s of samples) spread += dist(s[0], s[1], s[2]);
  spread /= samples.length;
  if (spread < 46) {
    const thresh = Math.max(26, Math.min(70, spread * 2.1 + 30));
    for (let i = 0; i < px.length; i += 4) {
      const d = dist(px[i], px[i + 1], px[i + 2]);
      if (d < thresh) px[i + 3] = 0;
      else if (d < thresh * 1.4) px[i + 3] = Math.round(((d - thresh) / (thresh * 0.4)) * 255);
    }
    ctx.putImageData(data, 0, 0);
  }
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 28) {
        opaque += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (opaque < w * h * 0.06 || maxX <= minX) return finishPhotoTex(src);
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d").drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  if (source.dispose) source.dispose();
  return finishPhotoTex(out);
}

function loadUrlList(urls, target) {
  const loader = new THREE.TextureLoader();
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve) => {
          loader.load(
            url,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              const isolated = QUALITY.stockLite ? tex : isolateSubject(tex);
              target.push(isolated);
              resolve(isolated);
            },
            undefined,
            () => resolve(null)
          );
        })
    )
  );
}

const CLOTH_MODELS = { shirt: [], pants: [], dress: [], blazer: [] };
let HANGER_SHIRT = null;
let modelsLoad = null;

function fitHanging(object, targetH = 0.72) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const s = targetH / Math.max(size.y, 0.001);
  object.scale.multiplyScalar(s);
  object.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(object);
  const mid = box2.getCenter(new THREE.Vector3());
  object.position.x -= mid.x;
  object.position.z -= mid.z;
  object.position.y -= box2.max.y;
  object.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if (m.material) {
      m.material.side = THREE.DoubleSide;
      m.material.envMapIntensity = 0.85;
    }
  });
  return object;
}

function loadObjTextured(objUrl, texUrl, kind, height) {
  return new Promise((resolve) => {
    new OBJLoader().load(
      objUrl,
      (obj) => {
        const apply = (tex) => {
          if (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = QUALITY.aniso;
            obj.traverse((m) => {
              if (!m.isMesh) return;
              m.material = new THREE.MeshPhysicalMaterial({
                map: tex,
                roughness: 0.52,
                metalness: 0,
                sheen: 0.28,
                sheenColor: new THREE.Color("#fff4e8"),
                side: THREE.DoubleSide,
              });
            });
          }
          CLOTH_MODELS[kind].push(fitHanging(obj, height));
          resolve(obj);
        };
        if (!texUrl) return apply(null);
        new THREE.TextureLoader().load(texUrl, apply, undefined, () => apply(null));
      },
      undefined,
      () => resolve(null)
    );
  });
}

function loadFbxTextured(fbxUrl, texUrl, kind, height) {
  return new Promise((resolve) => {
    new FBXLoader().load(
      fbxUrl,
      (obj) => {
        const finish = (tex) => {
          if (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            obj.traverse((m) => {
              if (!m.isMesh) return;
              const mat = m.material?.clone?.() || new THREE.MeshPhysicalMaterial({ roughness: 0.55 });
              mat.map = tex;
              mat.side = THREE.DoubleSide;
              m.material = mat;
            });
          }
          CLOTH_MODELS[kind].push(fitHanging(obj, height));
          resolve(obj);
        };
        if (!texUrl) return finish(null);
        new THREE.TextureLoader().load(texUrl, finish, undefined, () => finish(null));
      },
      undefined,
      () => resolve(null)
    );
  });
}

function loadGlb(url, kind, height) {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        CLOTH_MODELS[kind].push(fitHanging(gltf.scene, height));
        resolve(gltf.scene);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function meshLabel(mesh) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return `${mesh.name || ""} ${mat?.name || ""}`.toLowerCase();
}

function prepareHangerShirt(root, targetH = 0.62) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(targetH / Math.max(size.y, 0.001));
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const mid = box2.getCenter(new THREE.Vector3());
  root.position.x -= mid.x;
  root.position.z -= mid.z;
  root.position.y -= box2.max.y;
  root.traverse((m) => {
    if (!m.isMesh) return;
    const name = meshLabel(m);
    const keep = name.includes("wood") || name.includes("pants") || name.includes("metal");
    m.visible = keep;
    m.castShadow = keep;
    m.receiveShadow = keep;
    if (m.material) {
      m.material = m.material.clone();
      m.material.side = THREE.DoubleSide;
      m.material.envMapIntensity = name.includes("wood") || name.includes("metal") ? 1.15 : 0.55;
    }
  });
  HANGER_SHIRT = root;
  return root;
}

function loadHangerShirt(url) {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        prepareHangerShirt(gltf.scene, 0.62);
        resolve(gltf.scene);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function dyeClothMap(source, hex) {
  const key = `graydye:${source?.uuid || "tex"}:${hex}`;
  if (DYE_CACHE.has(key)) return DYE_CACHE.get(key);
  const img = source?.image;
  if (!img || !(img.width || img.naturalWidth)) return source;
  const c = document.createElement("canvas");
  c.width = img.width || img.naturalWidth;
  c.height = img.height || img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    const lift = Math.min(255, g * 1.45 + 48);
    px[i] = px[i + 1] = px[i + 2] = lift;
  }
  ctx.putImageData(data, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.wrapS = source.wrapS;
  tex.wrapT = source.wrapT;
  tex.needsUpdate = true;
  DYE_CACHE.set(key, tex);
  return tex;
}

function tintHangerCloth(mat, hex) {
  const next = mat.clone();
  const dyed = next.map ? dyeClothMap(next.map, hex) : null;
  if (dyed && dyed !== next.map) {
    next.map = dyed;
    next.color = new THREE.Color("#ffffff");
  } else {
    next.map = null;
    next.color = new THREE.Color(hex);
  }
  next.roughness = 0.58;
  next.metalness = 0;
  next.envMapIntensity = 0.6;
  next.side = THREE.DoubleSide;
  next.needsUpdate = true;
  return next;
}

function cloneHangerShirt(color) {
  if (!HANGER_SHIRT) return null;
  const clone = HANGER_SHIRT.clone(true);
  clone.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const name = meshLabel(m);
    const cloth = name.includes("pants") || name.includes("shirt") || name.includes("velvet");
    if (Array.isArray(m.material)) {
      m.material = m.material.map((mat) => (cloth ? tintHangerCloth(mat, color) : mat.clone()));
    } else {
      m.material = cloth ? tintHangerCloth(m.material, color) : m.material.clone();
    }
  });
  return clone;
}

export function loadClothesModels() {
  if (modelsLoad) return modelsLoad;
  modelsLoad = Promise.all([
    loadHangerShirt("./models/dresses/hangers_and_long_sleeve_shirt.glb"),
    loadGlb("./models/dresses/dress-aline.glb", "dress", 0.8),
    loadGlb("./models/dresses/dress-midi.glb", "dress", 0.68),
    loadGlb("./models/dresses/dress-gown.glb", "dress", 0.88),
    loadGlb("./models/dresses/dress-shirtdress.glb", "dress", 0.62),
    loadGlb("./models/dresses/shirt.glb", "shirt", 0.58),
    loadGlb("./models/dresses/pants.glb", "pants", 0.72),
    loadGlb("./models/dresses/blazer.glb", "blazer", 0.6),
    loadObjTextured("./models/clothes/shirt/shirt.obj", "./models/clothes/shirt/shirt.jpg", "shirt", 0.7),
  ]).then(() => true);
  return modelsLoad;
}

const DYE_CACHE = new Map();
const GARMENT_COLORS = [
  "#f3efe6",
  "#1a1a1a",
  "#b42318",
  "#1e3a5f",
  "#2f5d50",
  "#c4a574",
  "#8b1e3f",
  "#4a1d4e",
  "#e8b4c4",
  "#3d5a80",
  "#d4a017",
  "#5c3317",
  "#6b2d5c",
  "#2a6f97",
  "#7a4b27",
  "#d8d2c8",
];

function dyeTexture(source, hex) {
  const key = `${source?.uuid || "tex"}:${hex}`;
  if (DYE_CACHE.has(key)) return DYE_CACHE.get(key);
  const img = source?.image;
  if (!img || !(img.width || img.naturalWidth)) return source;
  const c = document.createElement("canvas");
  c.width = img.width || img.naturalWidth;
  c.height = img.height || img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.needsUpdate = true;
  DYE_CACHE.set(key, tex);
  return tex;
}

function applyGarmentPbr(root, color, style) {
  const cloth = dressCloth(color, style);
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.material = cloth;
    m.castShadow = true;
    m.receiveShadow = true;
    m.flatShading = false;
  });
}

function cloneClothModel(style, slot, color) {
  const pool = CLOTH_MODELS[style];
  if (!pool?.length) return null;
  const proto = pool[slot % pool.length];
  const clone = proto.clone(true);
  clone.visible = true;
  applyGarmentPbr(clone, color, style);
  clone.position.y -= 0.04;
  return clone;
}

export function loadClothesPhotos() {
  if (clothesLoad) return clothesLoad;
  const lite = QUALITY.stockLite;
  clothesLoad = Promise.all([
    loadClothesModels(),
    loadUrlList(lite ? SHIRT_URLS.slice(0, 4) : SHIRT_URLS, SHIRT_TEX),
    loadUrlList(lite ? PANTS_URLS.slice(0, 3) : PANTS_URLS, PANTS_TEX),
    loadUrlList(lite ? JACKET_URLS.slice(0, 3) : JACKET_URLS, JACKET_TEX),
    loadUrlList(lite ? DRESS_PHOTO_URLS.slice(0, 4) : DRESS_PHOTO_URLS, DRESS_TEX),
    lite ? Promise.resolve() : loadUrlList(MODEL_URLS, MODEL_TEX),
    loadUrlList(SHOE_PHOTO_URLS, SHOE_PHOTO_TEX),
    QUALITY.high ? loadFabricPBR() : Promise.resolve(false),
  ]).then(() => {
    CLOTH_TEX.push(...SHIRT_TEX, ...PANTS_TEX, ...JACKET_TEX, ...DRESS_TEX);
  });
  return clothesLoad;
}

export function hasPhotoClothes() {
  return SHIRT_TEX.length + PANTS_TEX.length + DRESS_TEX.length > 0;
}

function pickClothPhoto(style, slot) {
  const byStyle = {
    shirt: SHIRT_TEX,
    pants: PANTS_TEX,
    blazer: JACKET_TEX,
    dress: DRESS_TEX,
  };
  const preferred = byStyle[style];
  const pool = preferred?.length ? preferred : CLOTH_TEX.length ? CLOTH_TEX : [...SHIRT_TEX, ...PANTS_TEX, ...JACKET_TEX, ...DRESS_TEX];
  if (!pool.length) return null;
  return pool[slot % pool.length];
}

function imageAspect(tex) {
  const img = tex?.image;
  const w = img?.width || img?.naturalWidth || 1;
  const h = img?.height || img?.naturalHeight || 1;
  return w / Math.max(1, h);
}

function photoMaterial(tex) {
  const m = new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.4,
    metalness: 0,
    sheen: 0.32,
    sheenColor: new THREE.Color("#fff4e8"),
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    envMapIntensity: 0.88,
  });
  return m;
}

function bentPlane(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 8, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sin((y / h + 0.5) * Math.PI) * 0.028 + (x * x) / Math.max(0.06, w) * 0.08);
  }
  geo.computeVertexNormals();
  return geo;
}

function makePhotoCard(tex, maxH, maxW) {
  const aspect = imageAspect(tex);
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  const mesh = new THREE.Mesh(bentPlane(w, h), photoMaterial(tex));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.cardH = h;
  mesh.userData.cardW = w;
  return mesh;
}

export function makePhotoFigure(kind = "suit", extra = {}) {
  const pool = MODEL_TEX.length ? MODEL_TEX : CLOTH_TEX;
  if (!pool.length) return null;
  const pick = kind === "runway" ? 1 : kind === "dress" ? 2 : 0;
  const tex = pool[pick % pool.length] || pool[0];
  if (!tex) return null;
  const height = extra.height ?? 1.7;
  const aspect = imageAspect(tex);
  const w = Math.min(extra.maxW ?? 0.7, height * Math.min(0.72, aspect));
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(w, height, 1, 1), photoMaterial(tex));
  card.position.y = height / 2;
  card.castShadow = true;
  card.receiveShadow = true;
  g.add(card);
  return g;
}

function canvasTex(key, w, h, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const sized = capTex(w, h);
  w = sized.w;
  h = sized.h;
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
  const id = `${key}|${color}|${extra.mapKey || ""}|${extra.roughness}|${extra.metalness}|${extra.emissive || ""}`;
  if (MAT.has(id)) return MAT.get(id);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: extra.roughness ?? 0.45,
    metalness: extra.metalness ?? 0.06,
    map: extra.map || null,
    emissive: extra.emissive || "#000000",
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    transparent: extra.transparent || false,
    opacity: extra.opacity ?? 1,
    envMapIntensity: extra.env ?? 0.7,
  });
  m.userData.shared = true;
  MAT.set(id, m);
  return m;
}

function phys(key, color, extra = {}) {
  if (!QUALITY.physical) return std(key, color, extra);
  const id = `p|${key}|${color}|${extra.mapKey || ""}|${extra.roughness}|${extra.sheen}|${extra.clearcoat}`;
  if (MAT.has(id)) return MAT.get(id);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: extra.roughness ?? 0.38,
    metalness: extra.metalness ?? 0.04,
    map: extra.map || null,
    clearcoat: extra.clearcoat ?? 0.12,
    clearcoatRoughness: extra.ccr ?? 0.35,
    sheen: extra.sheen ?? 0,
    sheenRoughness: extra.sheenRoughness ?? 0.55,
    transparent: extra.transparent || false,
    opacity: extra.opacity ?? 1,
    envMapIntensity: extra.env ?? 0.85,
  });
  if (m.sheenColor) m.sheenColor.set(extra.sheenColor || "#fff4e6");
  m.userData.shared = true;
  MAT.set(id, m);
  return m;
}

function silkMap() {
  const tex = canvasTex("silk-weave", 512, 512, (ctx, s) => {
    ctx.fillStyle = "#cfc8be";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const weave = y % 4 < 2;
      ctx.fillStyle = weave ? "rgba(255,255,255,0.16)" : "rgba(32,22,14,0.08)";
      ctx.fillRect(0, y, s, 1);
    }
    for (let x = 0; x < s; x += 3) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x, 0, 1, s);
    }
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "rgba(255,255,255,0.14)");
    g.addColorStop(0.45, "rgba(0,0,0,0.04)");
    g.addColorStop(1, "rgba(255,248,236,0.12)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function leatherMap() {
  return canvasTex("leather-grain", 256, 256, (ctx, s) => {
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

function mesh(geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (sx != null) m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function labelBox(bg, accent, title, sub) {
  return canvasTex(`box2:${title}:${bg}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, "rgba(255,255,255,0.1)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 28, w, 28);
    ctx.globalAlpha = 0.16;
    ctx.fillRect(20, 36, w - 40, h - 78);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 40, w - 48, h - 86);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.font = "700 28px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 112);
    ctx.font = "600 15px DM Sans, sans-serif";
    ctx.fillText(sub, w / 2, 138);
    ctx.font = "500 11px DM Sans, sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText("NET WT  400g", w / 2, 162);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#111";
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 22; i++) ctx.fillRect(36 + i * 8, 204, 3, 16);
    ctx.globalAlpha = 1;
  });
}

function labelCan(bg, accent, title) {
  return canvasTex(`can2:${title}:${bg}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#b8bcc0";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 18, w, h - 36);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 18, w, 10);
    ctx.fillRect(0, h - 28, w, 10);
    ctx.fillStyle = accent;
    ctx.font = "700 26px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 72);
    ctx.font = "500 11px DM Sans, sans-serif";
    ctx.globalAlpha = 0.8;
    ctx.fillText("400g  ·  PREMIUM", w / 2, 92);
    ctx.globalAlpha = 1;
  });
}

function laptopScreen(i) {
  const walls = [
    ["#0b1a2e", "#2ad4e8"],
    ["#12141a", "#4ae0ee"],
    ["#1a1028", "#a78bfa"],
    ["#102018", "#4ade80"],
    ["#201810", "#fbbf24"],
  ];
  const [a, b] = walls[i % walls.length];
  return canvasTex(`lscreen:${i % 5}`, 512, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(28, 24, 200, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "700 36px DM Sans, sans-serif";
    ctx.fillText("UNIVERSAL", 28, 88);
    ctx.font = "500 18px DM Sans, sans-serif";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Laptops  ·  5G store demo", 28, 118);
    ctx.globalAlpha = 1;
    const icons = ["#3d8bfd", "#4ade80", "#fbbf24", "#fb7185", "#a78bfa", "#2ad4e8"];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = icons[(r + c + i) % icons.length];
        ctx.fillRect(28 + c * 92, 160 + r * 64, 76, 48);
      }
    }
  });
}

const PHONE_SPECS = [
  { title: "iPhone 16 Pro Max", sku: "AP-16PM", price: "$1,199", detail: "Natural Titanium · 6.9\" Super Retina · A18 Pro", brand: "Apple", family: "pro", body: "#9a9388", edge: "#c4bfb6", boxBg: "#1c1c1e", boxFg: "#f5f5f7", size: [0.078, 0.163, 0.0082], wall: ["#2a261f", "#c4b49a"] },
  { title: "iPhone 16 Pro", sku: "AP-16P", price: "$999", detail: "Black Titanium · 6.3\" Super Retina · A18 Pro", brand: "Apple", family: "pro", body: "#2a2c2e", edge: "#6a6e72", boxBg: "#1c1c1e", boxFg: "#f5f5f7", size: [0.072, 0.15, 0.0082], wall: ["#121416", "#4b5563"] },
  { title: "iPhone 16", sku: "AP-16", price: "$799", detail: "Ultramarine · 6.1\" Super Retina · A18", brand: "Apple", family: "slim", body: "#1e3a8a", edge: "#93c5fd", boxBg: "#f5f5f7", boxFg: "#1d1d1f", size: [0.072, 0.148, 0.0078], wall: ["#1e3a8a", "#60a5fa"] },
  { title: "iPhone 16 Plus", sku: "AP-16PL", price: "$899", detail: "Pink · 6.7\" Super Retina · A18", brand: "Apple", family: "slim", body: "#e8b4c4", edge: "#f8d7e0", boxBg: "#f5f5f7", boxFg: "#1d1d1f", size: [0.078, 0.161, 0.0078], wall: ["#9d174d", "#f9a8d4"] },
  { title: "Galaxy S25 Ultra", sku: "SS-S25U", price: "$1,299", detail: "Titanium Black · 6.9\" QHD+ · 200MP", brand: "Samsung", family: "ring", body: "#1a1c1e", edge: "#8a8f96", boxBg: "#14233d", boxFg: "#d4e8ff", size: [0.079, 0.163, 0.0084], wall: ["#0b1220", "#3b82f6"] },
  { title: "Galaxy S25+", sku: "SS-S25P", price: "$999", detail: "Navy · 6.7\" QHD+ · Snapdragon", brand: "Samsung", family: "ring", body: "#152a4a", edge: "#60a5fa", boxBg: "#14233d", boxFg: "#d4e8ff", size: [0.076, 0.158, 0.0076], wall: ["#0f2744", "#38bdf8"] },
  { title: "Galaxy Z Fold6", sku: "SS-ZF6", price: "$1,899", detail: "Crafted Black · Dual 7.6\" AMOLED · Fold", brand: "Samsung", family: "fold", body: "#1c1f24", edge: "#9aa3ad", boxBg: "#111418", boxFg: "#e7a15a", size: [0.07, 0.155, 0.013], wall: ["#111827", "#818cf8"] },
  { title: "Galaxy Z Flip6", sku: "SS-ZP6", price: "$1,099", detail: "Mint · Cover display · Compact fold", brand: "Samsung", family: "flip", body: "#7dcea0", edge: "#d1fae5", boxBg: "#111418", boxFg: "#6ee7b7", size: [0.072, 0.088, 0.014], wall: ["#064e3b", "#6ee7b7"] },
  { title: "Pixel 9 Pro XL", sku: "GP-P9X", price: "$1,099", detail: "Porcelain · Camera bar · Tensor G4", brand: "Google", family: "bar", body: "#f2efe8", edge: "#e7e2d8", boxBg: "#e8eaed", boxFg: "#202124", size: [0.077, 0.162, 0.0086], wall: ["#e8eaed", "#8ab4f8"] },
  { title: "Pixel 9", sku: "GP-P9", price: "$799", detail: "Wintergreen · Camera bar · Tensor G4", brand: "Google", family: "bar", body: "#6b8f71", edge: "#c5d5c4", boxBg: "#e8eaed", boxFg: "#202124", size: [0.073, 0.152, 0.0086], wall: ["#14532d", "#86efac"] },
  { title: "OnePlus 13", sku: "OP-13", price: "$899", detail: "Midnight Ocean · Hasselblad · 100W", brand: "OnePlus", family: "triple", body: "#0c2744", edge: "#f97316", boxBg: "#111418", boxFg: "#fb923c", size: [0.075, 0.16, 0.0084], wall: ["#7c2d12", "#fb923c"] },
  { title: "Xiaomi 15 Ultra", sku: "MI-15U", price: "$1,149", detail: "Black Leica · 1-inch sensor · Snapdragon", brand: "Xiaomi", family: "leica", body: "#141618", edge: "#ef4444", boxBg: "#1c1916", boxFg: "#fca5a5", size: [0.078, 0.162, 0.009], wall: ["#1c1916", "#f87171"] },
];

function phoneSpec(i = 0) {
  return PHONE_SPECS[((Number(i) || 0) % PHONE_SPECS.length + PHONE_SPECS.length) % PHONE_SPECS.length];
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function paintPhotoWall(ctx, w, h, kind) {
  const skies = {
    dune: ["#1b2434", "#c47a4a", "#e8c49a"],
    night: ["#070910", "#1a2744", "#3d4f72"],
    ocean: ["#0b1c3a", "#1d4e89", "#7eb6e0"],
    blossom: ["#3a1024", "#c45c7a", "#f3c4d4"],
    navy: ["#050914", "#102a4a", "#3d7ad6"],
    aurora: ["#061018", "#0f3d4a", "#3ee0c4"],
    violet: ["#12081c", "#3b1d6e", "#c4a0ff"],
    mint: ["#06241c", "#1a6b52", "#9be7c4"],
    porcelain: ["#d8e4f0", "#f4efe6", "#8ab4f8"],
    forest: ["#0c1a12", "#245c38", "#9ad4a0"],
    ember: ["#1a0a08", "#8a2a12", "#f0a060"],
    city: ["#12080c", "#4a1218", "#e05050"],
  };
  const [a, b, c] = skies[kind] || skies.ocean;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a);
  g.addColorStop(0.42, b);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.arc(kind === "porcelain" ? w * 0.72 : w * 0.78, h * 0.18, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = a;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.quadraticCurveTo(w * 0.35, h * 0.48, w * 0.7, h * 0.66);
  ctx.lineTo(w, h * 0.7);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74);
  ctx.quadraticCurveTo(w * 0.5, h * 0.58, w, h * 0.78);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function paintStatus(ctx, w, light = true) {
  ctx.fillStyle = light ? "#fff" : "#111";
  ctx.font = "600 15px DM Sans, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("9:41", 22, 28);
  ctx.textAlign = "right";
  ctx.fillRect(w - 44, 18, 22, 11);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = light ? "#fff" : "#111";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(w - 46, 16, 26, 15);
  ctx.globalAlpha = 1;
  ctx.fillRect(w - 19, 20, 2, 7);
  ctx.fillRect(w - 70, 18, 4, 10);
  ctx.fillRect(w - 64, 16, 4, 12);
  ctx.fillRect(w - 58, 14, 4, 14);
}

function paintAppIcon(ctx, x, y, s, kind) {
  const pack = {
    phone: ["#34c759", "☎"],
    msg: ["#34c759", "💬"],
    safari: ["#0a84ff", "◎"],
    cam: ["#8e8e93", "◉"],
    photos: ["#ff375f", "❀"],
    music: ["#ff2d55", "♪"],
    maps: ["#64d2ff", "➤"],
    set: ["#8e8e93", "⚙"],
    mail: ["#0a84ff", "✉"],
    cal: ["#ff3b30", "19"],
    clock: ["#1c1c1e", "◷"],
    notes: ["#ffd60a", "✎"],
    store: ["#0a84ff", "A"],
    weather: ["#5ac8fa", "☀"],
    wallet: ["#1c1c1e", "▣"],
    play: ["#ea4335", "▶"],
    chrome: ["#4285f4", "◯"],
    yt: ["#ff0000", "▶"],
    gmail: ["#ea4335", "M"],
    shop: ["#1428a0", "✦"],
  };
  const [bg, glyph] = pack[kind] || ["#3d8bfd", "•"];
  ctx.fillStyle = bg;
  rr(ctx, x, y, s, s, s * 0.24);
  ctx.fill();
  ctx.fillStyle = kind === "notes" || kind === "cal" ? "#111" : "#fff";
  ctx.font = `700 ${kind === "cal" ? 18 : 16}px DM Sans, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, x + s / 2, y + s / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function paintIOS(ctx, w, h, spec) {
  const walls = { "AP-16PM": "dune", "AP-16P": "night", "AP-16": "ocean", "AP-16PL": "blossom" };
  paintPhotoWall(ctx, w, h, walls[spec.sku] || "ocean");
  ctx.fillStyle = "#0b0d10";
  rr(ctx, w / 2 - 52, 14, 104, 28, 14);
  ctx.fill();
  ctx.fillStyle = "#1a1a1c";
  ctx.beginPath();
  ctx.arc(w / 2 + 28, 28, 7, 0, Math.PI * 2);
  ctx.fill();
  paintStatus(ctx, w, true);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "200 92px DM Sans, sans-serif";
  ctx.fillText("9:41", w / 2, 168);
  ctx.font = "500 18px DM Sans, sans-serif";
  ctx.globalAlpha = 0.92;
  ctx.fillText("Wednesday, 19 August", w / 2, 204);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  rr(ctx, 22, 248, w / 2 - 30, 78, 18);
  ctx.fill();
  rr(ctx, w / 2 + 8, 248, w / 2 - 30, 78, 18);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "600 13px DM Sans, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("28°", 38, 278);
  ctx.font = "500 11px DM Sans, sans-serif";
  ctx.globalAlpha = 0.75;
  ctx.fillText("Karachi  ·  Clear", 38, 298);
  ctx.fillText("Calendar", w / 2 + 22, 278);
  ctx.fillText("Private viewing 11:00", w / 2 + 22, 298);
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.arc(48, h - 78, 22, 0, Math.PI * 2);
  ctx.arc(w - 48, h - 78, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "18px DM Sans, sans-serif";
  ctx.fillText("⚡", 48, h - 72);
  ctx.fillText("◉", w - 48, h - 72);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  rr(ctx, w / 2 - 48, h - 22, 96, 5, 3);
  ctx.fill();
}

function paintOneUI(ctx, w, h, spec) {
  const walls = { "SS-S25U": "navy", "SS-S25P": "aurora", "SS-ZF6": "violet", "SS-ZP6": "mint" };
  paintPhotoWall(ctx, w, h, walls[spec.sku] || "navy");
  ctx.fillStyle = "#0b0d10";
  ctx.beginPath();
  ctx.arc(w / 2, 26, 8, 0, Math.PI * 2);
  ctx.fill();
  paintStatus(ctx, w, true);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "300 78px DM Sans, sans-serif";
  ctx.fillText("9:41", 28, 150);
  ctx.font = "500 16px DM Sans, sans-serif";
  ctx.globalAlpha = 0.88;
  ctx.fillText("Wed, 19 Aug", 32, 182);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(20,24,32,0.48)";
  rr(ctx, 22, 210, w - 44, 92, 22);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "600 15px DM Sans, sans-serif";
  ctx.fillText("Now Bar", 38, 238);
  ctx.font = "500 13px DM Sans, sans-serif";
  ctx.globalAlpha = 0.8;
  ctx.fillText("Galaxy · 82%  ·  Nearby devices", 38, 262);
  ctx.fillText("Store demo  ·  5G live", 38, 284);
  ctx.globalAlpha = 1;
  const apps = ["phone", "msg", "cam", "chrome", "photos", "play", "shop", "set", "mail", "weather", "clock", "yt"];
  apps.forEach((k, i) => {
    const c = i % 4;
    const r = Math.floor(i / 4);
    paintAppIcon(ctx, 28 + c * 82, 330 + r * 88, 58, k);
  });
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  rr(ctx, w / 2 - 40, h - 20, 80, 5, 3);
  ctx.fill();
}

function paintPixel(ctx, w, h, spec) {
  paintPhotoWall(ctx, w, h, spec.sku === "GP-P9" ? "forest" : "porcelain");
  const light = spec.sku !== "GP-P9";
  ctx.fillStyle = light ? "#202124" : "#0b0d10";
  ctx.beginPath();
  ctx.arc(w / 2, 26, 7, 0, Math.PI * 2);
  ctx.fill();
  paintStatus(ctx, w, !light);
  ctx.fillStyle = light ? "#202124" : "#fff";
  ctx.textAlign = "left";
  ctx.font = "500 15px DM Sans, sans-serif";
  ctx.fillText("Karachi  ·  28°", 28, 86);
  ctx.font = "300 86px DM Sans, sans-serif";
  ctx.fillText("9:41", 24, 176);
  ctx.font = "500 16px DM Sans, sans-serif";
  ctx.globalAlpha = 0.72;
  ctx.fillText("Wed, 19 August", 28, 208);
  ctx.globalAlpha = 1;
  ctx.fillStyle = light ? "rgba(255,255,255,0.72)" : "rgba(32,33,36,0.55)";
  rr(ctx, 28, 248, w - 56, 46, 23);
  ctx.fill();
  ctx.fillStyle = light ? "#5f6368" : "#e8eaed";
  ctx.font = "500 14px DM Sans, sans-serif";
  ctx.fillText("Search", 52, 276);
  const apps = ["phone", "msg", "cam", "chrome", "photos", "gmail", "maps", "yt"];
  apps.forEach((k, i) => paintAppIcon(ctx, 30 + (i % 4) * 82, 330 + Math.floor(i / 4) * 90, 58, k));
  ctx.fillStyle = light ? "rgba(32,33,36,0.25)" : "rgba(255,255,255,0.3)";
  rr(ctx, w / 2 - 36, h - 20, 72, 4, 2);
  ctx.fill();
}

function paintAndroid(ctx, w, h, spec) {
  paintPhotoWall(ctx, w, h, spec.brand === "Xiaomi" ? "city" : "ember");
  ctx.fillStyle = "#0b0d10";
  ctx.beginPath();
  ctx.arc(w / 2, 26, 8, 0, Math.PI * 2);
  ctx.fill();
  paintStatus(ctx, w, true);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "300 84px DM Sans, sans-serif";
  ctx.fillText("09:41", w / 2, 168);
  ctx.font = "500 15px DM Sans, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText(spec.brand === "Xiaomi" ? "Leica  ·  Pro mode" : "Hasselblad  ·  Master", w / 2, 198);
  ctx.globalAlpha = 1;
  const apps = ["phone", "msg", "cam", "chrome", "photos", "play", "shop", "set"];
  apps.forEach((k, i) => paintAppIcon(ctx, 30 + (i % 4) * 82, 360 + Math.floor(i / 4) * 90, 58, k));
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  rr(ctx, w / 2 - 40, h - 20, 80, 5, 3);
  ctx.fill();
}

function phoneScreen(spec) {
  return canvasTex(`screen-ui:${spec.sku}`, 360, 780, (ctx, w, h) => {
    if (spec.brand === "Apple") paintIOS(ctx, w, h, spec);
    else if (spec.brand === "Samsung") paintOneUI(ctx, w, h, spec);
    else if (spec.brand === "Google") paintPixel(ctx, w, h, spec);
    else paintAndroid(ctx, w, h, spec);
  });
}

const PHONE_BOX_TEX = PHONE_SPECS.map((p) =>
  labelBox(p.boxBg, p.boxFg, p.brand.toUpperCase(), p.title.replace(p.brand, "").trim().slice(0, 14))
);
function kraftBag(bg, ink, title, sub) {
  return canvasTex(`kraft:${title}:${bg}`, 256, 320, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = ((i * 13) % 15) - 7;
      img.data[i] += n;
      img.data[i + 1] += n * 0.9;
      img.data[i + 2] += n * 0.7;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 22, w - 36, h - 44);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(w / 2, 108, 28, 18, 0.4, 0, Math.PI * 2);
    ctx.ellipse(w / 2 - 22, 118, 16, 11, -0.3, 0, Math.PI * 2);
    ctx.ellipse(w / 2 + 24, 116, 15, 10, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "700 26px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 178);
    ctx.font = "600 14px DM Sans, sans-serif";
    ctx.fillText(sub, w / 2, 202);
    ctx.font = "500 12px DM Sans, sans-serif";
    ctx.globalAlpha = 0.75;
    ctx.fillText("250g  ·  WHOLE BEAN", w / 2, 268);
    ctx.globalAlpha = 1;
  });
}

function pharmaBox(bg, ink, title, dose) {
  return canvasTex(`phbox:${title}:${bg}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 22, w, 22);
    ctx.fillRect(w / 2 - 10, 28, 8, 28);
    ctx.fillRect(w / 2 - 18, 36, 24, 8);
    ctx.font = "700 22px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 92);
    ctx.font = "600 13px DM Sans, sans-serif";
    ctx.fillText(dose, w / 2, 116);
    ctx.font = "500 11px DM Sans, sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText("Take as directed", w / 2, 140);
    ctx.fillText("LOT  19A26  ·  EXP  08/28", w / 2, 168);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#111";
    for (let i = 0; i < 24; i++) ctx.fillRect(28 + i * 8, 200, 3, 18);
    ctx.globalAlpha = 1;
  });
}

const GROCERY_PACK_TEX = [
  labelBox("#c45c26", "#fff4e8", "HARVEST", "DURUM PASTA"),
  labelBox("#2f7d4a", "#e8ffe8", "ORCHARD", "OAT GRAINS"),
  labelBox("#d4a017", "#1a1408", "SUN GOLD", "CORN FLAKES"),
  labelBox("#1e4d8b", "#e8f0ff", "RIVER", "BASMATI"),
];
const GROCERY_CAN_TEX = [
  labelCan("#b42318", "#f4c96a", "TOMATO"),
  labelCan("#2a6f4e", "#e8ffe8", "OLIVES"),
  labelCan("#1c3a6e", "#c9a36a", "TUNA"),
];
const CAFE_BAG_TEX = [
  kraftBag("#3b2418", "#e8c9a0", "HOUSE ROAST", "SINGLE ORIGIN"),
  kraftBag("#5b3a29", "#f4efe6", "ARABICA", "MID ROAST"),
  kraftBag("#1c1916", "#c6a56a", "MOCHA", "DARK BLEND"),
];
const PHARMA_PACK_TEX = [
  pharmaBox("#ffffff", "#163a5f", "CARE", "Tablets  500mg"),
  pharmaBox("#e8f4fc", "#0f766e", "VITA+", "Softgels  1000 IU"),
  pharmaBox("#fef3c7", "#92400e", "CALM", "Capsules  250mg"),
];
const PHARMA_BOTTLE_TEX = [
  labelCan("#8a4a18", "#f8e6c8", "SYRUP"),
  labelCan("#166534", "#dcfce7", "VITA"),
  labelCan("#9f1239", "#ffe4e6", "CARE"),
];

function addInstanced(group, geo, positions, matOrColors, sx, sy, sz, rotX = 0) {
  const n = positions.length;
  if (!n) return;
  const shared = matOrColors.isMaterial;
  const mat = shared
    ? matOrColors
    : new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.08 });
  const meshI = new THREE.InstancedMesh(geo, mat, n);
  meshI.castShadow = false;
  meshI.receiveShadow = false;
  for (let i = 0; i < n; i++) {
    const p = positions[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(rotX, p.rotY || 0, 0);
    dummy.updateMatrix();
    meshI.setMatrixAt(i, dummy.matrix);
    if (!shared) {
      tint.set(matOrColors[i % matOrColors.length]);
      meshI.setColorAt(i, tint);
    }
  }
  meshI.instanceMatrix.needsUpdate = true;
  if (meshI.instanceColor) meshI.instanceColor.needsUpdate = true;
  group.add(meshI);
}

function addVariantStock(group, geo, positions, textures, sx, sy, sz) {
  const buckets = textures.map(() => []);
  positions.forEach((p, i) => buckets[i % textures.length].push(p));
  buckets.forEach((pts, i) => {
    if (!pts.length) return;
    addInstanced(group, geo, pts, std("map", "#ffffff", { map: textures[i], mapKey: textures[i].uuid, roughness: 0.46 }), sx, sy, sz);
  });
}

const PRODUCT_LINES = {
  phones: PHONE_SPECS.map(({ title, sku, price, detail }) => ({ title, sku, price, detail })),
  dresses: [
    { title: "Noir Column", sku: "DR-NC-11", price: "$420", detail: "Silk column gown · Evening edit" },
    { title: "Amethyst Drape", sku: "DR-AD-12", price: "$380", detail: "Bias drape · Couture fall" },
    { title: "Ruby Sheath", sku: "DR-RS-13", price: "$340", detail: "Crepe sheath · Gold belt" },
    { title: "Ink Navy", sku: "DR-IN-14", price: "$360", detail: "Wool-silk mix · Tailored" },
    { title: "Champagne Slip", sku: "DR-CS-15", price: "$290", detail: "Satin slip · Lookbook 26" },
    { title: "Ivory Salon", sku: "DR-IS-16", price: "$310", detail: "Bridal ivory · Soft flare" },
    { title: "Forest Wrap", sku: "DR-FW-17", price: "$330", detail: "Wrap midi · Maison green" },
    { title: "Scarlet Coat", sku: "DR-SC-18", price: "$450", detail: "Statement red · Limited" },
  ],
  shoes: [
    { title: "Obsidian Runner", sku: "SH-OR-21", price: "$220", detail: "Calf leather · Gold flash" },
    { title: "Walnut Oxford", sku: "SH-WO-22", price: "$260", detail: "Hand-welted · Brass eyelet" },
    { title: "Crimson Court", sku: "SH-CC-23", price: "$240", detail: "Suede court · Limited pair" },
    { title: "Ivory Loafer", sku: "SH-IL-24", price: "$210", detail: "Calfskin · Atelier last" },
    { title: "Navy Derby", sku: "SH-ND-25", price: "$250", detail: "Calf derby · Cork sole" },
    { title: "Honey Sneaker", sku: "SH-HS-26", price: "$190", detail: "Nubuck · Gold foxing" },
  ],
  watches: [
    { title: "Chronos Or", sku: "WT-CO-31", price: "$4,800", detail: "18k champagne · Swiss automatic" },
    { title: "Argent Line", sku: "WT-AL-32", price: "$3,200", detail: "Steel bracelet · Sapphire" },
    { title: "Bronze GMT", sku: "WT-BG-33", price: "$2,900", detail: "Bronze case · Dual time" },
    { title: "Ivoire Dress", sku: "WT-ID-34", price: "$5,400", detail: "Champagne dial · Alligator" },
    { title: "Noir Moon", sku: "WT-NM-35", price: "$6,200", detail: "Black DLC · Moonphase" },
    { title: "Aqua Diver", sku: "WT-AD-36", price: "$3,850", detail: "Ceramic bezel · 300m" },
    { title: "Rose Perpetual", sku: "WT-RP-37", price: "$8,900", detail: "Everose · Annual calendar" },
    { title: "Carbon Pulse", sku: "WT-CP-38", price: "$2,450", detail: "Carbon case · Chronograph" },
  ],
  cafe: [
    { title: "House Porcelain", sku: "CF-HP-41", price: "$28", detail: "Glazed cup · Single origin" },
    { title: "Espresso Noir", sku: "CF-EN-42", price: "$26", detail: "Dark roast · Ceramic" },
    { title: "Honey Cortado", sku: "CF-HC-43", price: "$24", detail: "Stoneware · Mid roast" },
    { title: "Ink Mug", sku: "CF-IM-44", price: "$22", detail: "Matte black · House blend" },
  ],
  laptops: [
    { title: "Aether Book 16", sku: "LP-AB-51", price: "$2,199", detail: "16\" OLED · M-class chip · Titanium" },
    { title: "Maison Air 14", sku: "LP-MA-52", price: "$1,499", detail: "14\" Liquid display · All-day battery" },
    { title: "Navy Studio 15", sku: "LP-NS-53", price: "$1,799", detail: "15\" 120Hz · Creator GPU" },
    { title: "Graphite Pro 13", sku: "LP-GP-54", price: "$1,299", detail: "13\" compact · Fast charge" },
    { title: "Atelier Fold 17", sku: "LP-AF-55", price: "$2,499", detail: "17\" dual screen · Maison exclusive" },
  ],
  tablets: [
    { title: "iPad Pro 13", sku: "TB-IP13", price: "$1,299", detail: "13\" Tandem OLED · M-class · Wi-Fi" },
    { title: "iPad Air 11", sku: "TB-IA11", price: "$799", detail: "11\" Liquid display · All-day" },
    { title: "iPad mini", sku: "TB-IMN", price: "$599", detail: "8.3\" compact · Fast charge" },
  ],
};

export function productInfo(category, index = 0, color) {
  const list = PRODUCT_LINES[category] || PRODUCT_LINES.phones;
  const base = list[index % list.length];
  return {
    category,
    title: base.title,
    sku: base.sku,
    price: base.price,
    detail: base.detail,
    color: color || "#c6a56a",
  };
}

export function tagProduct(node, category, index, extra = {}) {
  const info = productInfo(category, index, extra.color);
  node.userData = {
    selectable: true,
    kind: "product",
    id: extra.id || `prod-${category}-${index}-${Math.round((extra.x || 0) * 50)}-${Math.round((extra.z || extra.y || 0) * 50)}`,
    type: category,
    productIndex: index,
    slotId: extra.slotId || "",
    furnId: extra.furnId || "",
    scale: extra.scale,
    ...info,
  };
  return node;
}

const DRESS_SWATCH = [
  "#f3efe6",
  "#1a1a1a",
  "#b42318",
  "#1e3a5f",
  "#2f5d50",
  "#c4a574",
  "#8b1e3f",
  "#4a1d4e",
  "#e8b4c4",
  "#3d5a80",
  "#d4a017",
  "#5c3317",
];
const SHOE_SWATCH = ["#1a1a1a", "#5c3317", "#9b1c1c", "#eee8e0", "#1e3a5f", "#c4a574"];

export function makeDisplayProduct(category, index, x, y, z, extra = {}) {
  const i = Number(index) || 0;
  if (category === "laptops") return makeLaptop(i, x, y, z, extra.scale ?? 1, extra);
  if (category === "tablets") return makeDeskIpad(i, x, y, z, extra);
  if (category === "dresses") return makeDress(extra.color || DRESS_SWATCH[i % DRESS_SWATCH.length], x, extra.barY ?? y, { ...extra, index: i });
  if (category === "shoes") return makeShoePair(SHOE_SWATCH[i % SHOE_SWATCH.length], x, y, z, extra.rotY || 0, extra);
  if (category === "watches") return makeWatch(WATCH_SWATCH[i % WATCH_SWATCH.length], x, y, z, { ...extra, index: i });
  if (category === "cafe") return makeMugSet(i, x, y, z, extra);
  if (extra.simple) return makeSimplePhone(i, x, y, z, extra);
  if (extra.shelf) return makeShelfPhone(i, x, y, z, extra);
  return makePhoneStand(i, x, y, z, extra);
}

export { PRODUCT_LINES };

function addLens(g, x, y, z, r, rim = "#1a1c20") {
  const ring = mesh(CYL, std(`lens-rim:${rim}`, rim, { roughness: 0.12, metalness: 0.9, env: 1.2 }), x, y, z, r, r, 0.004);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const glass = mesh(CYL, std("lens-glass", "#071018", { roughness: 0.05, metalness: 0.72, env: 1.3 }), x, y, z - 0.001, r * 0.7, r * 0.7, 0.003);
  glass.rotation.x = Math.PI / 2;
  g.add(glass);
}

function addPhoneCameras(g, spec, pw, ph, pt) {
  const z = -pt / 2 - 0.003;
  const y = ph * 0.32;
  const dark = spec.body;
  if (spec.family === "pro") {
    g.add(mesh(BOX, std(`bump:${spec.sku}`, dark, { roughness: 0.16, metalness: 0.7 }), -pw * 0.18, y, z, 0.034, 0.034, 0.006));
    addLens(g, -pw * 0.26, y + 0.01, z - 0.004, 0.007, spec.edge);
    addLens(g, -pw * 0.1, y + 0.01, z - 0.004, 0.007, spec.edge);
    addLens(g, -pw * 0.26, y - 0.01, z - 0.004, 0.0065, spec.edge);
    g.add(mesh(CYL, std("flash", "#f4efe6", { roughness: 0.16, metalness: 0.4, emissive: "#fff6ea", emissiveIntensity: 0.35 }), -pw * 0.1, y - 0.01, z - 0.003, 0.0024, 0.0024, 0.0024));
  } else if (spec.family === "slim") {
    g.add(mesh(BOX, std(`bump:${spec.sku}`, dark, { roughness: 0.2, metalness: 0.62 }), -pw * 0.2, y, z, 0.028, 0.028, 0.005));
    addLens(g, -pw * 0.26, y + 0.007, z - 0.003, 0.007, spec.edge);
    addLens(g, -pw * 0.14, y - 0.007, z - 0.003, 0.006, spec.edge);
  } else if (spec.family === "ring") {
    const disc = mesh(CYL, std(`ring:${spec.sku}`, dark, { roughness: 0.14, metalness: 0.78 }), -pw * 0.16, y, z, 0.022, 0.022, 0.006);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    addLens(g, -pw * 0.16, y + 0.01, z - 0.004, 0.007, spec.edge);
    addLens(g, -pw * 0.07, y - 0.004, z - 0.004, 0.0065, spec.edge);
    addLens(g, -pw * 0.25, y - 0.004, z - 0.004, 0.0065, spec.edge);
    g.add(mesh(CYL, std("sflash", "#f4efe6", { roughness: 0.18, emissive: "#fff6ea", emissiveIntensity: 0.3 }), -pw * 0.16, y - 0.012, z - 0.003, 0.0022, 0.0022, 0.0022));
  } else if (spec.family === "bar") {
    g.add(mesh(BOX, std(`bar:${spec.sku}`, dark, { roughness: 0.22, metalness: 0.55 }), 0, y + 0.012, z, pw * 0.92, 0.022, 0.007));
    addLens(g, -pw * 0.18, y + 0.012, z - 0.004, 0.007, "#202124");
    addLens(g, 0, y + 0.012, z - 0.004, 0.007, "#202124");
    addLens(g, pw * 0.18, y + 0.012, z - 0.004, 0.006, "#202124");
  } else if (spec.family === "triple") {
    g.add(mesh(BOX, std(`trip:${spec.sku}`, dark, { roughness: 0.18, metalness: 0.7 }), -pw * 0.22, y, z, 0.02, 0.046, 0.006));
    addLens(g, -pw * 0.22, y + 0.014, z - 0.004, 0.0065, spec.edge);
    addLens(g, -pw * 0.22, y, z - 0.004, 0.0065, spec.edge);
    addLens(g, -pw * 0.22, y - 0.014, z - 0.004, 0.006, spec.edge);
  } else if (spec.family === "leica") {
    const disc = mesh(CYL, std(`leica:${spec.sku}`, dark, { roughness: 0.14, metalness: 0.8 }), -pw * 0.16, y, z, 0.02, 0.02, 0.007);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    addLens(g, -pw * 0.16, y + 0.008, z - 0.005, 0.008, spec.edge);
    addLens(g, -pw * 0.08, y - 0.008, z - 0.004, 0.006, spec.edge);
    addLens(g, -pw * 0.24, y - 0.008, z - 0.004, 0.006, spec.edge);
  } else if (spec.family === "fold" || spec.family === "flip") {
    g.add(mesh(BOX, std(`fbump:${spec.sku}`, dark, { roughness: 0.2, metalness: 0.6 }), -pw * 0.2, y * 0.6, z, 0.024, 0.024, 0.005));
    addLens(g, -pw * 0.2, y * 0.6, z - 0.003, 0.007, spec.edge);
  }
}

export function makePhone(i = 0, simple = false) {
  const spec = phoneSpec(i);
  const [pw, ph, pt] = spec.size;
  const g = new THREE.Group();
  const body = std(`ph-body:${spec.sku}`, spec.body, { roughness: 0.14, metalness: 0.74, env: 1.18 });
  const chrome = std(`ph-edge:${spec.sku}`, spec.edge, { roughness: 0.14, metalness: 0.9, env: 1.2 });
  if (spec.family === "fold") {
    g.add(mesh(BOX, body, -pw * 0.26, 0, 0, pw * 0.48, ph, pt));
    g.add(mesh(BOX, body, pw * 0.26, 0, 0, pw * 0.48, ph, pt));
    g.add(mesh(BOX, chrome, 0, 0, 0, 0.008, ph * 0.96, pt * 0.7));
  } else {
    g.add(mesh(BOX, body, 0, 0, 0, pw, ph, pt));
    g.add(mesh(BOX, chrome, 0, 0, 0, pw + 0.0018, ph + 0.0018, pt * 0.42));
  }
  const screenTex = phoneScreen(spec);
  const screenMat = std(`scr-ui-v2:${spec.sku}`, "#ffffff", {
    map: screenTex,
    mapKey: `ui-v2:${spec.sku}`,
    roughness: 0.08,
    metalness: 0.02,
    emissive: "#ffffff",
    emissiveIntensity: 1.15,
    env: 0.18,
  });
  screenMat.emissiveMap = screenTex;
  const glass = mesh(
    PLANE,
    screenMat,
    0,
    0,
    pt / 2 + 0.0006,
    spec.family === "fold" ? pw * 0.88 : pw * 0.88,
    spec.family === "flip" ? ph * 0.82 : ph * 0.9,
    1
  );
  g.add(glass);
  if (!simple && QUALITY.high) {
    if (spec.family === "pro" || spec.family === "slim") {
      g.add(mesh(BOX, std("island", "#0b0d10", { roughness: 0.18 }), 0, ph * 0.38, pt / 2 + 0.0008, 0.028, 0.007, 0.002));
    }
    addPhoneCameras(g, spec, pw, ph, pt);
    g.add(mesh(BOX, chrome, pw / 2 + 0.0004, 0.012, 0, 0.0022, 0.018, 0.004));
    g.add(mesh(BOX, chrome, -pw / 2 - 0.0004, 0.006, 0, 0.0022, 0.012, 0.004));
  }
  return g;
}

function makeSimplePhone(i, x, y, z, extra = {}) {
  const g = new THREE.Group();
  const phone = makePhone(i, true);
  phone.rotation.x = -0.08;
  g.add(phone);
  const s = extra.scale ?? 1;
  g.scale.setScalar(s);
  g.position.set(x, y, z);
  return tagProduct(g, "phones", i, { x, y, z, ...extra });
}

function retailBoxTex(spec) {
  return canvasTex(`rbox:${spec.sku}`, 256, 512, (ctx, w, h) => {
    ctx.fillStyle = spec.boxBg || "#f4f4f6";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = spec.boxFg || "#111";
    ctx.globalAlpha = 0.08;
    ctx.fillRect(18, 28, w - 36, h - 56);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = spec.boxFg || "#222";
    ctx.lineWidth = 6;
    rr(ctx, 78, 70, 100, 210, 18);
    ctx.stroke();
    ctx.fillStyle = spec.body || "#333";
    rr(ctx, 88, 82, 80, 186, 14);
    ctx.fill();
    ctx.fillStyle = spec.boxFg || "#111";
    ctx.font = "700 28px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(spec.brand.toUpperCase(), w / 2, 330);
    ctx.font = "600 20px DM Sans, sans-serif";
    const name = spec.title.replace(spec.brand, "").trim().slice(0, 16);
    ctx.fillText(name, w / 2, 368);
    ctx.font = "500 14px DM Sans, sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText(spec.sku, w / 2, 460);
  });
}

function priceTagTex(spec) {
  return canvasTex(`ptag:${spec.sku}`, 256, 96, (ctx, w, h) => {
    ctx.fillStyle = "#f7f8fa";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#111418";
    ctx.fillRect(0, 0, 6, h);
    ctx.font = "700 22px DM Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(spec.title.replace(spec.brand, "").trim().slice(0, 16) || spec.title, 16, 38);
    ctx.fillStyle = "#5b6570";
    ctx.font = "600 13px DM Sans, sans-serif";
    ctx.fillText(spec.brand, 16, 60);
    ctx.fillStyle = "#111";
    ctx.font = "700 20px DM Sans, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(spec.price, w - 14, 58);
  });
}

export function makeShelfPhone(i, x, y, z, extra = {}) {
  const spec = phoneSpec(i);
  const g = new THREE.Group();
  const chrome = std("shelf-stand-ch", "#c8ccd2", { roughness: 0.16, metalness: 0.88, env: 1.15 });
  const acryl = std("shelf-acryl-v2", "#e8f4fb", {
    roughness: 0.06,
    metalness: 0.08,
    transparent: true,
    opacity: 0.28,
    env: 1.15,
  });
  g.add(mesh(BOX, chrome, 0, 0.004, 0.016, 0.062, 0.008, 0.048));
  const back = mesh(BOX, acryl, 0, 0.04, -0.012, 0.056, 0.072, 0.004);
  back.rotation.x = -0.06;
  g.add(back);
  const phone = makePhone(i, QUALITY.stockLite);
  phone.rotation.x = -0.05;
  phone.position.set(0, 0.098, 0.016);
  g.add(phone);
  if (!QUALITY.stockLite) {
    const tagMap = priceTagTex(spec);
    const tag = mesh(
      PLANE,
      std(`ptag:${spec.sku}`, "#ffffff", { map: tagMap, mapKey: `ptag:${spec.sku}`, roughness: 0.55 }),
      0,
      0.012,
      0.05,
      0.056,
      0.024,
      1
    );
    tag.rotation.x = -1.05;
    g.add(tag);
  }
  g.position.set(x, y, z);
  const s = extra.scale && extra.scale !== 1 ? extra.scale : 1.95;
  g.scale.setScalar(s);
  return tagProduct(g, "phones", i, { x, y, z, ...extra });
}

export function addShelfAccessories(group, spots) {
  const white = std("acc-white", "#f3f4f6", { roughness: 0.48 });
  const dark = std("acc-dark", "#1c1f24", { roughness: 0.42 });
  const navy = std("acc-navy", "#1e3a5f", { roughness: 0.4 });
  const sand = std("acc-sand", "#c4a574", { roughness: 0.46 });
  const cases = [dark, navy, sand, white];
  for (const p of spots) {
    if (p.kind === "case") {
      group.add(mesh(BOX, cases[p.i % cases.length], p.x, p.y + 0.07, p.z, 0.068, 0.138, 0.01));
    } else {
      const spec = phoneSpec(p.i);
      const tex = labelBox("#f4f5f7", spec.boxFg || "#222", spec.brand.slice(0, 8).toUpperCase(), "BUDS");
      group.add(mesh(BOX, std(`accbox:${p.i}`, "#ffffff", { map: tex, mapKey: tex.uuid, roughness: 0.46 }), p.x, p.y + 0.03, p.z, 0.055, 0.055, 0.055));
    }
  }
}

function standPlaque(i) {
  const info = productInfo("phones", i);
  return canvasTex(`plaque:${info.sku}`, 256, 96, (ctx, w, h) => {
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2ad4e8";
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = "#f4f7fa";
    ctx.font = "700 22px DM Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(info.title, 14, 38);
    ctx.fillStyle = "#7aa0b0";
    ctx.font = "600 13px DM Sans, sans-serif";
    ctx.fillText(info.sku, 14, 58);
    ctx.fillStyle = "#4ae0ee";
    ctx.font = "700 16px DM Sans, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(info.price, w - 14, 58);
  });
}

export function makePhoneStand(i, x, y, z, extra = {}) {
  const g = new THREE.Group();
  const black = std("sec-base", "#161a20", { roughness: 0.28, metalness: 0.38, env: 0.9 });
  const chrome = std("sec-chrome", "#c8ccd2", { roughness: 0.14, metalness: 0.9, env: 1.2 });
  const acryl = std("sec-acryl", "#d5eef6", { roughness: 0.06, metalness: 0.12, transparent: true, opacity: 0.22, env: 1.1 });
  const led = std("sec-led", "#7ef3ff", { roughness: 0.22, metalness: 0.08, emissive: "#2ad4e8", emissiveIntensity: 0.95 });

  g.add(mesh(CYL, black, 0, 0.007, 0.004, 0.062, 0.014, 0.062));
  g.add(mesh(CYL, chrome, 0, 0.015, 0.004, 0.064, 0.003, 0.064));
  g.add(mesh(CYL, led, 0, 0.017, 0.004, 0.038, 0.002, 0.038));
  g.add(mesh(CYL, chrome, 0, 0.046, -0.01, 0.006, 0.056, 0.006));
  g.add(mesh(CYL, black, 0, 0.08, 0.002, 0.026, 0.014, 0.026));
  g.add(mesh(CYL, chrome, 0, 0.088, 0.002, 0.028, 0.003, 0.028));

  const back = mesh(BOX, acryl, 0, 0.122, -0.02, 0.07, 0.088, 0.005);
  back.rotation.x = -0.18;
  g.add(back);
  const lipL = mesh(BOX, chrome, -0.034, 0.108, 0.004, 0.005, 0.042, 0.016);
  const lipR = mesh(BOX, chrome, 0.034, 0.108, 0.004, 0.005, 0.042, 0.016);
  const tray = mesh(BOX, chrome, 0, 0.086, 0.012, 0.068, 0.004, 0.03);
  lipL.rotation.x = -0.18;
  lipR.rotation.x = -0.18;
  tray.rotation.x = -0.18;
  g.add(lipL, lipR, tray);

  const cable = mesh(CYL, std("sec-cable", "#2a3038", { roughness: 0.62 }), 0.02, 0.042, 0.012, 0.002, 0.048, 0.002);
  cable.rotation.z = 0.42;
  g.add(cable);

  const plaqueMap = standPlaque(i);
  const plate = mesh(
    PLANE,
    std(`sec-plq:${i}`, "#ffffff", { map: plaqueMap, mapKey: `plq:${i % 12}`, roughness: 0.22, metalness: 0.08, env: 0.6 }),
    0,
    0.016,
    0.052,
    0.07,
    0.026,
    1
  );
  plate.rotation.x = -1.15;
  g.add(plate);

  const phone = makePhone(i);
  phone.rotation.x = -0.28;
  phone.position.set(0, 0.128, 0.018);
  g.add(phone);

  g.position.set(x, y, z);
  return tagProduct(g, "phones", i, { x, y, z, ...extra });
}

function laptopDeckTex() {
  return canvasTex("lap-deck-v2", 1024, 680, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#c5c9ce");
    g.addColorStop(0.5, "#b4b8be");
    g.addColorStop(1, "#9ea4ac");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1a1d22";
    ctx.beginPath();
    ctx.roundRect(48, 36, w - 96, 392, 10);
    ctx.fill();
    const cols = 14;
    const rows = 5;
    const kw = 52;
    const kh = 52;
    const gap = 8;
    const ox = 70;
    const oy = 52;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 4 && c > 3 && c < 10) continue;
        const x = ox + c * (kw + gap) + (r === 4 ? 20 : 0);
        const y = oy + r * (kh + gap);
        ctx.fillStyle = "#2a2e34";
        ctx.beginPath();
        ctx.roundRect(x, y, c === 0 && r === 4 ? kw * 2.1 : kw, kh, 7);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x + 3, y + 3, kw * 0.7, 6);
      }
    }
    ctx.fillStyle = "#2a2e34";
    ctx.beginPath();
    ctx.roundRect(ox + 4 * (kw + gap), oy + 4 * (kh + gap), kw * 6.2, kh, 8);
    ctx.fill();
    ctx.fillStyle = "#d8dde4";
    ctx.beginPath();
    ctx.roundRect(220, 456, w - 440, 186, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,44,50,0.28)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(236, 470, w - 520, 28, 8);
    ctx.fill();
  });
}

function posLaptopScreen() {
  return canvasTex("lap-pos-ui", 1280, 800, (ctx, w, h) => {
    ctx.fillStyle = "#0b1018";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#121a26";
    ctx.fillRect(0, 0, 280, h);
    ctx.fillStyle = "#7ed6ff";
    ctx.font = "700 22px DM Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("UNIVERSAL", 28, 48);
    ctx.fillStyle = "#8aa0c8";
    ctx.font = "600 14px DM Sans, sans-serif";
    ctx.fillText("POS  ·  LIVE", 28, 74);
    const nav = ["Checkout", "Inventory", "Repairs", "Staff"];
    nav.forEach((n, i) => {
      ctx.fillStyle = i === 0 ? "#1b2c44" : "transparent";
      ctx.fillRect(16, 120 + i * 58, 248, 48);
      ctx.fillStyle = i === 0 ? "#f4f7fb" : "#8aa0c8";
      ctx.font = "600 20px DM Sans, sans-serif";
      ctx.fillText(n, 36, 152 + i * 58);
    });
    ctx.fillStyle = "#f4f7fb";
    ctx.font = "700 36px DM Sans, sans-serif";
    ctx.fillText("iPhone 16 Pro Max", 320, 70);
    ctx.fillStyle = "#8aa0c8";
    ctx.font = "500 18px DM Sans, sans-serif";
    ctx.fillText("Natural Titanium  ·  256GB  ·  In stock 4", 320, 104);
    const cards = [
      ["iPhone 16 Pro", "999"],
      ["Galaxy S25 Ultra", "1,299"],
      ["Pixel 9 Pro", "1,099"],
      ["OnePlus 13", "899"],
    ];
    cards.forEach((c, i) => {
      const x = 320 + (i % 2) * 460;
      const y = 150 + Math.floor(i / 2) * 150;
      ctx.fillStyle = "#151d2a";
      ctx.beginPath();
      ctx.roundRect(x, y, 430, 128, 16);
      ctx.fill();
      ctx.fillStyle = "#f4f7fb";
      ctx.font = "700 24px DM Sans, sans-serif";
      ctx.fillText(c[0], x + 24, y + 52);
      ctx.fillStyle = "#7ed6ff";
      ctx.font = "700 28px DM Sans, sans-serif";
      ctx.fillText("$" + c[1], x + 24, y + 96);
    });
    ctx.fillStyle = "#ff9a18";
    ctx.beginPath();
    ctx.roundRect(320, 470, 890, 96, 18);
    ctx.fill();
    ctx.fillStyle = "#111318";
    ctx.font = "800 40px DM Sans, sans-serif";
    ctx.fillText("CHARGE   $1,199.00", 360, 532);
    ctx.fillStyle = "#1b2c44";
    ctx.beginPath();
    ctx.roundRect(320, 590, 890, 160, 18);
    ctx.fill();
    ctx.fillStyle = "#8aa0c8";
    ctx.font = "600 18px DM Sans, sans-serif";
    ctx.fillText("Card  ·  Cash  ·  Wallet     Staff: Ayesha     19 Aug  9:41", 360, 680);
  });
}

export function makeDeskLaptop(i = 1, x = 0, y = 0, z = 0, extra = {}) {
  const g = new THREE.Group();
  const bw = 0.31;
  const bd = 0.216;
  const th = 0.012;
  const alum = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: "#c2c6cc",
        metalness: 0.92,
        roughness: 0.22,
        clearcoat: 0.35,
        clearcoatRoughness: 0.28,
        envMapIntensity: 1.25,
      })
    : std("desk-lap-alum", "#c2c6cc", { roughness: 0.2, metalness: 0.86, env: 1.22 });
  const darkAlum = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: "#3a3e44",
        metalness: 0.88,
        roughness: 0.28,
        envMapIntensity: 1.1,
      })
    : std("desk-lap-dark", "#3a3e44", { roughness: 0.26, metalness: 0.82, env: 1.1 });
  const black = std("desk-lap-in", "#1a1d22", { roughness: 0.42, metalness: 0.2 });
  const chrome = std("desk-lap-hinge", "#9aa3ad", { roughness: 0.16, metalness: 0.9, env: 1.2 });
  const rubber = std("desk-lap-feet", "#1c1c1c", { roughness: 0.82, metalness: 0.04 });

  g.add(mesh(BOX, alum, 0, th / 2, 0, bw, th, bd));
  g.add(mesh(BOX, darkAlum, 0, th + 0.0015, 0.004, bw - 0.01, 0.003, bd - 0.02));
  const deck = mesh(
    PLANE,
    std("desk-lap-deck", "#ffffff", { map: laptopDeckTex(), mapKey: "deckv2", roughness: 0.32, metalness: 0.18, env: 0.7 }),
    0,
    th + 0.0034,
    0.006,
    bw - 0.016,
    bd - 0.028,
    1
  );
  deck.rotation.x = -Math.PI / 2;
  g.add(deck);

  const hinge = mesh(CYL, chrome, 0, th + 0.004, -bd / 2 + 0.008, 0.005, bw * 0.86, 0.005);
  hinge.rotation.z = Math.PI / 2;
  g.add(hinge);

  for (const [fx, fz] of [
    [-bw * 0.38, -bd * 0.38],
    [bw * 0.38, -bd * 0.38],
    [-bw * 0.38, bd * 0.38],
    [bw * 0.38, bd * 0.38],
  ]) {
    g.add(mesh(BOX, rubber, fx, 0.0015, fz, 0.016, 0.003, 0.01));
  }
  g.add(mesh(BOX, chrome, bw / 2 - 0.001, th * 0.45, 0.03, 0.003, 0.004, 0.018));
  g.add(mesh(BOX, chrome, bw / 2 - 0.001, th * 0.45, -0.02, 0.003, 0.004, 0.018));
  g.add(mesh(BOX, black, -bw / 2 + 0.004, th * 0.4, 0.06, 0.004, 0.003, 0.012));

  const lid = new THREE.Group();
  lid.position.set(0, th + 0.003, -bd / 2 + 0.01);
  lid.rotation.x = 0.38;
  const lidH = 0.205;
  lid.add(mesh(BOX, alum, 0, lidH / 2, 0, bw, lidH, 0.008));
  lid.add(mesh(BOX, black, 0, lidH / 2, 0.0046, bw - 0.012, lidH - 0.012, 0.002));
  const ui = posLaptopScreen();
  const scr = mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: ui,
      roughness: 0.08,
      metalness: 0.04,
      emissive: "#ffffff",
      emissiveMap: ui,
      emissiveIntensity: 1.05,
      envMapIntensity: 0.35,
    }),
    0,
    lidH / 2,
    0.0062,
    bw - 0.028,
    lidH - 0.028,
    1
  );
  lid.add(scr);
  if (!QUALITY.stockLite) {
    const glass = mesh(
      PLANE,
      std("desk-lap-glass", "#d8eef8", { roughness: 0.04, metalness: 0.08, transparent: true, opacity: 0.12, env: 1.45 }),
      0,
      lidH / 2,
      0.0068,
      bw - 0.026,
      lidH - 0.026,
      1
    );
    lid.add(glass);
  }
  lid.add(mesh(BOX, black, 0, lidH - 0.01, 0.0052, 0.028, 0.006, 0.003));
  lid.add(mesh(BOX, std("desk-cam", "#111318", { roughness: 0.2 }), 0, lidH - 0.01, 0.006, 0.006, 0.006, 0.002));
  g.add(lid);

  g.position.set(x, y, z);
  return tagProduct(g, "laptops", i, { x, y, z, scale: 1, ...extra });
}

function tabletHomeTex(i = 0) {
  const titles = ["iPad Pro", "iPad Air", "iPad mini"];
  const skies = [
    ["#1b3a6b", "#7eb6e8", "#f3d9b0"],
    ["#122018", "#3d7a5a", "#d8e8c8"],
    ["#2a1830", "#8a4a8a", "#f0c8b0"],
  ];
  const sky = skies[i % skies.length];
  return canvasTex(`ipad-home:${i % 3}`, 768, 1024, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(0.45, sky[1]);
    g.addColorStop(1, sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.18, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "200 92px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("9:41", w / 2, 118);
    ctx.font = "600 22px DM Sans, sans-serif";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Wednesday, 19 August", w / 2, 158);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(12,16,22,0.28)";
    rr(ctx, 48, 200, w - 96, 86, 22);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 28px DM Sans, sans-serif";
    ctx.fillText(titles[i % titles.length], w / 2, 238);
    ctx.font = "500 18px DM Sans, sans-serif";
    ctx.globalAlpha = 0.8;
    ctx.fillText("Store demo  ·  In stock", w / 2, 268);
    ctx.globalAlpha = 1;
    const apps = ["#3d8bfd", "#34c759", "#ff9f0a", "#ff375f", "#bf5af2", "#64d2ff", "#ffd60a", "#30d158"];
    const names = ["Photos", "Music", "Store", "Notes", "Mail", "Maps", "Files", "Camera"];
    apps.forEach((c, n) => {
      const col = n % 4;
      const row = Math.floor(n / 4);
      const x = 86 + col * 160;
      const y = 340 + row * 170;
      ctx.fillStyle = c;
      rr(ctx, x, y, 88, 88, 22);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "600 16px DM Sans, sans-serif";
      ctx.fillText(names[n], x + 44, y + 118);
    });
    ctx.fillStyle = "rgba(20,24,32,0.42)";
    rr(ctx, 64, h - 168, w - 128, 112, 28);
    ctx.fill();
    ["#0a84ff", "#30d158", "#ff9f0a", "#ff375f"].forEach((c, n) => {
      ctx.fillStyle = c;
      rr(ctx, 110 + n * 140, h - 146, 72, 72, 18);
      ctx.fill();
    });
  });
}

export function makeDeskIpad(i = 0, x = 0, y = 0, z = 0, extra = {}) {
  const g = new THREE.Group();
  const finishes = [
    { body: "#c5c9ce", edge: "#9aa3ad" },
    { body: "#3a3e44", edge: "#1f2328" },
    { body: "#d6c6b6", edge: "#b8a894" },
  ];
  const look = finishes[((Number(i) || 0) % finishes.length + finishes.length) % finishes.length];
  const tw = 0.178;
  const th = 0.248;
  const tt = 0.0066;
  const alum = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: look.body,
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.4,
        clearcoatRoughness: 0.26,
        envMapIntensity: 1.2,
      })
    : std(`ipad-body:${look.body}`, look.body, { roughness: 0.18, metalness: 0.86, env: 1.18 });
  const rim = std(`ipad-edge:${look.edge}`, look.edge, { roughness: 0.16, metalness: 0.9, env: 1.2 });
  const black = std("ipad-bezel", "#111318", { roughness: 0.28, metalness: 0.18 });
  const stand = std("ipad-stand", "#161a20", { roughness: 0.32, metalness: 0.52, env: 0.9 });
  const chrome = std("ipad-chrome", "#c8ccd2", { roughness: 0.16, metalness: 0.9, env: 1.15 });

  g.add(mesh(CYL, stand, 0, 0.007, 0.012, 0.046, 0.014, 0.046));
  g.add(mesh(CYL, chrome, 0, 0.016, 0.012, 0.048, 0.003, 0.048));
  const arm = mesh(CYL, chrome, 0, 0.034, 0.002, 0.007, 0.038, 0.007);
  arm.rotation.x = 0.28;
  g.add(arm);
  g.add(mesh(BOX, stand, 0, 0.052, 0.016, 0.036, 0.01, 0.022));

  const tablet = new THREE.Group();
  tablet.position.set(0, 0.058, 0.018);
  tablet.rotation.x = -0.42;
  tablet.add(mesh(BOX, alum, 0, th / 2, 0, tw, th, tt));
  tablet.add(mesh(BOX, rim, 0, th / 2, 0, tw + 0.0016, th + 0.0016, tt * 0.42));
  tablet.add(mesh(BOX, black, 0, th / 2, tt / 2 + 0.0004, tw - 0.01, th - 0.01, 0.0012));
  const ui = tabletHomeTex(i);
  const scr = mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: ui,
      roughness: 0.08,
      metalness: 0.03,
      emissive: "#ffffff",
      emissiveMap: ui,
      emissiveIntensity: 1.12,
      envMapIntensity: 0.28,
    }),
    0,
    th / 2,
    tt / 2 + 0.0012,
    tw - 0.018,
    th - 0.018,
    1
  );
  tablet.add(scr);
  tablet.add(mesh(BOX, black, 0, th - 0.012, tt / 2 + 0.0008, 0.01, 0.01, 0.002));
  tablet.add(mesh(BOX, rim, tw / 2 + 0.0004, th * 0.42, 0, 0.002, 0.022, 0.004));
  g.add(tablet);

  g.position.set(x, y, z);
  if (extra.scale && extra.scale !== 1) g.scale.setScalar(extra.scale);
  return tagProduct(g, "tablets", i, { x, y, z, ...extra });
}

export function makeLaptop(i, x, y, z, scale = 1, extra = {}) {
  if (extra.real || extra.desk) return makeDeskLaptop(i, x, y, z, extra);
  const g = new THREE.Group();
  const bodies = ["#c8ccd2", "#1c2026", "#dfe3e8", "#2a3038", "#b8bec6"];
  const body = bodies[i % bodies.length];
  const alum = std(`lap-body:${body}`, body, { roughness: 0.2, metalness: 0.78, env: 1.15 });
  const dark = std("lap-keys", "#14181e", { roughness: 0.42, metalness: 0.18 });
  const chrome = std("lap-hinge", "#9aa3ad", { roughness: 0.18, metalness: 0.86 });
  const s = scale;

  g.add(mesh(BOX, std("lap-rise", "#161a20", { roughness: 0.3, metalness: 0.4 }), 0, 0.006 * s, 0, 0.14 * s, 0.012 * s, 0.1 * s));
  g.add(mesh(BOX, alum, 0, 0.02 * s, 0.008 * s, 0.24 * s, 0.01 * s, 0.16 * s));
  g.add(mesh(BOX, dark, 0, 0.026 * s, 0.016 * s, 0.2 * s, 0.003 * s, 0.1 * s));
  g.add(mesh(BOX, chrome, 0, 0.022 * s, -0.07 * s, 0.2 * s, 0.006 * s, 0.012 * s));

  const lid = new THREE.Group();
  lid.position.set(0, 0.024 * s, -0.07 * s);
  lid.rotation.x = 0.32;
  lid.add(mesh(BOX, alum, 0, 0.08 * s, 0, 0.24 * s, 0.16 * s, 0.007 * s));
  const scr = mesh(
    PLANE,
    std(`ls${i}`, "#ffffff", {
      map: laptopScreen(i),
      mapKey: `ls:${i % 5}`,
      roughness: 0.08,
      metalness: 0.22,
      emissive: "#12202c",
      emissiveIntensity: 0.38,
      env: 1.1,
    }),
    0,
    0.08 * s,
    0.0042 * s,
    0.216 * s,
    0.138 * s,
    1
  );
  lid.add(scr);
  g.add(lid);

  g.position.set(x, y, z);
  return tagProduct(g, "laptops", i, { x, y, z, color: body, scale, ...extra });
}

const CLOTH_GEO = new Map();

function extrudeCloth(kind, draw) {
  if (CLOTH_GEO.has(kind)) return CLOTH_GEO.get(kind);
  const shape = new THREE.Shape();
  draw(shape);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.038,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -0.019);
  geo.userData.shared = true;
  CLOTH_GEO.set(kind, geo);
  return geo;
}

function addHanger(g) {
  const chrome = std("hanger-hook", "#cfd4da", { roughness: 0.14, metalness: 0.9, env: 1.35 });
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 10, 22, Math.PI * 1.42), chrome);
  hook.rotation.x = Math.PI / 2;
  hook.position.set(0, 0.022, 0);
  hook.castShadow = true;
  g.add(hook);
  g.add(mesh(CYL, chrome, 0, -0.004, 0, 0.0055, 0.032, 0.0055));
  const wood = phys("hanger-body", "#b07a3a", { roughness: 0.4, metalness: 0.05, env: 0.65, clearcoat: 0.18 });
  const body = hangShape(
    "wood-hanger",
    (s) => {
      s.moveTo(-0.125, -0.092);
      s.lineTo(0.125, -0.092);
      s.lineTo(0.02, -0.016);
      s.lineTo(-0.02, -0.016);
      s.closePath();
    },
    0.016,
    false
  );
  g.add(clothMesh(body, wood, 0, 0, 0));
  const bar = mesh(CYL, wood, 0, -0.09, 0, 0.007, 0.22, 0.007);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
}

const FABRIC_PBR = {
  cotton: { nor: null, rgh: null },
  satin: { nor: null, rgh: null },
  silk: { nor: null, rgh: null },
  velvet: { nor: null, rgh: null },
  wool: { nor: null, rgh: null },
};

function fabricType(color, style = "dress") {
  if (style === "shirt") return "cotton";
  if (style === "pants" || style === "blazer") return "wool";
  const c = String(color || "").toLowerCase();
  if (c === "#1a1a1a" || c === "#4a1d4e" || c === "#8b1e3f" || c === "#1e3a5f") return "velvet";
  if (c === "#c4a574" || c === "#f3efe6" || c === "#f2efe6" || c === "#e8b4c4" || c === "#d4a017") return "satin";
  if (c === "#2f5d50" || c === "#3d5a80") return "silk";
  return "cotton";
}

function setupPbrTex(tex) {
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.max(QUALITY.aniso, QUALITY.high ? 16 : 8);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(2.15, 2.85);
  tex.needsUpdate = true;
  return tex;
}

function loadPbrFile(url) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, (tex) => resolve(setupPbrTex(tex)), undefined, () => resolve(null));
  });
}

export function loadFabricPBR() {
  if (QUALITY.low) return Promise.resolve(false);
  return Promise.all([
    loadPbrFile("./textures/fabric/poplin_nor_4k.jpg"),
    loadPbrFile("./textures/fabric/poplin_rough_2k.jpg"),
    loadPbrFile("./textures/fabric/satin_nor_4k.jpg"),
    loadPbrFile("./textures/fabric/satin_rough_2k.jpg"),
    loadPbrFile("./textures/fabric/velvet_nor_4k.jpg"),
    loadPbrFile("./textures/fabric/velvet_rough_2k.jpg"),
  ]).then(([poplinN, poplinR, satinN, satinR, velvetN, velvetR]) => {
    FABRIC_PBR.cotton.nor = poplinN;
    FABRIC_PBR.cotton.rgh = poplinR;
    FABRIC_PBR.wool.nor = poplinN;
    FABRIC_PBR.wool.rgh = poplinR;
    FABRIC_PBR.satin.nor = satinN;
    FABRIC_PBR.satin.rgh = satinR;
    FABRIC_PBR.silk.nor = satinN;
    FABRIC_PBR.silk.rgh = satinR;
    FABRIC_PBR.velvet.nor = velvetN;
    FABRIC_PBR.velvet.rgh = velvetR;
    return true;
  });
}

function makeDataTex(key, w, h, linear, draw) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.userData.shared = true;
  TEX.set(key, tex);
  return tex;
}

function fabricLook(kind) {
  if (kind === "silk") {
    return { roughness: 0.42, sheen: 0.48, sheenRoughness: 0.5, clearcoat: 0, ccr: 1, env: 0.26, nrm: 0.16 };
  }
  if (kind === "satin") {
    return { roughness: 0.48, sheen: 0.54, sheenRoughness: 0.46, clearcoat: 0, ccr: 1, env: 0.24, nrm: 0.18 };
  }
  if (kind === "velvet") {
    return { roughness: 0.8, sheen: 0.82, sheenRoughness: 0.92, clearcoat: 0, ccr: 1, env: 0.14, nrm: 0.42 };
  }
  if (kind === "wool") {
    return { roughness: 0.74, sheen: 0.12, sheenRoughness: 0.86, clearcoat: 0, ccr: 1, env: 0.18, nrm: 0.28 };
  }
  return { roughness: 0.7, sheen: 0.22, sheenRoughness: 0.78, clearcoat: 0, ccr: 1, env: 0.2, nrm: 0.24 };
}

function dressCloth(color, kind = "dress") {
  const fabric = fabricType(color, kind);
  const id = `cloth-pbr|${fabric}|${color}|${kind}`;
  if (MAT.has(id)) return MAT.get(id);
  const look = fabricLook(fabric);
  const maps = FABRIC_PBR[fabric] || FABRIC_PBR.cotton;
  const m = new THREE.MeshPhysicalMaterial({
    color,
    map: null,
    roughness: look.roughness,
    roughnessMap: maps.rgh || null,
    metalness: 0,
    normalMap: maps.nor || null,
    normalScale: new THREE.Vector2(look.nrm, look.nrm),
    sheen: look.sheen,
    sheenRoughness: look.sheenRoughness,
    sheenColor: new THREE.Color(fabric === "velvet" ? color : "#f3eee6"),
    clearcoat: 0,
    clearcoatRoughness: 1,
    envMapIntensity: look.env,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  m.userData.shared = true;
  MAT.set(id, m);
  return m;
}

function thinCloth(color, kind = "dress") {
  return dressCloth(color, kind);
}

const GARMENT_GEO = new Map();

function hangShape(kind, draw, depth = 0.032, bend = true) {
  if (GARMENT_GEO.has(kind)) return GARMENT_GEO.get(kind);
  const shape = new THREE.Shape();
  draw(shape);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.translate(0, 0, -depth / 2);
  if (bend) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp((-y - 0.06) / 0.72, 0, 1);
      pos.setZ(i, pos.getZ(i) + t * t * 0.02 + Math.abs(x) * t * 0.035);
    }
  }
  geo.computeVertexNormals();
  geo.userData.shared = true;
  GARMENT_GEO.set(kind, geo);
  return geo;
}

function clothMesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  m.flatShading = false;
  return m;
}

function densifyPairs(pairs, mid = 2) {
  const out = [];
  for (let i = 0; i < pairs.length - 1; i++) {
    out.push(pairs[i]);
    for (let s = 1; s <= mid; s++) {
      const t = s / (mid + 1);
      const sT = t * t * (3 - 2 * t);
      out.push([pairs[i][0] * (1 - sT) + pairs[i + 1][0] * sT, pairs[i][1] * (1 - t) + pairs[i + 1][1] * t]);
    }
  }
  out.push(pairs[pairs.length - 1]);
  return out;
}

function thickPairs(pairs, thickness = 0.0042) {
  const dense = densifyPairs(pairs, QUALITY.high ? 4 : 2);
  const inner = [];
  for (let i = dense.length - 1; i >= 0; i--) {
    inner.push([Math.max(0.007, dense[i][0] - thickness), dense[i][1]]);
  }
  return dense.concat(inner);
}

function clothJitter(ang, y) {
  const n = Math.sin(ang * 12.73 + y * 41.1) * 437.15;
  return n - Math.floor(n);
}

function sculptCloth(geo, { zScale = 0.3, folds = 6, foldAmp = 0.012, hang = 0.024, pinch = 0.9 } = {}) {
  const pos = geo.attributes.position;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  }
  const span = Math.max(0.001, ymax - ymin);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (ymax - y) / span;
    const ang = Math.atan2(z, x || 0.0001);
    const r = Math.hypot(x, z);
    const pinT = THREE.MathUtils.clamp((t - 0.07) / 0.17, 0, 1);
    const pin = THREE.MathUtils.lerp(pinch, 1, pinT * pinT * (3 - 2 * pinT));
    const jit = clothJitter(ang, y) - 0.5;
    const f1 = Math.sin(ang * folds + y * 2.4 + jit * 1.4) * foldAmp * Math.pow(t, 0.8);
    const f2 = Math.sin(ang * (folds * 1.37 + jit) + y * 6.2) * foldAmp * 0.32 * t;
    const f3 = (clothJitter(ang * 3.1, y * 2.2) - 0.5) * foldAmp * 0.22 * t;
    const nr = Math.max(0.006, r + f1 + f2 + f3);
    let nx = Math.cos(ang) * nr * pin;
    let nz = Math.sin(ang) * nr * pin * zScale;
    const side = 1 - Math.min(1, Math.abs(nx) / 0.18);
    const drape = hang * t * t;
    const midSag = 0.016 * t * t * side;
    nz += 0.022 * Math.pow(t, 1.5) * side;
    pos.setX(i, nx);
    pos.setY(i, y - drape - midSag);
    pos.setZ(i, nz);
  }
  return prepareClothGeo(geo);
}

function prepareClothGeo(geo) {
  const uv = geo.attributes.uv;
  if (uv) {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 2.9);
    uv.needsUpdate = true;
    if (!geo.attributes.uv2) geo.setAttribute("uv2", uv.clone());
  }
  geo.computeVertexNormals();
  if (uv && geo.index) {
    try {
      geo.computeTangents();
    } catch {
      /* ignore */
    }
  }
  return geo;
}

function latheBody(key, pairs, zScale, folds, foldAmp) {
  if (GARMENT_GEO.has(key)) return GARMENT_GEO.get(key);
  const pts = thickPairs(pairs).map(([r, y]) => new THREE.Vector2(r, y));
  const segs = QUALITY.clothSegs || (QUALITY.high ? 80 : 36);
  const geo = new THREE.LatheGeometry(pts, segs);
  sculptCloth(geo, { zScale, folds, foldAmp });
  geo.userData.shared = true;
  GARMENT_GEO.set(key, geo);
  return geo;
}

function sleeveGeo(key, len, rTop, rBot, zScale = 0.42) {
  if (GARMENT_GEO.has(key)) return GARMENT_GEO.get(key);
  const segs = QUALITY.high ? 32 : 18;
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, segs, QUALITY.high ? 12 : 6, true);
  sculptCloth(geo, { zScale, folds: 5, foldAmp: 0.007, hang: 0.01, pinch: 0.96 });
  geo.userData.shared = true;
  GARMENT_GEO.set(key, geo);
  return geo;
}

function dressPts(variant) {
  if (variant === 1) {
    return [
      [0.02, 0],
      [0.038, -0.006],
      [0.062, -0.028],
      [0.086, -0.05],
      [0.084, -0.09],
      [0.078, -0.15],
      [0.066, -0.22],
      [0.062, -0.28],
      [0.07, -0.36],
      [0.082, -0.46],
      [0.092, -0.55],
      [0.098, -0.62],
      [0.096, -0.64],
    ];
  }
  if (variant === 2) {
    return [
      [0.018, 0],
      [0.034, -0.006],
      [0.068, -0.03],
      [0.096, -0.052],
      [0.092, -0.09],
      [0.084, -0.16],
      [0.068, -0.24],
      [0.074, -0.3],
      [0.094, -0.38],
      [0.118, -0.48],
      [0.146, -0.6],
      [0.17, -0.72],
      [0.186, -0.82],
      [0.19, -0.86],
      [0.184, -0.88],
    ];
  }
  if (variant === 3) {
    return [
      [0.022, 0],
      [0.04, -0.008],
      [0.072, -0.032],
      [0.094, -0.054],
      [0.092, -0.1],
      [0.086, -0.18],
      [0.076, -0.26],
      [0.08, -0.32],
      [0.09, -0.4],
      [0.102, -0.48],
      [0.11, -0.54],
      [0.114, -0.58],
    ];
  }
  return [
    [0.02, 0],
    [0.038, -0.008],
    [0.07, -0.032],
    [0.098, -0.054],
    [0.094, -0.09],
    [0.086, -0.16],
    [0.072, -0.23],
    [0.07, -0.28],
    [0.088, -0.36],
    [0.11, -0.46],
    [0.136, -0.58],
    [0.156, -0.7],
    [0.166, -0.78],
    [0.168, -0.82],
    [0.162, -0.84],
  ];
}

function addShoulderCaps(g, cloth, span = 0.078) {
  g.add(mesh(SPHERE, cloth, -span, -0.058, 0, 0.044, 0.015, 0.024));
  g.add(mesh(SPHERE, cloth, span, -0.058, 0, 0.044, 0.015, 0.024));
}

function addSleevePair(g, cloth, key, len, r0, r1, x, y, tilt = 0.32) {
  const geo = sleeveGeo(key, len, r0, r1);
  g.add(clothMesh(geo, cloth, x, y, 0.01, 0.14, 0, tilt));
  g.add(clothMesh(geo, cloth, -x, y, 0.01, 0.14, 0, -tilt));
}

function add3DDress(g, cloth, variant = 0, thin) {
  const skin = thin || cloth;
  const zScale = variant === 2 ? 0.33 : variant === 3 ? 0.35 : 0.29;
  const geo = latheBody(`dress-body-hq-${variant}`, dressPts(variant), zScale, variant === 2 ? 7 : 5, variant === 2 ? 0.013 : 0.01);
  g.add(clothMesh(geo, cloth, 0, -0.018, 0));
  addShoulderCaps(g, cloth, variant === 1 ? 0.068 : 0.08);
  if (variant === 1) {
    g.add(mesh(CYL, skin, -0.036, -0.03, 0.012, 0.004, 0.052, 0.004));
    g.add(mesh(CYL, skin, 0.036, -0.03, 0.012, 0.004, 0.052, 0.004));
  } else if (variant === 2) {
    const sash = std("dress-sash", "#d8c4a0", { roughness: 0.48, metalness: 0, env: 0.28 });
    g.add(mesh(CYL, sash, 0, -0.27, 0, 0.074, 0.012, 0.03));
    addSleevePair(g, skin, "dress-long-sl-hq", 0.36, 0.03, 0.026, 0.1, -0.26, 0.22);
  } else if (variant === 3) {
    addSleevePair(g, skin, "dress-short-sl-hq", 0.16, 0.034, 0.038, 0.1, -0.16, 0.4);
    const belt = std("dress-belt", "#2a2018", { roughness: 0.58, metalness: 0 });
    g.add(mesh(CYL, belt, 0, -0.27, 0, 0.08, 0.016, 0.034));
    g.add(mesh(BOX, std("belt-buckle", "#c6a56a", { roughness: 0.35, metalness: 0.45 }), 0, -0.27, 0.034, 0.018, 0.014, 0.006));
  }
}

function add3DShirt(g, cloth, slot = 0, thin) {
  const geo = latheBody(
    "shirt-body-hq",
    [
      [0.024, 0],
      [0.04, -0.01],
      [0.09, -0.05],
      [0.086, -0.16],
      [0.082, -0.34],
      [0.084, -0.48],
      [0.09, -0.52],
    ],
    0.38,
    6,
    0.007
  );
  g.add(clothMesh(geo, cloth, 0, -0.02, 0));
  addShoulderCaps(g, cloth, 0.082);
  addSleevePair(g, thin || cloth, slot % 2 ? "shirt-long-sl-hq" : "shirt-mid-sl-hq", slot % 2 ? 0.34 : 0.22, 0.032, 0.028, 0.1, slot % 2 ? -0.24 : -0.18, 0.28);
  const collar = std("shirt-collar", "#f4efe8", { roughness: 0.42, env: 0.4 });
  const left = mesh(BOX, cloth, -0.024, -0.068, 0.028, 0.052, 0.03, 0.01);
  left.rotation.z = 0.18;
  left.rotation.x = -0.15;
  const right = mesh(BOX, cloth, 0.024, -0.068, 0.028, 0.052, 0.03, 0.01);
  right.rotation.z = -0.18;
  right.rotation.x = -0.15;
  g.add(left, right);
  g.add(mesh(BOX, cloth, 0, -0.3, 0.032, 0.018, 0.36, 0.008));
  const btn = std("shirt-btn", "#f4efe8", { roughness: 0.28, metalness: 0.12 });
  for (let i = 0; i < 5; i++) g.add(mesh(SPHERE, btn, 0, -0.14 - i * 0.07, 0.038, 0.0055, 0.0055, 0.0055));
  g.add(mesh(BOX, collar, 0, -0.055, 0.01, 0.03, 0.012, 0.022));
}

function add3DPants(g, cloth, thin) {
  const waist = latheBody(
    "pants-waist-hq",
    [
      [0.058, 0],
      [0.074, -0.01],
      [0.072, -0.08],
      [0.06, -0.12],
    ],
    0.48,
    4,
    0.004
  );
  g.add(clothMesh(waist, cloth, 0, -0.08, 0));
  const leg = sleeveGeo("pant-leg-hq", 0.6, 0.05, 0.038, 0.52);
  const legMat = thin || cloth;
  g.add(clothMesh(leg, legMat, 0.04, -0.44, 0.004, 0.05, 0, 0.06));
  g.add(clothMesh(leg, legMat, -0.04, -0.44, 0.004, 0.05, 0, -0.06));
  g.add(mesh(SPHERE, cloth, 0, -0.2, 0.004, 0.042, 0.03, 0.03));
  const cuff = std("pant-cuff", "#1a1a1a", { roughness: 0.55 });
  g.add(mesh(CYL, cuff, 0.04, -0.74, 0.004, 0.04, 0.012, 0.022));
  g.add(mesh(CYL, cuff, -0.04, -0.74, 0.004, 0.04, 0.012, 0.022));
}

function add3DBlazer(g, cloth, thin) {
  const geo = latheBody(
    "blazer-body-hq",
    [
      [0.02, 0],
      [0.055, -0.012],
      [0.108, -0.058],
      [0.1, -0.18],
      [0.096, -0.36],
      [0.1, -0.54],
      [0.098, -0.56],
    ],
    0.4,
    5,
    0.006
  );
  g.add(clothMesh(geo, cloth, 0, -0.018, 0));
  addShoulderCaps(g, cloth, 0.09);
  addSleevePair(g, thin || cloth, "blazer-sl-hq", 0.38, 0.034, 0.028, 0.108, -0.26, 0.24);
  const lining = std("blazer-lining", "#3a1020", { roughness: 0.48, env: 0.35 });
  g.add(mesh(BOX, lining, 0, -0.3, 0.034, 0.03, 0.4, 0.008));
  const lapelL = mesh(BOX, cloth, -0.028, -0.16, 0.036, 0.05, 0.16, 0.01);
  lapelL.rotation.z = 0.35;
  const lapelR = mesh(BOX, cloth, 0.028, -0.16, 0.036, 0.05, 0.16, 0.01);
  lapelR.rotation.z = -0.35;
  g.add(lapelL, lapelR);
  const btn = std("blazer-btn", "#1a1a1a", { roughness: 0.3, metalness: 0.2 });
  g.add(mesh(SPHERE, btn, 0.012, -0.28, 0.042, 0.006, 0.006, 0.006));
  g.add(mesh(SPHERE, btn, 0.012, -0.36, 0.042, 0.006, 0.006, 0.006));
}

function garmentShadowMat() {
  if (MAT.has("cloth-contact")) return MAT.get("cloth-contact");
  const tex = makeDataTex("cloth-contact", 256, 256, false, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, "rgba(18,14,12,0.42)");
    g.addColorStop(0.4, "rgba(18,14,12,0.16)");
    g.addColorStop(1, "rgba(18,14,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.MeshBasicMaterial({
    map: tex,
    color: "#1a1512",
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  m.userData.shared = true;
  MAT.set("cloth-contact", m);
  return m;
}

function addGarmentShadow(g, style) {
  const mat = garmentShadowMat();
  const tall = style === "pants" ? 0.68 : 0.8;
  const wide = style === "pants" ? 0.2 : 0.3;
  const back = new THREE.Mesh(PLANE, mat);
  back.scale.set(wide, tall, 1);
  back.position.set(0, style === "pants" ? -0.42 : -0.44, -0.058);
  back.renderOrder = -1;
  back.castShadow = false;
  back.receiveShadow = false;
  g.add(back);
  const puddle = new THREE.Mesh(PLANE, mat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(wide * 0.7, style === "pants" ? 0.14 : 0.18, 1);
  puddle.position.set(0, style === "pants" ? -0.78 : -0.86, 0.018);
  puddle.renderOrder = -1;
  puddle.castShadow = false;
  puddle.receiveShadow = false;
  g.add(puddle);
}

export function makeDress(color, x, barY, extra = {}) {
  const g = new THREE.Group();
  const idx = Math.max(0, DRESS_SWATCH.indexOf(color));
  const slot = Number(extra.index ?? idx) || 0;
  const style = extra.style || "dress";
  const hangerShirt = cloneHangerShirt(color);
  if (hangerShirt) {
    g.add(hangerShirt);
  } else {
    addHanger(g);
    const glb = cloneClothModel(style, slot, color);
    if (glb) {
      g.add(glb);
    } else {
      const node = buildGarment(style, slot % 4, QUALITY.high);
      applyGarmentPbr(node, color, style);
      node.position.y -= 0.02;
      g.add(node);
    }
  }
  addGarmentShadow(g, style);

  g.position.set(x, barY, extra.z || 0);
  g.rotation.y = extra.rotY ?? (slot % 2 ? 0.18 : -0.16);
  return tagProduct(g, "dresses", idx, { color, x, y: barY, ...extra });
}

export function makeFoldedDress(color, x, y, z, extra = {}) {
  const g = new THREE.Group();
  const cloth = dressCloth(color);
  g.add(mesh(BOX, cloth, 0, 0.016, 0, 0.2, 0.026, 0.26));
  g.add(mesh(BOX, cloth, 0.008, 0.038, 0.01, 0.184, 0.02, 0.23));
  g.add(mesh(BOX, cloth, -0.006, 0.056, -0.006, 0.17, 0.016, 0.2));
  g.add(mesh(BOX, cloth, 0, 0.036, 0.118, 0.198, 0.04, 0.022));
  g.position.set(x, y, z);
  g.rotation.y = extra.rotY ?? 0.1;
  const idx = DRESS_SWATCH.indexOf(color);
  return tagProduct(g, "dresses", Math.max(0, idx), { color, x, y, z, ...extra });
}

function oneShoe(color, side, style) {
  const s = new THREE.Group();
  const leather = phys(`shoe:${color}:${style}`, color, {
    roughness: style === 2 || style === 1 ? 0.38 : 0.55,
    metalness: 0.05,
    map: leatherMap(),
    mapKey: "leather",
    sheen: 0.22,
    sheenColor: "#f0e6d4",
    env: 0.55,
  });
  const sole = std(`sole:${style}`, style === 5 || style === 0 ? "#f4efe6" : "#141414", { roughness: 0.72 });
  const mid = std("midsole", style === 0 || style === 5 ? "#eee8e0" : "#2a2a2a", { roughness: 0.5 });
  s.add(mesh(BOX, sole, 0, 0.008, 0.008, 0.074, 0.014, 0.216));
  s.add(mesh(SPHERE, sole, 0, 0.01, 0.1, 0.036, 0.01, 0.03));
  s.add(mesh(BOX, mid, 0, 0.018, 0, 0.068, 0.008, 0.188));
  s.add(mesh(SPHERE, leather, 0, 0.032, 0.078, 0.034, 0.024, 0.042));
  s.add(mesh(BOX, leather, 0, 0.044, -0.016, 0.066, 0.044, 0.13));
  s.add(mesh(SPHERE, leather, 0, 0.046, -0.078, 0.03, 0.028, 0.032));
  if (style === 2) {
    s.add(mesh(CYL, leather, 0, 0.04, -0.09, 0.01, 0.07, 0.01));
    s.add(mesh(BOX, leather, 0, 0.008, -0.09, 0.03, 0.008, 0.028));
  } else if (style === 1 || style === 4) {
    s.add(mesh(BOX, std("laces", "#eee8e0", { roughness: 0.55 }), 0, 0.07, 0.01, 0.02, 0.004, 0.055));
    for (let k = 0; k < 3; k++) {
      s.add(mesh(CYL, std("eyelet", "#c6a56a", { roughness: 0.25, metalness: 0.7 }), -0.012, 0.068, 0.02 - k * 0.016, 0.003, 0.004, 0.003));
      s.add(mesh(CYL, std("eyelet", "#c6a56a", { roughness: 0.25, metalness: 0.7 }), 0.012, 0.068, 0.02 - k * 0.016, 0.003, 0.004, 0.003));
    }
  } else if (style === 3) {
    s.add(mesh(BOX, leather, 0, 0.058, 0.012, 0.058, 0.01, 0.028));
  } else {
    s.add(mesh(BOX, std("tongue", "#f3eee6", { roughness: 0.5 }), 0, 0.07, 0.006, 0.03, 0.012, 0.05));
    s.add(mesh(BOX, std("foxing", "#c6a56a", { roughness: 0.35, metalness: 0.18 }), side * 0.036, 0.042, 0, 0.008, 0.026, 0.1));
    s.add(mesh(BOX, leather, 0, 0.062, -0.078, 0.04, 0.02, 0.016));
  }
  s.position.x = side * 0.058;
  s.rotation.y = side * -0.08;
  return s;
}

export function makeShoePair(color, x, y, z, rotY = 0, extra = {}) {
  const g = new THREE.Group();
  const idx = Math.max(0, SHOE_SWATCH.indexOf(color));
  g.add(oneShoe(color, -1, idx));
  g.add(oneShoe(color, 1, idx));
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return tagProduct(g, "shoes", idx, { color, x, y, z, ...extra });
}

export function makeWatch(metal, x, y, z, extra = {}) {
  const idx = extra.index != null ? Number(extra.index) : Math.max(0, WATCH_SWATCH.indexOf(metal));
  const g = buildWatchDisplay(idx, extra);
  g.position.set(x, y, z);
  g.scale.setScalar(extra.scale ?? 1.55);
  if (extra.tilt != null) g.rotation.x = extra.tilt;
  return tagProduct(g, "watches", idx, { color: metal, x, y, z, ...extra });
}

export function makeMugSet(i, x, y, z, extra = {}) {
  const g = new THREE.Group();
  const looks = [
    { body: "#f4efe6", rim: "#fff8f0", scale: 1 },
    { body: "#3b2418", rim: "#5b3a29", scale: 0.88 },
    { body: "#e8c9a0", rim: "#f4efe6", scale: 1.05 },
    { body: "#1c1916", rim: "#2a2622", scale: 0.92 },
  ];
  const look = looks[i % looks.length];
  const s = look.scale;
  const glaze = phys(`mug2:${look.body}`, look.body, { roughness: 0.16, metalness: 0.04, clearcoat: 0.55, ccr: 0.12, env: 1.15 });
  const saucer = phys(`saucer:${look.rim}`, look.rim, { roughness: 0.18, metalness: 0.04, clearcoat: 0.5, ccr: 0.14, env: 1.1 });
  g.add(mesh(CYL, saucer, 0, 0.004 * s, 0, 0.062 * s, 0.006 * s, 0.062 * s));
  g.add(mesh(CYL, saucer, 0, 0.008 * s, 0, 0.028 * s, 0.004 * s, 0.028 * s));
  g.add(mesh(CUP, glaze, 0, 0.044 * s, 0, 0.032 * s, 0.068 * s, 0.032 * s));
  const coffee = mesh(DISC, std("coffee2", "#2a1810", { roughness: 0.28 }), 0, 0.078 * s, 0, 0.026 * s, 0.026 * s, 1);
  coffee.rotation.x = -Math.PI / 2;
  g.add(coffee);
  const crema = mesh(DISC, std("crema", "#6a4228", { roughness: 0.4 }), 0, 0.079 * s, 0, 0.02 * s, 0.02 * s, 1);
  crema.rotation.x = -Math.PI / 2;
  g.add(crema);
  const handle = mesh(TORUS, glaze, 0.034 * s, 0.046 * s, 0, 0.016 * s, 0.016 * s, 0.016 * s);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  g.add(mesh(BOX, std("spoon", "#c8ccd0", { roughness: 0.18, metalness: 0.82 }), 0.042 * s, 0.01 * s, 0.02 * s, 0.006 * s, 0.002 * s, 0.04 * s));
  g.position.set(x, y, z);
  return tagProduct(g, "cafe", i, { color: look.body, x, y, z, ...extra });
}

export function addPhoneBoxes(group, positions) {
  addVariantStock(group, BOX, positions, PHONE_BOX_TEX, 0.086, 0.118, 0.048);
}

function addCafeBags(group, positions, sx = 0.078, sy = 0.12, sz = 0.05) {
  addVariantStock(group, BOX, positions, CAFE_BAG_TEX, sx, sy, sz);
  addInstanced(
    group,
    BOX,
    positions.map((p) => ({ x: p.x, y: p.y + sy * 0.52, z: p.z })),
    std("kraft-fold", "#c4a06a", { roughness: 0.72 }),
    sx * 0.88,
    0.02,
    sz * 0.82
  );
}

export function addGroceryShelf(group, slots) {
  const cans = [];
  const packs = [];
  const bottles = [];
  const caps = [];
  for (const p of slots) {
    if (p.row % 3 === 0) cans.push({ x: p.x, y: p.y + 0.055, z: p.z });
    else if (p.row % 3 === 1) packs.push({ x: p.x, y: p.y + 0.07, z: p.z });
    else {
      bottles.push({ x: p.x, y: p.y + 0.08, z: p.z });
      caps.push({ x: p.x, y: p.y + 0.155, z: p.z });
    }
  }
  addVariantStock(group, CYL, cans, GROCERY_CAN_TEX, 0.036, 0.1, 0.036);
  addInstanced(group, CYL, cans.map((p) => ({ x: p.x, y: p.y + 0.052, z: p.z })), std("can-lid", "#c8ccd0", { roughness: 0.22, metalness: 0.72 }), 0.037, 0.006, 0.037);
  addInstanced(group, CYL, cans.map((p) => ({ x: p.x, y: p.y - 0.05, z: p.z })), std("can-base", "#b4b8bc", { roughness: 0.28, metalness: 0.65 }), 0.037, 0.006, 0.037);
  addVariantStock(group, BOX, packs, GROCERY_PACK_TEX, 0.092, 0.13, 0.062);
  addVariantStock(group, TAPER, bottles, GROCERY_CAN_TEX, 0.026, 0.15, 0.026);
  addInstanced(group, CYL, caps, std("cap", "#c6a56a", { roughness: 0.28, metalness: 0.42 }), 0.016, 0.02, 0.016);
}

export function addGroceryTop(group, positions) {
  const packs = positions.filter((_, i) => i % 3 !== 2);
  const fruit = positions.filter((_, i) => i % 3 === 2);
  addVariantStock(group, BOX, packs, GROCERY_PACK_TEX, 0.1, 0.13, 0.07);
  addInstanced(group, SPHERE, fruit, ["#c45c26", "#d4a017", "#2f7d4a", "#b42318"], 0.046, 0.046, 0.046);
}

export function addCafeShelf(group, slots) {
  const bags = slots.filter((p) => p.row !== 1).map((p) => ({ x: p.x, y: p.y + 0.075, z: p.z }));
  addCafeBags(group, bags, 0.078, 0.122, 0.052);
  let n = 0;
  for (const p of slots) {
    if (p.row !== 1 || n >= 6) continue;
    group.add(makeMugSet(p.i, p.x, p.y, p.z));
    n += 1;
  }
}

export function addCafeCounter(group, bags, mugs) {
  addCafeBags(group, bags, 0.086, 0.132, 0.056);
  mugs.forEach((p, i) => group.add(makeMugSet(i, p.x, p.y, p.z)));
}

export function addPharmacyShelf(group, slots) {
  const bottles = [];
  const caps = [];
  const packs = [];
  for (const p of slots) {
    if (p.col % 2 === 0) {
      bottles.push({ x: p.x, y: p.y + 0.07, z: p.z });
      caps.push({ x: p.x, y: p.y + 0.14, z: p.z });
    } else packs.push({ x: p.x, y: p.y + 0.055, z: p.z });
  }
  addVariantStock(group, TAPER, bottles, PHARMA_BOTTLE_TEX, 0.02, 0.13, 0.02);
  addInstanced(group, CYL, caps, std("pcab", "#f8fafc", { roughness: 0.22, metalness: 0.2 }), 0.014, 0.018, 0.014);
  addVariantStock(group, BOX, packs, PHARMA_PACK_TEX, 0.072, 0.1, 0.042);
}

export function addPharmacyTop(group, positions) {
  addVariantStock(group, TAPER, positions, PHARMA_BOTTLE_TEX, 0.022, 0.12, 0.022);
  addInstanced(
    group,
    CYL,
    positions.map((p) => ({ x: p.x, y: p.y + 0.07, z: p.z })),
    std("pcab2", "#e2e8f0", { roughness: 0.24, metalness: 0.12 }),
    0.014,
    0.016,
    0.014
  );
}
