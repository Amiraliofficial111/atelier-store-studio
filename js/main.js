import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { applySurface, loadImageBitmap, MATERIALS, FLOOR_MATERIALS, ROOF_MATERIALS, loadPhotoTextures, isShineTexture, isTileTexture, isRoofTexture, resolveRoofId } from "./textures.js";
import { CATALOG, createFurniture, newFurniture, isLamp, isLightFixture, resetLampBudget, resetAcDisplays, updateAcDisplays, isProductDesk, nextDeskProductPose, defaultDeskScale, loadSofaModels, loadMannequinModels, loadWalkAvatar, loadWalkGirl, createWalkAvatar, cycleWalkGirl } from "./furniture.js?v=walkkeys1";
import { PRODUCT_LINES, loadClothesPhotos } from "./products.js";
import { loadWatchModels } from "./watches.js";
import { LETTERS, LOGO_STYLES } from "./logos.js";
import { buildRoom, defaultState } from "./store.js?v=dimshops1";
import { ico, ICONS } from "./icons.js?v=walkwho1";
import { QUALITY, currentDpr, dropQuality } from "./quality.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: QUALITY.antialias,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
  alpha: false,
  failIfMajorPerformanceCaveat: false,
});
renderer.debug.checkShaderErrors = false;
renderer.setPixelRatio(currentDpr());
renderer.shadowMap.enabled = QUALITY.shadow > 0;
renderer.shadowMap.type = QUALITY.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let renderUntil = 0;
function invalidate(ms = 180) {
  const until = performance.now() + ms;
  if (until > renderUntil) renderUntil = until;
}

let shadowTimer = 0;
function markShadowsDirty() {
  invalidate(160);
  if (QUALITY.shadow <= 0) return;
  clearTimeout(shadowTimer);
  shadowTimer = setTimeout(() => {
    renderer.shadowMap.needsUpdate = true;
    invalidate(180);
  }, 70);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b8c3d0");
if (!QUALITY.low) scene.fog = new THREE.Fog("#b8c3d0", 42, 88);
scene.environmentIntensity = 1.18;
const bootWrap = canvas.parentElement;
renderer.setSize(Math.max(2, bootWrap?.clientWidth || window.innerWidth || 800), Math.max(2, bootWrap?.clientHeight || window.innerHeight || 600), false);
const pmrem = new THREE.PMREMGenerator(renderer);
function installEnvironment() {
  try {
    const roomEnv = new RoomEnvironment();
    scene.environment = pmrem.fromScene(roomEnv, QUALITY.pmrem).texture;
    roomEnv.dispose();
    scene.environmentIntensity = QUALITY.high ? 1.42 : 1.18;
    invalidate(240);
  } catch (err) {
    console.warn("environment skipped", err);
  }
}

const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(18));

const CAM_HOME = new THREE.Vector3(2.1, 1.66, 11.6);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 240);
camera.position.copy(CAM_HOME);
camera.filmGauge = 36;

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = QUALITY.damping;
orbit.dampingFactor = 0.12;
orbit.target.set(0, 1.8, 0);
orbit.minPolarAngle = 0.08;
orbit.maxPolarAngle = Math.PI * 0.92;
orbit.minDistance = 0.05;
orbit.maxDistance = 90;
orbit.enablePan = true;
orbit.screenSpacePanning = true;
orbit.autoRotate = false;
orbit.enableZoom = false;
orbit.zoomToCursor = false;
orbit.zoomSpeed = 1;
orbit.rotateSpeed = 0.7;

const walker = new PointerLockControls(camera, renderer.domElement);
const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform.getHelper());
transform.setSize(0.85);
transform.showY = false;
orbit.addEventListener("change", () => invalidate(QUALITY.damping ? 180 : 70));
transform.addEventListener("dragging-changed", (e) => {
  orbit.enabled = !e.value && viewMode === "orbit";
  if (e.value) transformDidDrag = true;
  else persistLayout(false);
  invalidate(400);
});
transform.addEventListener("objectChange", () => {
  const obj = transform.object;
  if (!obj) return;
  obj.position.y = 0;
  const item = state.furniture.find((f) => f.id === obj.userData.id);
  if (!item) return;
  item.x = obj.position.x;
  item.z = obj.position.z;
  item.rotY = obj.rotation.y;
  obj.updateMatrix();
  syncFurnRotationUI(item);
  markShadowsDirty();
  scheduleSave();
});
transform.addEventListener("mouseUp", () => {
  const obj = transform.object;
  if (!obj || transform.getMode() !== "scale") return;
  const item = state.furniture.find((f) => f.id === obj.userData.id);
  if (!item) return;
  item.width = Math.max(0.3, item.width * obj.scale.x);
  item.height = Math.max(0.3, item.height * obj.scale.y);
  item.depth = Math.max(0.3, item.depth * obj.scale.z);
  obj.scale.set(1, 1, 1);
  rebuildFurniture();
  persistLayout(false);
  select(findById(item.id));
});

const hemi = new THREE.HemisphereLight("#fff4ea", "#8a8074", 0.42);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff1dc", 0.88);
sun.position.copy(sunDir).multiplyScalar(40);
sun.castShadow = QUALITY.shadow > 0;
if (QUALITY.shadow > 0) {
  sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.028;
  sun.shadow.radius = QUALITY.high ? 2.4 : 1.6;
  sun.shadow.blurSamples = QUALITY.high ? 6 : 4;
  if ("intensity" in sun.shadow) sun.shadow.intensity = 0.7;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 44;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.updateProjectionMatrix();
}
scene.add(sun);
const fill = new THREE.DirectionalLight("#dce6f4", QUALITY.high ? 0.14 : 0.18);
fill.position.set(-14, 14, 18);
scene.add(fill);
const rim = QUALITY.high ? new THREE.DirectionalLight("#ffe6c4", 0.16) : null;
if (rim) {
  rim.position.set(18, 8, -16);
  scene.add(rim);
}

const grid = new THREE.GridHelper(32, 32, 0xb7c0cc, 0x9aa6b3);
grid.position.y = 0.001;
grid.visible = false;
scene.add(grid);

const roomRoot = new THREE.Group();
const furnitureRoot = new THREE.Group();
scene.add(roomRoot, furnitureRoot);

const SurfaceMat = QUALITY.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
const wallLook = {
  roughness: 0.54,
  metalness: 0,
  envMapIntensity: 0.78,
  side: THREE.DoubleSide,
};
if (QUALITY.physical && QUALITY.high) {
  wallLook.clearcoat = 0.08;
  wallLook.clearcoatRoughness = 0.6;
  wallLook.sheen = 0.14;
  wallLook.sheenRoughness = 0.8;
  wallLook.sheenColor = new THREE.Color("#f3eee6");
}
const materials = {
  floor: new SurfaceMat({
    roughness: 0.34,
    metalness: 0.03,
    envMapIntensity: 0.95,
  }),
  roof: new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.86, metalness: 0.02 }),
  "wall-front": new SurfaceMat({ ...wallLook }),
  "wall-back": new SurfaceMat({ ...wallLook }),
  "wall-left": new SurfaceMat({ ...wallLook }),
  "wall-right": new SurfaceMat({ ...wallLook }),
};

let state = defaultState();
let selected = null;
let viewMode = "orbit";
let walkHeight = 1.65;
let uiLock = false;
let boxHelper = null;
let introT = 0;
let idleT = 0;
let transformDidDrag = false;
const keys = { w: false, a: false, s: false, d: false };
const walkPos = new THREE.Vector3();
const walkFwd = new THREE.Vector3();
const walkRight = new THREE.Vector3();
let walkActor = null;
let walkWho = "man";
let walkYaw = 0;
let walkPitch = 0.22;
let walkDist = 2.7;
const WALK_RADIUS = 0.4;
const WALK_GIRL_SIDE = 0.46;
const WALK_SPEED = 1.55;
const WALK_SKIP = new Set([
  "logo",
  "wallSconce",
  "ledBanner",
  "windowVinyl",
  "hoursPlaque",
  "splitAc",
  "pendant",
  "crystalChandelier",
  "ceilingCan",
  "deskLamp",
  "poster",
]);
const walkHits = [];

function rebuildWalkColliders() {
  walkHits.length = 0;
  for (const item of state.furniture || []) {
    if (WALK_SKIP.has(item.type)) continue;
    walkHits.push({
      x: item.x || 0,
      z: item.z || 0,
      hw: Math.max(0.16, (Number(item.width) || 0.55) / 2) + 0.05,
      hd: Math.max(0.16, (Number(item.depth) || 0.45) / 2) + 0.05,
      rotY: item.rotY || 0,
    });
  }
}

function frontDoorGap() {
  const width = state.store.width;
  const doors = (state.doors || []).filter((d) => d.wall === "front");
  if (!doors.length) return [{ x: 0, half: 1.15 }];
  return doors.map((d) => ({
    x: (Number(d.pos ?? 50) / 100 - 0.5) * width,
    half: Math.max(0.7, (Number(d.width) || 2.5) / 2 - 0.12),
  }));
}

function inFrontDoor(x) {
  return frontDoorGap().some((d) => Math.abs(x - d.x) <= d.half);
}

function walkHitsWall(x, z) {
  const w = state.store.width / 2;
  const d = state.store.depth / 2;
  const frontZ = d;
  const pad = WALK_RADIUS + 0.08;
  if (z > frontZ + 3.8) return true;
  if (z >= frontZ - 0.2 && (x < -w - 1.5 || x > w + 1.5)) return true;
  if (Math.abs(z - frontZ) < pad && !inFrontDoor(x)) return true;
  if (z < frontZ - 0.12) {
    if (x < -w + 0.42 || x > w - 0.42) return true;
    if (z < -d + 0.45) return true;
  }
  return false;
}

function walkBlocked(x, z) {
  if (walkHitsWall(x, z)) return true;
  const r2 = WALK_RADIUS * WALK_RADIUS;
  for (const b of walkHits) {
    const c = Math.cos(-b.rotY);
    const s = Math.sin(-b.rotY);
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const qx = lx - Math.max(-b.hw, Math.min(b.hw, lx));
    const qz = lz - Math.max(-b.hd, Math.min(b.hd, lz));
    if (qx * qx + qz * qz < r2) return true;
  }
  return false;
}

function girlWorldAt(x, z, side) {
  const fx = -Math.sin(walkYaw);
  const fz = -Math.cos(walkYaw);
  return { x: x + fz * side, z: z - fx * side };
}

function walkBlockedSoft(x, z, radius = 0.28) {
  if (walkHitsWall(x, z)) return true;
  const r2 = radius * radius;
  for (const b of walkHits) {
    const c = Math.cos(-b.rotY);
    const s = Math.sin(-b.rotY);
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const qx = lx - Math.max(-b.hw, Math.min(b.hw, lx));
    const qz = lz - Math.max(-b.hd, Math.min(b.hd, lz));
    if (qx * qx + qz * qz < r2) return true;
  }
  return false;
}

function pickGirlSide(x, z, current = WALK_GIRL_SIDE) {
  const prefer = current >= 0 ? 1 : -1;
  const tries = [0.46, 0.32, 0.18, 0.08, 0, -0.18, -0.32, -0.46];
  for (const mag of tries) {
    const side = prefer * mag;
    const g = girlWorldAt(x, z, side);
    if (!walkBlockedSoft(g.x, g.z)) return side;
  }
  for (const mag of tries) {
    const side = -prefer * mag;
    const g = girlWorldAt(x, z, side);
    if (!walkBlockedSoft(g.x, g.z)) return side;
  }
  return 0;
}

function pairBlocked(x, z) {
  return walkBlocked(x, z);
}

function clampWalkBounds(x, z) {
  const w = state.store.width / 2;
  const d = state.store.depth / 2;
  return {
    x: THREE.MathUtils.clamp(x, -w - 1.4, w + 1.4),
    z: THREE.MathUtils.clamp(z, -d + 0.45, d + 3.6),
  };
}

function tryWalkMove(nx, nz) {
  const next = clampWalkBounds(nx, nz);
  if (!pairBlocked(next.x, next.z)) {
    walkPos.x = next.x;
    walkPos.z = next.z;
    return;
  }
  const onlyX = clampWalkBounds(nx, walkPos.z);
  if (!pairBlocked(onlyX.x, onlyX.z)) walkPos.x = onlyX.x;
  const onlyZ = clampWalkBounds(walkPos.x, nz);
  if (!pairBlocked(onlyZ.x, onlyZ.z)) walkPos.z = onlyZ.z;
}
const imageCache = new Map();

const SWATCH_BG = {
  "reeded-glass": "#c8dce8",
  "brushed-steel": "#8a929a",
  "brushed-brass": "#c4a05a",
  "brushed-champagne": "#d8c49a",
  statuario: "#f0ece4",
  calacatta: "#f4f0e8",
  "terrazzo-chips": "#e4ddd4",
  "terrazzo-noir": "#1c1e22",
  "polished-concrete": "#9aa0a6",
  "concrete-grey": "#8a8882",
  zellige: "#1e4a3a",
  limestone: "#e4d4b8",
  tadelakt: "#c45a32",
  "stucco-fine": "#d8d4cc",
  "fluted-walnut": "#4a3426",
  corten: "#8a3a18",
  "oxidized-steel": "#4a2a1a",
  "patina-copper": "#2a5a52",
  "velvet-teal": "#12363c",
  boucle: "#efe8de",
  "chunky-knit": "#2a2c30",
  "wool-weave": "#2a2c30",
  "woven-jute": "#c4a06a",
  "braided-jute": "#c4a574",
  rattan: "#c4a06a",
  "leather-emboss": "#1a1a1c",
  drywall: "#f1ece4",
  silk: "#f5f1ea",
  limewash: "#eee6d9",
  venetian: "#e7dccf",
  microcement: "#e4ddd4",
  clay: "#e8d5c0",
  travertine: "#e6d7c2",
  fluted: "#efe8dc",
  linen: "#efe6d6",
  "concrete-wall": "#c8c4bc",
  paint: "#f1ece4",
  stucco: "#e4ddd4",
  brick: "#8a4b38",
  wood: "#c4a06a",
  tiles: "#f3eee4",
  "tile-white": "#eceae6",
  "tile-ivory": "#ece4d6",
  "tile-beige": "#d6c6b0",
  "tile-gray": "#b0b0ae",
  "tile-slate": "#848e94",
  "tile-charcoal": "#3e3e40",
  "tile-black": "#161618",
  "tile-subway": "#eeece8",
  "tile-hex": "#d2d0ca",
  "tile-check": "#f0f0ee",
  luxury: "#8a7a72",
  carrara: "#c8c2c4",
  espresso: "#2a1c16",
  photo: "#6a4a3a",
  mobileFloor: "#c8c6c0",
  concrete: "#9a9aa0",
  marble: "#f3eee4",
  terrazzo: "#d8d6d2",
  "tz-dove": "#c4bbb0",
  "tz-cinnamon": "#8f4a32",
  "tz-mint": "#b7c4b2",
  "tz-ginger": "#c9a46a",
  "tz-spearmint": "#4a8a4a",
  "tz-cottage": "#d8d6d2",
  "tz-turtle": "#8a8682",
  "tz-glossy": "#3a2a22",
  "tz-sage": "#8a8a6e",
  "tz-green": "#1e4a42",
  granite: "#6e6862",
  herringbone: "#c9a06a",
  plaster: "#eee6d9",
  walnut: "#4a3426",
  stone: "#6f6964",
  carpet: "#c9b8a0",
  checker: "#e4dcd0",
  wallpaper: "#efe6d6",
  metal: "#a8b0b8",
  "roof-goldleaf": "#c6a56a",
  "roof-silk": "#f7f1e6",
  "roof-onyx": "#2a1c12",
  "roof-noir": "#1a1714",
  "roof-marble": "#f6f2ea",
  "roof-champagne": "#e6c888",
  "roof-fluted": "#f3eee6",
  "roof-walnutinlay": "#4a3426",
  "roof-crystal": "#f5f0e6",
  "roof-lacquer": "#2a2420",
  "roof-travertine": "#e4d4ba",
  "roof-bronze": "#6a4524",
  "roof-alabaster": "#f3ead8",
  "roof-pearl": "#f4efe6",
  "roof-inlay": "#f2ebe0",
  "roof-stepcove": "#f6f1e8",
};

const PRESETS = [
  { id: "empty", label: "Empty" },
  { id: "mobile", label: "Mobile" },
  { id: "dresses", label: "Dresses" },
  { id: "shoes", label: "Shoes" },
  { id: "watches", label: "Watches" },
  { id: "cafe", label: "Cafe" },
  { id: "grocery", label: "Grocery" },
  { id: "pharmacy", label: "Pharmacy" },
];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
}

function findSelectable(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.selectable) return o;
    o = o.parent;
  }
  return null;
}

function findById(id) {
  let found = null;
  const visit = (o) => {
    if (found) return;
    if (o.userData && o.userData.id === id) found = o;
  };
  roomRoot.traverse(visit);
  if (!found) furnitureRoot.traverse(visit);
  return found;
}

function disposeNode(c) {
  if (c.dispose && (c.isReflector || c.type === "Reflector")) c.dispose();
  if (c.geometry && !c.geometry.userData?.shared) c.geometry.dispose();
  const mats = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : [];
  for (const m of mats) {
    if (!m || m.userData?.shared) continue;
    if (m.map && !m.map.userData?.shared) m.map.dispose();
    m.dispose();
  }
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse(disposeNode);
  }
}

function clampItems() {
  for (const f of state.furniture) {
    const wallLogo =
      (f.type === "logo" && f.logoMount === "wall") ||
      f.type === "ledBanner" ||
      f.type === "wallSconce" ||
      f.type === "dressNiche" ||
      f.type === "goldArch" ||
      f.type === "brandCubby" ||
      f.type === "slatSignWall" ||
      f.type === "ledGlassBay" ||
      f.type === "windowVinyl" ||
      f.type === "hoursPlaque" ||
      f.type === "splitAc";
    const pad = wallLogo ? 0.05 : 0.5;
    const hw = state.store.width / 2 - pad;
    const hd = state.store.depth / 2 - pad;
    f.x = THREE.MathUtils.clamp(f.x, -hw, hw);
    f.z = THREE.MathUtils.clamp(f.z, -hd, hd);
  }
}

function snapLogoToWall(item, wall) {
  if (!wall) {
    item.logoSnap = "";
    return;
  }
  const { width, depth } = state.store;
  const inset = item.type === "splitAc" ? Math.max(0.11, (item.depth || 0.21) * 0.5 + 0.012) : 0.09;
  item.logoSnap = wall;
  item.logoMount = "wall";
  if (wall === "front") {
    item.z = depth / 2 - inset;
    item.rotY = Math.PI;
  } else if (wall === "back") {
    item.z = -depth / 2 + inset;
    item.rotY = 0;
  } else if (wall === "left") {
    item.x = -width / 2 + inset;
    item.rotY = -Math.PI / 2;
  } else if (wall === "right") {
    item.x = width / 2 - inset;
    item.rotY = Math.PI / 2;
  }
}

function applyFlatSurfaces() {
  for (const key of Object.keys(state.store.surfaces)) {
    const surface = state.store.surfaces[key];
    const m = materials[key];
    if (!m) continue;
    m.color.set(surface.color || "#f3ebe0");
    if (key === "floor") m.color.set("#f4f0ea");
  }
}

async function applyAllSurfaces() {
  for (const key of Object.keys(state.store.surfaces)) {
    const surface = state.store.surfaces[key];
    let extra = null;
    if (surface.image) {
      if (!imageCache.has(surface.image)) {
        const loaded = await loadImageBitmap(surface.image);
        imageCache.set(surface.image, loaded.texture);
      }
      extra = imageCache.get(surface.image);
    }
    try {
      applySurface(materials[key], surface, extra);
    } catch (err) {
      console.error("surface failed", key, surface.texture, err);
    }
    if (key === "roof" && isRoofTexture(surface.texture)) {
      materials.roof.color.set("#ffffff");
    }
    if (key === "floor") {
      const m = materials.floor;
      m.color.set("#ffffff");
      if (surface.texture === "mobileFloor" || (isTileTexture(surface.texture) && surface.texture !== "tiles")) {
        m.roughness = 0.22;
        m.metalness = 0.05;
        m.envMapIntensity = 1.9;
        if (QUALITY.high && "clearcoat" in m) {
          m.clearcoat = 0.8;
          m.clearcoatRoughness = 0.04;
        }
        if (QUALITY.high && "ior" in m) m.ior = 1.52;
      } else {
        m.roughness = Math.min(m.roughness, QUALITY.high ? 0.06 : 0.16);
        m.metalness = Math.max(m.metalness, 0.07);
        m.envMapIntensity = 1.65;
        if (QUALITY.high && "clearcoat" in m) {
          m.clearcoat = Math.max(m.clearcoat || 0, 0.58);
          m.clearcoatRoughness = 0.05;
        }
      }
    }
  }
  scheduleSave();
}

function freezeStatic(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isLight) return;
    o.matrixAutoUpdate = false;
    o.frustumCulled = true;
    if (!o.isMesh) return;
    const vol = Math.abs((o.scale?.x || 1) * (o.scale?.y || 1) * (o.scale?.z || 1));
    if (vol < 0.014) {
      o.castShadow = false;
      if (!QUALITY.high) o.receiveShadow = false;
    }
  });
}

function thawObject(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    o.matrixAutoUpdate = true;
  });
}

function rebuildRoom() {
  clearGroup(roomRoot);
  const built = buildRoom(state, materials);
  roomRoot.add(built);
  freezeStatic(roomRoot);
  grid.scale.set(state.store.width / 16, 1, state.store.depth / 16);
  markShadowsDirty();
  scheduleSave();
  if (selected && selected.kind !== "furniture") {
    const obj = findById(selected.id);
    if (obj) highlight(obj);
    else deselect();
  }
}

function findProductSlot(furnId, slotId) {
  let found = null;
  furnitureRoot.traverse((o) => {
    if (!found && o.userData?.kind === "product" && o.userData.furnId === furnId && o.userData.slotId === slotId) {
      found = o;
    }
  });
  return found;
}

function productSwapCats(category) {
  if (category === "phones" || category === "laptops" || category === "tablets") return ["phones", "laptops", "tablets"];
  return [category || "phones"];
}

function productDeskItem() {
  if (selected?.kind === "product" && selected.furnId) return state.furniture.find((f) => f.id === selected.furnId);
  if (selected?.kind === "furniture") return state.furniture.find((f) => f.id === selected.id);
  return null;
}

function fillProductSwap() {
  const modeWrap = document.getElementById("prod-action-mode");
  const catsWrap = document.getElementById("prod-swap-cats");
  const grid = document.getElementById("prod-swap-grid");
  const hint = document.getElementById("prod-swap-hint");
  if (!catsWrap || !grid || !selected || selected.kind !== "product") return;
  const mode = grid.dataset.mode === "add" ? "add" : "replace";
  grid.dataset.mode = mode;
  if (modeWrap) {
    modeWrap.innerHTML = [
      ["replace", "Replace"],
      ["add", "Add new"],
    ]
      .map(([id, label]) => `<button type="button" data-prod-mode="${id}" class="${id === mode ? "active" : ""}">${label}</button>`)
      .join("");
  }
  const cats = mode === "add" ? ["phones", "laptops", "tablets"] : productSwapCats(selected.category);
  const labels = { phones: "Phones", laptops: "Laptops", tablets: "iPads", dresses: "Dresses", shoes: "Shoes", watches: "Watches", cafe: "Cafe" };
  let cat = grid.dataset.cat;
  if (!cats.includes(cat)) cat = cats[0];
  grid.dataset.cat = cat;
  catsWrap.innerHTML = cats
    .map((c) => `<button type="button" data-swap-tab="${c}" class="${c === cat ? "active" : ""}">${labels[c] || c}</button>`)
    .join("");
  const list = PRODUCT_LINES[cat] || [];
  grid.innerHTML = list
    .map(
      (p, i) =>
        `<button type="button" class="catalog-btn${mode === "replace" && selected.category === cat && Number(selected.productIndex) === i ? " active" : ""}" data-swap-cat="${cat}" data-swap-i="${i}"><span class="cat-copy">${p.title}<small>${p.price} · ${p.sku}</small></span></button>`
    )
    .join("");
  if (hint) {
    hint.textContent =
      mode === "add"
        ? "Catalog se product choose karo — yeh isi desk par naya add hoga."
        : "Is jagah doosra product choose karo. Delete se yeh desk se hat jayega.";
  }
}

function replaceSelectedProduct(category, index) {
  if (!selected || selected.kind !== "product" || !selected.slotId || !selected.furnId) return;
  const item = state.furniture.find((f) => f.id === selected.furnId);
  if (!item) return;
  const extra = (item.extras || []).find((row) => row.slotId === selected.slotId);
  const scale = defaultDeskScale(category);
  if (extra) {
    extra.category = category;
    extra.index = Number(index);
    extra.scale = scale;
  } else {
    if (!item.productMap) item.productMap = {};
    item.productMap[selected.slotId] = { category, index: Number(index), scale: selected.scale || scale };
  }
  const furnId = selected.furnId;
  const slotId = selected.slotId;
  rebuildFurniture();
  const next = findProductSlot(furnId, slotId);
  if (next) select(next);
}

function addProductToDesk(category, index = 0) {
  const item = productDeskItem();
  if (!item) return;
  if (!item.extras) item.extras = [];
  const pose = nextDeskProductPose(item);
  const slotId = `extra-${Date.now().toString(36)}-${item.extras.length}`;
  item.extras.push({
    slotId,
    category,
    index: Number(index) || 0,
    x: pose.x,
    z: pose.z,
    rotY: pose.rotY || 0,
    scale: defaultDeskScale(category),
  });
  rebuildFurniture();
  const next = findProductSlot(item.id, slotId);
  if (next) select(next);
}

function deleteProductFromDesk() {
  if (!selected || selected.kind !== "product" || !selected.slotId || !selected.furnId) return;
  const item = state.furniture.find((f) => f.id === selected.furnId);
  if (!item) return;
  const extras = item.extras || [];
  const extraIdx = extras.findIndex((row) => row.slotId === selected.slotId);
  if (extraIdx >= 0) extras.splice(extraIdx, 1);
  else {
    if (!item.hiddenSlots) item.hiddenSlots = [];
    if (!item.hiddenSlots.includes(selected.slotId)) item.hiddenSlots.push(selected.slotId);
  }
  const furnId = item.id;
  rebuildFurniture();
  const desk = findById(furnId);
  if (desk) select(desk);
  else deselect();
}

function rebuildFurniture() {
  const keepProduct = selected?.kind === "product" ? { furnId: selected.furnId, slotId: selected.slotId } : null;
  clearGroup(furnitureRoot);
  resetLampBudget();
  resetAcDisplays();
  for (const item of state.furniture) {
    if ((item.type === "logo" || item.type === "wallSconce" || item.type === "ledBanner" || item.type === "windowVinyl" || item.type === "hoursPlaque" || item.type === "slatSignWall" || item.type === "splitAc") && item.logoSnap) {
      snapLogoToWall(item, item.logoSnap);
    }
    try {
      furnitureRoot.add(createFurniture(item));
    } catch (err) {
      console.error("furniture failed", item.type, err);
    }
  }
  freezeStatic(furnitureRoot);
  rebuildWalkColliders();
  markShadowsDirty();
  refreshObjectList();
  scheduleSave();
  hydrateStudioAssets();
  if (keepProduct?.furnId && keepProduct.slotId) {
    const obj = findProductSlot(keepProduct.furnId, keepProduct.slotId);
    if (obj) {
      highlight(obj);
      return;
    }
  }
  if (selected && selected.kind === "furniture") {
    const obj = findById(selected.id);
    if (obj) {
      thawObject(obj);
      highlight(obj);
      transform.attach(obj);
    } else deselect();
  }
}

async function restoreFurnitureMaps() {
  for (const item of state.furniture) {
    if (!item.image) continue;
    if (!imageCache.has(item.image)) {
      const loaded = await loadImageBitmap(item.image);
      imageCache.set(item.image, loaded.texture);
    }
    item._map = imageCache.get(item.image);
  }
}

function shopLighting() {
  const fallback = { exposure: 0.86, sun: 0.78, fill: 0.14, hemi: 0.42, warmth: 0.72 };
  if (!state.store.lighting) state.store.lighting = { ...fallback };
  return Object.assign(fallback, state.store.lighting);
}

function isDressBoutique() {
  return lastPresetId === "dresses" || state.store?.sign?.text === "ATELIER";
}

function stripDressShopLights() {
  if (!isDressBoutique()) return;
  state.furniture = (state.furniture || []).filter((f) => f.type === "crystalChandelier" || !isLightFixture(f.type));
  for (const item of state.furniture) {
    if (item.type === "crystalChandelier") {
      if (item.lightOn !== false && !(Number(item.lightPower) > 0)) {
        item.lightOn = true;
        item.lightPower = 86;
        item.lightColor = item.lightColor || "#f2f6ff";
      }
      continue;
    }
    item.lightOn = false;
    item.lightPower = 0;
  }
  if (!state.furniture.some((f) => f.type === "crystalChandelier")) {
    const h = state.store?.height || 4.8;
    state.furniture.push(
      newFurniture("crystalChandelier", 0, -0.45, {
        width: 1.18,
        depth: 1.18,
        height: 0.52,
        lift: Math.max(3.8, h - 0.14),
        lightOn: true,
        lightPower: 86,
        lightColor: "#f2f6ff",
        color: "#e8eef4",
        accent: "#c8d0d8",
        stock: "none",
      })
    );
  }
}

function applyShopLighting() {
  const L = shopLighting();
  state.store.lighting = { ...L };
  const warmth = THREE.MathUtils.clamp(L.warmth ?? 0.76, 0, 1);
  const cool = new THREE.Color("#dce8ff");
  const warm = new THREE.Color("#fff4e4");
  const key = cool.clone().lerp(warm, warmth);
  renderer.toneMappingExposure = (L.exposure ?? 0.86) * 0.78;
  sun.intensity = (L.sun ?? 0.78) * 0.68;
  sun.color.copy(key);
  fill.intensity = (L.fill ?? 0.14) * 0.62;
  fill.color.copy(key).multiplyScalar(0.94);
  hemi.intensity = (L.hemi ?? 0.42) * 0.62;
  hemi.color.copy(key);
  hemi.groundColor.set(warmth > 0.45 ? "#7a6e62" : "#6a7280");
  const watchShop = lastPresetId === "watches" || state.store?.sign?.text === "CHRONOS" || state.store?.sign?.text === "AURUM GENESIS";
  scene.environmentIntensity = (watchShop ? 0.68 : 0.72) + (L.exposure ?? 0.86) * 0.12;
  if (rim) {
    rim.intensity = 0.1 + warmth * 0.08;
    rim.color.copy(key);
  }
  const mobile = state.store?.frontStyle === "mobile";
  const bg = mobile
    ? new THREE.Color("#b7c2ce").lerp(new THREE.Color("#cfd6de"), warmth * 0.35)
    : new THREE.Color("#c4cedc").lerp(new THREE.Color("#d8cfc2"), warmth);
  scene.background.copy(bg);
  if (scene.fog) {
    scene.fog.color.copy(bg);
    scene.fog.near = mobile ? 38 : 48;
    scene.fog.far = mobile ? 82 : 110;
  }
  if (mobile) {
    sun.position.set(9, 17, 24);
    fill.position.set(-12, 12, 16);
  } else {
    sun.position.copy(sunDir).multiplyScalar(40);
    fill.position.set(-14, 14, 18);
  }
  markShadowsDirty();
  invalidate(360);
  scheduleSave();
}

const studioJobs = { hdr: null, clothes: null, watches: null, sofa: null, man: null };

function furnitureTypes() {
  return new Set((state.furniture || []).map((f) => f.type));
}

function ensureStudioAssets() {
  const types = furnitureTypes();
  const jobs = [];
  if (!studioJobs.hdr) {
    studioJobs.hdr = true;
    if (QUALITY.high) setTimeout(() => loadStudioHDR(), 900);
  }
  if ((isDressBoutique() || types.has("rack") || types.has("dressNiche")) && !studioJobs.clothes) {
    studioJobs.clothes = loadClothesPhotos();
    jobs.push(studioJobs.clothes);
  }
  if ((isWatchShop() || types.has("glassCase") || types.has("watchTower")) && !studioJobs.watches) {
    studioJobs.watches = loadWatchModels();
    jobs.push(studioJobs.watches);
  }
  if (types.has("sofa") && !studioJobs.sofa) {
    studioJobs.sofa = loadSofaModels();
    jobs.push(studioJobs.sofa);
  }
  if ((types.has("mannequin") || types.has("mannequinCase") || types.has("glowRunway")) && !studioJobs.man) {
    studioJobs.man = loadMannequinModels();
    jobs.push(studioJobs.man);
  }
  if (!jobs.length) return Promise.resolve(false);
  return Promise.all(jobs)
    .then(() => true)
    .catch(() => false);
}

function hydrateStudioAssets() {
  return ensureStudioAssets().then((fresh) => {
    if (!fresh) return;
    rebuildFurniture();
    applyShopLighting();
    invalidate(260);
  });
}

function loadStudioHDR() {
  return new Promise((resolve) => {
    new RGBELoader().load(
      "./textures/hdr/studio.hdr",
      (hdr) => {
        const env = pmrem.fromEquirectangular(hdr).texture;
        scene.environment = env;
        scene.environmentIntensity = 1.12;
        hdr.dispose();
        applyShopLighting();
        resolve(true);
      },
      undefined,
      () => resolve(false)
    );
  });
}

function isWatchShop() {
  return lastPresetId === "watches" || state.store?.sign?.text === "CHRONOS" || state.store?.sign?.text === "AURUM GENESIS";
}

function ensureWatchDisplays() {
  if (!isWatchShop()) return;
  const list = (state.furniture || []).filter((item) => item.type !== "sofa" && item.type !== "mannequin");
  state.furniture = list;
  for (const item of list) {
    if (item.type === "watchTower") {
      const hero = Math.abs(item.x || 0) < 0.45 && Math.abs((item.z || 0) - 0.85) < 0.7;
      item.width = hero ? 0.5 : 0.42;
      item.depth = hero ? 0.5 : 0.42;
      item.height = hero ? 1.05 : 0.96;
      item.watchScale = hero ? 1.28 : 1.18;
    } else if (item.type === "glassCase" && (item.stock === "watches" || !item.stock)) {
      item.height = Math.min(item.height || 1.55, 1.18);
      item.depth = Math.min(item.depth || 0.5, 0.38);
      item.width = Math.min(item.width || 2.45, 1.78);
      item.watchScale = Math.min(item.watchScale || 1.15, 0.92);
    }
  }
}

function ensureWalkActor() {
  if (walkActor) return walkActor;
  walkActor = createWalkAvatar();
  if (walkActor) {
    walkActor.root.visible = false;
    scene.add(walkActor.root);
  }
  return walkActor;
}

function syncWalkWhoButtons() {
  document.querySelectorAll("[data-walk-who]").forEach((btn) => {
    btn.classList.toggle("active", viewMode === "walk" && btn.dataset.walkWho === walkWho);
  });
}

function applyWalkWho() {
  const actor = walkActor;
  if (!actor) return;
  const girlOn = walkWho === "girl" || walkWho === "both";
  const manOn = walkWho === "man" || walkWho === "both";
  if (actor.man) actor.man.visible = manOn;
  for (const girl of actor.girls || []) {
    girl.root.visible = girlOn;
    girl.side = walkWho === "both" ? WALK_GIRL_SIDE : 0;
    if (girl.restX != null) girl.root.position.x = girl.restX + (girl.side || 0);
  }
  actor.who = walkWho;
  syncWalkWhoButtons();
}

function chooseWalkWho(who) {
  walkWho = who === "girl" || who === "both" ? who : "man";
  if (viewMode !== "walk") {
    setView("walk");
    return;
  }
  if (walkWho === "girl" || walkWho === "both") {
    loadWalkGirl().then(() => {
      cycleWalkGirl(walkActor);
      applyWalkWho();
      invalidate(200);
    });
  }
  applyWalkWho();
  invalidate(200);
}

function setWalkActorVisible(on) {
  if (!on) {
    if (walkActor) walkActor.root.visible = false;
    syncWalkWhoButtons();
    return;
  }
  const show = () => {
    const actor = ensureWalkActor();
    if (!actor) return;
    actor.root.visible = true;
    if (walkWho === "girl" || walkWho === "both") cycleWalkGirl(actor);
    applyWalkWho();
    invalidate(200);
  };
  if (walkActor) {
    show();
    return;
  }
  loadWalkGirl();
  loadWalkAvatar().then(() => {
    if (viewMode !== "walk") return;
    show();
  });
}

async function rebuildAll() {
  clampItems();
  ensureWatchDisplays();
  ensureDressDisplays();
  try {
    applyFlatSurfaces();
    await restoreFurnitureMaps();
    await loadMannequinModels();
    rebuildRoom();
    rebuildFurniture();
    applyShopLighting();
    syncStoreSliders();
  } catch (err) {
    console.error("rebuildAll failed", err);
    try {
      rebuildRoom();
      rebuildFurniture();
      applyShopLighting();
    } catch (err2) {
      console.error("rebuild fallback failed", err2);
    }
  }
  invalidate(220);
  scheduleSave();
  hydrateStudioAssets();
  const later = window.requestIdleCallback || ((fn, opts) => setTimeout(fn, opts?.timeout || 60));
  later(() => applyAllSurfaces().then(() => invalidate(180)), { timeout: 220 });
}

function highlight(obj) {
  if (boxHelper) {
    scene.remove(boxHelper);
    boxHelper = null;
  }
  boxHelper = new THREE.BoxHelper(obj, 0xe7a15a);
  scene.add(boxHelper);
}

function deselect() {
  selected = null;
  transform.detach();
  freezeStatic(furnitureRoot);
  if (boxHelper) {
    scene.remove(boxHelper);
    boxHelper = null;
  }
  document.querySelectorAll(".surface-btn.active, .object-list button.active").forEach((b) => b.classList.remove("active"));
  showProps("empty");
  refreshObjectList();
  syncHud();
}

function focusOnProduct(obj) {
  if (viewMode === "walk") return;
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const radius = Math.max(size.x, size.y, size.z, 0.06);
  orbit.target.copy(center);
  orbit.minDistance = 0.05;
  orbit.minPolarAngle = 0.08;
  orbit.maxPolarAngle = Math.PI * 0.92;
  const dir = camera.position.clone().sub(center);
  if (dir.lengthSq() < 1e-6) dir.set(0.35, 0.22, 0.55);
  dir.setLength(THREE.MathUtils.clamp(radius * 3.2, 0.22, 1.1));
  camera.position.copy(center).add(dir);
  invalidate(500);
}

function select(obj) {
  if (!obj) return deselect();
  selected = {
    kind: obj.userData.kind,
    id: obj.userData.id,
    type: obj.userData.type,
    title: obj.userData.title,
    sku: obj.userData.sku,
    price: obj.userData.price,
    detail: obj.userData.detail,
    color: obj.userData.color,
    category: obj.userData.category,
    slotId: obj.userData.slotId || "",
    furnId: obj.userData.furnId || "",
    productIndex: obj.userData.productIndex,
    scale: obj.userData.scale,
  };
  highlight(obj);
  if (selected.kind === "furniture") {
    thawObject(obj);
    transform.attach(obj);
  } else transform.detach();
  if (selected.kind === "product") focusOnProduct(obj);
  document.querySelectorAll(".surface-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.select === selected.id || b.dataset.select === selected.kind);
  });
  fillProps();
  refreshObjectList();
  closeObjectMenu();
  const panel = document.querySelector(".panel");
  if (panel) panel.scrollTo({ top: 0, behavior: "smooth" });
}

function showProps(name) {
  for (const id of ["empty", "surface", "sign", "door", "window", "furniture", "product"]) {
    document.getElementById(`props-${id}`).hidden = id !== name;
  }
}

function currentSurface() {
  if (!selected) return null;
  if (selected.kind === "wall") return state.store.surfaces[selected.id];
  if (selected.kind === "floor" || selected.kind === "roof") return state.store.surfaces[selected.kind];
  return null;
}

function fillSwatchGrid(el, list) {
  if (!el) return;
  el.innerHTML = list
    .map(
      (m) =>
        `<button type="button" class="swatch" data-id="${m.id}" title="${m.label}"><span class="swatch-chip" style="background:${SWATCH_BG[m.id] || "#ddd"}"></span><span class="swatch-name">${m.label}</span></button>`
    )
    .join("");
}

function fillProps() {
  uiLock = true;
  if (!selected) {
    showProps("empty");
    uiLock = false;
    syncHud();
    return;
  }
  if (selected.kind === "sign") {
    showProps("sign");
    document.getElementById("sign-text").value = state.store.sign.text;
    document.getElementById("sign-fg").value = state.store.sign.fg;
    document.getElementById("sign-bg").value = state.store.sign.bg;
  } else if (selected.kind === "door") {
    const door = state.doors.find((d) => d.id === selected.id);
    showProps("door");
    if (door) {
      document.getElementById("door-style").value = door.style === "wood" ? "glass" : door.style;
      document.getElementById("door-wall").value = door.wall;
      document.getElementById("door-glass").value = door.glassType || "clear";
      document.getElementById("door-glass-color").value = door.glassColor || "#d8eef8";
      document.getElementById("door-opacity").value = door.opacity ?? 0.05;
      document.getElementById("val-door-op").textContent = `${Math.round((door.opacity ?? 0.05) * 100)}%`;
      document.getElementById("door-pos").value = door.pos;
      document.getElementById("door-w").value = door.width;
      document.getElementById("door-h").value = door.height;
      document.getElementById("val-door-pos").textContent = `${door.pos}%`;
      document.getElementById("val-door-w").textContent = `${Number(door.width).toFixed(2)} m`;
      document.getElementById("val-door-h").textContent = `${Number(door.height).toFixed(2)} m`;
    }
  } else if (selected.kind === "window") {
    const win = state.windows.find((w) => w.id === selected.id);
    showProps("window");
    if (win) {
      document.getElementById("window-wall").value = win.wall;
      document.getElementById("window-glass").value = win.glassType || "clear";
      document.getElementById("window-color").value = win.glassColor || win.color;
      document.getElementById("window-opacity").value = win.opacity ?? 0.05;
      document.getElementById("val-win-op").textContent = `${Math.round((win.opacity ?? 0.05) * 100)}%`;
      document.getElementById("window-pos").value = win.pos;
      document.getElementById("window-w").value = win.width;
      document.getElementById("window-h").value = win.height;
      document.getElementById("val-win-pos").textContent = `${win.pos}%`;
      document.getElementById("val-win-w").textContent = `${Number(win.width).toFixed(2)} m`;
      document.getElementById("val-win-h").textContent = `${Number(win.height).toFixed(2)} m`;
    }
  } else if (selected.kind === "product") {
    showProps("product");
    const cats = { phones: "Phones", laptops: "Laptops", tablets: "iPads", dresses: "Ready to wear", shoes: "Footwear", watches: "Timepieces", cafe: "Cafe" };
    document.getElementById("prod-cat").textContent = cats[selected.category] || selected.category || "Collection";
    document.getElementById("prod-title").textContent = selected.title || "Product";
    document.getElementById("prod-sku").textContent = selected.sku || "";
    document.getElementById("prod-price").textContent = selected.price || "";
    document.getElementById("prod-detail").textContent = selected.detail || "";
    document.getElementById("prod-swatch").style.background = selected.color || "#c6a56a";
    fillProductSwap();
  } else if (selected.kind === "furniture") {
    const item = state.furniture.find((f) => f.id === selected.id);
    showProps("furniture");
    if (item) {
      const isLogo = item.type === "logo";
      const isBanner = item.type === "ledBanner" || item.type === "ledDesk";
      const lamp = isLamp(item.type);
      const titles = {
        ledBanner: "LED wall banner",
        ledDesk: "LED desk screen",
        haloDesk: "King counter",
        slatSignWall: "Brand display wall",
        logo: "Logo",
        light: "Floor lamp",
        pendant: "Pendant lamp",
        ceilingCan: "Ceiling spot",
        wallSconce: "Wall sconce",
        deskLamp: "Desk lamp",
        splitAc: "Split AC",
      };
      document.getElementById("furn-title").textContent =
        titles[item.type] || item.type[0].toUpperCase() + item.type.slice(1);
      document.getElementById("furn-type-label").textContent = isLogo
        ? "Pick A–Z, change style, or upload your own logo. Move it anywhere."
        : isBanner
          ? "Snap to a wall or raise the stand onto a desk. Headline and size are below."
          : lamp
            ? "Place it anywhere. Turn it on, pick a color, and set brightness."
            : "Move or rotate with the gizmo, slider, or 90° buttons";
      document.getElementById("furn-stock-field").hidden = isLogo || isBanner || lamp;
      const deskProducts = document.getElementById("furn-desk-products");
      if (deskProducts) deskProducts.hidden = !isProductDesk(item.type);
      document.getElementById("logo-fields").hidden = !isLogo;
      document.getElementById("banner-fields").hidden = !isBanner;
      document.getElementById("light-fields").hidden = !lamp;
      document.getElementById("furn-color").value = item.color;
      document.getElementById("furn-accent").value = item.accent;
      document.querySelectorAll("#furn-swatches .swatch").forEach((s) => {
        s.classList.toggle("active", s.dataset.id === (item.texture || "paint"));
      });
      document.getElementById("furn-stock").value = item.stock || "none";
      document.getElementById("furn-w").value = item.width;
      document.getElementById("furn-d").value = item.depth;
      document.getElementById("furn-h").value = item.height;
      document.getElementById("val-furn-w").textContent = `${Number(item.width).toFixed(2)} m`;
      document.getElementById("val-furn-d").textContent = `${Number(item.depth).toFixed(2)} m`;
      document.getElementById("val-furn-h").textContent = `${Number(item.height).toFixed(2)} m`;
      syncFurnRotationUI(item);
      if (isLogo) {
        document.getElementById("logo-letter").value = item.logoLetter || "A";
        document.getElementById("logo-style").value = item.logoStyle || "circle";
        document.getElementById("logo-word").value = item.logoWord || "";
        document.getElementById("logo-mount").value = item.logoMount || "stand";
        document.getElementById("logo-snap").value = item.logoSnap || "";
        document.getElementById("logo-lift").value = item.lift ?? 1.5;
        document.getElementById("val-logo-lift").textContent = `${Number(item.lift ?? 1.5).toFixed(2)} m`;
        document.getElementById("logo-lift-field").hidden = (item.logoMount || "stand") !== "wall";
        document.querySelectorAll("#logo-letters .letter-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.letter === String(item.logoLetter || "A").toUpperCase().slice(0, 1));
        });
      }
      if (isBanner) {
        document.getElementById("banner-text").value = item.posterText || "";
        document.getElementById("banner-shape").value = item.bannerShape || "portrait";
        document.getElementById("banner-snap").value = item.logoSnap || "";
        document.getElementById("banner-lift").value = item.lift ?? (item.type === "ledDesk" ? 1.1 : 2.1);
        document.getElementById("val-banner-lift").textContent = `${Number(item.lift ?? (item.type === "ledDesk" ? 1.1 : 2.1)).toFixed(2)} m`;
        document.getElementById("banner-snap-field").hidden = item.type !== "ledBanner";
      }
      if (lamp) {
        document.getElementById("light-on").checked = item.lightOn !== false;
        document.getElementById("light-color").value = item.lightColor || "#ffe6b8";
        document.getElementById("light-power").value = item.lightPower ?? 48;
        document.getElementById("val-light-power").textContent = String(item.lightPower ?? 48);
        const liftDefault = item.type === "pendant" ? 3.15 : item.type === "ceilingCan" ? 4.55 : item.type === "crystalChandelier" ? 4.66 : item.type === "deskLamp" ? 0.78 : 1.75;
        document.getElementById("light-lift").value = item.lift ?? liftDefault;
        document.getElementById("val-light-lift").textContent = `${Number(item.lift ?? liftDefault).toFixed(2)} m`;
        document.getElementById("light-lift-field").hidden = item.type === "light" || isBanner;
        document.getElementById("light-snap-field").hidden = item.type !== "wallSconce";
        document.getElementById("light-snap").value = item.logoSnap || "";
      }
    }
  } else {
    const surface = currentSurface();
    showProps("surface");
    const titles = {
      floor: "Floor",
      roof: "Roof",
      "wall-front": "Front wall",
      "wall-back": "Back wall",
      "wall-left": "Left wall",
      "wall-right": "Right wall",
    };
    document.getElementById("surface-title").textContent = titles[selected.id] || "Surface";
    if (surface) {
      const isFloor = selected.kind === "floor" || selected.id === "floor";
      const isRoof = selected.kind === "roof" || selected.id === "roof";
      document.getElementById("surface-color-field").hidden = isFloor || isRoof;
      document.getElementById("surface-all-walls-field").hidden = selected.kind !== "wall";
      document.getElementById("material-presets-label").textContent = isFloor
        ? "Shiny floor textures"
        : isRoof
          ? "Ceiling designs"
          : "Material presets";
      fillSwatchGrid(
        document.getElementById("material-swatches"),
        isFloor ? FLOOR_MATERIALS : isRoof ? ROOF_MATERIALS : MATERIALS
      );
      document.getElementById("surface-color").value = surface.color;
      document.getElementById("surface-repeat").value = surface.repeat;
      document.getElementById("val-repeat").textContent = Number(surface.repeat).toFixed(1);
      document.getElementById("wall-finish-fields").hidden = selected.kind !== "wall";
      document.getElementById("surface-finish").value = surface.finish || "solid";
      document.getElementById("surface-opacity").value = surface.opacity ?? 0.05;
      document.getElementById("val-wall-op").textContent = `${Math.round((surface.opacity ?? 0.05) * 100)}%`;
      document.querySelectorAll("#material-swatches .swatch").forEach((s) => {
        s.classList.toggle("active", s.dataset.id === (surface.texture || "drywall"));
      });
    }
  }
  uiLock = false;
  syncHud();
}

function rotDeg(rad) {
  return Math.round((((THREE.MathUtils.radToDeg(rad || 0) % 360) + 360) % 360));
}

function syncFurnRotationUI(item) {
  const deg = rotDeg(item.rotY);
  const slider = document.getElementById("furn-rot");
  const label = document.getElementById("val-furn-rot");
  if (!slider || !label) return;
  slider.value = deg;
  label.textContent = `${deg}°`;
}

function applyFurnRotation(item, deg) {
  const wrapped = ((Number(deg) % 360) + 360) % 360;
  item.rotY = THREE.MathUtils.degToRad(wrapped);
  const obj = findById(item.id);
  if (obj) obj.rotation.y = item.rotY;
  syncFurnRotationUI(item);
}

function syncStoreSliders() {
  uiLock = true;
  document.getElementById("store-width").value = state.store.width;
  document.getElementById("store-depth").value = state.store.depth;
  document.getElementById("store-height").value = state.store.height;
  document.getElementById("val-width").textContent = `${Number(state.store.width).toFixed(1)} m`;
  document.getElementById("val-depth").textContent = `${Number(state.store.depth).toFixed(1)} m`;
  document.getElementById("val-height").textContent = `${Number(state.store.height).toFixed(1)} m`;
  document.getElementById("btn-roof").querySelector(".btn-label").textContent =
    state.store.roofVisible === false ? "Roof Off" : "Roof On";
  const L = shopLighting();
  document.getElementById("lit-exposure").value = L.exposure;
  document.getElementById("lit-sun").value = L.sun;
  document.getElementById("lit-fill").value = L.fill;
  document.getElementById("lit-hemi").value = L.hemi;
  document.getElementById("lit-warmth").value = L.warmth;
  document.getElementById("val-lit-exposure").textContent = Number(L.exposure).toFixed(2);
  document.getElementById("val-lit-sun").textContent = Number(L.sun).toFixed(2);
  document.getElementById("val-lit-fill").textContent = Number(L.fill).toFixed(2);
  document.getElementById("val-lit-hemi").textContent = Number(L.hemi).toFixed(2);
  document.getElementById("val-lit-warmth").textContent = L.warmth >= 0.55 ? "Warm" : L.warmth <= 0.35 ? "Cool" : "Neutral";
  uiLock = false;
}

function objectRowLabel(row) {
  if (row.type === "door") return `Door · ${row.wall}`;
  if (row.type === "window") return `Window · ${row.wall}`;
  if (row.type === "logo") return `Logo · ${row.logoLetter || (row.image ? "custom" : "A")}`;
  if (row.type === "ledBanner") return `LED wall · ${row.posterText || "Live"}`;
  if (row.type === "ledDesk") return `LED desk · ${row.posterText || "Deals"}`;
  if (row.type === "light") return "Floor lamp";
  if (row.type === "pendant") return "Pendant lamp";
  if (row.type === "crystalChandelier") return "Crystal jhomar";
  if (row.type === "ceilingCan") return "Ceiling spot";
  if (row.type === "wallSconce") return "Wall sconce";
  if (row.type === "deskLamp") return "Desk lamp";
  const name = row.type.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  return `${name} · ${Number(row.width).toFixed(1)}m`;
}

function collectObjectRows() {
  return [
    ...state.doors.map((d) => ({ id: d.id, kind: "door", type: "door", group: "Doors", wall: d.wall, label: objectRowLabel({ type: "door", wall: d.wall }) })),
    ...state.windows.map((w) => ({ id: w.id, kind: "window", type: "window", group: "Windows", wall: w.wall, label: objectRowLabel({ type: "window", wall: w.wall }) })),
    ...state.furniture.map((f) => ({
      id: f.id,
      kind: "furniture",
      type: f.type,
      group: isLightFixture(f.type) ? "Lighting" : "Fixtures",
      width: f.width,
      logoLetter: f.logoLetter,
      posterText: f.posterText,
      image: f.image,
      label: objectRowLabel(f),
    })),
  ];
}

function closeObjectMenu() {
  const trigger = document.getElementById("object-trigger");
  const menu = document.getElementById("object-menu");
  if (!trigger || !menu) return;
  menu.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
}

function positionObjectMenu() {
  const trigger = document.getElementById("object-trigger");
  const menu = document.getElementById("object-menu");
  if (!trigger || !menu || menu.hidden) return;
  const r = trigger.getBoundingClientRect();
  const maxH = Math.min(320, window.innerHeight - r.bottom - 16);
  menu.style.position = "fixed";
  menu.style.left = `${r.left}px`;
  menu.style.width = `${r.width}px`;
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.maxHeight = `${Math.max(120, maxH)}px`;
}

function toggleObjectMenu() {
  const trigger = document.getElementById("object-trigger");
  const menu = document.getElementById("object-menu");
  if (!trigger || !menu) return;
  const open = menu.hidden;
  menu.hidden = !open;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionObjectMenu();
}

function refreshObjectList() {
  const list = document.getElementById("object-list");
  const label = document.getElementById("object-trigger-label");
  const count = document.getElementById("object-count");
  const icoWrap = document.getElementById("object-trigger-ico");
  if (!list) return;
  const rows = collectObjectRows();
  const groups = ["Doors", "Windows", "Fixtures"];
  list.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "object-group-label";
    empty.textContent = "No doors, windows or fixtures yet";
    list.appendChild(empty);
  }
  for (const group of groups) {
    const items = rows.filter((r) => r.group === group);
    if (!items.length) continue;
    const head = document.createElement("div");
    head.className = "object-group-label";
    head.textContent = `${group} · ${items.length}`;
    list.appendChild(head);
    for (const row of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `${ico(row.type)}<span>${row.label}</span>`;
      if (selected && selected.id === row.id) btn.classList.add("active");
      btn.addEventListener("click", () => select(findById(row.id)));
      list.appendChild(btn);
    }
  }
  const active = selected ? rows.find((r) => r.id === selected.id) : null;
  if (label) label.textContent = active ? active.label : "Choose an object";
  if (count) count.textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
  if (icoWrap) icoWrap.innerHTML = ico(active ? active.type : "cube");
}

function openFrontDoor() {
  const frontDoor = state.doors.find((d) => d.wall === "front");
  if (frontDoor && !frontDoor.open) {
    frontDoor.open = true;
    rebuildRoom();
  }
}

function setCameraFov(fov) {
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function storeFitDistance(fovDeg = 42) {
  const { width, depth, height } = state.store;
  const radius = 0.5 * Math.hypot(width, depth, height * 1.2);
  return (radius / Math.sin(THREE.MathUtils.degToRad(fovDeg) * 0.5)) * 1.08;
}

const WALK_ZOOM_DIR = new THREE.Vector3();

function wheelStep(e) {
  let d = e.deltaY;
  if (e.deltaMode === 1) d *= 16;
  if (e.deltaMode === 2) d *= 80;
  return THREE.MathUtils.clamp(d, -220, 220) * 0.011;
}

function camHeightLimits() {
  const h = state.store?.height || 4.8;
  return { min: 0.05, max: h - 0.04 };
}

function clampCamHeight(y) {
  const { min, max } = camHeightLimits();
  return THREE.MathUtils.clamp(y, min, max);
}

function walkStyleZoom(delta) {
  if (viewMode === "walk") {
    walkDist = THREE.MathUtils.clamp(walkDist + delta * 0.12, 1.15, 5.4);
    return;
  }
  camera.getWorldDirection(WALK_ZOOM_DIR);
  const { min, max } = camHeightLimits();
  const next = camera.position.clone().addScaledVector(WALK_ZOOM_DIR, -delta);
  next.y = THREE.MathUtils.clamp(next.y, min, max);
  const appliedX = next.x - camera.position.x;
  const appliedY = next.y - camera.position.y;
  const appliedZ = next.z - camera.position.z;
  camera.position.copy(next);
  orbit.target.x += appliedX;
  orbit.target.y += appliedY;
  orbit.target.z += appliedZ;
  orbit.target.y = THREE.MathUtils.clamp(orbit.target.y, 0, max + 1.2);
}

function applyCameraRange(dist) {
  camera.near = 0.05;
  camera.far = Math.max(160, dist * 4);
  camera.updateProjectionMatrix();
  orbit.minDistance = 0.05;
  orbit.maxDistance = Math.max(80, dist * 2.6);
  if (scene.fog) {
    scene.fog.near = Math.max(42, dist * 0.85);
    scene.fog.far = Math.max(96, dist * 2.1);
  }
}

function heroCameraPose() {
  const { width, depth, height } = state.store;
  if (state.store.frontStyle === "mobile") {
    return {
      pos: new THREE.Vector3(1.72, 1.62, depth / 2 + 5.05),
      target: new THREE.Vector3(0.04, 1.58, depth / 2 - 1.85),
      fov: 34,
    };
  }
  const dress = lastPresetId === "dresses" || state.store?.sign?.text === "ATELIER";
  if (dress) {
    return {
      pos: new THREE.Vector3(0.42, 1.58, depth / 2 - 1.05),
      target: new THREE.Vector3(-0.85, 1.18, 3.85),
      fov: 36,
    };
  }
  const watches = lastPresetId === "watches" || state.store?.sign?.text === "CHRONOS" || state.store?.sign?.text === "AURUM GENESIS";
  if (watches) {
    return {
      pos: new THREE.Vector3(0.28, 1.36, 2.05),
      target: new THREE.Vector3(0, 1.28, 1.12),
      fov: 26,
    };
  }
  return {
    pos: new THREE.Vector3(0.55, 1.6, depth / 2 - 1.2),
    target: new THREE.Vector3(0, 1.12, depth * 0.04),
    fov: 40,
  };
}

function frameFullStore() {
  const pose = heroCameraPose();
  setCameraFov(pose.fov);
  applyCameraRange(pose.pos.distanceTo(pose.target) + 6);
  orbit.target.copy(pose.target);
  camera.position.copy(pose.pos);
  CAM_HOME.copy(pose.pos);
}

function setOrbitLimits(mode) {
  if (mode === "ceiling") {
    orbit.minPolarAngle = Math.PI * 0.48;
    orbit.maxPolarAngle = Math.PI * 0.78;
    return;
  }
  if (mode === "inside") {
    orbit.minPolarAngle = 0.1;
    orbit.maxPolarAngle = Math.PI * 0.9;
  } else {
    orbit.minPolarAngle = 0.08;
    orbit.maxPolarAngle = Math.PI * 0.92;
  }
}

function syncHud() {
  const names = { orbit: "Orbit", top: "Top", ceiling: "Ceiling", front: "Front", back: "Back", left: "Left", right: "Right", inside: "Inside", walk: "Walk" };
  const badge = document.getElementById("view-badge");
  if (badge) badge.textContent = names[viewMode] || "Orbit";
  const store = document.getElementById("hud-store");
  if (store) store.textContent = state.store?.sign?.text || "Your Store";
  const status = document.getElementById("inspect-status");
  if (status) {
    if (!selected) status.textContent = "Ready";
    else if (selected.kind === "product") status.textContent = "Product";
    else if (selected.kind === "furniture") status.textContent = selected.type || "Fixture";
    else if (selected.kind === "wall") status.textContent = "Wall";
    else status.textContent = selected.kind;
  }
}

function setView(mode) {
  viewMode = mode;
  syncHud();
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === mode));
  document.getElementById("walk-hint").hidden = true;
  transform.detach();
  if (mode === "walk") {
    orbit.enabled = false;
    orbit.autoRotate = false;
    introT = 0;
    openFrontDoor();
    if (state.store.roofVisible === false) {
      state.store.roofVisible = true;
      rebuildRoom();
      syncStoreSliders();
    }
    setCameraFov(56);
    walkHeight = 1.52;
    walkPos.set(0, 0, state.store.depth / 2 + 2.55);
    walkYaw = 0;
    walkPitch = 0.16;
    walkDist = 3.1;
    setWalkActorVisible(true);
    syncWalkWhoButtons();
    invalidate(800);
    setTimeout(() => {
      if (viewMode === "walk") canvas.requestPointerLock?.();
    }, 50);
  } else {
    walker.unlock();
    if (document.pointerLockElement) document.exitPointerLock();
    setWalkActorVisible(false);
    orbit.enabled = true;
    const { width, depth, height } = state.store;
    orbit.minDistance = 0.05;
    orbit.maxDistance = 90;
    setOrbitLimits(mode);
    setCameraFov(mode === "inside" ? 48 : mode === "ceiling" ? 72 : 42);
    if (mode === "inside") {
      openFrontDoor();
      if (state.store.roofVisible === false) {
        state.store.roofVisible = true;
        rebuildRoom();
        syncStoreSliders();
      }
      camera.position.set(width * 0.13, 1.66, depth * 0.36);
      orbit.target.set(0, 1.18, -depth * 0.16);
      orbit.minDistance = 0.05;
      orbit.maxDistance = Math.max(28, Math.min(width, depth) * 1.35);
    } else if (mode === "ceiling") {
      if (state.store.roofVisible === false) {
        state.store.roofVisible = true;
        rebuildRoom();
        syncStoreSliders();
      }
      setCameraFov(58);
      camera.position.set(-width * 0.34, 1.12, depth * 0.36);
      orbit.target.set(width * 0.06, height - 0.18, -depth * 0.14);
      orbit.minDistance = 0.2;
      orbit.maxDistance = Math.max(width, depth) * 1.4;
    } else if (mode === "top") {
      const d = storeFitDistance(50);
      applyCameraRange(d);
      setCameraFov(50);
      orbit.target.set(0, 0.2, 0);
      camera.position.set(0, d * 0.95, 0.02);
    } else if (mode === "front") {
      const { depth, height } = state.store;
      if (state.store.frontStyle === "mobile") {
        setCameraFov(34);
        applyCameraRange(14);
        orbit.target.set(0, height * 0.42, depth / 2 - 0.2);
        camera.position.set(0.35, 1.68, depth / 2 + 6.1);
      } else {
        const d = storeFitDistance(40);
        applyCameraRange(d);
        orbit.target.set(0, height * 0.48, 0);
        camera.position.set(0, height * 0.85, depth / 2 + d * 0.62);
      }
    } else if (mode === "back") {
      const d = storeFitDistance(40);
      applyCameraRange(d);
      orbit.target.set(0, height * 0.48, 0);
      camera.position.set(0, height * 0.85, -depth / 2 - d * 0.62);
    } else if (mode === "left") {
      const d = storeFitDistance(40);
      applyCameraRange(d);
      orbit.target.set(0, height * 0.48, 0);
      camera.position.set(-width / 2 - d * 0.62, height * 0.85, 0);
    } else if (mode === "right") {
      const d = storeFitDistance(40);
      applyCameraRange(d);
      orbit.target.set(0, height * 0.48, 0);
      camera.position.set(width / 2 + d * 0.62, height * 0.85, 0);
    } else {
      frameFullStore();
      introT = 0;
    }
    if (selected && selected.kind === "furniture") {
      const obj = findById(selected.id);
      if (obj) transform.attach(obj);
    }
  }
  invalidate(400);
}

function addFromCatalog(type) {
  if (type === "door") {
    const door = {
      id: uid(),
      wall: "front",
      style: "glass",
      color: "#6b3f2a",
      glassType: "clear",
      glassColor: "#d8eef8",
      opacity: 0.05,
      pos: Math.min(85, 20 + state.doors.length * 18),
      width: 1.1,
      height: 2.1,
      open: false,
    };
    state.doors.push(door);
    rebuildRoom();
    refreshObjectList();
    select(findById(door.id));
    return;
  }
  if (type === "window") {
    const win = {
      id: uid(),
      wall: "left",
      color: "#9ec9e6",
      glassType: "clear",
      glassColor: "#d8eef8",
      opacity: 0.05,
      pos: 50,
      width: 1.5,
      height: 1.2,
      sill: 0.95,
    };
    state.windows.push(win);
    rebuildRoom();
    refreshObjectList();
    select(findById(win.id));
    return;
  }
  const extra = {};
  if (type === "logo") {
    extra.logoLetter = (state.store.sign.text || "A").replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "A";
    extra.logoWord = (state.store.sign.text || "").slice(0, 16);
  }
  if (type === "ledBanner") {
    extra.logoMount = "wall";
    extra.posterText = (state.store.sign.text || "LIVE").slice(0, 16);
    extra.color = "#101218";
    extra.accent = "#c6a56a";
    extra.lift = 2.1;
    extra.bannerShape = "portrait";
  }
  if (type === "ledDesk") {
    extra.logoMount = "desk";
    extra.posterText = "DEALS";
    extra.color = "#101218";
    extra.accent = "#c6a56a";
    extra.lift = 1.1;
    extra.bannerShape = "wide";
  }
  if (type === "splitAc") {
    extra.logoMount = "wall";
    extra.logoSnap = "back";
    extra.lift = Math.max(2.9, (state.store.height || 4.4) - 0.62);
    extra.color = "#f1f3f6";
    extra.accent = "#c8ccd2";
  }
  if (isLamp(type)) {
    extra.lightOn = true;
    extra.lightColor = "#ffe6b8";
    extra.lightPower = type === "deskLamp" ? 32 : type === "wallSconce" ? 28 : type === "ceilingCan" ? 70 : 48;
    extra.color = "#f4eee6";
    extra.accent = "#c6a56a";
    if (type === "pendant") extra.lift = Math.max(2.2, (state.store.height || 4.8) - 1.35);
    if (type === "crystalChandelier") {
      extra.lift = Math.max(3.6, (state.store.height || 4.8) - 0.14);
      extra.lightColor = "#f2f6ff";
      extra.lightPower = 86;
    }
    if (type === "ceilingCan") extra.lift = Math.max(2.8, (state.store.height || 4.8) - 0.28);
    if (type === "wallSconce") extra.lift = 1.75;
    if (type === "deskLamp") extra.lift = 0.78;
  }
  let px = (Math.random() - 0.5) * 2;
  let pz = (Math.random() - 0.5) * 2;
  if (isLightFixture(type)) {
    const n = state.furniture.filter((f) => isLightFixture(f.type)).length;
    px = (n % 3 - 1) * 1.25;
    pz = Math.floor(n / 3) * 1.15 - 0.4;
  }
  const item = newFurniture(type, px, pz, extra);
  item.id = uid();
  if (type === "ledBanner" || type === "wallSconce" || type === "splitAc") {
    const wall = selected && selected.kind === "wall" ? String(selected.id).replace("wall-", "") : "back";
    snapLogoToWall(item, wall);
  }
  state.furniture.push(item);
  clampItems();
  rebuildFurniture();
  select(findById(item.id));
}

function duplicateSelected() {
  if (!selected) return;
  if (selected.kind === "furniture") {
    const item = state.furniture.find((f) => f.id === selected.id);
    if (!item) return;
    const rot = item.rotY || 0;
    const gap = item.width + 0.15;
    const copy = {
      ...item,
      id: uid(),
      x: item.x + Math.cos(rot) * gap,
      z: item.z + Math.sin(rot) * gap,
    };
    state.furniture.push(copy);
    clampItems();
    rebuildFurniture();
    select(findById(copy.id));
    return;
  }
  if (selected.kind === "door") {
    const door = state.doors.find((d) => d.id === selected.id);
    if (!door) return;
    const copy = { ...door, id: uid(), pos: Math.min(90, door.pos + 14) };
    state.doors.push(copy);
    rebuildRoom();
    refreshObjectList();
    select(findById(copy.id));
    return;
  }
  if (selected.kind === "window") {
    const win = state.windows.find((w) => w.id === selected.id);
    if (!win) return;
    const copy = { ...win, id: uid(), pos: Math.min(88, win.pos + 14) };
    state.windows.push(copy);
    rebuildRoom();
    refreshObjectList();
    select(findById(copy.id));
  }
}

function deleteSelected() {
  if (!selected) return;
  if (selected.kind === "product") {
    deleteProductFromDesk();
    return;
  }
  if (selected.kind === "door") state.doors = state.doors.filter((d) => d.id !== selected.id);
  if (selected.kind === "window") state.windows = state.windows.filter((w) => w.id !== selected.id);
  if (selected.kind === "furniture") state.furniture = state.furniture.filter((f) => f.id !== selected.id);
  if (["door", "window"].includes(selected.kind)) rebuildRoom();
  if (selected.kind === "furniture") rebuildFurniture();
  deselect();
  refreshObjectList();
}

function serializable() {
  const furniture = (state.furniture || []).map((item) => {
    const row = { ...item };
    delete row._map;
    return row;
  });
  return JSON.parse(
    JSON.stringify({
      version: state.version || 1,
      store: state.store,
      doors: state.doors,
      windows: state.windows,
      furniture,
    })
  );
}

const SAVE_KEY = "atelier-store-autosave";
const SAVE_KEY_OLD = "store-layout-3d";
const PRESET_KEY = "atelier-last-preset";
let autosavePaused = false;
let lastPresetId = localStorage.getItem(PRESET_KEY) || "mobile";
let saveTimer = 0;

function flashSave(msg = "Saved") {
  const el = document.getElementById("save-toast");
  const btn = document.getElementById("btn-save");
  if (el) {
    el.hidden = false;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(flashSave._t);
    flashSave._t = setTimeout(() => el.classList.remove("show"), 1800);
  }
  if (btn && msg.toLowerCase().includes("save")) {
    btn.classList.add("saved");
    clearTimeout(flashSave._b);
    flashSave._b = setTimeout(() => btn.classList.remove("saved"), 1200);
  }
}

function persistLayout(showToast = false) {
  if (autosavePaused) return false;
  try {
    localStorage.setItem(PRESET_KEY, lastPresetId || "mobile");
    const payload = { ...serializable(), presetId: lastPresetId, savedAt: Date.now() };
    const json = JSON.stringify(payload);
    localStorage.setItem(SAVE_KEY, json);
    localStorage.setItem(SAVE_KEY_OLD, json);
    if (showToast) flashSave("Saved — refresh par yahi layout rahega");
    return true;
  } catch {
    if (showToast) flashSave("Save failed");
    return false;
  }
}

function scheduleSave() {
  if (autosavePaused) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistLayout(false), 450);
}

function readSavedLayout() {
  const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_OLD);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data?.store ? data : null;
  } catch {
    return null;
  }
}

function applySavedState(data) {
  const base = defaultState();
  lastPresetId = data.presetId || lastPresetId || "empty";
  const savedSurfaces = data.store?.surfaces || {};
  const surfaces = { ...base.store.surfaces };
  for (const id of Object.keys(savedSurfaces)) {
    surfaces[id] = { ...(surfaces[id] || {}), ...savedSurfaces[id] };
  }
  state = {
    ...base,
    ...data,
    store: {
      ...base.store,
      ...data.store,
      sign: { ...base.store.sign, ...(data.store?.sign || {}) },
      lighting: { ...base.store.lighting, ...(data.store?.lighting || {}) },
      surfaces,
    },
    doors: Array.isArray(data.doors) && data.doors.length ? data.doors.map((d) => ({ ...d })) : base.doors,
    windows: Array.isArray(data.windows) ? data.windows.map((w) => ({ ...w })) : base.windows,
    furniture: Array.isArray(data.furniture) ? data.furniture.map((item) => ({ ...item })) : [],
  };
  if (state.store.surfaces?.roof?.texture) {
    state.store.surfaces.roof.texture = resolveRoofId(state.store.surfaces.roof.texture);
    state.store.surfaces.roof.color = "#ffffff";
  }
  document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b.dataset.preset === lastPresetId));
  ensureDressDisplays();
}

function ensureDressDisplays() {
  const list = state.furniture || [];
  const dressShop =
    lastPresetId === "dresses" ||
    state.store?.sign?.text === "ATELIER" ||
    list.some((item) => item.type === "dressNiche" || item.type === "marbleIsland");
  if (!dressShop) return;
  const cleaned = list.filter((item) => {
    if (item.type === "mannequinCase" && Math.abs(item.x || 0) <= 1.1 && (item.z || 0) >= 3.4) return false;
    if (item.type === "sofa" && (item.z || 0) >= 3.2) return false;
    return true;
  });
  if (cleaned.length !== list.length) {
    list.length = 0;
    list.push(...cleaned);
  }
  const L = state.store.lighting || {};
  if ((L.sun ?? 0) < 0.45) {
    state.store.lighting = { exposure: 0.88, sun: 0.72, fill: 0.22, hemi: 0.58, warmth: 0.74 };
  }
  const roof = state.store.surfaces?.roof;
  if (roof) {
    roof.texture = resolveRoofId(roof.texture || "roof-stepcove");
    roof.color = "#ffffff";
  }
  for (const item of list) {
    if (item.type === "marbleIsland" && (!item.stock || item.stock === "none")) item.stock = "dresses";
    if (item.type === "dressNiche") {
      item.width = 3.15;
      item.height = 2.24;
      item.depth = 0.46;
      item.color = "#f4eee6";
      item.accent = "#b08968";
      item.stock = "dresses";
      const snaps = [
        [-3.55, -6.82, -3.85, -6.77],
        [3.55, -6.82, 3.85, -6.77],
        [-8.78, -2.55, -8.77, -2.45],
        [-8.78, 2.15, -8.77, 2.15],
        [8.78, -2.55, 8.77, -2.45],
        [8.78, 2.15, 8.77, 2.15],
      ];
      for (const [ox, oz, nx, nz] of snaps) {
        if (Math.hypot((item.x || 0) - ox, (item.z || 0) - oz) < 0.35) {
          item.x = nx;
          item.z = nz;
          break;
        }
      }
    }
    if (item.type === "rack") {
      item.width = item.width >= 1.3 ? 1 : item.width || 1;
      item.height = Math.max(item.height || 0, 1.85);
      item.depth = item.depth || 0.46;
      item.color = "#c6a56a";
      item.accent = "#c6a56a";
      item.stock = "dresses";
    }
  }
  const addIfMissing = (type, x, z, extra) => {
    if (list.some((item) => item.type === type && Math.hypot((item.x || 0) - x, (item.z || 0) - z) < 0.85)) return;
    list.push(newFurniture(type, x, z, extra));
  };
  addIfMissing("glowRunway", -2.55, 4.55, {
    width: 1.35,
    depth: 1.15,
    height: 2.18,
    color: "#e8dcc8",
    accent: "#ffffff",
    stock: "none",
    lightOn: true,
    lightPower: 28,
    lightColor: "#ffffff",
  });
  for (const item of list) {
    if (item.type !== "splitAc") continue;
    item.width = 0.92;
    item.height = 0.29;
    item.depth = 0.21;
    item.color = "#f3f5f7";
  }
  if (!list.some((item) => item.type === "splitAc")) {
    const lift = Math.max(3.4, (state.store.height || 4.8) - 0.88);
    const ac = {
      logoMount: "wall",
      lift,
      width: 0.92,
      height: 0.29,
      depth: 0.21,
      color: "#f3f5f7",
      accent: "#c8ccd2",
      stock: "none",
    };
    list.push(
      newFurniture("splitAc", -8.55, -0.2, { ...ac, logoSnap: "left" }),
      newFurniture("splitAc", 8.55, -0.2, { ...ac, logoSnap: "right" })
    );
  }
  for (const [x, z] of [
    [-5.55, 1.25],
    [5.55, 1.25],
    [-5.55, -2.15],
    [5.55, -2.15],
  ]) {
    addIfMissing("rack", x, z, {
      width: 1,
      height: 1.85,
      depth: 0.46,
      color: "#c6a56a",
      accent: "#c6a56a",
      stock: "dresses",
    });
  }
  state.furniture = list;
}

function saveLocal() {
  persistLayout(true);
}

function loadLocal() {
  const data = readSavedLayout();
  if (!data) {
    flashSave("No saved layout");
    return;
  }
  autosavePaused = true;
  applySavedState(data);
  rebuildAll().finally(() => {
    autosavePaused = false;
    persistLayout(false);
    deselect();
    flashSave("Loaded saved layout");
  });
}

async function restoreLayout() {
  const data = readSavedLayout();
  if (!data) return false;
  const sign = data.store?.sign?.text || "";
  const n = data.furniture?.length || 0;
  const blank = (data.presetId === "empty" || sign === "YOUR STORE") && n <= 1;
  if (blank && (localStorage.getItem(PRESET_KEY) || "mobile") !== "empty") return false;
  applySavedState(data);
  await rebuildAll();
  deselect();
  return true;
}

function applyPreset(id) {
  lastPresetId = id || "mobile";
  try {
    localStorage.setItem(PRESET_KEY, lastPresetId);
  } catch {}
  state = defaultState();
  state.doors[0].id = uid();
  state.windows.forEach((w) => (w.id = uid()));
  const S = state.store.surfaces;
  const f = (type, x, z, extra) => newFurniture(type, x, z, extra);
  const lamp = (type, x, z, extra = {}) =>
    f(type, x, z, {
      lightOn: true,
      lightColor: extra.lightColor || "#ffe6b8",
      lightPower: extra.lightPower ?? 58,
      color: extra.color || "#f4eee6",
      accent: extra.accent || "#c6a56a",
      ...extra,
    });
  const paintWalls = (color, texture = "microcement") => {
    for (const id of ["wall-back", "wall-left", "wall-right"]) {
      S[id].color = color;
      S[id].texture = texture;
      S[id].repeat = 2;
      S[id].finish = "solid";
    }
    S["wall-front"].color = color;
    S["wall-front"].finish = "glass";
  };

  if (id === "empty") {
    state.store.sign.text = "YOUR STORE";
    state.store.sign.fg = "#f3f1ec";
    state.store.sign.bg = "#121214";
    state.store.lighting = { exposure: 0.88, sun: 0.7, fill: 0.16, hemi: 0.68, warmth: 0.8 };
    paintWalls("#f7f1e8", "microcement");
    S.floor.texture = "tz-glossy";
    S.floor.color = "#ffffff";
    S.floor.repeat = 3;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-goldleaf";
    S.roof.repeat = 2;
    state.furniture = [
      f("rack", -6.85, -1.6, { rotY: Math.PI / 2, width: 1.0, height: 1.85, depth: 0.46, stock: "dresses", color: "#c6a56a", accent: "#c6a56a" }),
      f("rack", -6.85, 1.35, { rotY: Math.PI / 2, width: 1.0, height: 1.85, depth: 0.46, stock: "dresses", color: "#c6a56a", accent: "#c6a56a" }),
      f("rack", 6.85, -1.6, { rotY: -Math.PI / 2, width: 1.0, height: 1.85, depth: 0.46, stock: "dresses", color: "#c6a56a", accent: "#c6a56a" }),
      f("rack", 6.85, 1.35, { rotY: -Math.PI / 2, width: 1.0, height: 1.85, depth: 0.46, stock: "dresses", color: "#c6a56a", accent: "#c6a56a" }),
      f("mannequin", -1.7, 4.15, { accent: "#4a1d4e", color: "#f3ece4" }),
      f("mannequin", 0, 4.45, { accent: "#8b1e3f", color: "#f3ece4" }),
      f("mannequin", 1.7, 4.15, { accent: "#1e3a5f", color: "#f3ece4" }),
      f("cube", -2.15, 0.15, { stock: "dresses", color: "#f7f3ec", accent: "#c6a56a", width: 0.85, height: 0.55, depth: 0.85 }),
      f("cube", 2.15, 0.15, { stock: "dresses", color: "#f7f3ec", accent: "#c6a56a", width: 0.85, height: 0.55, depth: 0.85 }),
      f("table", 0, 0.35, { width: 1.35, depth: 1.35, color: "#f7f3ec", accent: "#c6a56a", stock: "dresses" }),
      f("counter", 0, -5.45, { width: 5.2, color: "#6f6964", accent: "#c6a56a" }),
      f("cashier", 6.15, 5.05, { color: "#6f6964", accent: "#c6a56a" }),
      f("glassCase", -3.4, -2.5, { stock: "watches", accent: "#c6a56a", color: "#f7f3ec" }),
      f("glassCase", 3.4, -2.5, { stock: "watches", accent: "#c6a56a", color: "#f7f3ec" }),
      f("shoeIsland", 0, 2.15, { color: "#f4eee6", accent: "#c6a56a" }),
      f("fittingRoom", -6.55, -5.35, { color: "#f7f3ec", accent: "#c6a56a" }),
      f("fittingRoom", 6.55, -5.35, { color: "#f7f3ec", accent: "#c6a56a" }),
      f("mirror", -4.65, -5.25),
      f("mirror", 4.65, -5.25),
      f("bench", 0, 5.35, { color: "#e8ddd0", accent: "#c6a56a" }),
      f("plant", -7.5, 5.5),
      f("plant", 7.5, 5.5),
      f("poster", -7.15, 3.9, { posterText: "NEW IN", color: "#f7f3ec", accent: "#c6a56a", rotY: 0.06 }),
      f("poster", 7.15, 3.9, { posterText: "LUXE", color: "#f7f3ec", accent: "#c6a56a", rotY: -0.06 }),
      f("logo", 0, 6.25, {
        logoLetter: "Y",
        logoStyle: "luxury",
        logoWord: "STORE",
        logoMount: "wall",
        logoSnap: "back",
        color: "#1a1612",
        accent: "#c6a56a",
        lift: 2.35,
        width: 1.05,
      }),
      lamp("pendant", 0, 0.35, { lift: 3.18, lightPower: 72 }),
      lamp("pendant", -2.15, 0.15, { lift: 3.05, lightPower: 52 }),
      lamp("pendant", 2.15, 0.15, { lift: 3.05, lightPower: 52 }),
      lamp("wallSconce", -8.7, 3.55, { logoSnap: "left", lift: 1.82, lightPower: 28 }),
      lamp("wallSconce", 8.7, 3.55, { logoSnap: "right", lift: 1.82, lightPower: 28 }),
    ];
  } else if (id === "mobile") {
    state.store.width = 11.2;
    state.store.depth = 12;
    state.store.height = 4.4;
    state.store.frontStyle = "mobile";
    state.store.sign.text = "UNIVERSAL PHONES";
    state.store.sign.bg = "#102038";
    state.store.sign.fg = "#4ae0ee";
    S["wall-front"].color = "#f4f7fa";
    S["wall-front"].finish = "glass";
    S["wall-back"].color = "#3a2a1e";
    S["wall-back"].texture = "walnut";
    S["wall-back"].repeat = 2;
    S["wall-back"].finish = "solid";
    S["wall-left"].color = "#efeae3";
    S["wall-left"].texture = "silk";
    S["wall-left"].repeat = 2.4;
    S["wall-left"].finish = "solid";
    S["wall-right"].color = "#efeae3";
    S["wall-right"].texture = "silk";
    S["wall-right"].repeat = 2.4;
    S["wall-right"].finish = "solid";
    S.floor.color = "#ffffff";
    S.floor.texture = "tile-charcoal";
    S.floor.repeat = 3.2;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-silk";
    S.roof.repeat = 1;
    state.store.lighting = { exposure: 0.9, sun: 0.54, fill: 0.32, hemi: 0.68, warmth: 0.4 };
    state.doors[0].style = "slide";
    state.doors[0].width = 2.52;
    state.doors[0].height = 2.88;
    state.doors[0].color = "#c8ccd1";
    state.doors[0].glassType = "clear";
    state.doors[0].opacity = 0.07;
    state.windows = [];
    const white = { color: "#f4f6f8", accent: "#1e4d8c", stock: "phones", lightOn: false };
    const bay = {
      color: "#f2f5f8",
      accent: "#c8ccd2",
      stock: "phones",
      lightOn: true,
      lightColor: "#eef4ff",
      lightPower: 14,
    };
    state.furniture = [
      f("haloDesk", 2.12, 3.58, {
        width: 2.35,
        depth: 0.68,
        height: 1.02,
        color: "#111111",
        accent: "#ff7a18",
        stock: "none",
        lightOn: true,
        lightColor: "#5b6bff",
        lightPower: 18,
      }),
      f("ledGlassBay", 5.36, -1.65, { rotY: -Math.PI / 2, width: 3.15, height: 2.28, depth: 0.46, ...bay }),
      f("ledGlassBay", 5.36, 2.25, { rotY: -Math.PI / 2, width: 3.15, height: 2.28, depth: 0.46, ...bay }),
      f("ledGlassBay", -5.36, -1.65, { rotY: Math.PI / 2, width: 3.15, height: 2.28, depth: 0.46, ...bay }),
      f("ledGlassBay", -5.36, 2.25, { rotY: Math.PI / 2, width: 3.15, height: 2.28, depth: 0.46, ...bay }),
      f("phonePedestal", -1.42, 0.12, { width: 1.12, depth: 1.12, height: 0.92, color: "#6a4a2e", accent: "#c6a56a", stock: "laptops", productMap: { top: { category: "laptops", index: 0, scale: 1.72 } } }),
      f("phonePedestal", 1.42, 0.12, { width: 1.12, depth: 1.12, height: 0.92, color: "#6a4a2e", accent: "#c6a56a", stock: "laptops", productMap: { top: { category: "laptops", index: 2, scale: 1.72 } } }),
      f("phonePedestal", 0, -2.28, { width: 1.22, depth: 1.22, height: 0.92, color: "#6a4a2e", accent: "#c6a56a", stock: "laptops", productMap: { top: { category: "laptops", index: 4, scale: 1.72 } } }),
      f("slatSignWall", 0, -5.91, {
        width: 10.4,
        height: 3.55,
        depth: 0.28,
        color: "#4a3426",
        accent: "#dcc8a0",
        stock: "none",
        logoMount: "wall",
        logoSnap: "back",
        rotY: 0,
        lightOn: false,
      }),
      f("ledBanner", 0, 1.15, {
        lift: 3.12,
        width: 2.55,
        height: 0.32,
        depth: 0.05,
        bannerShape: "wide",
        posterText: "TRADE IN",
        color: "#081018",
        accent: "#2ad4e8",
        lightOn: false,
      }),
      f("splitAc", -4.18, -5.91, {
        logoMount: "wall",
        logoSnap: "back",
        lift: 3.78,
        width: 0.94,
        height: 0.3,
        depth: 0.22,
        color: "#f1f3f6",
        accent: "#c8ccd2",
        stock: "none",
        lightOn: false,
      }),
      f("splitAc", 4.18, -5.91, {
        logoMount: "wall",
        logoSnap: "back",
        lift: 3.78,
        width: 0.94,
        height: 0.3,
        depth: 0.22,
        color: "#f1f3f6",
        accent: "#c8ccd2",
        stock: "none",
        lightOn: false,
      }),
      f("hoursPlaque", -2.08, 5.96, {
        logoMount: "wall",
        logoSnap: "front",
        lift: 1.52,
        width: 0.42,
        height: 0.3,
        color: "#081018",
        accent: "#2ad4e8",
      }),
      f("windowVinyl", -3.82, 5.96, {
        logoMount: "wall",
        logoSnap: "front",
        lift: 1.82,
        width: 1.12,
        height: 1.48,
        posterText: "PRO CAMERA",
        color: "#081018",
        accent: "#4ae0ee",
      }),
      f("windowVinyl", 3.82, 5.96, {
        logoMount: "wall",
        logoSnap: "front",
        lift: 1.82,
        width: 1.12,
        height: 1.48,
        posterText: "5G LIVE",
        color: "#081018",
        accent: "#4ae0ee",
      }),
      f("plant", -4.52, 4.7, { pot: "gold", color: "#f4f6f8", accent: "#2f8f5a", height: 1.12, width: 0.5 }),
      f("plant", 4.52, 4.7, { pot: "gold", color: "#f4f6f8", accent: "#2f8f5a", height: 1.12, width: 0.5 }),
      f("bench", -2.28, 4.28, { width: 1.35, depth: 0.46, height: 0.42, color: "#f2f4f6", accent: "#c5c9ce" }),
    ];
  } else if (id === "dresses") {
    state.store.sign.text = "ATELIER";
    state.store.sign.bg = "#121214";
    state.store.sign.fg = "#c6a56a";
    S["wall-front"].color = "#f4f1ea";
    S["wall-front"].finish = "glass";
    S["wall-back"].color = "#ffffff";
    S["wall-back"].texture = "carrara";
    S["wall-back"].finish = "solid";
    S["wall-left"].color = "#ffffff";
    S["wall-left"].texture = "carrara";
    S["wall-left"].finish = "solid";
    S["wall-right"].color = "#ffffff";
    S["wall-right"].texture = "carrara";
    S["wall-right"].finish = "solid";
    S.floor.color = "#ffffff";
    S.floor.texture = "luxury";
    S.floor.repeat = 2;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-stepcove";
    S.roof.repeat = 2;
    state.store.lighting = { exposure: 0.88, sun: 0.72, fill: 0.24, hemi: 0.58, warmth: 0.74 };
    const niche = { color: "#f4eee6", accent: "#b08968", stock: "dresses", width: 3.15, height: 2.24, depth: 0.46 };
    const island = { color: "#f7f3ec", accent: "#c6a56a", stock: "dresses" };
    state.furniture = [
      f("goldArch", 0, -6.78, { width: 1.55, height: 2.95, depth: 0.16, color: "#f7f3ec", accent: "#c6a56a" }),
      f("dressNiche", -3.85, -6.77, { ...niche }),
      f("dressNiche", 3.85, -6.77, { ...niche }),
      f("dressNiche", -8.77, -2.45, { rotY: Math.PI / 2, ...niche }),
      f("dressNiche", -8.77, 2.15, { rotY: Math.PI / 2, ...niche }),
      f("dressNiche", 8.77, -2.45, { rotY: -Math.PI / 2, ...niche }),
      f("dressNiche", 8.77, 2.15, { rotY: -Math.PI / 2, ...niche }),
      f("marbleIsland", 0, 1.25, { width: 3.55, depth: 0.92, height: 0.4, ...island }),
      f("marbleIsland", 0, -2.15, { width: 3.55, depth: 0.92, height: 0.4, ...island }),
      lamp("crystalChandelier", 0, -0.45, {
        width: 1.18,
        depth: 1.18,
        height: 0.52,
        lift: 4.66,
        lightPower: 86,
        lightColor: "#f2f6ff",
        color: "#e8eef4",
        accent: "#c8d0d8",
        stock: "none",
      }),
      f("rack", -5.55, 1.25, { width: 1.0, height: 1.85, depth: 0.46, color: "#c6a56a", accent: "#c6a56a", stock: "dresses" }),
      f("rack", 5.55, 1.25, { width: 1.0, height: 1.85, depth: 0.46, color: "#c6a56a", accent: "#c6a56a", stock: "dresses" }),
      f("rack", -5.55, -2.15, { width: 1.0, height: 1.85, depth: 0.46, color: "#c6a56a", accent: "#c6a56a", stock: "dresses" }),
      f("rack", 5.55, -2.15, { width: 1.0, height: 1.85, depth: 0.46, color: "#c6a56a", accent: "#c6a56a", stock: "dresses" }),
      f("glowRunway", -2.55, 4.55, {
        width: 1.35,
        depth: 1.15,
        height: 2.18,
        color: "#e8dcc8",
        accent: "#ffffff",
        stock: "none",
        lightOn: false,
        lightPower: 0,
      }),
      f("marblePlinth", 5.35, 4.55, { color: "#f7f3ec", accent: "#c6a56a", stock: "shoes" }),
      f("plant", -6.85, 5.25, { pot: "gold", color: "#f7f3ec", accent: "#3f8f5a", height: 1.15, width: 0.55 }),
      f("desk", 6.85, 5.15, { width: 1.45, depth: 0.7, color: "#f3ebe0", accent: "#c6a56a" }),
      f("splitAc", -8.55, -0.2, {
        logoMount: "wall",
        logoSnap: "left",
        lift: 3.92,
        width: 0.92,
        height: 0.29,
        depth: 0.21,
        color: "#f3f5f7",
        accent: "#c8ccd2",
        stock: "none",
      }),
      f("splitAc", 8.55, -0.2, {
        logoMount: "wall",
        logoSnap: "right",
        lift: 3.92,
        width: 0.92,
        height: 0.29,
        depth: 0.21,
        color: "#f3f5f7",
        accent: "#c8ccd2",
        stock: "none",
      }),
      f("logo", 0, -6.91, {
        logoLetter: "A",
        logoStyle: "luxury",
        logoWord: "ATELIER",
        logoMount: "wall",
        logoSnap: "back",
        rotY: 0,
        color: "#121214",
        accent: "#c6a56a",
        lift: 3.42,
        width: 0.62,
      }),
    ];
  } else if (id === "shoes") {
    state.store.sign.text = "SOLE STUDIO";
    state.store.sign.bg = "#1a120c";
    state.store.sign.fg = "#e8d5b0";
    state.store.lighting = { exposure: 0.84, sun: 0.64, fill: 0.16, hemi: 0.66, warmth: 0.84 };
    paintWalls("#f3ebe0", "microcement");
    S.floor.color = "#ffffff";
    S.floor.texture = "herringbone";
    S.floor.repeat = 5;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-walnutinlay";
    S.roof.repeat = 2;
    state.doors[0].color = "#c6a56a";
    state.furniture = [
      f("cashier", 5.0, 4.7, { color: "#d9cbb8" }),
      f("counter", -3.6, -4.8, { width: 3.4, color: "#d9cbb8" }),
      f("shoeWall", -7.3, -0.2, { rotY: -Math.PI / 2, stock: "shoes" }),
      f("shoeWall", -7.3, 2.4, { rotY: -Math.PI / 2, stock: "shoes" }),
      f("shoeWall", 7.3, -0.2, { rotY: Math.PI / 2, stock: "shoes" }),
      f("shoeWall", 7.3, 2.4, { rotY: Math.PI / 2, stock: "shoes" }),
      f("shoeIsland", -2.4, 0.4),
      f("shoeIsland", 2.4, 0.4),
      f("shoeIsland", 0, 2.6, { width: 1.8 }),
      f("mirror", -4.2, 4.6),
      f("mirror", 4.2, 4.6),
      f("bench", 0, 4.9),
      f("cube", 0, -2.2, { stock: "shoes", color: "#1c1916", width: 0.9, depth: 0.9, height: 0.55 }),
      f("poster", -6.5, 5.0, { posterText: "SNEAKERS", color: "#1a120c" }),
      f("poster", 6.5, 5.0, { posterText: "FORMAL", color: "#1a120c" }),
      f("plant", -7.3, 5.2),
      f("plant", 7.3, 5.2),
      f("fittingRoom", 6.6, -4.7, { accent: "#5c3317" }),
      f("logo", 0, 5.6, {
        logoLetter: "S",
        logoStyle: "shield",
        logoWord: "SOLE",
        logoMount: "wall",
        logoSnap: "back",
        color: "#1a120c",
        accent: "#d4b07a",
        lift: 2.15,
        width: 0.9,
      }),
      lamp("pendant", -2.4, 0.4, { lift: 3.05, lightPower: 54 }),
      lamp("pendant", 2.4, 0.4, { lift: 3.05, lightPower: 54 }),
      lamp("pendant", 0, 2.6, { lift: 3.12, lightPower: 62 }),
    ];
  } else if (id === "watches") {
    state.store.sign.text = "AURUM GENESIS";
    state.store.sign.bg = "#100e0c";
    state.store.sign.fg = "#d4af37";
    S["wall-front"].color = "#141210";
    S["wall-front"].finish = "glass";
    S["wall-front"].opacity = 0.06;
    S["wall-back"].color = "#171412";
    S["wall-left"].color = "#171412";
    S["wall-right"].color = "#171412";
    S.floor.color = "#ffffff";
    S.floor.texture = "terrazzo-noir";
    S.floor.repeat = 2.4;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-noir";
    S.roof.repeat = 2;
    S["wall-back"].texture = "tadelakt";
    S["wall-back"].repeat = 1.6;
    S["wall-left"].texture = "tadelakt";
    S["wall-left"].repeat = 1.6;
    S["wall-right"].texture = "tadelakt";
    S["wall-right"].repeat = 1.6;
    state.store.lighting = { exposure: 0.86, sun: 0.62, fill: 0.18, hemi: 0.5, warmth: 0.74 };
    state.doors[0].style = "double";
    state.doors[0].color = "#d4af37";
    state.doors[0].glassColor = "#dce4ea";
    const dark = { color: "#1a1410", accent: "#d4af37", stock: "watches", lightColor: "#ffe4ae" };
    const wallCase = { ...dark, lightOn: true, width: 1.78, depth: 0.38, height: 1.18, watchScale: 0.92, lightPower: 16 };
    state.furniture = [
      f("watchTower", 0, 0.85, {
        width: 0.5,
        depth: 0.5,
        height: 1.05,
        ...dark,
        lightOn: true,
        watchIndex: 0,
        watchScale: 1.28,
        posterText: "AURUM GENESIS",
        lightPower: 28,
      }),
      lamp("pendant", 0, 0.85, { lift: 3.08, lightColor: "#ffe6b0", lightPower: 52, accent: "#d4af37", width: 0.48 }),
      lamp("ceilingCan", -3.55, -0.85, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 34, accent: "#d4af37" }),
      lamp("ceilingCan", -3.55, 1.75, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 34, accent: "#d4af37" }),
      lamp("ceilingCan", 3.55, -0.85, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 34, accent: "#d4af37" }),
      lamp("ceilingCan", 3.55, 1.75, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 34, accent: "#d4af37" }),
      lamp("ceilingCan", 0, 3.65, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 30, accent: "#d4af37" }),
      lamp("ceilingCan", -2.15, -3.15, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 28, accent: "#d4af37" }),
      lamp("ceilingCan", 2.15, -3.15, { lift: 4.58, lightColor: "#ffe6b0", lightPower: 28, accent: "#d4af37" }),
      f("glassCase", -3.55, -0.85, { rotY: Math.PI / 2, ...wallCase, posterText: "OR", watchIndex: 10 }),
      f("glassCase", -3.55, 1.75, { rotY: Math.PI / 2, ...wallCase, posterText: "GMT", watchIndex: 20 }),
      f("glassCase", 3.55, -0.85, { rotY: -Math.PI / 2, ...wallCase, posterText: "DRESS", watchIndex: 30 }),
      f("glassCase", 3.55, 1.75, { rotY: -Math.PI / 2, ...wallCase, posterText: "DIVER", watchIndex: 40 }),
      f("glassCase", -2.15, -3.15, { ...wallCase, lightOn: false, width: 1.58, posterText: "HERITAGE", watchIndex: 50 }),
      f("glassCase", 2.15, -3.15, { ...wallCase, lightOn: false, width: 1.58, posterText: "LINE", watchIndex: 60 }),
      f("logoMat", 0, 5.55, { width: 2.4, depth: 1.2, posterText: "AURUM GENESIS", color: "#100e0c", accent: "#d4af37" }),
      f("securityGate", 0, 5.28, { width: 2.5, color: "#11141a", accent: "#d4af37" }),
      f("hoursPlaque", -2.15, 6.91, {
        logoMount: "wall",
        logoSnap: "front",
        rotY: Math.PI,
        lift: 1.52,
        width: 0.42,
        height: 0.32,
        color: "#100e0c",
        accent: "#d4af37",
      }),
      f("windowVinyl", -5.7, 6.91, {
        logoMount: "wall",
        logoSnap: "front",
        rotY: Math.PI,
        lift: 1.78,
        width: 1.7,
        height: 2.05,
        posterText: "AURUM",
        accent: "#d4af37",
      }),
      f("windowVinyl", 5.7, 6.91, {
        logoMount: "wall",
        logoSnap: "front",
        rotY: Math.PI,
        lift: 1.78,
        width: 1.7,
        height: 2.05,
        posterText: "PRIVATE VIEW",
        accent: "#d4af37",
      }),
      f("watchTower", -1.55, 2.45, { width: 0.42, depth: 0.42, height: 0.96, ...dark, lightOn: true, watchIndex: 3, watchScale: 1.18, posterText: "AURUM", lightPower: 18 }),
      f("watchTower", 1.55, 2.45, { width: 0.42, depth: 0.42, height: 0.96, ...dark, lightOn: true, watchIndex: 7, watchScale: 1.18, posterText: "GENESIS", lightPower: 18 }),
      f("goldArch", 0, -6.78, { width: 1.7, height: 2.9, depth: 0.16, color: "#1a1612", accent: "#d4af37" }),
      f("desk", 5.55, -5.15, { width: 1.55, color: "#1a1410", accent: "#d4af37", liveCheckout: true }),
      f("cashier", 5.55, 4.35, { color: "#1a1410", accent: "#d4af37" }),
      f("plant", -7.45, 5.45, { pot: "gold", accent: "#2f5d50", height: 1.05, width: 0.48 }),
      f("plant", 7.45, 5.45, { pot: "gold", accent: "#2f5d50", height: 1.05, width: 0.48 }),
      f("logo", 0, -6.91, {
        logoLetter: "A",
        logoStyle: "seal",
        logoWord: "AURUM",
        logoMount: "wall",
        logoSnap: "back",
        color: "#100e0c",
        accent: "#d4af37",
        lift: 3.28,
        width: 0.72,
      }),
    ];
  } else if (id === "cafe") {
    state.store.sign.text = "COFFEE BAR";
    state.store.sign.bg = "#3b2418";
    state.store.sign.fg = "#f3e6d4";
    state.store.lighting = { exposure: 0.82, sun: 0.62, fill: 0.14, hemi: 0.62, warmth: 0.88 };
    S["wall-front"].color = "#f6ebe0";
    S["wall-front"].finish = "glass";
    S["wall-back"].texture = "brick";
    S["wall-back"].color = "#ffffff";
    S["wall-back"].repeat = 4;
    S["wall-left"].color = "#f6ebe0";
    S["wall-left"].texture = "clay";
    S["wall-right"].color = "#f6ebe0";
    S["wall-right"].texture = "clay";
    S.floor.texture = "walnut";
    S.floor.color = "#ffffff";
    S.floor.repeat = 5;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-walnutinlay";
    S.roof.repeat = 2;
    state.furniture = [
      f("counter", 0, -4.5, { width: 6.2, color: "#5b3a29", accent: "#c4a574", stock: "cafe" }),
      f("shelf", -7.3, 0.6, { rotY: Math.PI / 2, width: 2.2, height: 1.9, color: "#efe8dc", accent: "#5b3a29", stock: "cafe" }),
      f("shelf", 7.3, 0.6, { rotY: -Math.PI / 2, width: 2.2, height: 1.9, color: "#efe8dc", accent: "#5b3a29", stock: "cafe" }),
      f("table", -3.6, 0.6, { width: 0.8, depth: 0.8, height: 0.75, color: "#efe8dc", stock: "cafe" }),
      f("table", 0, 0.6, { width: 0.8, depth: 0.8, height: 0.75, color: "#5b3a29", stock: "cafe" }),
      f("table", 3.6, 0.6, { width: 0.8, depth: 0.8, height: 0.75, color: "#efe8dc", stock: "cafe" }),
      f("table", -3.6, 3.2, { width: 0.8, depth: 0.8, height: 0.75, color: "#5b3a29", stock: "cafe" }),
      f("table", 3.6, 3.2, { width: 0.8, depth: 0.8, height: 0.75, color: "#efe8dc", stock: "cafe" }),
      f("plant", 6.8, -4.8),
      f("logo", 0, 0, {
        logoLetter: "C",
        logoStyle: "banner",
        logoWord: "COFFEE",
        logoMount: "wall",
        logoSnap: "back",
        color: "#3b2418",
        accent: "#e8c9a0",
        lift: 2.1,
      }),
      lamp("pendant", -3.6, 0.6, { lift: 2.55, lightColor: "#ffd8a8", lightPower: 42, accent: "#c4a574" }),
      lamp("pendant", 0, 0.6, { lift: 2.55, lightColor: "#ffd8a8", lightPower: 42, accent: "#c4a574" }),
      lamp("pendant", 3.6, 0.6, { lift: 2.55, lightColor: "#ffd8a8", lightPower: 42, accent: "#c4a574" }),
      lamp("pendant", -3.6, 3.2, { lift: 2.55, lightColor: "#ffd8a8", lightPower: 38, accent: "#c4a574" }),
      lamp("pendant", 3.6, 3.2, { lift: 2.55, lightColor: "#ffd8a8", lightPower: 38, accent: "#c4a574" }),
    ];
  } else if (id === "grocery") {
    state.store.sign.text = "FRESH MART";
    state.store.sign.bg = "#1f5a3a";
    state.store.sign.fg = "#f6f3ea";
    state.store.lighting = { exposure: 0.88, sun: 0.68, fill: 0.2, hemi: 0.7, warmth: 0.52 };
    paintWalls("#f7f4ee", "drywall");
    S.floor.texture = "tz-sage";
    S.floor.color = "#ffffff";
    S.floor.repeat = 3;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-champagne";
    S.roof.repeat = 2;
    state.furniture = [
      newFurniture("cashier", 4.2, 4.6),
      newFurniture("shelf", -3.4, -0.4),
      newFurniture("shelf", 0, -0.4),
      newFurniture("shelf", 3.4, -0.4),
      newFurniture("shelf", -3.4, 1.8),
      newFurniture("shelf", 0, 1.8),
      newFurniture("shelf", 3.4, 1.8),
      newFurniture("counter", -4.4, -4.6),
      newFurniture("logo", 0, 0, {
        logoLetter: "F",
        logoStyle: "circle",
        logoWord: "FRESH",
        logoMount: "wall",
        logoSnap: "back",
        color: "#1f5a3a",
        accent: "#f4efe6",
        lift: 2.1,
      }),
    ];
    state.furniture.forEach((item) => {
      if (item.type === "shelf") {
        item.width = 1.4;
        item.depth = 0.5;
        item.height = 1.7;
        item.stock = "grocery";
        item.color = "#f7f4ee";
        item.accent = "#1f5a3a";
      }
      if (item.type === "counter") {
        item.stock = "grocery";
        item.color = "#f7f4ee";
        item.accent = "#1f5a3a";
      }
      if (item.type === "cashier") {
        item.color = "#f7f4ee";
        item.accent = "#1f5a3a";
      }
    });
    state.furniture.push(
      lamp("ceilingCan", -3.4, 0.7, { lift: 4.52, lightColor: "#fff6e8", lightPower: 70 }),
      lamp("ceilingCan", 0, 0.7, { lift: 4.52, lightColor: "#fff6e8", lightPower: 70 }),
      lamp("ceilingCan", 3.4, 0.7, { lift: 4.52, lightColor: "#fff6e8", lightPower: 70 })
    );
  } else if (id === "pharmacy") {
    state.store.sign.text = "CARE PLUS";
    state.store.sign.bg = "#163a5f";
    state.store.sign.fg = "#e8f4fc";
    state.store.lighting = { exposure: 0.9, sun: 0.62, fill: 0.22, hemi: 0.72, warmth: 0.26 };
    paintWalls("#f4f8fb", "silk");
    S.floor.color = "#ffffff";
    S.floor.texture = "tile-white";
    S.floor.repeat = 4;
    S.roof.color = "#ffffff";
    S.roof.texture = "roof-pearl";
    S.roof.repeat = 2;
    state.furniture = [
      newFurniture("counter", 0, -4.4),
      newFurniture("shelf", -7.0, 0.2),
      newFurniture("shelf", 7.0, 0.2),
      newFurniture("shelf", -7.0, 2.4),
      newFurniture("shelf", 7.0, 2.4),
      newFurniture("desk", 3.6, 4.4),
      newFurniture("plant", -7.1, 5.0),
      newFurniture("logo", 0, 0, {
        logoLetter: "C",
        logoStyle: "square",
        logoWord: "CARE",
        logoMount: "wall",
        logoSnap: "back",
        color: "#163a5f",
        accent: "#e8f4fc",
        lift: 2.1,
      }),
    ];
    state.furniture[0].width = 5.2;
    state.furniture[0].color = "#ffffff";
    state.furniture.forEach((item) => {
      if (item.type === "shelf") {
        item.rotY = item.x > 0 ? -Math.PI / 2 : Math.PI / 2;
        item.color = "#f7fbff";
        item.accent = "#163a5f";
        item.stock = "pharmacy";
      }
      if (item.type === "counter" || item.type === "desk") {
        item.stock = "pharmacy";
        item.accent = "#163a5f";
      }
    });
    state.furniture.push(
      lamp("ceilingCan", -3.2, 0.8, { lift: 4.52, lightColor: "#e8f4ff", lightPower: 74 }),
      lamp("ceilingCan", 3.2, 0.8, { lift: 4.52, lightColor: "#e8f4ff", lightPower: 74 }),
      lamp("ceilingCan", 0, -1.6, { lift: 4.52, lightColor: "#e8f4ff", lightPower: 74 })
    );
  } else {
    state.store.sign.text = "YOUR STORE";
    state.furniture = [newFurniture("desk", 0, 2.2)];
  }
  state.furniture.forEach((item) => {
    item.id = uid();
    if ((item.type === "logo" || item.type === "wallSconce" || item.type === "ledBanner" || item.type === "windowVinyl" || item.type === "hoursPlaque" || item.type === "slatSignWall" || item.type === "splitAc") && item.logoSnap) {
      snapLogoToWall(item, item.logoSnap);
    }
  });
  rebuildAll().then(() => {
    persistLayout(false);
    frameFullStore();
    invalidate(900);
  });
  deselect();
}

function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function resize() {
  const wrap = canvas.parentElement;
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(currentDpr());
  renderer.setSize(w, h, false);
  invalidate(400);
}

function onPointer(event) {
  if (transform.dragging || viewMode === "walk") return;
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects([...roomRoot.children, ...furnitureRoot.children], true);
  const hit = hits.find((h) => findSelectable(h.object));
  if (!hit) return deselect();
  select(findSelectable(hit.object));
}

function bindUI() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.querySelector(":scope > .ico")) return;
    el.insertAdjacentHTML("afterbegin", ico(el.dataset.icon));
  });
  const closeIco = document.querySelector(".panel-toggle-close");
  const openIco = document.querySelector(".panel-toggle-open");
  if (closeIco) closeIco.innerHTML = ICONS.chevronRight;
  if (openIco) openIco.innerHTML = ICONS.chevronLeft;

  const brand = document.querySelector(".brand-mark");
  if (brand && !brand.querySelector(".ico")) brand.innerHTML = ico("empty");
  const emptyMark = document.querySelector(".empty-mark");
  if (emptyMark && !emptyMark.querySelector(".ico")) emptyMark.innerHTML = ico("orbit");

  document.getElementById("preset-grid").innerHTML = PRESETS.map(
    (p) =>
      `<button type="button" class="preset-btn" data-preset="${p.id}"><span class="tile-ico">${ico(p.id)}</span>${p.label}</button>`
  ).join("");
  document.getElementById("preset-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (btn) {
      document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b === btn));
      applyPreset(btn.dataset.preset);
    }
  });

  const catalogBtn = (c) =>
    `<button type="button" class="catalog-btn" data-type="${c.type}"><span class="tile-ico">${ico(c.type)}</span><span class="cat-copy">${c.label}<small>${c.hint}</small></span></button>`;
  const lamps = CATALOG.filter((c) => isLightFixture(c.type));
  const rest = CATALOG.filter((c) => !isLightFixture(c.type));
  const catalog = [
    { type: "door", label: "Door", hint: "Any wall" },
    { type: "window", label: "Window", hint: "Any wall" },
    ...rest,
  ];
  document.getElementById("light-catalog").innerHTML = lamps.map(catalogBtn).join("");
  document.getElementById("catalog").innerHTML = catalog.map(catalogBtn).join("");
  const addFromClick = (e) => {
    const btn = e.target.closest("[data-type]");
    if (btn) addFromCatalog(btn.dataset.type);
  };
  document.getElementById("light-catalog").addEventListener("click", addFromClick);
  document.getElementById("catalog").addEventListener("click", addFromClick);

  const sw = document.getElementById("material-swatches");
  fillSwatchGrid(sw, MATERIALS);
  const furnSw = document.getElementById("furn-swatches");
  fillSwatchGrid(furnSw, FLOOR_MATERIALS);
  furnSw.addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch");
    if (!btn || !selected || selected.kind !== "furniture") return;
    const item = state.furniture.find((f) => f.id === selected.id);
    if (!item) return;
    item.texture = btn.dataset.id;
    if (isShineTexture(item.texture)) item.color = "#ffffff";
    rebuildFurniture();
    fillProps();
    select(findById(item.id));
  });
  sw.addEventListener("click", async (e) => {
    const btn = e.target.closest(".swatch");
    const surface = currentSurface();
    if (!btn || !surface) return;
    surface.texture = btn.dataset.id;
    surface.image = null;
    if (isShineTexture(surface.texture) || selected.id === "floor" || selected.id === "roof") {
      surface.color = "#ffffff";
      if (isRoofTexture(surface.texture)) {
        const roofId = resolveRoofId(surface.texture);
        surface.texture = roofId;
        surface.repeat = roofId === "roof-walnutinlay" || roofId === "roof-bronze" || roofId === "roof-fluted" ? 6 : 2;
      } else {
        surface.repeat = isTileTexture(surface.texture) ? 4 : Math.max(surface.repeat || 1, 3);
      }
    }
    await applyAllSurfaces();
    if (selected.kind === "roof" || selected.id === "roof") rebuildRoom();
    fillProps();
  });

  document.querySelectorAll("[data-select]").forEach((btn) => {
    btn.addEventListener("click", () => select(findById(btn.dataset.select)));
  });
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
  document.querySelectorAll("[data-walk-who]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      chooseWalkWho(btn.dataset.walkWho);
    });
  });

  const size = (id, key) => {
    const el = document.getElementById(id);
    const apply = debounce(() => {
      clampItems();
      rebuildRoom();
      rebuildFurniture();
    }, 80);
    el.addEventListener("input", () => {
      state.store[key] = Number(el.value);
      syncStoreSliders();
      apply();
    });
  };
  size("store-width", "width");
  size("store-depth", "depth");
  size("store-height", "height");

  const bindShopLight = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      if (uiLock) return;
      shopLighting();
      state.store.lighting[key] = Number(el.value);
      applyShopLighting();
      syncStoreSliders();
    });
  };
  bindShopLight("lit-exposure", "exposure");
  bindShopLight("lit-sun", "sun");
  bindShopLight("lit-fill", "fill");
  bindShopLight("lit-hemi", "hemi");
  bindShopLight("lit-warmth", "warmth");

  document.getElementById("btn-roof").addEventListener("click", () => {
    state.store.roofVisible = !(state.store.roofVisible !== false);
    rebuildRoom();
    syncStoreSliders();
  });
  document.getElementById("btn-grid").addEventListener("click", () => {
    grid.visible = !grid.visible;
  });
  const setMenuHidden = (hidden) => {
    const app = document.getElementById("app");
    app.classList.toggle("is-fs", hidden);
    document.getElementById("btn-fs").classList.toggle("active", hidden);
    resize();
  };
  document.getElementById("btn-fs").addEventListener("click", () => setMenuHidden(true));
  document.getElementById("btn-show-menu").addEventListener("click", () => setMenuHidden(false));
  document.getElementById("btn-panel").addEventListener("click", () => {
    const app = document.getElementById("app");
    const closed = app.classList.toggle("panel-closed");
    document.getElementById("btn-panel").title = closed ? "Show panel" : "Hide panel";
    closeObjectMenu();
    resize();
  });
  document.getElementById("object-trigger").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleObjectMenu();
  });
  document.addEventListener("click", (e) => {
    const picker = document.getElementById("objects-picker");
    if (picker && !picker.contains(e.target)) closeObjectMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeObjectMenu();
  });
  window.addEventListener("resize", positionObjectMenu);
  document.querySelector(".panel")?.addEventListener("scroll", positionObjectMenu);
  document.getElementById("btn-reset-cam").addEventListener("click", () => setView("orbit"));
  document.getElementById("btn-save").addEventListener("click", saveLocal);
  document.getElementById("btn-load").addEventListener("click", loadLocal);
  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(serializable(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "store-layout.json";
    a.click();
  });
  document.getElementById("input-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    state = JSON.parse(await file.text());
    await rebuildAll();
    persistLayout(true);
    deselect();
  });
  document.getElementById("btn-new").addEventListener("click", () => {
    lastPresetId = "empty";
    applyPreset("empty");
    persistLayout(true);
    flashSave("New store");
    setView("orbit");
  });

  document.getElementById("mode-translate").addEventListener("click", () => setMode("translate"));
  document.getElementById("mode-rotate").addEventListener("click", () => setMode("rotate"));
  document.getElementById("mode-scale").addEventListener("click", () => setMode("scale"));

  document.getElementById("surface-color").addEventListener("input", (e) => {
    const surface = currentSurface();
    if (!surface || uiLock) return;
    const keys =
      document.getElementById("surface-all-walls").checked && selected.kind === "wall"
        ? ["wall-front", "wall-back", "wall-left", "wall-right"]
        : [selected.kind === "wall" ? selected.id : selected.kind];
    let needRebuild = false;
    for (const key of keys) {
      state.store.surfaces[key].color = e.target.value;
      materials[key].color.set(e.target.value);
      if (state.store.surfaces[key].finish === "glass" || state.store.surfaces[key].finish === "mirror") {
        needRebuild = true;
      }
    }
    if (needRebuild) rebuildRoom();
    else scheduleSave();
  });
  const wallFinishUpdate = () => {
    const surface = currentSurface();
    if (!surface || uiLock || selected.kind !== "wall") return;
    surface.finish = document.getElementById("surface-finish").value;
    surface.opacity = Number(document.getElementById("surface-opacity").value);
    document.getElementById("val-wall-op").textContent = `${Math.round(surface.opacity * 100)}%`;
    rebuildRoom();
    select(findById(selected.id));
  };
  document.getElementById("surface-finish").addEventListener("change", wallFinishUpdate);
  document.getElementById("surface-opacity").addEventListener("input", wallFinishUpdate);
  document.getElementById("surface-repeat").addEventListener("input", async (e) => {
    const surface = currentSurface();
    if (!surface || uiLock) return;
    surface.repeat = Number(e.target.value);
    document.getElementById("val-repeat").textContent = surface.repeat.toFixed(1);
    await applyAllSurfaces();
  });
  document.getElementById("surface-image").addEventListener("change", async (e) => {
    const surface = currentSurface();
    const file = e.target.files[0];
    if (!surface || !file) return;
    const loaded = await loadImageBitmap(file);
    surface.image = loaded.dataUrl;
    surface.texture = "drywall";
    imageCache.set(loaded.dataUrl, loaded.texture);
    await applyAllSurfaces();
  });
  document.getElementById("btn-clear-image").addEventListener("click", async () => {
    const surface = currentSurface();
    if (!surface) return;
    surface.image = null;
    await applyAllSurfaces();
  });

  const signUpdate = () => {
    if (uiLock) return;
    state.store.sign.text = document.getElementById("sign-text").value;
    state.store.sign.fg = document.getElementById("sign-fg").value;
    state.store.sign.bg = document.getElementById("sign-bg").value;
    rebuildRoom();
    syncHud();
  };
  document.getElementById("sign-text").addEventListener("input", signUpdate);
  document.getElementById("sign-fg").addEventListener("input", signUpdate);
  document.getElementById("sign-bg").addEventListener("input", signUpdate);

  const doorUpdate = () => {
    if (uiLock || !selected || selected.kind !== "door") return;
    const door = state.doors.find((d) => d.id === selected.id);
    if (!door) return;
    door.style = document.getElementById("door-style").value;
    door.wall = document.getElementById("door-wall").value;
    door.glassType = document.getElementById("door-glass").value;
    door.glassColor = document.getElementById("door-glass-color").value;
    door.opacity = Number(document.getElementById("door-opacity").value);
    door.pos = Number(document.getElementById("door-pos").value);
    door.width = Number(document.getElementById("door-w").value);
    door.height = Number(document.getElementById("door-h").value);
    rebuildRoom();
    fillProps();
    select(findById(door.id));
  };
  ["door-style", "door-wall", "door-glass", "door-glass-color", "door-opacity", "door-pos", "door-w", "door-h"].forEach((id) => {
    document.getElementById(id).addEventListener("input", doorUpdate);
    document.getElementById(id).addEventListener("change", doorUpdate);
  });
  document.getElementById("btn-toggle-door").addEventListener("click", () => {
    const door = state.doors.find((d) => selected && d.id === selected.id);
    if (!door) return;
    door.open = !door.open;
    rebuildRoom();
    select(findById(door.id));
  });
  document.getElementById("btn-delete-door").addEventListener("click", deleteSelected);

  const winUpdate = () => {
    if (uiLock || !selected || selected.kind !== "window") return;
    const win = state.windows.find((w) => w.id === selected.id);
    if (!win) return;
    win.wall = document.getElementById("window-wall").value;
    win.glassType = document.getElementById("window-glass").value;
    win.glassColor = document.getElementById("window-color").value;
    win.color = win.glassColor;
    win.opacity = Number(document.getElementById("window-opacity").value);
    win.pos = Number(document.getElementById("window-pos").value);
    win.width = Number(document.getElementById("window-w").value);
    win.height = Number(document.getElementById("window-h").value);
    rebuildRoom();
    fillProps();
    select(findById(win.id));
  };
  ["window-wall", "window-glass", "window-color", "window-opacity", "window-pos", "window-w", "window-h"].forEach((id) => {
    document.getElementById(id).addEventListener("input", winUpdate);
    document.getElementById(id).addEventListener("change", winUpdate);
  });
  document.getElementById("btn-delete-window").addEventListener("click", deleteSelected);

  const furnRebuild = debounce(() => {
    if (!selected || selected.kind !== "furniture") return;
    const id = selected.id;
    rebuildFurniture();
    fillProps();
    select(findById(id));
  }, 70);
  const furnUpdate = () => {
    if (uiLock || !selected || selected.kind !== "furniture") return;
    const item = state.furniture.find((f) => f.id === selected.id);
    if (!item) return;
    item.color = document.getElementById("furn-color").value;
    item.accent = document.getElementById("furn-accent").value;
    item.stock = document.getElementById("furn-stock").value;
    item.width = Number(document.getElementById("furn-w").value);
    item.depth = Number(document.getElementById("furn-d").value);
    item.height = Number(document.getElementById("furn-h").value);
    if (item.type === "logo") {
      item.logoLetter = (document.getElementById("logo-letter").value || "A").toUpperCase().slice(0, 3);
      item.logoStyle = document.getElementById("logo-style").value;
      item.logoWord = document.getElementById("logo-word").value;
      item.logoMount = document.getElementById("logo-mount").value;
      item.lift = Number(document.getElementById("logo-lift").value);
      const snap = document.getElementById("logo-snap").value;
      if (snap !== (item.logoSnap || "")) snapLogoToWall(item, snap);
      else item.logoSnap = snap;
    }
    if (item.type === "ledBanner" || item.type === "ledDesk") {
      item.posterText = document.getElementById("banner-text").value;
      const nextShape = document.getElementById("banner-shape").value;
      if (nextShape !== (item.bannerShape || "portrait")) {
        item.bannerShape = nextShape;
        if (item.type === "ledBanner") {
          item.width = nextShape === "wide" ? 1.85 : 0.72;
          item.height = nextShape === "wide" ? 0.4 : 1.52;
        } else {
          item.width = nextShape === "wide" ? 0.62 : 0.36;
          item.height = nextShape === "wide" ? 0.28 : 0.52;
        }
      } else {
        item.bannerShape = nextShape;
      }
      item.lift = Number(document.getElementById("banner-lift").value);
      if (item.type === "ledBanner") {
        const snap = document.getElementById("banner-snap").value;
        if (snap !== (item.logoSnap || "")) snapLogoToWall(item, snap);
        else item.logoSnap = snap;
      }
    }
    if (isLamp(item.type)) {
      item.lightOn = document.getElementById("light-on").checked;
      item.lightColor = document.getElementById("light-color").value;
      item.lightPower = Number(document.getElementById("light-power").value);
      if (item.type !== "light" && item.type !== "ledBanner" && item.type !== "ledDesk") {
        item.lift = Number(document.getElementById("light-lift").value);
      }
      if (item.type === "wallSconce") {
        const snap = document.getElementById("light-snap").value;
        if (snap !== (item.logoSnap || "")) snapLogoToWall(item, snap);
        else item.logoSnap = snap;
      }
    }
    furnRebuild();
  };
  document.getElementById("furn-rot").addEventListener("input", () => {
    if (uiLock || !selected || selected.kind !== "furniture") return;
    const item = state.furniture.find((f) => f.id === selected.id);
    if (item) applyFurnRotation(item, document.getElementById("furn-rot").value);
  });
  document.getElementById("furn-rot-snaps").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rot]");
    if (!btn || !selected || selected.kind !== "furniture") return;
    const item = state.furniture.find((f) => f.id === selected.id);
    if (!item) return;
    const raw = btn.dataset.rot;
    const current = rotDeg(item.rotY);
    const next = raw.startsWith("+") || raw.startsWith("-") ? current + Number(raw) : Number(raw);
    applyFurnRotation(item, next);
  });
  ["furn-color", "furn-accent", "furn-stock", "furn-w", "furn-d", "furn-h", "logo-letter", "logo-style", "logo-word", "logo-mount", "logo-snap", "logo-lift", "banner-text", "banner-shape", "banner-snap", "banner-lift", "light-on", "light-color", "light-power", "light-lift", "light-snap"].forEach((id) => {
    document.getElementById(id).addEventListener("input", furnUpdate);
    document.getElementById(id).addEventListener("change", furnUpdate);
  });
  document.getElementById("logo-style").innerHTML = LOGO_STYLES.map(
    (s) => `<option value="${s.id}">${s.label}</option>`
  ).join("");
  document.getElementById("logo-letters").innerHTML = LETTERS.map(
    (L) => `<button type="button" class="letter-btn" data-letter="${L}">${L}</button>`
  ).join("");
  document.getElementById("logo-letters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-letter]");
    const item = state.furniture.find((f) => selected && f.id === selected.id);
    if (!btn || !item || item.type !== "logo") return;
    item.logoLetter = btn.dataset.letter;
    document.getElementById("logo-letter").value = item.logoLetter;
    rebuildFurniture();
    fillProps();
    select(findById(item.id));
  });
  document.getElementById("btn-clear-logo").addEventListener("click", () => {
    const item = state.furniture.find((f) => selected && f.id === selected.id);
    if (!item) return;
    item.image = null;
    item._map = null;
    rebuildFurniture();
    select(findById(item.id));
  });
  document.getElementById("furn-image").addEventListener("change", async (e) => {
    const item = state.furniture.find((f) => selected && f.id === selected.id);
    const file = e.target.files[0];
    if (!item || !file) return;
    const loaded = await loadImageBitmap(file);
    item.image = loaded.dataUrl;
    item._map = loaded.texture;
    if (item.type === "logo") item.logoStyle = "plain";
    rebuildFurniture();
    select(findById(item.id));
  });
  document.getElementById("btn-duplicate").addEventListener("click", duplicateSelected);
  document.getElementById("btn-delete-furn").addEventListener("click", deleteSelected);
  document.getElementById("prod-action-mode").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-prod-mode]");
    if (!btn || !selected || selected.kind !== "product") return;
    document.getElementById("prod-swap-grid").dataset.mode = btn.dataset.prodMode;
    fillProductSwap();
  });
  document.getElementById("prod-swap-cats").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-swap-tab]");
    if (!btn || !selected || selected.kind !== "product") return;
    document.getElementById("prod-swap-grid").dataset.cat = btn.dataset.swapTab;
    fillProductSwap();
  });
  document.getElementById("prod-swap-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-swap-cat]");
    if (!btn) return;
    const grid = document.getElementById("prod-swap-grid");
    if (grid.dataset.mode === "add") addProductToDesk(btn.dataset.swapCat, btn.dataset.swapI);
    else replaceSelectedProduct(btn.dataset.swapCat, btn.dataset.swapI);
  });
  document.getElementById("btn-delete-prod").addEventListener("click", deleteProductFromDesk);
  document.getElementById("prod-quick-add").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-cat]");
    if (!btn) return;
    addProductToDesk(btn.dataset.addCat, 0);
  });
  document.getElementById("furn-desk-products").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-cat]");
    if (!btn || !selected || selected.kind !== "furniture") return;
    addProductToDesk(btn.dataset.addCat, 0);
  });

  let pointerDown = null;
  canvas.addEventListener("pointerdown", (e) => {
    idleT = 0;
    orbit.autoRotate = false;
    invalidate(400);
    if (introT > 0) {
      introT = 0;
      camera.position.copy(CAM_HOME);
    }
    if (viewMode === "walk") {
      canvas.requestPointerLock?.();
      return;
    }
    if (e.button === 0) pointerDown = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons || viewMode === "walk") invalidate(280);
  });
  document.addEventListener("mousemove", (e) => {
    if (viewMode !== "walk" || document.pointerLockElement !== canvas) return;
    walkYaw -= e.movementX * 0.0026;
    walkPitch = THREE.MathUtils.clamp(walkPitch + e.movementY * 0.0021, -1.08, 0.86);
    invalidate(180);
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      idleT = 0;
      orbit.autoRotate = false;
      if (introT > 0) introT = 0;
      if (viewMode === "walk" || (orbit.enabled && viewMode !== "ceiling" && viewMode !== "top")) {
        walkStyleZoom(wheelStep(e));
      }
      invalidate(900);
    },
    { passive: true }
  );
  canvas.addEventListener("pointerup", (e) => {
    invalidate(280);
    if (!pointerDown || viewMode === "walk" || transform.dragging || transformDidDrag) {
      pointerDown = null;
      transformDidDrag = false;
      return;
    }
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    pointerDown = null;
    if (moved < 5) onPointer(e);
  });
}

function setMode(mode) {
  transform.setMode(mode);
  if (mode === "rotate") {
    transform.showX = false;
    transform.showY = true;
    transform.showZ = false;
  } else if (mode === "translate") {
    transform.showX = true;
    transform.showY = false;
    transform.showZ = true;
  } else {
    transform.showX = true;
    transform.showY = true;
    transform.showZ = true;
  }
  document.getElementById("mode-translate").classList.toggle("active", mode === "translate");
  document.getElementById("mode-rotate").classList.toggle("active", mode === "rotate");
  document.getElementById("mode-scale").classList.toggle("active", mode === "scale");
}

window.addEventListener("keydown", (e) => {
  invalidate(400);
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
  if (e.code === "KeyW") keys.w = true;
  if (e.code === "KeyA") keys.a = true;
  if (e.code === "KeyS") keys.s = true;
  if (e.code === "KeyD" && !e.ctrlKey && !e.metaKey) keys.d = true;
  if (typing) return;
  if ((e.key === "Delete" || e.key === "Backspace") && selected) {
    e.preventDefault();
    deleteSelected();
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyD") {
    e.preventDefault();
    duplicateSelected();
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyG") {
    e.preventDefault();
    chooseWalkWho("girl");
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyM") {
    e.preventDefault();
    chooseWalkWho("man");
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyB") {
    e.preventDefault();
    chooseWalkWho("both");
  }
  if (e.key === "1") setMode("translate");
  if (e.key === "2") setMode("rotate");
  if (e.key === "3") setMode("scale");
  if (e.key === "Escape") {
    if (viewMode === "walk") setView("orbit");
    else deselect();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") keys.w = false;
  if (e.code === "KeyA") keys.a = false;
  if (e.code === "KeyS") keys.s = false;
  if (e.code === "KeyD") keys.d = false;
});

const clock = new THREE.Clock();
const camFrom = new THREE.Vector3(20, 12, 22);
let pageVisible = true;
let slowFrames = 0;

document.addEventListener("visibilitychange", () => {
  pageVisible = document.visibilityState === "visible";
  if (pageVisible) {
    clock.getDelta();
    invalidate(800);
  }
});

function tick() {
  requestAnimationFrame(tick);
  if (!pageVisible) return;
  const now = performance.now();
  const walking = viewMode === "walk";
  const intro = introT > 0;
  const moving = keys.w || keys.a || keys.s || keys.d;
  const acDirty = updateAcDisplays(now);
  const live = intro || transform.dragging || moving || now < renderUntil || acDirty || roomRoot.children.length === 0;
  if (!live) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  if (walking) {
    const speed = WALK_SPEED * dt;
    walkFwd.set(-Math.sin(walkYaw), 0, -Math.cos(walkYaw));
    walkRight.set(walkFwd.z, 0, -walkFwd.x);
    let nx = walkPos.x;
    let nz = walkPos.z;
    if (keys.w) {
      nx += walkFwd.x * speed;
      nz += walkFwd.z * speed;
    }
    if (keys.s) {
      nx -= walkFwd.x * speed;
      nz -= walkFwd.z * speed;
    }
    if (keys.a) {
      nx -= walkRight.x * speed;
      nz -= walkRight.z * speed;
    }
    if (keys.d) {
      nx += walkRight.x * speed;
      nz += walkRight.z * speed;
    }
    tryWalkMove(nx, nz);
    walkPos.y = 0;
    const actor = ensureWalkActor();
    if (actor) {
      actor.root.visible = true;
      actor.root.position.copy(walkPos);
      actor.root.rotation.y = Math.atan2(walkFwd.x, walkFwd.z);
      if (walkWho === "both") {
        const wantSide = pickGirlSide(walkPos.x, walkPos.z, actor.girls?.[0]?.side ?? WALK_GIRL_SIDE);
        for (const girl of actor.girls || []) {
          girl.side = THREE.MathUtils.damp(girl.side ?? WALK_GIRL_SIDE, wantSide, 10, dt);
        }
      } else {
        for (const girl of actor.girls || []) girl.side = 0;
      }
      actor.play(moving ? "walk" : "idle");
      if (actor.update) actor.update(dt, moving);
      else actor.mixer.update(dt);
    }
    const back = walkDist * Math.cos(walkPitch);
    const lookX = walkPos.x + (walkWho === "both" ? walkRight.x * 0.28 : 0);
    const lookZ = walkPos.z + (walkWho === "both" ? walkRight.z * 0.28 : 0);
    camera.position.set(
      walkPos.x - walkFwd.x * back,
      walkPos.y + 1.48 + walkDist * Math.sin(walkPitch) * 0.55,
      walkPos.z - walkFwd.z * back
    );
    camera.lookAt(lookX, walkPos.y + 1.38, lookZ);
    invalidate(moving ? 280 : 160);
  } else {
    if (intro) {
      introT = Math.max(0, introT - dt * 0.28);
      const k = 1 - introT;
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(camFrom, CAM_HOME, e);
      const pose = heroCameraPose();
      orbit.target.lerp(pose.target, 0.12);
      if (introT === 0) {
        camera.position.copy(pose.pos);
        orbit.target.copy(pose.target);
      }
      invalidate(80);
    }
    orbit.update();
    if (viewMode !== "ceiling") {
      camera.position.y = clampCamHeight(camera.position.y);
    }
  }
  if (boxHelper) boxHelper.update();
  const t0 = performance.now();
  renderer.render(scene, camera);
  if (performance.now() - t0 > 22) {
    slowFrames += 1;
    if (slowFrames > 16 && dropQuality()) {
      renderer.setPixelRatio(currentDpr());
      if (QUALITY.shadow <= 0) {
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
      } else if (sun.shadow?.mapSize) {
        sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
        renderer.shadowMap.type = THREE.PCFShadowMap;
        markShadowsDirty();
      }
      slowFrames = 0;
    }
  } else {
    slowFrames = Math.max(0, slowFrames - 2);
  }
}

window.addEventListener("resize", debounce(resize, 80));
window.addEventListener("beforeunload", () => persistLayout(false));
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistLayout(false);
});
try {
  bindUI();
} catch (err) {
  console.error("bindUI failed", err);
}
resize();
try {
  rebuildRoom();
  rebuildFurniture();
} catch (err) {
  console.error("first room failed", err);
}
setView("orbit");
invalidate(4000);
tick();
renderer.render(scene, camera);
requestAnimationFrame(async () => {
  installEnvironment();
  autosavePaused = true;
  let restored = false;
  try {
    restored = await restoreLayout();
  } catch (err) {
    console.error("restore failed", err);
  }
  autosavePaused = false;
  if (!restored) {
    const preset = localStorage.getItem(PRESET_KEY) || "mobile";
    try {
      applyPreset(preset);
    } catch (err) {
      console.error("preset failed", err);
      applyPreset("empty");
    }
    document.querySelector(`[data-preset="${preset}"]`)?.classList.add("active");
  } else {
    frameFullStore();
    persistLayout(false);
  }
  invalidate(1200);
  renderer.render(scene, camera);
  loadPhotoTextures().then(() => {
    applyAllSurfaces();
    invalidate(180);
    renderer.render(scene, camera);
  });
});
