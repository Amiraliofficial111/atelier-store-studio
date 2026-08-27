import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { QUALITY, capTex } from "./quality.js";
import { loadAllWalkGirls, getWalkGirlPacks } from "./walk-girls.js?v=girlwalk1";
import { makeLogoTexture } from "./logos.js";
import { makePresetTexture, makeNormalFromAlbedo, SURFACE_PBR, isTerrazzo } from "./textures.js";
import {
  makeDisplayProduct,
  tagProduct,
  addGroceryShelf,
  addGroceryTop,
  addCafeShelf,
  addCafeCounter,
  addPharmacyShelf,
  addPharmacyTop,
  makeShelfPhone,
  productInfo,
  makeDeskLaptop,
  makeDeskIpad,
  makeFoldedDress,
  makeShoePair,
} from "./products.js";

const DRESS_COLORS = ["#1c1916", "#4a1d4e", "#8b1e3f", "#1e3a5f", "#c4a574", "#f2efe6", "#2f5d50", "#b42318"];
const SHIRT_COLORS = [
  "#111111",
  "#f4efe6",
  "#1e3a5f",
  "#b42318",
  "#2f5d50",
  "#c4a574",
  "#e8b4c4",
  "#4a1d4e",
  "#3d5a80",
  "#d4a017",
  "#5c3317",
  "#8b1e3f",
  "#7a9e7e",
  "#2b2d32",
  "#d8d2c8",
  "#1a4d8c",
];

function shirtColor(item, slot) {
  const seed = Math.abs(Math.round(((item.x || 0) + 9) * 5 + ((item.z || 0) + 9) * 11 + (item.rotY || 0) * 3));
  return SHIRT_COLORS[(seed + slot) % SHIRT_COLORS.length];
}
const SHOE_COLORS = ["#1a1a1a", "#5c3317", "#9b1c1c", "#eee8e0", "#1e3a5f", "#c4a574"];
const WATCH_METALS = ["#d4af37", "#c0c0c8", "#b87333", "#e8d5a3"];

const BOX = new THREE.BoxGeometry(1, 1, 1);
BOX.userData.shared = true;
const PLANE = new THREE.PlaneGeometry(1, 1);
PLANE.userData.shared = true;
const INST = new THREE.Object3D();

function instancedBoxes(mat, parts, extra = {}) {
  const mesh = new THREE.InstancedMesh(BOX, mat, parts.length);
  mesh.castShadow = extra.castShadow === true;
  mesh.receiveShadow = extra.receiveShadow !== false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    INST.position.set(p.x, p.y, p.z);
    INST.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
    INST.scale.set(Math.max(0.002, p.w), Math.max(0.002, p.h), Math.max(0.002, p.d));
    INST.updateMatrix();
    mesh.setMatrixAt(i, INST.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

const LED_MAT = new THREE.MeshStandardMaterial({
  color: "#fff8f0",
  emissive: "#ffe8c4",
  emissiveIntensity: 0.55,
});
LED_MAT.userData.shared = true;

const CYAN_LED = new THREE.MeshStandardMaterial({
  color: "#7ef3ff",
  emissive: "#2ad4e8",
  emissiveIntensity: 1.2,
});
CYAN_LED.userData.shared = true;

const KICK_LED = new THREE.MeshStandardMaterial({
  color: "#fff7ee",
  emissive: "#ffd89a",
  emissiveIntensity: 1.45,
});
KICK_LED.userData.shared = true;

const KICK_WASH = new THREE.MeshStandardMaterial({
  color: "#fff4e4",
  emissive: "#ffcc88",
  emissiveIntensity: 0.55,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  side: THREE.DoubleSide,
});
KICK_WASH.userData.shared = true;

const TUBE = new THREE.CylinderGeometry(1, 1, 1, 14);
TUBE.userData.shared = true;
const TAPER = new THREE.CylinderGeometry(0.72, 1, 1, 12);
TAPER.userData.shared = true;
const BALL = new THREE.SphereGeometry(1, 12, 10);
BALL.userData.shared = true;

const GLASS_CACHE = new Map();
let FABRIC_SRC = null;
function fabricSrc() {
  if (!FABRIC_SRC) FABRIC_SRC = makePresetTexture("fabric");
  return FABRIC_SRC;
}

function mappedColorMat(color, texId, extra = {}) {
  if (!QUALITY.high && !extra.map) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: extra.roughness ?? 0.42,
      metalness: extra.metalness ?? 0.04,
      envMapIntensity: extra.env ?? 0.7,
    });
  }
  const src = extra.map || makePresetTexture(texId);
  const map = src.clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(extra.repeat || 1.5, extra.repeatY || extra.repeat || 1.5);
  map.needsUpdate = true;
  const nrm = QUALITY.normals ? makeNormalFromAlbedo(map, extra.nStr ?? 0.75) : null;
  if (nrm) nrm.repeat.copy(map.repeat);
  const Ctor = QUALITY.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  return new Ctor({
    color,
    map,
    normalMap: nrm || null,
    normalScale: new THREE.Vector2(extra.nSc ?? 0.32, extra.nSc ?? 0.32),
    roughness: extra.roughness ?? 0.42,
    metalness: extra.metalness ?? 0.04,
    envMapIntensity: extra.env ?? 0.7,
    ...(QUALITY.physical
      ? { clearcoat: extra.clearcoat ?? 0.28, clearcoatRoughness: extra.ccr ?? 0.22 }
      : {}),
  });
}

function woodMat(color, extra = {}) {
  if (extra.map) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: extra.roughness ?? 0.38,
      metalness: extra.metalness ?? 0.04,
      envMapIntensity: extra.env ?? 0.72,
      map: extra.map,
    });
  }
  return mappedColorMat(color, "walnut", {
    roughness: extra.roughness ?? 0.32,
    metalness: 0.05,
    env: extra.env ?? 0.95,
    repeat: extra.repeat || 1.4,
    nStr: 0.85,
    nSc: 0.38,
    physical: QUALITY.physical,
    clearcoat: extra.clearcoat ?? 0.18,
    ccr: extra.ccr ?? 0.35,
  });
}

function bodyMat(color) {
  const c = new THREE.Color(color);
  const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  if (lum < 0.28) {
    return mappedColorMat(color, "walnut", {
      roughness: 0.28,
      metalness: 0.06,
      env: 1.08,
      repeat: 1.2,
      nStr: 0.9,
      nSc: 0.4,
      physical: QUALITY.physical,
      clearcoat: 0.2,
    });
  }
  if (lum < 0.55) {
    return mappedColorMat(color, "stone", {
      roughness: 0.14,
      metalness: 0.08,
      env: 1.28,
      repeat: 1.25,
      nStr: 0.62,
      nSc: 0.24,
      physical: QUALITY.physical,
      clearcoat: 0.42,
      ccr: 0.12,
    });
  }
  return mappedColorMat(color, "plaster", {
    roughness: 0.42,
    metalness: 0.03,
    env: 0.78,
    repeat: 1.8,
    nStr: 0.42,
    nSc: 0.16,
    physical: QUALITY.physical,
    clearcoat: 0.12,
    ccr: 0.4,
  });
}

function metalMat(color) {
  const c = new THREE.Color(color);
  const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  const gold = lum >= 0.28;
  const spec = {
    color,
    roughness: gold ? 0.14 : 0.28,
    metalness: gold ? 0.96 : 0.84,
    envMapIntensity: gold ? 1.85 : 0.9,
  };
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      ...spec,
      clearcoat: gold ? 0.48 : 0.18,
      clearcoatRoughness: gold ? 0.16 : 0.4,
    });
  }
  return new THREE.MeshStandardMaterial(spec);
}

function polishedGold(color = "#c6a56a") {
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.98,
      roughness: 0.1,
      envMapIntensity: 2.15,
      clearcoat: 0.7,
      clearcoatRoughness: 0.08,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.95,
    roughness: 0.14,
    envMapIntensity: 1.8,
  });
}

class ArchRailCurve extends THREE.Curve {
  constructor(hw, bodyH, y0 = 0.02) {
    super();
    this.hw = hw;
    this.bodyH = bodyH;
    this.y0 = y0;
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const hw = this.hw;
    const bodyH = this.bodyH;
    const y0 = this.y0;
    const post = Math.max(0.04, bodyH - y0);
    const arch = Math.PI * hw;
    const d = t * (post * 2 + arch);
    if (d <= post) return optionalTarget.set(-hw, y0 + d, 0);
    const d2 = d - post;
    if (d2 <= arch) {
      const a = Math.PI - (d2 / arch) * Math.PI;
      return optionalTarget.set(Math.cos(a) * hw, bodyH + Math.sin(a) * hw, 0);
    }
    return optionalTarget.set(hw, bodyH - (d2 - arch), 0);
  }
}

function archGlassShape(hw, bodyH, segs = 28) {
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw, bodyH);
  for (let i = 1; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    s.lineTo(Math.cos(a) * hw, bodyH + Math.sin(a) * hw);
  }
  s.lineTo(hw, 0);
  s.lineTo(-hw, 0);
  return s;
}

class CapsuleRailCurve extends THREE.Curve {
  constructor(hw, bodyH) {
    super();
    this.hw = hw;
    this.bodyH = bodyH;
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const hw = this.hw;
    const bodyH = this.bodyH;
    const post = Math.max(0.04, bodyH);
    const arch = Math.PI * hw;
    const d = t * (post * 2 + arch * 2);
    if (d <= post) return optionalTarget.set(-hw, hw + d, 0);
    let d2 = d - post;
    if (d2 <= arch) {
      const a = Math.PI - (d2 / arch) * Math.PI;
      return optionalTarget.set(Math.cos(a) * hw, hw + bodyH + Math.sin(a) * hw, 0);
    }
    d2 -= arch;
    if (d2 <= post) return optionalTarget.set(hw, hw + bodyH - d2, 0);
    d2 -= post;
    const a = -(d2 / arch) * Math.PI;
    return optionalTarget.set(Math.cos(a) * hw, hw + Math.sin(a) * hw, 0);
  }
}

function capsuleGlassShape(hw, bodyH, segs = 28) {
  const s = new THREE.Shape();
  s.moveTo(-hw, hw);
  s.lineTo(-hw, hw + bodyH);
  for (let i = 1; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    s.lineTo(Math.cos(a) * hw, hw + bodyH + Math.sin(a) * hw);
  }
  s.lineTo(hw, hw);
  for (let i = 1; i < segs; i++) {
    const a = -(i / segs) * Math.PI;
    s.lineTo(Math.cos(a) * hw, hw + Math.sin(a) * hw);
  }
  s.closePath();
  return s;
}

function makeCapsuleGlassGeometry(hw, bodyH, segs = 32) {
  const ring = [];
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI - (i / segs) * Math.PI;
    ring.push([Math.cos(a) * hw, hw + bodyH + Math.sin(a) * hw]);
  }
  for (let i = 1; i <= segs; i++) {
    const a = -(i / segs) * Math.PI;
    ring.push([Math.cos(a) * hw, hw + Math.sin(a) * hw]);
  }
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  const totalH = bodyH + hw * 2;
  const cx = 0;
  const cy = hw + bodyH * 0.5;
  const push = (x, y) => {
    positions.push(x, y, 0);
    uvs.push((x / hw + 1) * 0.5, y / totalH);
    normals.push(0, 0, 1);
  };
  push(cx, cy);
  for (const [x, y] of ring) push(x, y);
  const n = ring.length;
  for (let i = 0; i < n; i++) indices.push(0, 1 + i, 1 + ((i + 1) % n));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function makeArchGlassGeometry(hw, bodyH, segs = 32) {
  const ring = [
    [-hw, 0],
    [hw, 0],
    [hw, bodyH],
  ];
  for (let i = 1; i < segs; i++) {
    const a = (i / segs) * Math.PI;
    ring.push([Math.cos(a) * hw, bodyH + Math.sin(a) * hw]);
  }
  ring.push([-hw, bodyH]);
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  const totalH = bodyH + hw;
  const push = (x, y) => {
    positions.push(x, y, 0);
    uvs.push((x / hw + 1) * 0.5, y / totalH);
    normals.push(0, 0, 1);
  };
  push(0, bodyH * 0.42);
  for (const [x, y] of ring) push(x, y);
  const n = ring.length;
  for (let i = 0; i < n; i++) indices.push(0, 1 + i, 1 + ((i + 1) % n));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function satinBronze(color = "#5a4a3c") {
  const spec = {
    color,
    roughness: 0.46,
    metalness: 0.28,
    envMapIntensity: 0.58,
  };
  return QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        ...spec,
        clearcoat: 0.1,
        clearcoatRoughness: 0.62,
      })
    : new THREE.MeshStandardMaterial(spec);
}

function makeLiveGlass(geo, tint = 0xc4ced6) {
  const size = QUALITY.phone ? 256 : QUALITY.high ? 768 : 512;
  if (!QUALITY.phone) {
    return new Reflector(geo, {
      clipBias: 0.003,
      textureWidth: size,
      textureHeight: Math.round(size * 1.45),
      color: tint,
      multisample: 0,
    });
  }
  const spec = {
    color: "#c8d2da",
    metalness: 1,
    roughness: 0.02,
    envMapIntensity: 2.5,
  };
  return new THREE.Mesh(
    geo,
    QUALITY.physical
      ? new THREE.MeshPhysicalMaterial({ ...spec, clearcoat: 1, clearcoatRoughness: 0.03 })
      : new THREE.MeshStandardMaterial(spec)
  );
}

class RoundedRectRailCurve extends THREE.Curve {
  constructor(hw, hh, r) {
    super();
    this.hw = hw;
    this.hh = hh;
    this.r = r;
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const hw = this.hw;
    const hh = this.hh;
    const r = this.r;
    const sideX = Math.max(0.04, (hh - r) * 2);
    const sideY = Math.max(0.04, (hw - r) * 2);
    const corner = (Math.PI / 2) * r;
    const lens = [sideX, corner, sideY, corner, sideX, corner, sideY, corner];
    const total = lens.reduce((a, b) => a + b, 0);
    let d = t * total;
    let i = 0;
    while (i < lens.length - 1 && d > lens[i]) {
      d -= lens[i];
      i += 1;
    }
    const u = lens[i] > 0 ? d / lens[i] : 0;
    if (i === 0) return optionalTarget.set(-hw, r + u * sideX, 0);
    if (i === 1) {
      const a = Math.PI - u * (Math.PI / 2);
      return optionalTarget.set(-hw + r + Math.cos(a) * r, hh - r + Math.sin(a) * r, 0);
    }
    if (i === 2) return optionalTarget.set(-hw + r + u * sideY, hh, 0);
    if (i === 3) {
      const a = Math.PI / 2 - u * (Math.PI / 2);
      return optionalTarget.set(hw - r + Math.cos(a) * r, hh - r + Math.sin(a) * r, 0);
    }
    if (i === 4) return optionalTarget.set(hw, hh - r - u * sideX, 0);
    if (i === 5) {
      const a = -u * (Math.PI / 2);
      return optionalTarget.set(hw - r + Math.cos(a) * r, r + Math.sin(a) * r, 0);
    }
    if (i === 6) return optionalTarget.set(hw - r - u * sideY, 0, 0);
    const a = -Math.PI / 2 - u * (Math.PI / 2);
    return optionalTarget.set(-hw + r + Math.cos(a) * r, r + Math.sin(a) * r, 0);
  }
}

function roundedMirrorShape(hw, hh, r, segs = 10) {
  const s = new THREE.Shape();
  const corner = (cx, cy, a0, a1) => {
    for (let i = 1; i <= segs; i++) {
      const a = a0 + (a1 - a0) * (i / segs);
      s.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };
  s.moveTo(-hw, r);
  s.lineTo(-hw, hh - r);
  corner(-hw + r, hh - r, Math.PI, Math.PI / 2);
  s.lineTo(hw - r, hh);
  corner(hw - r, hh - r, Math.PI / 2, 0);
  s.lineTo(hw, r);
  corner(hw - r, r, 0, -Math.PI / 2);
  s.lineTo(-hw + r, 0);
  corner(-hw + r, r, -Math.PI / 2, -Math.PI);
  s.closePath();
  return s;
}

function makeRoundedRectGeometry(hw, hh, r, segs = 10) {
  const ring = [];
  const addCorner = (cx, cy, a0, a1) => {
    for (let i = 0; i <= segs; i++) {
      const a = a0 + (a1 - a0) * (i / segs);
      ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  ring.push([-hw, r]);
  ring.push([-hw, hh - r]);
  addCorner(-hw + r, hh - r, Math.PI, Math.PI / 2);
  ring.push([hw - r, hh]);
  addCorner(hw - r, hh - r, Math.PI / 2, 0);
  ring.push([hw, r]);
  addCorner(hw - r, r, 0, -Math.PI / 2);
  ring.push([-hw + r, 0]);
  addCorner(-hw + r, r, -Math.PI / 2, -Math.PI);
  const positions = [];
  const uvs = [];
  const normals = [];
  const indices = [];
  const push = (x, y) => {
    positions.push(x, y, 0);
    uvs.push((x / hw + 1) * 0.5, y / hh);
    normals.push(0, 0, 1);
  };
  push(0, hh * 0.5);
  for (const [x, y] of ring) push(x, y);
  const n = ring.length;
  for (let i = 0; i < n; i++) indices.push(0, 1 + i, 1 + ((i + 1) % n));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function addArchedFloorMirror(group, w, h) {
  const bronze = satinBronze("#5a4a3c");
  const lipMat = satinBronze("#6a5748");
  const tubeR = Math.min(0.04, Math.max(0.03, w * 0.034));
  const hw = w / 2 - tubeR * 0.2;
  const hh = h - tubeR * 0.4;
  const r = Math.min(0.15, hw * 0.36);
  const segs = QUALITY.phone ? 64 : 128;
  const radial = QUALITY.phone ? 8 : 16;
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new RoundedRectRailCurve(hw, hh, r), segs, tubeR, radial, true), bronze);
  rail.castShadow = true;
  rail.receiveShadow = true;
  group.add(rail);
  const inset = tubeR * 0.95;
  const ghw = Math.max(0.16, hw - inset);
  const ghh = Math.max(0.3, hh - inset * 0.35);
  const gr = Math.max(0.06, r - inset * 0.55);
  const lip = new THREE.Mesh(
    new THREE.TubeGeometry(new RoundedRectRailCurve(ghw + tubeR * 0.12, ghh, Math.max(0.05, gr)), segs, tubeR * 0.18, 8, true),
    lipMat
  );
  lip.position.z = 0.01;
  group.add(lip);
  const glassSize = QUALITY.phone ? 320 : QUALITY.high ? 1024 : 704;
  const glassGeo = makeRoundedRectGeometry(ghw, ghh, gr, QUALITY.phone ? 8 : 14);
  const glass = QUALITY.phone
    ? makeLiveGlass(glassGeo, 0xd6dce2)
    : new Reflector(glassGeo, {
        clipBias: 0.002,
        textureWidth: glassSize,
        textureHeight: Math.round(glassSize * 1.7),
        color: 0xd8dee4,
        multisample: 0,
      });
  glass.position.set(0, 0, 0.014);
  group.add(glass);
  const back = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedMirrorShape(hw + tubeR * 0.12, hh, r, QUALITY.phone ? 8 : 12), {
      depth: 0.034,
      bevelEnabled: false,
      curveSegments: QUALITY.phone ? 10 : 18,
    }),
    new THREE.MeshStandardMaterial({ color: "#1a1612", roughness: 0.86, metalness: 0.06 })
  );
  back.position.z = -0.05;
  back.castShadow = true;
  group.add(back);
  const shade = new THREE.Mesh(
    makeRoundedRectGeometry(hw + tubeR * 1.15, hh, r + tubeR * 0.2, 10),
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.14, depthWrite: false })
  );
  shade.position.z = -0.062;
  group.add(shade);
}

function addStandingMirror(group, w, h, goldColor) {
  const gold = polishedGold(goldColor || "#c6a56a");
  const t = Math.min(0.03, w * 0.045);
  const glassW = w - t * 2.2;
  const glassH = h - t * 2.4;
  group.add(box(t, h, 0.046, gold, -w / 2 + t / 2, h / 2, 0));
  group.add(box(t, h, 0.046, gold, w / 2 - t / 2, h / 2, 0));
  group.add(box(w, t, 0.05, gold, 0, t / 2, 0));
  group.add(box(w, t, 0.05, gold, 0, h - t / 2, 0));
  group.add(box(w - t * 0.6, t * 0.35, 0.018, polishedGold("#d4b878"), 0, t + 0.02, 0.02));
  const glass = makeLiveGlass(new THREE.PlaneGeometry(glassW, glassH));
  glass.position.set(0, h / 2, 0.018);
  group.add(glass);
  group.add(box(w - t, h - t, 0.02, new THREE.MeshStandardMaterial({ color: "#161412", roughness: 0.8, metalness: 0.1 }), 0, h / 2, -0.018));
}

function isDarkBody(color) {
  const c = new THREE.Color(color || "#f4eee6");
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 < 0.38;
}

function marbleTop(color = "#f4eee6") {
  return mappedColorMat(color, "luxury", {
    roughness: 0.07,
    metalness: 0.08,
    env: 1.62,
    repeat: 1.1,
    nStr: 0.45,
    nSc: 0.16,
    physical: QUALITY.physical,
    clearcoat: 0.78,
    ccr: 0.06,
  });
}

function leatherMat(color) {
  if (!QUALITY.high) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.04,
      envMapIntensity: 0.55,
    });
  }
  const map = fabricSrc().clone();
  map.repeat.set(5, 5);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: 0.42,
    metalness: 0.04,
    envMapIntensity: 0.55,
  });
}

function fabricMat(color) {
  if (!QUALITY.high) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.02,
      envMapIntensity: 0.42,
    });
  }
  const map = fabricSrc().clone();
  map.repeat.set(10, 10);
  map.needsUpdate = true;
  const satin = color === "#c4a574" || color === "#f2efe6" || color === "#8b1e3f" || color === "#1a2a4a" || color === "#e8b4c4";
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      color,
      map,
      roughness: satin ? 0.28 : 0.62,
      metalness: 0.02,
      sheen: satin ? 0.7 : 0.28,
      sheenColor: "#fff4e8",
      sheenRoughness: 0.45,
      envMapIntensity: satin ? 0.85 : 0.42,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: satin ? 0.32 : 0.7,
    metalness: 0.03,
    envMapIntensity: satin ? 0.7 : 0.36,
  });
}

function ceramicMat(color) {
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.2,
      metalness: 0.02,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.12,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.18,
    metalness: 0.04,
    envMapIntensity: 0.92,
  });
}

const BRAND_TEX = new Map();
function brandPlateTex(word = "ATELIER") {
  const key = String(word).toUpperCase();
  if (BRAND_TEX.has(key)) return BRAND_TEX.get(key);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1612";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#c6a56a";
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = "#c6a56a";
  ctx.font = "600 42px Cormorant Garamond, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(key.slice(0, 14), 256, 56);
  ctx.font = "500 14px DM Sans, sans-serif";
  ctx.fillStyle = "rgba(246,241,232,0.55)";
  ctx.fillText("MAISON  ·  PARIS", 256, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  BRAND_TEX.set(key, tex);
  return tex;
}

function addBrandPlate(group, x, y, z, ry = 0, word = "ATELIER") {
  const g = new THREE.Group();
  g.add(box(0.3, 0.07, 0.012, metalMat("#c6a56a"), 0, 0, 0, false));
  const face = new THREE.Mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: brandPlateTex(word),
      roughness: 0.28,
      metalness: 0.18,
      emissive: "#1a1612",
      emissiveIntensity: 0.08,
    })
  );
  face.scale.set(0.28, 0.058, 1);
  face.position.z = 0.008;
  g.add(face);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  group.add(g);
}

function aurumPlateTex(word = "AURUM GENESIS") {
  const key = `aurum:${word}`;
  if (BRAND_TEX.has(key)) return BRAND_TEX.get(key);
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 160;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 768, 160);
  g.addColorStop(0, "#8a6a32");
  g.addColorStop(0.35, "#e8c878");
  g.addColorStop(0.7, "#c6a056");
  g.addColorStop(1, "#7a5828");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 768, 160);
  ctx.fillStyle = "rgba(255,236,180,0.18)";
  for (let i = 0; i < 40; i++) ctx.fillRect(0, i * 4, 768, 1);
  ctx.strokeStyle = "rgba(40,28,12,0.35)";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 748, 140);
  ctx.fillStyle = "#1a140c";
  ctx.font = "600 52px Cormorant Garamond, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(word).toUpperCase().slice(0, 18), 384, 80);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  BRAND_TEX.set(key, tex);
  return tex;
}

function addAurumPlate(group, x, y, z, word, w = 0.28, h = 0.058) {
  const gold = metalMat("#d4af37");
  group.add(box(w + 0.012, h + 0.01, 0.01, gold, x, y, z, false));
  const face = new THREE.Mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: aurumPlateTex(word),
      roughness: 0.22,
      metalness: 0.55,
      envMapIntensity: 1.1,
    })
  );
  face.scale.set(w, h, 1);
  face.position.set(x, y, z + 0.007);
  group.add(face);
}

function watchGlassMat() {
  return glassMat("#ffffff", { opacity: 0.05, env: 0.55, roughness: 0.04, reflectivity: 0.12 });
}

function suedeMat(color) {
  return mappedColorMat(color, "leather-emboss", {
    roughness: 0.82,
    metalness: 0.02,
    env: 0.32,
    repeat: 3.4,
    nStr: 0.72,
    nSc: 0.3,
  });
}

function watchCaseLayout(item) {
  const w = item.width;
  const d = item.depth;
  const h = item.height;
  const baseH = Math.max(0.26, h * 0.24);
  const topH = 0.046;
  const cavityH = Math.max(0.5, h - baseH - topH);
  const shelfYs = [baseH + 0.048, baseH + cavityH * 0.38];
  return { w, d, h, baseH, topH, cavityH, shelfYs };
}

function addWatchVitrine(group, item, w, h, d) {
  const gold = metalMat(item.accent || "#d4af37");
  const ebony = woodMat("#1c1410", { roughness: 0.3, env: 0.95, repeat: 1.6 });
  const polish = woodMat("#2a1c14", { roughness: 0.16, env: 1.25, repeat: 1.1, clearcoat: 0.42, ccr: 0.18 });
  const suede = suedeMat("#cbb59a");
  const lining = mappedColorMat("#1a1512", "tadelakt", { roughness: 0.74, metalness: 0.03, env: 0.28, repeat: 1.8, nStr: 0.55, nSc: 0.22 });
  const { baseH, topH, cavityH, shelfYs } = watchCaseLayout(item);
  const side = 0.038;
  const backT = 0.03;
  const glass = watchGlassMat();

  group.add(box(w, 0.018, d + 0.012, gold, 0, 0.01, 0, false));
  group.add(box(w, baseH - 0.018, d, ebony, 0, (baseH + 0.018) / 2, 0));
  const grooves = Math.max(7, Math.round(w / 0.11));
  for (let i = 0; i < grooves; i++) {
    const x = -w / 2 + 0.07 + (i * (w - 0.14)) / Math.max(1, grooves - 1);
    group.add(box(0.005, baseH - 0.12, 0.007, gold, x, baseH * 0.52, d / 2 + 0.001, false));
  }
  addAurumPlate(group, 0, baseH * 0.48, d / 2 + 0.008, item.posterText || "AURUM", 0.32, 0.046);

  group.add(box(w, cavityH, backT, lining, 0, baseH + cavityH / 2, -d / 2 + backT / 2));
  group.add(box(side, cavityH, d, ebony, -w / 2 + side / 2, baseH + cavityH / 2, 0));
  group.add(box(side, cavityH, d, ebony, w / 2 - side / 2, baseH + cavityH / 2, 0));
  group.add(box(w, topH, d + 0.01, polish, 0, h - topH / 2, 0));
  group.add(box(w + 0.012, 0.01, d + 0.016, gold, 0, h - 0.004, 0, false));

  const innerW = w - side * 2;
  const innerD = d - backT - 0.02;
  group.add(box(innerW, 0.01, innerD, suede, 0, baseH + 0.008, 0.006));

  const led = new THREE.MeshStandardMaterial({
    color: "#fff6e4",
    emissive: "#ffe4ae",
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });
  for (const y of shelfYs) {
    group.add(box(innerW, 0.02, innerD, polish, 0, y, 0.008));
    group.add(box(innerW - 0.02, 0.008, innerD - 0.02, suede, 0, y + 0.013, 0.01, false));
    group.add(box(innerW, 0.004, 0.008, gold, 0, y + 0.004, d / 2 - 0.018, false));
    group.add(box(innerW - 0.06, 0.004, 0.005, led, 0, y - 0.012, 0.02, false));
  }

  const openW = innerW;
  const openH = cavityH - 0.008;
  const frame = 0.012;
  const fz = d / 2 - 0.004;
  group.add(box(openW + frame * 2, frame, 0.012, gold, 0, baseH + frame / 2, fz, false));
  group.add(box(openW + frame * 2, frame, 0.012, gold, 0, baseH + openH - frame / 2, fz, false));
  group.add(box(frame, openH, 0.012, gold, -openW / 2 - frame / 2, baseH + openH / 2, fz, false));
  group.add(box(frame, openH, 0.012, gold, openW / 2 + frame / 2, baseH + openH / 2, fz, false));
  group.add(box(openW, openH, 0.004, glass, 0, baseH + openH / 2, d / 2 - 0.01, false));

  const wash = new THREE.MeshStandardMaterial({
    color: "#ffe8b8",
    emissive: "#ffd89a",
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  group.add(box(innerW - 0.04, cavityH - 0.08, 0.002, wash, 0, baseH + cavityH / 2, -d / 2 + backT + 0.006, false));
  addLampLight(group, { ...item, lightOn: item.lightOn !== false, lightPower: item.lightPower ?? 16, lightColor: item.lightColor || "#ffe6b8" }, baseH + cavityH * 0.7, "point");
}

function addDisplayMannequin(group, opts = {}) {
  const y0 = opts.y || 0;
  if (
    addManModel(
      group,
      {
        accent: opts.accent || "#1a2a4a",
        color: opts.color || "#f7f2ec",
        x: opts.x,
        z: opts.z,
        id: opts.id,
      },
      { kind: "man", height: 1.62, y: y0 }
    )
  ) {
    return;
  }
  const segs = QUALITY.low ? 10 : 18;
  const skin = ceramicMat(opts.color || "#f7f2ec");
  const suit = fabricMat(opts.accent || "#1a2a4a");
  const gold = metalMat("#c6a56a");
  const ink = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.22, metalness: 0.18 });
  const leather = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.34, metalness: 0.12, envMapIntensity: 0.7 });
  const look = new THREE.Group();
  look.position.y = y0;

  const hips = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.105, segs, segs), skin));
  hips.scale.set(1.08, 0.68, 0.72);
  hips.position.y = 0.88;
  look.add(hips);
  const torso = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.122, 0.42, segs), skin));
  torso.position.y = 1.24;
  look.add(torso);
  const chest = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.1, segs, segs), skin));
  chest.position.set(0, 1.44, 0);
  look.add(chest);
  const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.08, segs), skin));
  neck.position.y = 1.5;
  look.add(neck);
  const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.084, segs, segs), skin));
  head.scale.set(0.88, 1.08, 0.9);
  head.position.y = 1.61;
  look.add(head);

  const jacket = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.152, 0.46, segs), suit));
  jacket.position.set(0, 1.26, 0.012);
  look.add(jacket);
  look.add(box(0.24, 0.07, 0.13, suit, 0, 1.46, 0.03));
  look.add(box(0.055, 0.32, 0.1, suit, -0.05, 1.24, 0.078));
  look.add(box(0.055, 0.32, 0.1, suit, 0.05, 1.24, 0.078));
  look.add(box(0.22, 0.01, 0.12, gold, 0, 1.05, 0.055));

  for (const side of [-1, 1]) {
    const thigh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.044, 0.4, segs), suit));
    thigh.position.set(side * 0.058, 0.64, 0.012);
    look.add(thigh);
    const calf = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.38, segs), suit));
    calf.position.set(side * 0.058, 0.28, 0.02);
    look.add(calf);
    const pump = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.038, 0.17), suit));
    pump.position.set(side * 0.058, 0.08, 0.04);
    look.add(pump);
    look.add(box(0.022, 0.07, 0.022, suit, side * 0.058, 0.045, -0.028));
  }

  const lArm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.4, segs), skin));
  lArm.rotation.z = 1.05;
  lArm.position.set(-0.2, 1.2, 0.05);
  look.add(lArm);
  const rArm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.44, segs), skin));
  rArm.rotation.z = -0.18;
  rArm.position.set(0.19, 1.14, 0.02);
  look.add(rArm);

  const bag = new THREE.Group();
  bag.add(box(0.17, 0.13, 0.065, leather, 0, 0, 0));
  bag.add(box(0.055, 0.018, 0.02, gold, 0, 0.018, 0.034));
  bag.position.set(0.3, 0.88, 0.07);
  look.add(bag);

  look.add(box(0.072, 0.014, 0.012, ink, -0.034, 1.612, 0.074));
  look.add(box(0.072, 0.014, 0.012, ink, 0.034, 1.612, 0.074));
  look.add(box(0.028, 0.006, 0.008, ink, 0, 1.612, 0.078));

  tagProduct(look, "dresses", 3, { color: opts.accent || "#1a2a4a" });
  group.add(look);
}

function addRunwayMannequin(group, opts = {}) {
  const y0 = opts.y || 0;
  const segs = QUALITY.low ? 10 : 18;
  const skin = ceramicMat("#f0cbb8");
  const blazer = fabricMat("#e8b4c4");
  const top = fabricMat("#f7f4f0");
  const jeans = fabricMat("#7ea0c4");
  const hair = new THREE.MeshStandardMaterial({ color: "#2c1a12", roughness: 0.72, metalness: 0.03, envMapIntensity: 0.2 });
  const heel = ceramicMat("#f7f4f0");
  const look = new THREE.Group();
  look.position.y = y0;

  const hips = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.1, segs, segs), skin));
  hips.scale.set(1.04, 0.68, 0.7);
  hips.position.y = 0.86;
  look.add(hips);
  const torso = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.114, 0.4, segs), skin));
  torso.position.y = 1.2;
  look.add(torso);
  const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.035, 0.075, segs), skin));
  neck.position.y = 1.45;
  look.add(neck);
  const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.08, segs, segs), skin));
  head.scale.set(0.88, 1.08, 0.9);
  head.position.y = 1.56;
  look.add(head);

  const mane = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.1, segs, 10), hair));
  mane.scale.set(1.02, 1.22, 0.92);
  mane.position.set(0, 1.54, -0.035);
  look.add(mane);
  for (const side of [-1, 1]) {
    const lock = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), hair));
    lock.scale.set(0.72, 1.85, 0.7);
    lock.position.set(side * 0.075, 1.34, -0.01);
    look.add(lock);
  }

  look.add(box(0.15, 0.14, 0.07, top, 0, 1.3, 0.04));
  const jacket = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.148, 0.42, segs), blazer));
  jacket.position.set(0, 1.22, 0.01);
  look.add(jacket);
  look.add(box(0.065, 0.3, 0.095, blazer, -0.058, 1.22, 0.075));
  look.add(box(0.065, 0.3, 0.095, blazer, 0.058, 1.22, 0.075));

  for (const side of [-1, 1]) {
    const thigh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.36, segs), jeans));
    thigh.position.set(side * 0.054, 0.64, 0.01);
    look.add(thigh);
    const calf = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.3, segs), jeans));
    calf.position.set(side * 0.054, 0.32, 0.016);
    look.add(calf);
    const shoe = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.028, 0.15), heel));
    shoe.position.set(side * 0.054, 0.155, 0.045);
    look.add(shoe);
    look.add(box(0.016, 0.085, 0.016, heel, side * 0.054, 0.1, -0.018));
  }

  for (const side of [-1, 1]) {
    const arm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.022, 0.4, segs), skin));
    arm.rotation.z = side * 0.22;
    arm.position.set(side * 0.175, 1.16, 0.02);
    look.add(arm);
  }

  tagProduct(look, "dresses", 4, { color: "#e8b4c4" });
  group.add(look);
}

function glowEllipse(rx, ry, tube, mat) {
  const curve = new THREE.EllipseCurve(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  const pts = curve.getPoints(72).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const path = new THREE.CatmullRomCurve3(pts, true);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 72, tube, 8, true), mat);
  mesh.castShadow = false;
  return mesh;
}

function glassMat(color = "#e4f2fb", extra = {}) {
  const key = `${color}|${extra.opacity ?? ""}|${extra.env ?? ""}`;
  let m = GLASS_CACHE.get(key);
  if (m) return m;
  const spec = {
    color,
    roughness: extra.roughness ?? 0.06,
    metalness: 0.04,
    transparent: true,
    opacity: extra.opacity ?? 0.22,
    depthWrite: false,
    envMapIntensity: extra.env ?? 1.85,
  };
  m = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        ...spec,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        reflectivity: extra.reflectivity ?? 0.52,
        ior: 1.5,
      })
    : new THREE.MeshStandardMaterial(spec);
  m.userData.shared = true;
  GLASS_CACHE.set(key, m);
  return m;
}

function addUnderShelfLed(group, w, d, y, glow = "#cfefff", power = 2) {
  const led = new THREE.MeshStandardMaterial({
    color: "#f4fbff",
    emissive: glow,
    emissiveIntensity: power,
    roughness: 0.2,
  });
  const t = 0.013;
  group.add(box(w, t, t, led, 0, y, d / 2, false));
  group.add(box(w, t, t, led, 0, y, -d / 2, false));
  group.add(box(t, t, d, led, -w / 2, y, 0, false));
  group.add(box(t, t, d, led, w / 2, y, 0, false));
  const wash = new THREE.MeshStandardMaterial({
    color: "#eef8ff",
    emissive: glow,
    emissiveIntensity: power * 0.35,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  group.add(box(Math.max(0.12, w - 0.1), 0.004, Math.max(0.12, d - 0.1), wash, 0, y - 0.008, 0, false));
}

function addMallKickLight(group, w, d, y = 0.055) {
  const r = 0.032;
  const pad = 0.045;
  const iw = Math.max(0.28, w - pad * 2);
  const id = Math.max(0.22, d - pad * 2);
  const wash = new THREE.Mesh(PLANE, KICK_WASH);
  wash.rotation.x = -Math.PI / 2;
  wash.scale.set(iw + 0.22, id + 0.22, 1);
  wash.position.y = 0.008;
  wash.castShadow = false;
  group.add(wash);
  if (QUALITY.stockLite) {
    const strip = new THREE.Mesh(BOX, KICK_LED);
    strip.scale.set(iw, 0.012, 0.012);
    strip.position.set(0, y, id / 2);
    strip.castShadow = false;
    group.add(strip);
    return;
  }
  const hx = iw / 2 - r;
  const hz = id / 2 - r;
  const side = (len, x, z, rotY) => {
    const m = new THREE.Mesh(TUBE, KICK_LED);
    m.scale.set(r, Math.max(0.08, len), r);
    m.rotation.z = Math.PI / 2;
    m.rotation.y = rotY;
    m.position.set(x, y, z);
    m.castShadow = false;
    group.add(m);
  };
  side(hx * 2, 0, hz + r * 0.15, 0);
  side(hx * 2, 0, -(hz + r * 0.15), 0);
  const end = (len, x, z) => {
    const m = new THREE.Mesh(TUBE, KICK_LED);
    m.scale.set(r, Math.max(0.08, len), r);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    m.castShadow = false;
    group.add(m);
  };
  end(hz * 2, hx + r * 0.15, 0);
  end(hz * 2, -(hx + r * 0.15), 0);
}

function box(w, h, d, mat, x, y, z, heavy = true) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(Math.max(0.002, w), Math.max(0.002, h), Math.max(0.002, d));
  m.position.set(x, y, z);
  const vol = w * h * d;
  m.receiveShadow = heavy && vol > 0.008;
  if (heavy && vol > 0.01) m.castShadow = true;
  return m;
}

function rackRailYs(h) {
  return [Math.max(0.72, h * 0.51), Math.max(1.05, h - 0.02)];
}

function dressShelfLayout(w) {
  const n = w >= 2.7 ? 3 : 2;
  const inner = Math.max(0.6, w - 0.16);
  const bay = inner / n;
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(-inner / 2 + bay / 2 + i * bay);
  return { n, bay, xs };
}

function dressShelfRailY(h) {
  return h * 0.77;
}

function post(r, h, mat, x, y, z, taper = false) {
  const m = new THREE.Mesh(taper ? TAPER : TUBE, mat);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  m.castShadow = h * r > 0.01;
  return m;
}

function shadow(mesh) {
  mesh.castShadow = true;
  return mesh;
}

function shelfSlots(item, rows, cols, startY, stepY) {
  const pts = [];
  const w = item.width;
  const d = item.depth;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = cols === 1 ? 0 : -w / 2 + 0.18 + (col * (w - 0.36)) / (cols - 1);
      const y = startY + row * stepY;
      const z = d / 2 - 0.08;
      pts.push({ x, y, z, row, col, i: row * cols + col });
    }
  }
  return pts;
}

export const CATALOG = [
  { type: "desk", label: "Desk", hint: "Staff table" },
  { type: "counter", label: "Counter", hint: "Service bar" },
  { type: "cashier", label: "Checkout", hint: "POS desk" },
  { type: "haloDesk", label: "King counter", hint: "L-shape RGB service desk" },
  { type: "table", label: "Display table", hint: "Products" },
  { type: "shelf", label: "Shelf unit", hint: "Aisle / wall" },
  { type: "ledGlassBay", label: "LED glass bay", hint: "Metal frame + glass + phones" },
  { type: "phoneIsland", label: "Phone island", hint: "Mobile display" },
  { type: "phoneBar", label: "Phone bar", hint: "Long glass counter + screens" },
  { type: "phonePedestal", label: "Wood laptop cube", hint: "Walnut plinth + laptop" },
  { type: "brandCubby", label: "Brand cubby wall", hint: "Navy cubbies + logo" },
  { type: "slatSignWall", label: "Brand display wall", hint: "Walnut + gold panels + shelves" },
  { type: "phoneCabinet", label: "Phone cabinet", hint: "Wall cabinet + shelves" },
  { type: "accessoryWall", label: "Gadget wall", hint: "Boxes + phones" },
  { type: "glassCase", label: "Glass showcase", hint: "Watches / jewelry" },
  { type: "watchTower", label: "Watch pedestal", hint: "Featured piece" },
  { type: "dressNiche", label: "Clothing wall shelf", hint: "Hanger shirts on chrome rail" },
  { type: "marbleIsland", label: "Marble island", hint: "Low floating display" },
  { type: "marblePlinth", label: "Marble pedestal", hint: "Featured piece" },
  { type: "goldArch", label: "Arched mirror", hint: "Rounded rectangle mirror" },
  { type: "rack", label: "Dress rack", hint: "Hanging clothes" },
  { type: "mannequin", label: "Display model", hint: "Boutique fashion model" },
  { type: "mannequinCase", label: "Glass mannequin case", hint: "Front window vitrine" },
  { type: "glowRunway", label: "LED runway arch", hint: "Oval neon + platform" },
  { type: "fittingRoom", label: "Fitting room", hint: "Try-on booth" },
  { type: "shoeWall", label: "Shoe wall", hint: "Footwear display" },
  { type: "shoeIsland", label: "Shoe table", hint: "Pairs on top" },
  { type: "mirror", label: "Floor mirror", hint: "Fitting" },
  { type: "sofa", label: "Sofa", hint: "Waiting seat" },
  { type: "loungeChair", label: "Lounge chair", hint: "Leather club chair" },
  { type: "coffeeTable", label: "Coffee table", hint: "Glass + brass table" },
  { type: "ottoman", label: "Ottoman", hint: "Leather pouf" },
  { type: "sideboard", label: "Sideboard", hint: "Console cabinet" },
  { type: "logo", label: "Logo", hint: "A–Z or upload" },
  { type: "poster", label: "Poster stand", hint: "Store graphic" },
  { type: "ledBanner", label: "LED wall banner", hint: "Digital screen on any wall" },
  { type: "ledDesk", label: "LED desk screen", hint: "Digital screen on a desk" },
  { type: "cube", label: "Display cube", hint: "Featured" },
  { type: "plant", label: "Plant", hint: "Decor" },
  { type: "light", label: "Floor lamp", hint: "Stand light · move anywhere" },
  { type: "pendant", label: "Pendant lamp", hint: "Hanging ceiling light" },
  { type: "crystalChandelier", label: "Luxury ring light", hint: "Brass canopy + warm LED rings" },
  { type: "ceilingCan", label: "Ceiling spot", hint: "Downlight on the roof" },
  { type: "wallSconce", label: "Wall sconce", hint: "Light on any wall" },
  { type: "deskLamp", label: "Desk lamp", hint: "Light on a counter or desk" },
  { type: "bench", label: "Bench", hint: "Seating" },
  { type: "securityGate", label: "Security gate", hint: "Door sensors" },
  { type: "logoMat", label: "Logo floor mat", hint: "Entrance decal" },
  { type: "hoursPlaque", label: "Hours plaque", hint: "Open / close sign" },
  { type: "windowVinyl", label: "Window vinyl", hint: "Glass campaign" },
  { type: "hangingCard", label: "Hanging card", hint: "Ceiling campaign" },
  { type: "splitAc", label: "Split AC", hint: "Wall air conditioner" },
];

export function isLightFixture(type) {
  return (
    type === "light" ||
    type === "pendant" ||
    type === "crystalChandelier" ||
    type === "ceilingCan" ||
    type === "wallSconce" ||
    type === "deskLamp"
  );
}

export function isLamp(type) {
  return isLightFixture(type) || type === "ledBanner" || type === "ledDesk" || type === "haloDesk" || type === "slatSignWall" || type === "ledGlassBay";
}

export const DEFAULTS = {
  desk: { width: 1.6, depth: 0.75, height: 0.75, color: "#6f6964", accent: "#c6a56a", stock: "none" },
  counter: { width: 2.2, depth: 0.7, height: 1.05, color: "#6f6964", accent: "#c6a56a", stock: "none" },
  cashier: { width: 1.4, depth: 0.7, height: 1.0, color: "#6f6964", accent: "#c6a56a", stock: "none" },
  haloDesk: { width: 2.75, depth: 0.72, height: 1.02, color: "#111111", accent: "#ff7a18", stock: "none" },
  table: { width: 1.2, depth: 1.2, height: 0.8, color: "#f4eee6", accent: "#c6a56a", stock: "none" },
  shelf: { width: 1.2, depth: 0.45, height: 1.8, color: "#f3ebe0", accent: "#c6a56a", stock: "none" },
  ledGlassBay: { width: 3.55, depth: 0.46, height: 2.22, color: "#eef1f4", accent: "#c5c9ce", stock: "phones" },
  rack: { width: 1.0, depth: 0.46, height: 1.85, color: "#c6a56a", accent: "#c6a56a", stock: "dresses" },
  dressNiche: { width: 3.15, depth: 0.46, height: 2.24, color: "#f4eee6", accent: "#b08968", stock: "dresses" },
  marbleIsland: { width: 3.4, depth: 0.92, height: 0.4, color: "#f6f1e8", accent: "#c6a56a", stock: "dresses" },
  marblePlinth: { width: 0.42, depth: 0.42, height: 0.78, color: "#f6f1e8", accent: "#c6a56a", stock: "shoes" },
  goldArch: { width: 1.04, depth: 0.1, height: 2.28, color: "#5a4a3c", accent: "#5a4a3c", stock: "none" },
  cube: { width: 0.7, depth: 0.7, height: 0.7, color: "#f4eee6", accent: "#c6a56a", stock: "none" },
  plant: { width: 0.45, depth: 0.45, height: 0.9, color: "#6f6964", accent: "#3f8f5a", stock: "none" },
  light: { width: 0.35, depth: 0.35, height: 1.7, color: "#f4eee6", accent: "#c6a56a", stock: "none" },
  pendant: { width: 0.42, depth: 0.42, height: 0.55, color: "#f4eee6", accent: "#c6a56a", stock: "none" },
  crystalChandelier: { width: 1.28, depth: 1.28, height: 0.58, color: "#161412", accent: "#c6a56a", stock: "none" },
  ceilingCan: { width: 0.22, depth: 0.22, height: 0.12, color: "#ece7de", accent: "#c6a56a", stock: "none" },
  wallSconce: { width: 0.22, depth: 0.12, height: 0.28, color: "#f4eee6", accent: "#c6a56a", stock: "none" },
  deskLamp: { width: 0.28, depth: 0.28, height: 0.48, color: "#f4eee6", accent: "#c6a56a", stock: "none" },
  bench: { width: 1.4, depth: 0.45, height: 0.45, color: "#4a3426", accent: "#c6a56a", stock: "none" },
  phoneIsland: { width: 1.9, depth: 0.95, height: 0.95, color: "#f4eee6", accent: "#c6a56a", stock: "phones" },
  phoneBar: { width: 4.6, depth: 0.86, height: 1.02, color: "#f2f4f6", accent: "#1e4d8c", stock: "phones" },
  phonePedestal: { width: 1.15, depth: 1.15, height: 0.98, color: "#6a4a2e", accent: "#c6a56a", stock: "laptops" },
  brandCubby: { width: 2.45, depth: 0.42, height: 2.2, color: "#f2f4f6", accent: "#152a4a", stock: "phones" },
  slatSignWall: { width: 11.2, depth: 0.28, height: 3.95, color: "#4a3426", accent: "#dcc8a0", stock: "none" },
  phoneCabinet: { width: 1.85, depth: 0.48, height: 2.15, color: "#f3ebe0", accent: "#c6a56a", stock: "phones" },
  accessoryWall: { width: 1.8, depth: 0.42, height: 2.15, color: "#f3ebe0", accent: "#c6a56a", stock: "phones" },
  glassCase: { width: 2.2, depth: 0.5, height: 1.48, color: "#1a1612", accent: "#c6a56a", stock: "watches" },
  watchTower: { width: 0.5, depth: 0.5, height: 1.35, color: "#1a1612", accent: "#c6a56a", stock: "watches" },
  mannequin: { width: 0.56, depth: 0.5, height: 1.88, color: "#f3ece4", accent: "#1a1c20", stock: "dresses" },
  mannequinCase: { width: 1.08, depth: 0.88, height: 2.28, color: "#f4f1ec", accent: "#1a2a4a", stock: "none" },
  glowRunway: { width: 1.35, depth: 1.15, height: 2.18, color: "#e8dcc8", accent: "#ffffff", stock: "none" },
  fittingRoom: { width: 1.82, depth: 1.72, height: 2.42, color: "#f3ebe0", accent: "#3a2a1e", stock: "none" },
  shoeWall: { width: 1.9, depth: 0.42, height: 2.05, color: "#f4eee6", accent: "#c6a56a", stock: "shoes" },
  shoeIsland: { width: 1.6, depth: 0.85, height: 0.72, color: "#f4eee6", accent: "#c6a56a", stock: "shoes" },
  mirror: { width: 0.72, depth: 0.1, height: 1.85, color: "#e7ecf2", accent: "#c6a56a", stock: "none" },
  sofa: { width: 1.85, depth: 0.78, height: 0.78, color: "#3a2e28", accent: "#c6a56a", stock: "none" },
  loungeChair: { width: 0.78, depth: 0.82, height: 0.8, color: "#121014", accent: "#c6a56a", stock: "none" },
  coffeeTable: { width: 1.05, depth: 0.58, height: 0.4, color: "#1a1612", accent: "#c6a56a", stock: "none" },
  ottoman: { width: 0.62, depth: 0.62, height: 0.4, color: "#121014", accent: "#c6a56a", stock: "none" },
  sideboard: { width: 1.95, depth: 0.42, height: 0.74, color: "#1a1612", accent: "#c6a56a", stock: "none" },
  poster: { width: 1.15, depth: 0.1, height: 1.85, color: "#1a1612", accent: "#c6a56a", stock: "none" },
  logo: { width: 0.78, depth: 0.08, height: 1.65, color: "#1a1612", accent: "#c6a56a", stock: "none" },
  ledBanner: { width: 0.72, depth: 0.07, height: 1.52, color: "#101218", accent: "#c6a56a", stock: "none" },
  ledDesk: { width: 0.52, depth: 0.14, height: 0.34, color: "#101218", accent: "#c6a56a", stock: "none" },
  securityGate: { width: 2.45, depth: 0.22, height: 1.42, color: "#11141a", accent: "#d4af37", stock: "none" },
  logoMat: { width: 2.35, depth: 1.15, height: 0.01, color: "#100e0c", accent: "#d4af37", stock: "none" },
  hoursPlaque: { width: 0.42, depth: 0.04, height: 0.32, color: "#100e0c", accent: "#d4af37", stock: "none" },
  windowVinyl: { width: 1.85, depth: 0.02, height: 2.15, color: "#100e0c", accent: "#d4af37", stock: "none" },
  hangingCard: { width: 0.72, depth: 0.04, height: 0.42, color: "#100e0c", accent: "#d4af37", stock: "none" },
  splitAc: { width: 0.92, depth: 0.21, height: 0.29, color: "#f3f5f7", accent: "#c8ccd2", stock: "none" },
};

function gridOnTop(item, cols, rows, padX = 0.22, padZ = 0.22) {
  const pts = [];
  const usableW = item.width - padX;
  const usableD = item.depth - padZ;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cols === 1 ? 0 : -usableW / 2 + (c * usableW) / (cols - 1);
      const z = rows === 1 ? 0 : -usableD / 2 + (r * usableD) / (rows - 1);
      pts.push({ x, z, i: r * cols + c });
    }
  }
  return pts;
}

export function isProductDesk(type) {
  return (
    type === "phonePedestal" ||
    type === "haloDesk" ||
    type === "cube" ||
    type === "table" ||
    type === "counter" ||
    type === "phoneIsland" ||
    type === "desk" ||
    type === "phoneBar" ||
    type === "ledDesk"
  );
}

export function isHiddenSlot(item, slotId) {
  return Boolean(slotId && Array.isArray(item.hiddenSlots) && item.hiddenSlots.includes(slotId));
}

export function defaultDeskScale(category) {
  if (category === "laptops") return 1.25;
  if (category === "tablets") return 1.18;
  if (category === "phones") return 1.5;
  return 1;
}

export function nextDeskProductPose(item) {
  const occ = [];
  const hidden = item.hiddenSlots || [];
  if (item.type === "phonePedestal") {
    const side = Math.max(0.34, item.width * 0.32);
    if (!hidden.includes("top")) occ.push({ x: 0, z: 0.02 });
    if (!hidden.includes("ipad-l")) occ.push({ x: -side, z: 0.06 });
    if (!hidden.includes("ipad-r")) occ.push({ x: side, z: 0.04 });
  }
  for (const extra of item.extras || []) occ.push({ x: Number(extra.x) || 0, z: Number(extra.z) || 0 });
  const cols = 3;
  const rows = 3;
  const pw = Math.max(0.28, item.width - 0.28);
  const pd = Math.max(0.22, item.depth - 0.28);
  const spots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      spots.push({
        x: -pw / 2 + (c * pw) / (cols - 1),
        z: -pd / 2 + (r * pd) / (rows - 1),
        rotY: 0.14 * (c - 1),
      });
    }
  }
  for (const spot of spots) {
    if (!occ.some((o) => Math.hypot(o.x - spot.x, o.z - spot.z) < 0.24)) return spot;
  }
  const n = occ.length;
  return { x: ((n % 3) - 1) * 0.26, z: -0.2 + Math.floor(n / 3) * 0.2, rotY: 0.08 };
}

function placeDeskProduct(group, item, spec, y) {
  const category = spec.category || "phones";
  const index = spec.index ?? 0;
  const scale = spec.scale ?? defaultDeskScale(category);
  const x = spec.x || 0;
  const z = spec.z || 0;
  const slotId = spec.slotId;
  let node;
  if (category === "laptops") {
    node = makeDeskLaptop(index, x, y, z, { slotId, furnId: item.id, id: `prod-${item.id}-${slotId}` });
    node.scale.setScalar(scale);
  } else if (category === "tablets") {
    node = makeDeskIpad(index, x, y, z, { slotId, furnId: item.id, id: `prod-${item.id}-${slotId}`, scale });
  } else {
    node = makeDisplayProduct(category, index, x, y, z, {
      scale,
      slotId,
      furnId: item.id,
      id: `prod-${item.id}-${slotId}`,
      shelf: category === "phones",
    });
  }
  node.rotation.y = spec.rotY || 0;
  node.userData.slotId = slotId;
  node.userData.furnId = item.id;
  node.userData.scale = scale;
  node.userData.productIndex = index;
  group.add(node);
}

function placeExtras(group, item) {
  if (!item.extras || !item.extras.length) return;
  const y0 = item.type === "phonePedestal" ? item.height + 0.036 : item.height + 0.02;
  for (const extra of item.extras) {
    placeDeskProduct(group, item, extra, extra.y ?? y0);
  }
}

function placeDisplay(group, item, slotId, fallback) {
  if (isHiddenSlot(item, slotId)) return;
  const swap = item.productMap?.[slotId];
  const category = swap?.category || fallback.category;
  const index = category === "watches" ? nextWatchColor() : swap?.index ?? fallback.index;
  const scale = swap?.scale ?? fallback.scale;
  const node = makeDisplayProduct(category, index, fallback.x, fallback.y, fallback.z, {
    scale,
    slotId,
    furnId: item.id,
    id: `prod-${item.id}-${slotId}`,
    barY: fallback.barY,
    color: fallback.color,
    rotY: fallback.rotY,
    tilt: fallback.tilt,
    stand: fallback.stand,
    ice: fallback.ice,
    style: fallback.style,
    simple: fallback.simple,
    shelf: fallback.shelf,
  });
  node.rotation.y = fallback.rotY || 0;
  if (fallback.tilt != null) node.rotation.x = fallback.tilt;
  node.userData.slotId = slotId;
  node.userData.furnId = item.id;
  node.userData.scale = scale;
  node.userData.productIndex = index;
  group.add(node);
}

function fillStock(group, item) {
  const kind = item.stock;
  if (!kind || kind === "none") return;
  if (item.type === "ledGlassBay") return;
  const w = item.width;
  const d = item.depth;
  const h = item.height;

  if (item.type === "phonePedestal") {
    const idx = item.productMap?.top?.index ?? Math.abs(Math.round((item.x || 0) * 5 + (item.z || 0) * 3));
    const y = h + 0.036;
    if (!isHiddenSlot(item, "top")) {
      const mapped = item.productMap?.top;
      placeDeskProduct(
        group,
        item,
        {
          slotId: "top",
          category: mapped?.category || "laptops",
          index: mapped?.index ?? idx,
          x: 0,
          z: 0.02,
          rotY: 0.18,
          scale: mapped?.scale ?? 1.72,
        },
        y
      );
    }
    const side = Math.max(0.34, w * 0.32);
    [
      { slot: "ipad-l", x: -side, z: 0.06, rot: 0.32, i: idx },
      { slot: "ipad-r", x: side, z: 0.04, rot: -0.28, i: idx + 1 },
    ].forEach((p) => {
      if (isHiddenSlot(item, p.slot)) return;
      const mapped = item.productMap?.[p.slot];
      placeDeskProduct(
        group,
        item,
        {
          slotId: p.slot,
          category: mapped?.category || "tablets",
          index: mapped?.index ?? p.i,
          x: p.x,
          z: p.z,
          rotY: p.rot,
          scale: mapped?.scale ?? 1.18,
        },
        y
      );
    });
    return;
  }

  if (kind === "phones") {
    if (item.type === "phoneBar") {
      const y = h + 0.03;
      const cols = Math.max(3, Math.min(6, Math.round(w / 0.58)));
      for (const p of gridOnTop(item, cols, 1, 0.46, 0.32)) {
        placeDisplay(group, item, `bar-${p.i}`, { category: "phones", index: p.i, x: p.x, y, z: p.z * 0.12, scale: 1 });
      }
      return;
    }
    if (item.type === "brandCubby") {
      const cols = 4;
      const rows = 3;
      const cw = (w - 0.16) / cols;
      const ch = (h - 0.55) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = -w / 2 + 0.1 + (c + 0.5) * cw;
          const cy = 0.28 + (r + 0.5) * ch;
          const y = cy - ch * 0.32 + 0.018;
          const i = r * cols + c;
          const brand = String(item.posterText || "").toLowerCase();
          const base = brand.includes("samsung") ? 4 : brand.includes("pixel") ? 8 : 0;
          placeDisplay(group, item, `c${r}-${c}`, {
            category: "phones",
            index: base + (i % 4),
            x,
            y,
            z: 0.06,
            scale: 1.7,
            shelf: true,
          });
        }
      }
      return;
    }
    if (item.type === "accessoryWall" || item.type === "phoneCabinet" || item.type === "shelf") {
      const rows = 4;
      const cols = Math.max(3, Math.round(w / (item.type === "shelf" ? 0.52 : 0.42)));
      const startY = item.type === "phoneCabinet" ? 0.82 : item.type === "shelf" ? h / 4.3 + 0.02 : 0.38;
      const stepY =
        item.type === "phoneCabinet"
          ? (h - 1.05) / Math.max(1, rows - 1)
          : item.type === "shelf"
            ? h / (rows + 0.3)
            : 0.36;
      const slots = shelfSlots(item, rows, cols, startY, stepY);
      for (const p of slots) {
        placeDisplay(group, item, `s${p.row}-${p.col}`, {
          category: "phones",
          index: p.i,
          x: p.x,
          y: p.y + 0.01,
          z: p.z,
          scale: 1.95,
          shelf: true,
        });
      }
      return;
    }
    const cols = Math.max(2, Math.min(5, Math.round(w / 0.42)));
    const rows = item.type === "glassCase" || item.type === "counter" ? 1 : Math.min(2, Math.max(1, Math.round(d / 0.5)));
    const y =
      item.type === "glassCase" ? h * 0.48 : item.type === "phoneIsland" || item.type === "counter" ? h + 0.03 : h;
    for (const p of gridOnTop(item, cols, rows, 0.32, 0.26)) {
      if (item.type === "phoneIsland" && Math.abs(p.x) < 0.18 && Math.abs(p.z) < 0.16) continue;
      placeDisplay(group, item, `t${p.i}`, {
        category: "phones",
        index: p.i,
        x: p.x,
        y,
        z: p.z * (item.type === "glassCase" ? 0.45 : 1),
        scale: 1,
      });
    }
    return;
  }

  if (kind === "dresses") {
    if (item.type === "dressNiche") {
      const { bay, xs } = dressShelfLayout(w);
      const railY = dressShelfRailY(h);
      const perBay = bay >= 0.9 ? 4 : 3;
      let slot = 0;
      xs.forEach((bx) => {
        for (let i = 0; i < perBay; i++) {
          const span = Math.max(0.28, bay - 0.28);
          const x = bx + (perBay === 1 ? 0 : -span / 2 + (i * span) / (perBay - 1));
          placeDisplay(group, item, `d${slot}`, {
            category: "dresses",
            index: slot,
            x,
            y: railY,
            z: 0.03,
            barY: railY,
            rotY: i % 2 ? 0.12 : -0.1,
            style: "shirt",
            color: shirtColor(item, slot),
          });
          slot += 1;
        }
      });
      return;
    }
    if (item.type === "rack") {
      const usable = Math.max(0.4, w - 0.18);
      const n = Math.max(4, Math.round(usable / 0.22));
      const rails = rackRailYs(h);
      let slot = 0;
      rails.forEach((barY, rail) => {
        for (let i = 0; i < n; i++) {
          const x = -usable / 2 + (i * usable) / Math.max(1, n - 1);
          const topCycle = ["dress", "dress", "shirt", "dress", "blazer"];
          const lowCycle = ["pants", "shirt", "dress", "pants", "shirt"];
          placeDisplay(group, item, `d${slot}`, {
            category: "dresses",
            index: slot,
            x,
            y: barY,
            z: (i % 2 ? 0.01 : -0.01),
            barY,
            rotY: (i % 2 ? 0.2 : -0.18) + i * 0.01,
            style: rail === 0 ? lowCycle[i % 5] : topCycle[i % 5],
            color: shirtColor(item, slot),
          });
          slot += 1;
        }
      });
      return;
    }
    if (item.type === "cube" || item.type === "table" || item.type === "coffeeTable" || item.type === "counter" || item.type === "marbleIsland") {
      const n = Math.max(3, Math.round(w / 0.28));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.2 + (i * (w - 0.4)) / Math.max(1, n - 1);
        const pile = makeFoldedDress(DRESS_COLORS[i % DRESS_COLORS.length], x, h, 0, {
          rotY: (i % 2 ? 0.12 : -0.08),
          slotId: `pile${i}`,
          furnId: item.id,
          id: `prod-${item.id}-pile${i}`,
        });
        group.add(pile);
      }
    }
    return;
  }

  if (kind === "shoes") {
    if (item.type === "marblePlinth") {
      placeDisplay(group, item, "top", { category: "shoes", index: 0, x: 0, y: h + 0.02, z: 0 });
      return;
    }
    if (item.type === "shoeWall" || item.type === "shelf") {
      const rows = item.type === "shelf" ? 4 : 5;
      const cols = Math.max(3, Math.round(w / 0.38));
      for (let r = 0; r < rows; r++) {
        const y = item.type === "shelf" ? ((h / (rows + 0.3)) * (r + 1)) + 0.03 : 0.28 + r * 0.34;
        for (let c = 0; c < cols; c++) {
          const x = -w / 2 + 0.22 + (c * (w - 0.44)) / Math.max(1, cols - 1);
          placeDisplay(group, item, `sh${r}-${c}`, { category: "shoes", index: r + c, x, y, z: d / 2 - 0.14 });
        }
      }
      return;
    }
    const cols = Math.max(2, Math.round(w / 0.42));
    const rows = Math.max(1, Math.round(d / 0.36));
    for (const p of gridOnTop(item, cols, rows, 0.4, 0.3)) {
      placeDisplay(group, item, `sh${p.i}`, { category: "shoes", index: p.i, x: p.x, y: h, z: p.z, rotY: Math.PI * 0.08 });
    }
    return;
  }

  if (kind === "watches") {
    const aisleTilt = Math.abs(item.rotY || 0) > 0.4 ? 0.58 : -0.58;
    const seed = Math.abs(Math.round((item.x || 0) * 23 + (item.z || 0) * 41 + (item.rotY || 0) * 9 + (item.watchIndex || 0) * 17));
    if (item.type === "watchTower") {
      placeDisplay(group, item, "top", {
        category: "watches",
        index: seed,
        x: 0,
        y: h + 0.028,
        z: 0.01,
        scale: item.watchScale ?? 1.85,
        tilt: aisleTilt * 0.55,
        stand: false,
      });
      return;
    }
    const cols = 4;
    const shelfYs = item.type === "glassCase" ? watchCaseLayout(item).shelfYs : [h];
    const caseScale = Math.min(1.22, 0.88 + w * 0.1);
    const inset = Math.min(0.24, w * 0.1);
    let n = 0;
    for (const y of shelfYs) {
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + inset + (c * (w - inset * 2)) / (cols - 1);
        placeDisplay(group, item, `w${n}`, {
          category: "watches",
          index: seed + n + 1,
          x,
          y: y + 0.014,
          z: Math.max(0.06, d * 0.16),
          scale: caseScale,
          tilt: aisleTilt * 0.28,
          stand: false,
          ice: false,
        });
        n += 1;
      }
    }
    return;
  }

  if (kind === "grocery") {
    const rows = item.type === "shelf" ? 4 : 3;
    const cols = Math.max(3, Math.round(w / 0.28));
    const startY = item.type === "shelf" ? h / (rows + 0.3) + 0.03 : 0.38;
    const stepY = item.type === "shelf" ? h / (rows + 0.3) : 0.34;
    if (item.type === "shelf" || item.type === "accessoryWall") {
      addGroceryShelf(group, shelfSlots(item, rows, cols, startY, stepY));
      return;
    }
    addGroceryTop(
      group,
      gridOnTop(item, Math.max(3, Math.round(w / 0.28)), Math.min(2, Math.max(1, Math.round(d / 0.28))), 0.28, 0.24).map(
        (p) => ({ x: p.x, y: h + 0.07, z: p.z })
      )
    );
    return;
  }

  if (kind === "cafe") {
    if (item.type === "table" || item.type === "cube") {
      placeDisplay(group, item, "m0", { category: "cafe", index: 0, x: -0.12, y: h, z: 0.08 });
      placeDisplay(group, item, "m1", { category: "cafe", index: 1, x: 0.14, y: h, z: -0.06 });
      return;
    }
    if (item.type === "counter") {
      addCafeCounter(
        group,
        gridOnTop(item, Math.max(3, Math.round(w / 0.32)), 1, 0.3, 0.2).map((p) => ({ x: p.x, y: h + 0.08, z: p.z })),
        gridOnTop(item, Math.min(5, Math.max(2, Math.round(w / 0.7))), 1, 0.45, 0.25).map((p) => ({
          x: p.x,
          y: h,
          z: p.z * 0.35,
        }))
      );
      return;
    }
    addCafeShelf(group, shelfSlots(item, 3, Math.max(3, Math.round(w / 0.32)), 0.4, 0.36));
    return;
  }

  if (kind === "pharmacy") {
    const rows = item.type === "shelf" ? 4 : 3;
    const cols = Math.max(4, Math.round(w / 0.24));
    const startY = item.type === "shelf" ? h / (rows + 0.3) + 0.03 : 0.36;
    const stepY = item.type === "shelf" ? h / (rows + 0.3) : 0.32;
    if (item.type === "shelf" || item.type === "accessoryWall") {
      addPharmacyShelf(group, shelfSlots(item, rows, cols, startY, stepY));
      return;
    }
    addPharmacyTop(
      group,
      gridOnTop(item, Math.max(3, Math.round(w / 0.26)), 1, 0.28, 0.2).map((p) => ({ x: p.x, y: h + 0.07, z: p.z }))
    );
  }
}

function posterTexture(text, fg, bg) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 768;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 768);
  g.addColorStop(0, bg || "#1a1612");
  g.addColorStop(1, "#0c0a08");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 768);
  ctx.strokeStyle = fg || "#c6a56a";
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, 468, 724);
  ctx.fillStyle = fg || "#c6a56a";
  ctx.font = "500 18px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MAISON ATELIER", 256, 86);
  ctx.fillStyle = "#f6f1e8";
  ctx.font = "600 64px Cormorant Garamond, serif";
  const lines = String(text || "NEW IN").split(" ");
  lines.forEach((line, i) => ctx.fillText(line, 256, 300 + i * 78));
  ctx.font = "500 16px DM Sans, sans-serif";
  ctx.fillStyle = "#c6a56a";
  ctx.fillText("LIMITED  ·  LOOKBOOK 26", 256, 640);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BOUTIQUE_TEX = new Map();
function boutiqueTex(key, w, h, draw) {
  if (BOUTIQUE_TEX.has(key)) return BOUTIQUE_TEX.get(key);
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
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  BOUTIQUE_TEX.set(key, tex);
  return tex;
}

function watchMatTex(word, fg, bg) {
  return boutiqueTex(`mat:${word}:${fg}:${bg}`, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg || "#100e0c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg || "#d4af37";
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    ctx.strokeRect(28, 28, w - 56, h - 56);
    ctx.fillStyle = fg || "#d4af37";
    ctx.font = "600 42px Cormorant Garamond, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(word || "CHRONOS").toUpperCase().slice(0, 14), w / 2, h / 2 - 8);
    ctx.font = "500 13px DM Sans, sans-serif";
    ctx.fillStyle = "rgba(244,239,230,0.55)";
    ctx.fillText("SWISS  ·  GENEVA  ·  EST. 1924", w / 2, h / 2 + 36);
  });
}

function hoursPlaqueTex(fg, bg) {
  const tech = String(fg || "").toLowerCase().includes("e8") || String(fg || "").toLowerCase().includes("ee") || String(bg || "").includes("081018");
  return boutiqueTex(`hours:${fg}:${bg}`, 256, 192, (ctx, w, h) => {
    ctx.fillStyle = bg || "#100e0c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg || "#d4af37";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = fg || "#d4af37";
    ctx.font = "700 22px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("OPEN", w / 2, 58);
    ctx.fillStyle = tech ? "#e8f6ff" : "#f6f1e8";
    ctx.font = tech ? "600 20px DM Sans, sans-serif" : "600 20px Cormorant Garamond, serif";
    ctx.fillText("10:00  —  22:00", w / 2, 100);
    ctx.font = "500 11px DM Sans, sans-serif";
    ctx.fillStyle = tech ? "rgba(74,224,238,0.85)" : "rgba(212,175,55,0.8)";
    ctx.fillText(tech ? "DEMO  ·  TRADE-IN  ·  REPAIR" : "PRIVATE VIEWING BY APPOINTMENT", w / 2, 142);
  });
}

function vinylTex(word, fg) {
  const raw = String(word || "CHRONOS");
  const tech = /5G|CAMERA|PHONE|PRO|LIVE|TRADE/i.test(raw);
  return boutiqueTex(`vinyl:${word}:${fg}`, 512, 640, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = fg || "#d4af37";
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg || "#d4af37";
    ctx.font = "500 16px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tech ? "NOW IN STORE" : "MAISON", w / 2, 120);
    ctx.font = tech ? "700 52px DM Sans, sans-serif" : "600 58px Cormorant Garamond, serif";
    const lines = raw.toUpperCase().split(" ");
    lines.forEach((line, i) => ctx.fillText(line, w / 2, 250 + i * 70));
    ctx.font = "500 14px DM Sans, sans-serif";
    ctx.fillText(tech ? "FLAGSHIP  ·  DEMO BAR" : "GENEVA   ·   SWISS MADE", w / 2, 480);
    ctx.fillRect(w / 2 - 28, 510, 56, 2);
    ctx.font = "500 12px DM Sans, sans-serif";
    ctx.fillText(tech ? "LATEST ARRIVALS" : "TIMEPIECES", w / 2, 545);
  });
}

function hangingCardTex(word, fg, bg) {
  return boutiqueTex(`hang:${word}:${fg}`, 384, 256, (ctx, w, h) => {
    ctx.fillStyle = bg || "#100e0c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg || "#d4af37";
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = fg || "#d4af37";
    ctx.font = "500 13px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("THE COLLECTION", w / 2, 62);
    ctx.fillStyle = "#f6f1e8";
    ctx.font = "600 36px Cormorant Garamond, serif";
    ctx.fillText(String(word || "SWISS MADE").toUpperCase(), w / 2, 130);
    ctx.fillStyle = fg || "#d4af37";
    ctx.font = "500 12px DM Sans, sans-serif";
    ctx.fillText("LIMITED  ·  IN STORE", w / 2, 188);
  });
}

function addLiveCheckout(group, w, topY, d, brass) {
  const y = topY + 0.01;
  const dark = new THREE.MeshStandardMaterial({ color: "#16181c", metalness: 0.42, roughness: 0.38 });
  const gold = brass;
  const screen = boutiqueTex("pos-screen", 256, 160, (ctx, tw, th) => {
    ctx.fillStyle = "#0b1016";
    ctx.fillRect(0, 0, tw, th);
    ctx.fillStyle = "#d4af37";
    ctx.font = "600 18px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CHRONOS  POS", tw / 2, 42);
    ctx.fillStyle = "#f6f1e8";
    ctx.font = "600 28px Cormorant Garamond, serif";
    ctx.fillText("4,800", tw / 2, 88);
    ctx.font = "500 11px DM Sans, sans-serif";
    ctx.fillStyle = "rgba(212,175,55,0.8)";
    ctx.fillText("CHRONOS OR  ·  WT-CO-31", tw / 2, 122);
  });
  group.add(box(0.26, 0.18, 0.02, new THREE.MeshStandardMaterial({
    map: screen,
    roughness: 0.22,
    metalness: 0.08,
    emissive: "#1a1408",
    emissiveIntensity: 0.22,
  }), w * 0.22, y + 0.22, -d * 0.08, false));
  group.add(box(0.22, 0.04, 0.08, dark, w * 0.22, y + 0.04, -d * 0.08));
  group.add(box(0.12, 0.03, 0.08, dark, w * 0.22, y + 0.035, d * 0.18));
  group.add(box(0.09, 0.014, 0.06, gold, w * 0.22, y + 0.055, d * 0.18, false));
  group.add(box(0.16, 0.05, 0.1, dark, -w * 0.28, y + 0.03, -d * 0.12));
  const bag = new THREE.MeshStandardMaterial({ color: "#1a1612", roughness: 0.72 });
  group.add(box(0.12, 0.16, 0.06, bag, -w * 0.32, y + 0.09, d * 0.16, false));
  group.add(box(0.1, 0.14, 0.05, bag, -w * 0.22, y + 0.08, d * 0.2, false));
  group.add(box(0.08, 0.008, 0.008, gold, -w * 0.32, y + 0.18, d * 0.16, false));
  group.add(box(0.18, 0.012, 0.12, gold, 0, y + 0.008, d * 0.05, false));
  group.add(box(0.05, 0.09, 0.05, new THREE.MeshStandardMaterial({
    color: "#e8d5a3",
    roughness: 0.18,
    metalness: 0.12,
  }), w * 0.08, y + 0.055, d * 0.22, false));
}

function bannerCopy(text) {
  const key = String(text || "LIVE").toUpperCase();
  const pack = {
    "MOBILE HUB": { kicker: "LIVE", line: "LATEST 5G", sub: "PHONES & GEAR" },
    "5G LIVE": { kicker: "FLAGSHIP", line: "5G LIVE", sub: "NEW ARRIVALS" },
    "LATEST 5G": { kicker: "LIVE", line: "LATEST 5G", sub: "PHONES & GEAR" },
    UNIVERSAL: { kicker: "STORE", line: "UNIVERSAL", sub: "PHONES  ·  LIVE" },
    PHONES: { kicker: "TECH", line: "PHONES", sub: "OPEN NOW" },
    "TRADE IN": { kicker: "TODAY", line: "TRADE IN", sub: "SAVE UP TO 40%" },
    IPHONE: { kicker: "NEW", line: "iPHONE", sub: "PRO SERIES" },
    GALAXY: { kicker: "DROP", line: "GALAXY", sub: "ULTRA NOW" },
    DEALS: { kicker: "HOT", line: "DEALS", sub: "THIS WEEK" },
    SAMSUNG: { kicker: "LIVE", line: "SAMSUNG", sub: "FOLD & FLIP" },
  };
  return pack[key] || { kicker: "LIVE", line: key.slice(0, 12), sub: "DIGITAL WALL" };
}

function makeLedBannerTex(item, vertical) {
  const w = vertical ? 512 : 1280;
  const h = vertical ? 1280 : 360;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const copy = bannerCopy(item.posterText || item.logoWord || "LIVE");
  const bg = item.color || "#101218";
  const accent = item.accent || "#c6a56a";
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg);
  g.addColorStop(1, "#07080c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = vertical ? 10 : 8;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.fillRect(16, 16, w - 32, vertical ? 8 : 6);
  ctx.fillStyle = "#8ee0ff";
  ctx.font = `600 ${vertical ? 22 : 18}px DM Sans, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("●  DIGITAL  ·  LIVE", w / 2, vertical ? 70 : 52);
  ctx.fillStyle = "#f6f1e8";
  ctx.font = `600 ${vertical ? 36 : 24}px DM Sans, sans-serif`;
  ctx.fillText(copy.kicker, w / 2, vertical ? 150 : 108);
  ctx.font = `600 ${vertical ? 78 : 64}px Cormorant Garamond, serif`;
  ctx.fillText(copy.line, w / 2, vertical ? 300 : 200);
  ctx.fillStyle = accent;
  ctx.font = `600 ${vertical ? 32 : 22}px DM Sans, sans-serif`;
  ctx.fillText(copy.sub, w / 2, vertical ? 390 : 268);
  if (vertical) {
    ctx.fillStyle = "rgba(198,165,106,0.16)";
    ctx.fillRect(64, 460, w - 128, 2);
    ctx.fillStyle = "#f6f1e8";
    ctx.font = "600 30px DM Sans, sans-serif";
    ctx.fillText("PHONES  ·  WATCHES  ·  GEAR", w / 2, 540);
    ctx.fillStyle = "rgba(142,224,255,0.88)";
    ctx.font = "500 20px DM Sans, sans-serif";
    ctx.fillText("SWIPE  ·  NEW IN  ·  VIP", w / 2, 610);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 8; i++) ctx.fillRect(80, 700 + i * 48, w - 160, 20);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addDigitalBanner(group, item, brass) {
  const wall = item.type === "ledBanner" || item.logoMount === "wall";
  const wide = item.bannerShape === "wide" || item.width > item.height * 1.35;
  const sw = item.width;
  const sh = item.height;
  const lift = item.lift ?? (wall ? 2.1 : 1.1);
  const tex = item._map || makeLedBannerTex(item, !wide);
  const frame = new THREE.MeshStandardMaterial({
    color: "#1a1c20",
    metalness: 0.72,
    roughness: 0.28,
  });
  const on = item.lightOn !== false;
  const glowCol = item.lightColor || item.accent || "#2ad4e8";
  const face = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.14,
    metalness: 0.08,
    emissive: "#ffffff",
    emissiveMap: tex,
    emissiveIntensity: item.type === "ledDesk" && on ? 1.18 : item.type === "ledBanner" ? 0.12 : on ? 0.28 : 0.08,
  });
  const screen = new THREE.Group();
  screen.add(box(sw + 0.05, sh + 0.05, 0.045, frame, 0, 0, 0));
  screen.add(box(sw + 0.07, 0.016, 0.055, brass, 0, sh / 2 + 0.028, 0));
  screen.add(box(sw + 0.07, 0.016, 0.055, brass, 0, -sh / 2 - 0.028, 0));
  const pane = new THREE.Mesh(PLANE, face);
  pane.scale.set(sw, sh, 1);
  pane.position.z = 0.026;
  screen.add(pane);
  const back = pane.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.026;
  screen.add(back);
  if (item.type === "ledDesk") {
    screen.add(box(sw + 0.02, 0.012, 0.01, CYAN_LED, 0, sh / 2 + 0.01, 0.03, false));
    screen.add(box(sw + 0.02, 0.012, 0.01, CYAN_LED, 0, -sh / 2 - 0.01, 0.03, false));
    screen.add(box(0.012, sh, 0.01, CYAN_LED, -sw / 2 - 0.01, 0, 0.03, false));
    screen.add(box(0.012, sh, 0.01, CYAN_LED, sw / 2 + 0.01, 0, 0.03, false));
    screen.add(box(sw * 0.72, 0.012, 0.014, CYAN_LED, 0, -sh / 2 - 0.04, 0.02, false));
  }
  if (wall) {
    screen.position.y = lift;
    if (item.type === "ledBanner" && !item.logoSnap) {
      const hang = Math.max(0.28, 0.92);
      group.add(box(0.01, hang, 0.01, brass, -sw * 0.3, lift + sh / 2 + hang / 2, 0, false));
      group.add(box(0.01, hang, 0.01, brass, sw * 0.3, lift + sh / 2 + hang / 2, 0, false));
    }
    group.add(screen);
  } else {
    const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(sw * 0.22, sw * 0.26, 0.04, 20), brass));
    base.position.y = 0.02;
    group.add(base);
    const poleH = Math.max(0.18, lift - sh / 2 - 0.06);
    const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, poleH, 12), brass));
    pole.position.y = poleH / 2;
    group.add(pole);
    const yoke = box(sw * 0.28, 0.02, 0.02, brass, 0, lift - sh / 2 - 0.02, 0);
    group.add(yoke);
    screen.position.y = lift;
    group.add(screen);
  }
  if ((item.type === "ledDesk" || item.type === "haloDesk") && takeLampSlot()) {
    const lamp = new THREE.PointLight(glowCol, on ? Math.min(16, Math.max(6, Number(item.lightPower ?? 38))) : 0, 5.2, 2);
    lamp.position.set(0, lift, wall ? 0.22 : 0.16);
    group.add(lamp);
  }
}

let lampBudget = 0;
let watchColorSeq = 0;
let manOutfitSeq = 0;
export function resetLampBudget() {
  lampBudget = 0;
  watchColorSeq = 0;
  manOutfitSeq = 0;
  mannequinWalkers.length = 0;
}
function nextWatchColor() {
  return watchColorSeq++;
}

const SOFA_GLB = "./models/furniture/sofa_parma.glb";
let SOFA_MASTER = null;
let sofaLoad = null;

function fitSofaGlb(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = 1 / Math.max(size.x, 0.001);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const mid = box2.getCenter(new THREE.Vector3());
  root.position.x -= mid.x;
  root.position.z -= mid.z;
  root.position.y -= box2.min.y;
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.2);
      if (mat.sheen != null) mat.sheen = Math.max(mat.sheen, 0.55);
    }
  });
  return root;
}

export function loadSofaModels() {
  if (sofaLoad) return sofaLoad;
  sofaLoad = new Promise((resolve) => {
    new GLTFLoader().load(
      SOFA_GLB,
      (gltf) => {
        if (gltf?.scene) SOFA_MASTER = fitSofaGlb(gltf.scene);
        resolve(!!SOFA_MASTER);
      },
      undefined,
      () => resolve(false)
    );
  });
  return sofaLoad;
}

function addSofaModel(group, item) {
  if (!SOFA_MASTER) return false;
  const sofa = SOFA_MASTER.clone(true);
  sofa.scale.multiplyScalar(item.width || 1.85);
  sofa.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sofa);
  sofa.position.x -= (box.max.x + box.min.x) / 2;
  sofa.position.z -= (box.max.z + box.min.z) / 2;
  sofa.position.y -= box.min.y;
  const tint = new THREE.Color(item.color || "#1a1612");
  sofa.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map((mat) => {
      const next = mat.clone();
      if (next.color && (next.metalness ?? 0) < 0.45) next.color.lerp(tint, 0.28);
      next.envMapIntensity = Math.max(next.envMapIntensity ?? 1, 1.2);
      return next;
    });
    if (m.material.length === 1) m.material = m.material[0];
  });
  group.add(sofa);
  return true;
}

const MAN_GLBS = [
  { url: "./models/mannequin/business_man.glb", kind: "man", outfit: "suit" },
  { url: "./models/mannequin/cool_man.glb", kind: "man", outfit: "cool" },
  { url: "./models/mannequin/lumberjack.glb?v=tex1", kind: "man", outfit: "lumber" },
  { url: "./models/mannequin/rpm.glb", kind: "man", outfit: "casual" },
];
const MAN_MASTERS = [];
let manLoad = null;
const OUTFIT_TINTS = ["#f2eee8", "#2f4068", "#7a2436", "#1f4a3c"];

function applyIdlePose(gltf) {
  const clips = gltf.animations || [];
  const clip =
    clips.find((a) => /rig\|idle$/i.test(a.name)) ||
    clips.find((a) => /(^|[|_ -])idle([|_ -]|$)/i.test(a.name)) ||
    clips.find((a) => /static_pose|standing|stand$/i.test(a.name));
  if (!clip) return;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  mixer.update(0.12);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((m) => {
    if (m.isSkinnedMesh) m.skeleton.update();
  });
}

function fitManGlb(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = 1 / Math.max(size.y, 0.001);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const mid = box2.getCenter(new THREE.Vector3());
  root.position.x -= mid.x;
  root.position.z -= mid.z;
  root.position.y -= box2.min.y;
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = Math.max(mat.map.anisotropy || 1, QUALITY.aniso);
      }
      if (mat.normalMap) mat.normalMap.colorSpace = THREE.NoColorSpace;
      if (mat.roughnessMap) mat.roughnessMap.colorSpace = THREE.NoColorSpace;
      mat.envMapIntensity = 1.2;
      mat.needsUpdate = true;
    }
  });
  return root;
}

function loadGlbFile(url) {
  return new Promise((resolve) => {
    new GLTFLoader().load(url, resolve, undefined, () => resolve(null));
  });
}

export function loadMannequinModels() {
  if (manLoad) return manLoad;
  manLoad = (async () => {
    const loaded = await Promise.all(
      MAN_GLBS.map(async (spec) => {
        const gltf = await loadGlbFile(spec.url);
        if (!gltf?.scene) return null;
        applyIdlePose(gltf);
        return { kind: spec.kind, outfit: spec.outfit, root: fitManGlb(gltf.scene), clips: gltf.animations || [] };
      })
    );
    MAN_MASTERS.length = 0;
    for (const m of loaded) if (m) MAN_MASTERS.push(m);
    return MAN_MASTERS.length > 0;
  })();
  return manLoad;
}

export function mannequinModelsReady() {
  return MAN_MASTERS.length > 0;
}

export function compileMannequinModels(renderer, scene, camera) {
  if (!renderer || !camera || !MAN_MASTERS.length) return;
  const tmp = new THREE.Scene();
  if (scene?.environment) tmp.environment = scene.environment;
  for (const m of MAN_MASTERS) {
    if (!m?.root) continue;
    tmp.add(m.root);
    try {
      renderer.compile(tmp, camera);
    } catch {}
    tmp.remove(m.root);
  }
}

function nextManOutfit() {
  return manOutfitSeq++;
}

export const MAN_OUTFITS = [
  { id: "suit", label: "Tailored suit" },
  { id: "cool", label: "Modern look" },
  { id: "lumber", label: "Wool layer" },
  { id: "casual", label: "Smart casual" },
];

function pickManMaster(prefer, slot, outfit) {
  if (!MAN_MASTERS.length) return null;
  if (outfit) {
    const hit = MAN_MASTERS.find((m) => m.outfit === outfit);
    if (hit) return hit;
  }
  const pool = MAN_MASTERS.filter((m) => m.kind === prefer);
  const list = pool.length ? pool : MAN_MASTERS;
  return list[slot % list.length];
}

function manMeshRole(mesh, mat) {
  const n = `${mat?.name || ""} ${mesh.name || ""} ${mesh.parent?.name || ""}`.toLowerCase();
  if (/eye|cornea|sclera|tears/.test(n)) return "eye";
  if (/hair|brow|beard|mustache|lash|fur/.test(n)) return "hair";
  if (/glass|hat|headwear|cap_/.test(n)) return "prop";
  if (/shoe|boot|footwear|footwear|sneaker/.test(n)) return "shoe";
  if (/skin|body|face|arm|leg|hand|neck|wolf3d_body|wolf3d_head(?!wear)/.test(n)) return "skin";
  if (/outfit|shirt|pant|cloth|jacket|coat|top|bottom|suit|denim|hoodie/.test(n)) return "cloth";
  return "keep";
}

function styleBoutiqueMan(root, item, outfit = "") {
  const accent = new THREE.Color(item.accent || "#1a1c20");
  const keepTex = !item.color || /#f3ece4|#f7f2ec|#ffffff|#f7f3ec/i.test(item.color);
  const wash = {
    suit: "#e8e6e2",
    cool: "#ece6de",
    lumber: "#d8cfc2",
    casual: "#e4e7ec",
  }[outfit] || "#ece8e2";
  root.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mat) => {
      const role = manMeshRole(m, mat);
      const copy = mat.clone();
      if (copy.map) {
        copy.map.colorSpace = THREE.SRGBColorSpace;
        copy.map.anisotropy = Math.max(copy.map.anisotropy || 1, QUALITY.aniso);
        copy.color.set(keepTex ? wash : item.color);
      } else if (copy.color && !keepTex) {
        copy.color.lerp(new THREE.Color(item.color), 0.4);
      }
      if (role === "cloth" && copy.color) copy.color.lerp(accent, 0.16);
      if (role === "skin") {
        copy.roughness = 0.52;
        copy.metalness = 0.02;
        copy.envMapIntensity = 0.62;
        if ("sheen" in copy) {
          copy.sheen = 0.22;
          copy.sheenRoughness = 0.72;
          copy.sheenColor?.set("#f3e6d8");
        }
      } else if (role === "cloth") {
        copy.roughness = Math.max(copy.roughness ?? 0.5, outfit === "suit" ? 0.38 : 0.5);
        copy.metalness = Math.min(copy.metalness ?? 0.04, 0.06);
        copy.envMapIntensity = outfit === "suit" ? 0.95 : 0.72;
        if ("sheen" in copy) {
          copy.sheen = outfit === "suit" ? 0.34 : 0.18;
          copy.sheenRoughness = 0.55;
          copy.sheenColor?.set("#f4efe6");
        }
      } else if (role === "shoe") {
        copy.roughness = 0.28;
        copy.metalness = 0.12;
        copy.envMapIntensity = 1.05;
        if ("clearcoat" in copy) {
          copy.clearcoat = 0.28;
          copy.clearcoatRoughness = 0.22;
        }
      } else if (role === "hair") {
        copy.roughness = 0.62;
        copy.envMapIntensity = 0.45;
        if (copy.alphaMap || /hair|lash|brow/i.test(`${copy.name || ""} ${m.name || ""}`)) copy.alphaTest = 0.38;
      } else if (role === "eye") {
        copy.roughness = 0.08;
        copy.metalness = 0.02;
        copy.envMapIntensity = 1.15;
      } else {
        copy.roughness = Math.min(Math.max(copy.roughness ?? 0.42, 0.28), 0.68);
        copy.envMapIntensity = 0.88;
      }
      copy.needsUpdate = true;
      return copy;
    });
    m.material = next.length === 1 ? next[0] : next;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  });
}

function applyFashionStance(root, slot = 0) {
  const side = slot % 2 ? 1 : -1;
  const twist = side * 0.09;
  root.traverse((o) => {
    const n = o.name || "";
    if (/(^|_|:)(Hips|pelvis)$/i.test(n) || /Hips_jt/i.test(n)) {
      o.rotation.y += twist * 0.5;
      o.rotation.z += side * 0.03;
    } else if (/Spine2|spine_02|Chest|Spine_jt/i.test(n)) {
      o.rotation.y += twist * 0.32;
    }
  });
}

function addBoutiqueStand(group) {
  const ink = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: "#141518",
        roughness: 0.26,
        metalness: 0.24,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.18,
      })
    : new THREE.MeshStandardMaterial({ color: "#141518", roughness: 0.28, metalness: 0.2, envMapIntensity: 1.05 });
  const brass = metalMat("#c6a56a");
  const glow = new THREE.MeshStandardMaterial({
    color: "#fff6ea",
    emissive: "#ffe3b8",
    emissiveIntensity: 1.45,
    roughness: 0.28,
  });
  const ph = 0.08;
  const slab = new THREE.Mesh(extrudeRoundSlab(0.5, 0.4, 0.07, ph, QUALITY.low ? 6 : 12), ink);
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);
  group.add(box(0.42, 0.004, 0.008, brass, 0, ph + 0.003, 0.168, false));
  group.add(box(0.34, 0.007, 0.01, glow, 0, 0.01, 0.188, false));
  return ph + 0.008;
}

function plantMan(man, y0 = 0) {
  man.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(man);
  if (!Number.isFinite(box.min.x)) return;
  man.position.x -= (box.max.x + box.min.x) / 2;
  man.position.z -= (box.max.z + box.min.z) / 2;
  man.position.y -= box.min.y - y0;
  man.updateMatrixWorld(true);
}

function addManModel(group, item, opts = {}) {
  const slot = nextManOutfit();
  const master = pickManMaster(opts.kind || "man", slot, opts.outfit || item.outfit);
  if (!master) return false;
  const man = cloneSkinned(master.root);
  const height = opts.height ?? 1.68;
  const y0 = opts.y ?? 0;
  man.scale.multiplyScalar(height);
  man.position.y = y0;
  plantMan(man, y0);
  styleBoutiqueMan(man, item, master.outfit);
  const lookIdx = ["suit", "cool", "lumber", "casual"].indexOf(master.outfit);
  const poseSlot = lookIdx >= 0 ? lookIdx : slot;
  tagProduct(man, "dresses", Math.max(0, lookIdx), { color: item.accent, x: item.x, z: item.z, outfit: master.outfit, furnId: item.id });
  man.userData.selectable = false;
  group.add(man);
  if (master.clips?.length) holdDisplayPose(man, master.clips);
  applyFashionStance(man, poseSlot);
  plantMan(man, y0);
  return true;
}

const mannequinWalkers = [];
const ARM_TRACK_RE = /(Clavicle|Shoulder|Elbow|Wrist|Thumb|Index|Middle|Ring|Pinky)_jt/i;
const _armDown = new THREE.Vector3(0, -1, 0);
const _armAxis = new THREE.Vector3();
const _armLocal = new THREE.Vector3();
const _armQ = new THREE.Quaternion();
const _armParentQ = new THREE.Quaternion();

function isArmBoneTrack(name) {
  return ARM_TRACK_RE.test(name || "");
}

function stripArmTracks(clip) {
  const next = clip.clone();
  next.name = `${clip.name || "walk"}-arms-down`;
  next.tracks = next.tracks.filter((t) => !isArmBoneTrack(t.name));
  return next;
}

function cacheClavicleBind(root) {
  root.traverse((o) => {
    if (/Clavicle_jt/i.test(o.name || "") && !o.userData.armBind) {
      o.userData.armBind = o.quaternion.clone();
    }
  });
}

function boneHangAxis(bone) {
  const child = bone.children.find((c) => /(Elbow|Wrist|Knee|Ankle|Ball)_jt/i.test(c.name || ""));
  if (child && child.position.lengthSq() > 1e-6) return child.position;
  return _armAxis.set(/^(Rt_|Right)/i.test(bone.name || "") ? -1 : 1, 0, 0);
}

function pointBoneWorld(bone, localAxis, worldDir) {
  if (!bone?.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_armParentQ);
  _armLocal.copy(worldDir).applyQuaternion(_armQ.copy(_armParentQ).invert()).normalize();
  _armAxis.copy(localAxis).normalize();
  if (_armAxis.lengthSq() < 1e-6 || _armLocal.lengthSq() < 1e-6) return;
  bone.quaternion.setFromUnitVectors(_armAxis, _armLocal);
  bone.updateMatrix();
}

function lockArmsDown(root) {
  if (!root) return;
  if (!root.userData.armBones) {
    const clav = [];
    const arms = [];
    root.traverse((o) => {
      const n = o.name || "";
      if (/Clavicle_jt/i.test(n)) clav.push(o);
      else if (/Shoulder_jt|Elbow_jt|Wrist_jt/i.test(n)) arms.push(o);
    });
    arms.sort((a, b) => {
      const rank = (n) => (/Shoulder/i.test(n) ? 0 : /Elbow/i.test(n) ? 1 : 2);
      return rank(a.name) - rank(b.name);
    });
    root.userData.armBones = { clav, arms };
  }
  const { clav, arms } = root.userData.armBones;
  for (const bone of clav) {
    if (bone.userData.armBind) bone.quaternion.copy(bone.userData.armBind);
  }
  for (const bone of arms) {
    pointBoneWorld(bone, boneHangAxis(bone), _armDown);
    bone.updateWorldMatrix(true, false);
  }
}

function holdDisplayPose(man, clips) {
  const idle =
    pickWalkClip(clips || [], /rig\|idle$/i, /(^|[|_ -])idle([|_ -]|$)/i) ||
    pickWalkClip(clips || [], /static_pose|standing|stand$/i);
  const src =
    idle ||
    pickWalkClip(clips || [], /rig\|walk$/i, /(^|[|_ -])walk(ing)?([|_ -]|$)/i) ||
    (clips && clips[0]);
  if (!src) return;
  cacheClavicleBind(man);
  const clip = (idle ? src : stripArmTracks(src)).clone();
  clip.tracks = clip.tracks.filter((t) => !/\.position$/.test(t.name));
  const mixer = new THREE.AnimationMixer(man);
  const action = mixer.clipAction(clip);
  action.enabled = true;
  action.play();
  mixer.update(idle ? 0.12 : 0);
  action.stop();
  lockArmsDown(man);
  man.updateMatrixWorld(true);
  man.traverse((m) => {
    if (m.isSkinnedMesh) {
      m.skeleton.update();
      m.computeBoundingBox?.();
      m.computeBoundingSphere?.();
    }
  });
}

export function hasMannequinWalks() {
  return mannequinWalkers.length > 0;
}

export function updateMannequinWalks(dt) {
  if (!mannequinWalkers.length) return false;
  for (const walker of mannequinWalkers) {
    walker.mixer.update(dt);
    lockArmsDown(walker.root);
  }
  return true;
}

const WALK_GLB_URLS = ["./models/mannequin/lumberjack.glb?v=tex1", "./models/mannequin/business_man.glb"];
let walkGltf = null;
let walkLoad = null;
let walkGirlLoad = null;

function polishManMaterials(root) {
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = Math.max(mat.map.anisotropy || 1, QUALITY.aniso);
        mat.color?.set("#ffffff");
      }
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.depthTest = true;
      if (mat.alphaMap || /hair|lash|brow/i.test(`${mat.name || ""} ${m.name || ""}`)) {
        mat.alphaTest = 0.4;
      }
      mat.envMapIntensity = 1.25;
      mat.needsUpdate = true;
    }
  });
}

export function loadWalkGirl() {
  if (walkGirlLoad) return walkGirlLoad;
  walkGirlLoad = loadAllWalkGirls().then((list) => list.length > 0);
  return walkGirlLoad;
}

export function loadWalkAvatar() {
  if (walkLoad) return walkLoad;
  walkLoad = (async () => {
    for (const url of WALK_GLB_URLS) {
      const gltf = await loadGlbFile(url);
      if (gltf?.scene) {
        walkGltf = gltf;
        return true;
      }
    }
    return false;
  })();
  return walkLoad;
}

function fitWalkModel(src, height, skinned = false) {
  const model = skinned ? cloneSkinned(src) : src.clone(true);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(height / Math.max(size.y, 0.001));
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.x -= (box2.max.x + box2.min.x) / 2;
  model.position.z -= (box2.max.z + box2.min.z) / 2;
  model.position.y -= box2.min.y;
  polishManMaterials(model);
  return model;
}

function pickWalkClip(clips, ...names) {
  return clips.find((c) => names.some((n) => n.test(c.name))) || null;
}

function holdPoseClip(clip, name = "idle-hold") {
  const hold = clip.clone();
  hold.name = name;
  hold.duration = 1 / 30;
  for (const track of hold.tracks) {
    if (!track.times?.length) continue;
    const size = track.getValueSize();
    const first = Array.from(track.values.slice(0, size));
    track.times = new Float32Array([0, hold.duration]);
    track.values = new Float32Array(first.concat(first));
  }
  return hold;
}

function makeWalkActions(mixer, clips, opts = {}) {
  let idleClip = pickWalkClip(clips, /rig\|idle$/i, /(^|[|_ -])idle([|_ -]|$)/i);
  let walkClip =
    pickWalkClip(clips, /rig\|walk$/i, /(^|[|_ -])walk(ing)?([|_ -]|$)/i) ||
    pickWalkClip(clips, /run/i) ||
    pickWalkClip(clips, /mixamo/i) ||
    clips.find((c) => c !== idleClip) ||
    clips[0];
  if (opts.armsDown) {
    if (walkClip) walkClip = stripArmTracks(walkClip);
    if (idleClip && idleClip !== walkClip) idleClip = stripArmTracks(idleClip);
  }
  if (!idleClip && walkClip) idleClip = holdPoseClip(walkClip);
  const actions = {};
  try {
    if (idleClip && idleClip !== walkClip) actions.idle = mixer.clipAction(idleClip);
    if (walkClip) actions.walk = mixer.clipAction(walkClip);
  } catch (err) {
    console.warn("walk clip bind failed", err);
  }
  for (const act of Object.values(actions)) {
    act.enabled = true;
    act.setEffectiveWeight(0);
    act.play();
  }
  if (actions.idle) actions.idle.setEffectiveWeight(1);
  return { actions, idleClip, walkClip };
}

function fadeWalkGait(state, next) {
  const name = state.actions[next] ? next : "idle";
  if (name === state.gait) return;
  const prev = state.actions[state.gait];
  const act = state.actions[name];
  if (prev && prev !== act) {
    prev.fadeOut(0.16);
    if (name === "idle") prev.paused = true;
  }
  if (act) {
    act.paused = false;
    act.reset().setEffectiveWeight(1).fadeIn(0.16).play();
  }
  state.gait = name;
}

function attachWalkGirls(actor) {
  if (!actor) return;
  actor.girls = actor.girls || [];
  if (actor.girls.length) return;
  const pack = getWalkGirlPacks()[0];
  if (!pack?.gltf?.scene) return;
  const girl = fitWalkModel(pack.gltf.scene, pack.height || 1.62, true);
  girl.name = "walk-girl";
  const side = pack.side ?? 0.46;
  girl.position.x += side;
  actor.root.add(girl);
  const mixer = new THREE.AnimationMixer(girl);
  const anim = { ...makeWalkActions(mixer, pack.clips || []), gait: "idle" };
  const manWalk = actor.manAnim?.actions?.walk;
  const girlWalk = anim.actions.walk;
  if (manWalk) manWalk.timeScale = 0.72;
  if (manWalk && girlWalk) {
    const manDur = manWalk.getClip().duration || 1;
    const girlDur = girlWalk.getClip().duration || 1;
    girlWalk.timeScale = (girlDur / manDur) * 0.72;
  }
  actor.girls.push({
    id: pack.id,
    root: girl,
    mixer,
    anim,
    base: girl.position.clone(),
    restX: girl.position.x - side,
    side,
    yaw: pack.yaw || 0,
  });
}

export function cycleWalkGirl(actor) {
  attachWalkGirls(actor);
  return actor?.girls?.[0] || null;
}

export function createWalkAvatar() {
  if (!walkGltf?.scene) return null;
  const model = fitWalkModel(walkGltf.scene, 1.72, true);
  const root = new THREE.Group();
  root.name = "walk-avatar";
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  cacheClavicleBind(model);
  const manAnim = { ...makeWalkActions(mixer, walkGltf.animations || [], { armsDown: true }), gait: "idle" };
  if (manAnim.actions.walk) manAnim.actions.walk.timeScale = 0.72;
  lockArmsDown(model);
  const actor = {
    root,
    mixer,
    man: model,
    manAnim,
    girls: [],
    play(next) {
      if (actor.man?.visible !== false) fadeWalkGait(manAnim, next);
      for (const girl of actor.girls) {
        if (!girl.root.visible) continue;
        if (girl.play) girl.play(next);
        else fadeWalkGait(girl.anim, next);
      }
    },
    update(dt, moving) {
      mixer.update(dt);
      if (actor.man?.visible !== false) lockArmsDown(model);
      const manWalk = manAnim.actions.walk;
      for (const girl of actor.girls) {
        if (girl.update) girl.update(dt, moving);
        else if (girl.mixer) {
          const girlWalk = girl.anim?.actions?.walk;
          if (girlWalk) {
            if (moving) {
              girlWalk.paused = false;
              if (manWalk && actor.man?.visible) {
                const manDur = manWalk.getClip().duration || 1;
                const girlDur = girlWalk.getClip().duration || 1;
                girlWalk.time = ((manWalk.time / manDur) * girlDur) % girlDur;
              }
            } else {
              girlWalk.paused = true;
              girlWalk.setEffectiveWeight(0);
            }
          }
          girl.mixer.update(dt);
        }
        girl.root.position.copy(girl.base);
        if (girl.restX != null) girl.root.position.x = girl.restX + (girl.side ?? 0);
        girl.root.rotation.y = girl.yaw || 0;
      }
    },
  };
  return actor;
}
function takeLampSlot() {
  if (lampBudget >= QUALITY.maxLights) return false;
  lampBudget += 1;
  return true;
}

function glowMat(color, on) {
  return new THREE.MeshStandardMaterial({
    color: color || "#fff8ee",
    emissive: color || "#ffe6b8",
    emissiveIntensity: on ? 2.05 : 0.06,
    roughness: 0.22,
    metalness: 0.02,
  });
}

function addLampLight(group, item, y, kind = "point") {
  if (item.lightOn === false) return;
  if (!takeLampSlot()) return;
  const on = item.lightOn !== false;
  const color = item.lightColor || "#ffe6b8";
  const power = Math.min(QUALITY.high ? 22 : 12, Math.max(0, Number(item.lightPower ?? 32)));
  if (kind === "spot") {
    const spot = new THREE.SpotLight(color, on ? power : 0, 12, 0.62, 0.42, 1.7);
    spot.position.set(0, y, 0);
    const target = new THREE.Object3D();
    target.position.set(0, 0.05, 0);
    group.add(target);
    spot.target = target;
    group.add(spot);
    return;
  }
  const dist = kind === "desk" ? 4.2 : kind === "sconce" ? 5.2 : 7.4;
  const lamp = new THREE.PointLight(color, on ? power : 0, dist, 2);
  lamp.position.set(0, y, kind === "sconce" ? 0.08 : 0);
  group.add(lamp);
}

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  r = Math.max(0.04, Math.min(r, hw - 0.012, hd - 0.012));
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - r);
  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hd);
  s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + r);
  s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  s.closePath();
  return s;
}

function extrudeRoundSlab(w, d, r, thick, segs) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: thick,
    bevelEnabled: false,
    curveSegments: segs,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function addLoungeChair(group, item) {
  const w = item.width || 0.78;
  const d = item.depth || 0.82;
  const h = item.height || 0.8;
  const leather = leatherMat(item.color || "#121014");
  leather.side = THREE.DoubleSide;
  const piped = leatherMat(item.color || "#1a1612");
  const gold = metalMat(item.accent || "#c6a56a");
  const segs = QUALITY.low ? 14 : 28;
  const seatH = 0.4;

  const seat = shadow(new THREE.Mesh(extrudeRoundSlab(w * 0.84, d * 0.72, 0.08, 0.1, segs), leather));
  seat.position.y = seatH;
  group.add(seat);
  const cushion = new THREE.Mesh(extrudeRoundSlab(w * 0.7, d * 0.56, 0.07, 0.05, segs), piped);
  cushion.position.y = seatH + 0.078;
  group.add(cushion);

  const back = shadow(
    new THREE.Mesh(
      new THREE.CylinderGeometry(d * 0.42, d * 0.44, h * 0.5, segs, 1, true, Math.PI * 0.22, Math.PI * 0.56),
      leather
    )
  );
  back.position.set(0, seatH + h * 0.22, -d * 0.1);
  group.add(back);
  const backPad = new THREE.Mesh(
    new THREE.CylinderGeometry(d * 0.35, d * 0.36, h * 0.34, segs, 1, true, Math.PI * 0.28, Math.PI * 0.44),
    piped
  );
  backPad.position.set(0, seatH + h * 0.2, -d * 0.08);
  group.add(backPad);

  for (const side of [-1, 1]) {
    const arm = shadow(new THREE.Mesh(extrudeRoundSlab(0.11, d * 0.5, 0.04, 0.08, 10), leather));
    arm.position.set(side * w * 0.36, seatH + 0.12, -d * 0.02);
    group.add(arm);
  }
  const lx = w * 0.3;
  const lz = d * 0.26;
  for (const [x, z] of [
    [-lx, lz],
    [lx, lz],
    [-lx, -lz],
    [lx, -lz],
  ]) {
    group.add(post(0.016, seatH - 0.02, gold, x, (seatH - 0.02) / 2, z, true));
  }
}

function addCoffeeTable(group, item) {
  const w = item.width || 1.05;
  const d = item.depth || 0.58;
  const h = item.height || 0.4;
  const gold = metalMat(item.accent || "#c6a56a");
  const wood = woodMat(item.color || "#1a1612");
  const segs = QUALITY.low ? 16 : 32;
  const glass = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: "#f4f7fb",
        metalness: 0.04,
        roughness: 0.05,
        transmission: 0.86,
        thickness: 0.025,
        ior: 1.5,
        envMapIntensity: 1.7,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      })
    : new THREE.MeshStandardMaterial({
        color: "#dce4ee",
        metalness: 0.15,
        roughness: 0.08,
        transparent: true,
        opacity: 0.32,
        envMapIntensity: 1.5,
      });
  const top = new THREE.Mesh(extrudeRoundSlab(w, d, 0.08, 0.016, segs), glass);
  top.position.y = h;
  group.add(top);
  const rim = new THREE.Mesh(extrudeRoundSlab(w + 0.02, d + 0.02, 0.085, 0.008, segs), gold);
  rim.position.y = h - 0.01;
  group.add(rim);
  const shelf = shadow(new THREE.Mesh(extrudeRoundSlab(w * 0.78, d * 0.72, 0.06, 0.016, segs), wood));
  shelf.position.y = h * 0.38;
  group.add(shelf);
  const lx = w * 0.38;
  const lz = d * 0.32;
  for (const [x, z] of [
    [-lx, lz],
    [lx, lz],
    [-lx, -lz],
    [lx, -lz],
  ]) {
    group.add(post(0.012, h - 0.02, gold, x, (h - 0.02) / 2, z, true));
  }
}

function addOttoman(group, item) {
  const w = item.width || 0.62;
  const h = item.height || 0.4;
  const leather = leatherMat(item.color || "#121014");
  const gold = metalMat(item.accent || "#c6a56a");
  const segs = QUALITY.low ? 16 : 28;
  const body = shadow(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.46, h * 0.72, segs), leather));
  body.position.y = h * 0.42;
  group.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(w * 0.42, segs, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), leather);
  cap.position.y = h * 0.72;
  group.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.44, 0.012, 8, segs), gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h * 0.18;
  group.add(ring);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), gold);
  button.position.y = h * 0.86;
  group.add(button);
}

function addSideboard(group, item) {
  const w = item.width || 1.95;
  const d = item.depth || 0.42;
  const h = item.height || 0.74;
  const body = bodyMat(item.color || "#1a1612");
  const gold = metalMat(item.accent || "#c6a56a");
  const stone = marbleTop(isDarkBody(item.color) ? "#2a2420" : "#f6f1e8");
  const segs = QUALITY.low ? 8 : 14;
  const cab = shadow(new THREE.Mesh(extrudeRoundSlab(w, d, 0.04, h - 0.12, segs), body));
  cab.position.y = 0.08;
  group.add(cab);
  const top = new THREE.Mesh(extrudeRoundSlab(w + 0.04, d + 0.04, 0.045, 0.028, segs), stone);
  top.position.y = h - 0.02;
  group.add(top);
  group.add(box(w + 0.05, 0.006, d + 0.05, gold, 0, h - 0.036, 0, false));
  for (const x of [0, -w * 0.22, w * 0.22]) {
    group.add(box(0.006, h * 0.52, 0.01, gold, x, h * 0.42, d / 2 + 0.002, false));
  }
  for (const x of [-w * 0.33, -w * 0.11, w * 0.11, w * 0.33]) {
    group.add(box(0.07, 0.01, 0.012, gold, x, h * 0.48, d / 2 + 0.008, false));
  }
  const lx = w * 0.42;
  const lz = d * 0.32;
  for (const [x, z] of [
    [-lx, lz],
    [lx, lz],
    [-lx, -lz],
    [lx, -lz],
  ]) {
    group.add(post(0.014, 0.08, gold, x, 0.04, z, true));
  }
}

function wrapLedBand(w, d, r, bandH, inset, segs) {
  const outer = roundedRectShape(w - inset, d - inset, Math.max(0.05, r - inset * 0.45));
  const inner = roundedRectShape(
    w - inset - 0.05,
    d - inset - 0.05,
    Math.max(0.04, r - inset * 0.45 - 0.025)
  );
  outer.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: bandH,
    bevelEnabled: false,
    curveSegments: segs,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makeGoldMonogram() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  const g = ctx.createLinearGradient(-120, -130, 110, 140);
  g.addColorStop(0, "#fff1c4");
  g.addColorStop(0.35, "#e0b84a");
  g.addColorStop(0.7, "#b8862a");
  g.addColorStop(1, "#6e5018");
  ctx.strokeStyle = g;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(255, 210, 120, 0.55)";
  ctx.shadowBlur = 14;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(-98, -78);
  ctx.lineTo(-18, 108);
  ctx.lineTo(62, -92);
  ctx.stroke();
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(18, -118);
  ctx.bezierCurveTo(128, -88, 132, 18, 78, 88);
  ctx.bezierCurveTo(42, 132, -28, 118, -52, 72);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(255, 244, 210, 0.55)";
  ctx.beginPath();
  ctx.moveTo(-90, -74);
  ctx.lineTo(-18, 96);
  ctx.lineTo(54, -86);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeSlatGrainTex() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c4bbb0";
  ctx.fillRect(0, 0, 128, 512);
  const img = ctx.getImageData(0, 0, 128, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4;
    const x = p % 128;
    const y = (p / 128) | 0;
    const n = ((Math.sin(y * 0.11 + x * 0.04) + Math.sin(y * 0.37)) * 7 + ((x * 17 + y * 3) % 9) - 4) | 0;
    img.data[i] = Math.max(0, Math.min(255, 196 + n));
    img.data[i + 1] = Math.max(0, Math.min(255, 187 + n * 0.85));
    img.data[i + 2] = Math.max(0, Math.min(255, 176 + n * 0.7));
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(4, 0, 6, 512);
  ctx.fillStyle = "rgba(40,32,24,0.1)";
  ctx.fillRect(118, 0, 6, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = QUALITY.aniso;
  tex.needsUpdate = true;
  return tex;
}

function makeFeatureSignTex(on) {
  const w = 1600;
  const h = 980;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  function phone(x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.1;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.roundRect(-s * 0.34, -s * 0.58, s * 0.68, s * 1.16, s * 0.12);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-s * 0.12, -s * 0.48, s * 0.24, s * 0.06, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, s * 0.42, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function mark(x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    phone(0, 0, s * 0.58, color);
    ctx.restore();
  }

  function word(text, x, y, size, color, oMark) {
    ctx.font = `800 ${size}px "DM Sans", Arial Black, sans-serif`;
    let cx = x;
    for (const ch of text) {
      if (oMark && (ch === "O" || ch === "o")) {
        mark(cx + size * 0.38, y, size * 0.86, color);
        cx += size * 0.86;
      } else {
        ctx.fillStyle = color;
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + size * 0.035;
      }
    }
    return cx - x;
  }

  const left = 210;
  if (on) {
    ctx.save();
    ctx.shadowColor = "#ffb84a";
    ctx.shadowBlur = 28;
    ctx.globalAlpha = 0.95;
    phone(128, 250, 118, "#ffcc66");
    word("MOBILE", left, 250, 168, "#ffcc66");
    word("STORE", left, 470, 168, "#ffcc66", true);
    word("PLUS", 980, 690, 108, "#ffcc66");
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "#ffe29a";
    ctx.shadowBlur = 54;
    ctx.globalAlpha = 0.55;
    phone(128, 250, 118, "#ffe29a");
    word("MOBILE", left, 250, 168, "#ffe29a");
    word("STORE", left, 470, 168, "#ffe29a", true);
    word("PLUS", 980, 690, 108, "#ffe29a");
    ctx.restore();
  }

  phone(128, 250, 118, "#111111");
  word("MOBILE", left, 250, 168, "#111111");
  word("STORE", left, 470, 168, "#111111", true);
  word("PLUS", 980, 690, 108, "#111111");

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.needsUpdate = true;
  return tex;
}

let WALNUT_SLAT_TEX;
function makeWalnutSlatTex() {
  if (WALNUT_SLAT_TEX) return WALNUT_SLAT_TEX;
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a2a1e";
  ctx.fillRect(0, 0, 96, 512);
  const img = ctx.getImageData(0, 0, 96, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4;
    const x = p % 96;
    const y = (p / 96) | 0;
    const n = ((Math.sin(y * 0.09) + Math.sin(y * 0.31 + x * 0.05)) * 10 + ((x * 13 + y) % 8) - 4) | 0;
    img.data[i] = Math.max(0, Math.min(255, 62 + n));
    img.data[i + 1] = Math.max(0, Math.min(255, 44 + n * 0.7));
    img.data[i + 2] = Math.max(0, Math.min(255, 30 + n * 0.45));
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = "rgba(255,220,180,0.05)";
  ctx.fillRect(6, 0, 8, 512);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(88, 0, 8, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = QUALITY.aniso;
  tex.needsUpdate = true;
  WALNUT_SLAT_TEX = tex;
  return tex;
}

let CHAMPAGNE_TEX;
function makeChampagneTex() {
  if (CHAMPAGNE_TEX) return CHAMPAGNE_TEX;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 256, 40);
  g.addColorStop(0, "#cbb48a");
  g.addColorStop(0.5, "#e4d3ae");
  g.addColorStop(1, "#b89a68");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = `rgba(255,245,220,${0.04 + (y % 7) * 0.008})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = QUALITY.aniso;
  tex.needsUpdate = true;
  CHAMPAGNE_TEX = tex;
  return tex;
}

function makeWallBrandTex(key, draw) {
  const tex = boutiqueTex(key, 768, 220, draw);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function fitBrandWord(ctx, text, tw, th, color = "#f4f8ff") {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  let size = Math.min(th * 0.58, tw / Math.max(3, text.length * 0.56));
  const family = "800 " + Math.round(size) + "px 'DM Sans', Arial Black, sans-serif";
  ctx.font = family;
  while (size > 14 && ctx.measureText(text).width > tw * 0.9) {
    size -= 2;
    ctx.font = `800 ${Math.round(size)}px 'DM Sans', Arial Black, sans-serif`;
  }
  ctx.shadowColor = "rgba(255,255,255,0.28)";
  ctx.shadowBlur = Math.max(3, size * 0.06);
  ctx.fillText(text, tw / 2, th / 2);
}

function makePhoneShelfBannerTex(title, accent = "#7ed6ff") {
  const key = `shelf-banner:${title}:${accent}`;
  return boutiqueTex(key, 512, 128, (ctx, tw, th) => {
    const bg = ctx.createLinearGradient(0, 0, tw, th);
    bg.addColorStop(0, "#070b12");
    bg.addColorStop(0.55, "#101820");
    bg.addColorStop(1, "#0a0e14");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, tw, th);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let y = 0; y < th; y += 3) ctx.fillRect(0, y, tw, 1);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, tw, 6);
    ctx.fillRect(0, th - 6, tw, 6);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.font = "700 28px DM Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("NEW", 36, 52);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f4f7fb";
    ctx.font = "800 72px DM Sans, sans-serif";
    ctx.fillText(String(title || "PHONE").toUpperCase(), 36, 128);
    ctx.fillStyle = "rgba(244,247,251,0.62)";
    ctx.font = "600 24px DM Sans, sans-serif";
    ctx.fillText("LIVE  ·  IN STORE", 36, 168);
  });
}

function addLedGlassBay(group, item, w, h, d) {
  const on = item.lightOn !== false;
  const bays = Math.max(2, Math.min(4, Math.round(w / 1.12)));
  const postW = 0.03;
  const baseH = 0.13;
  const topH = 0.045;
  const inner = w - postW * (bays + 1);
  const bayW = inner / bays;
  const shelves = QUALITY.high ? 4 : 3;
  const shelfT = 0.016;
  const gap = (h - baseH - topH - 0.02) / shelves;
  const shelfD = d - 0.07;
  const metal = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: item.accent || "#c8ccd2",
        roughness: 0.2,
        metalness: 0.92,
        envMapIntensity: 1.22,
      })
    : new THREE.MeshStandardMaterial({
        color: item.accent || "#c8ccd2",
        roughness: 0.28,
        metalness: 0.86,
        envMapIntensity: 1.12,
      });
  const back = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: item.color || "#f2f5f8",
        roughness: 0.36,
        metalness: 0.08,
        clearcoat: 0.14,
        clearcoatRoughness: 0.5,
        envMapIntensity: 0.72,
      })
    : new THREE.MeshStandardMaterial({
        color: item.color || "#f2f5f8",
        roughness: 0.48,
        metalness: 0.06,
        envMapIntensity: 0.58,
      });
  const glass = new THREE.MeshStandardMaterial({
    color: "#eef3f7",
    roughness: 0.2,
    metalness: 0.06,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    envMapIntensity: 0.72,
  });
  glass.userData.shared = false;

  group.add(box(w - 0.02, h - 0.04, 0.028, back, 0, h / 2, -d / 2 + 0.016, false));
  group.add(box(w + 0.02, baseH, d, metal, 0, baseH / 2, 0));
  group.add(box(w + 0.01, topH, d + 0.01, metal, 0, h - topH / 2, 0));
  group.add(box(0.028, h, d - 0.02, metal, -w / 2 + 0.014, h / 2, 0, false));
  group.add(box(0.028, h, d - 0.02, metal, w / 2 - 0.014, h / 2, 0, false));

  const posts = [];
  for (let i = 1; i < bays; i++) {
    const px = -w / 2 + (postW + bayW) * i + postW / 2;
    posts.push({ w: postW, h: h - topH - 0.02, d: d - 0.04, x: px, y: (h - topH) / 2 + 0.01, z: 0 });
  }
  if (posts.length) group.add(instancedBoxes(metal, posts, { castShadow: false }));

  const glasses = [];
  for (let b = 0; b < bays; b++) {
    const x0 = -w / 2 + postW + b * (bayW + postW);
    const cx = x0 + bayW / 2;
    for (let s = 0; s < shelves; s++) {
      const sy = baseH + 0.018 + s * gap;
      glasses.push({ w: bayW - 0.03, h: shelfT, d: shelfD, x: cx, y: sy, z: 0.012 });
    }
  }
  for (const g of glasses) {
    group.add(box(g.w, g.h, g.d, glass, g.x, g.y, g.z, false));
  }

  const perBay = QUALITY.high ? 3 : 2;
  let idx = Math.abs(Math.round((item.x || 0) * 7 + (item.z || 0) * 3));
  const bayNames = new Array(bays).fill(null);
  for (let s = 0; s < shelves; s++) {
    const sy = baseH + 0.018 + s * gap;
    for (let b = 0; b < bays; b++) {
      const x0 = -w / 2 + postW + b * (bayW + postW);
      const cx = x0 + bayW / 2;
      for (let i = 0; i < perBay; i++) {
        const x = perBay === 1 ? cx : cx - bayW * 0.28 + (i / (perBay - 1)) * bayW * 0.56;
        if (!bayNames[b]) bayNames[b] = productInfo("phones", idx).title;
        group.add(
          makeShelfPhone(idx, x, sy + 0.01, 0.1, {
            slotId: `bay-${b}-${s}-${i}`,
            furnId: item.id,
            scale: 1.95,
          })
        );
        idx += 1;
      }
    }
  }

  const accents = ["#7ed6ff", "#ffb35c", "#9ad4ff", "#e8c45a"];
  const frame = new THREE.MeshStandardMaterial({ color: "#10141a", metalness: 0.58, roughness: 0.26 });
  const bannerH = 0.13;
  const bannerY = h + bannerH / 2 + 0.012;
  const bannerZ = d / 2 - 0.008;
  for (let b = 0; b < bays; b++) {
    const x0 = -w / 2 + postW + b * (bayW + postW);
    const cx = x0 + bayW / 2;
    const title = bayNames[b] || productInfo("phones", b).title;
    const tex = makePhoneShelfBannerTex(title, accents[b % accents.length]);
    group.add(box(bayW - 0.03, bannerH + 0.018, 0.042, frame, cx, bannerY, bannerZ, false));
    const pane = new THREE.Mesh(
      PLANE,
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.1,
        metalness: 0.03,
        emissive: "#ffffff",
        emissiveMap: tex,
        emissiveIntensity: on ? 1.2 : 0.12,
      })
    );
    pane.scale.set(Math.max(0.2, bayW - 0.08), bannerH - 0.024, 1);
    pane.position.set(cx, bannerY, bannerZ + 0.026);
    group.add(pane);
  }

}


function addSlatSignWall(group, item, w, h, d) {
  const walnutMap = makeWalnutSlatTex();
  walnutMap.repeat.set(1, 3.2);
  const slatMat = new THREE.MeshStandardMaterial({
    color: "#4a3426",
    map: walnutMap,
    roughness: 0.62,
    metalness: 0.04,
    envMapIntensity: 0.38,
  });
  const groove = new THREE.MeshStandardMaterial({ color: "#2a1c14", roughness: 0.9 });
  const champMap = makeChampagneTex();
  champMap.repeat.set(1.6, 1.1);
  const metal = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: "#dcc8a0",
        map: champMap,
        roughness: 0.28,
        metalness: 0.78,
        clearcoat: 0.22,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.2,
      })
    : new THREE.MeshStandardMaterial({
        color: "#dcc8a0",
        map: champMap,
        roughness: 0.3,
        metalness: 0.72,
        envMapIntensity: 1.1,
      });
  const glass = glassMat("#d8eef8");
  const dark = new THREE.MeshStandardMaterial({ color: "#1a1612", roughness: 0.42, metalness: 0.22 });
  const whiteBox = new THREE.MeshStandardMaterial({ color: "#f3f4f6", roughness: 0.55 });

  group.add(box(w, h, 0.04, groove, 0, h / 2, -0.02, false));
  const slatW = 0.05;
  const gap = 0.007;
  const pitch = slatW + gap;
  const count = Math.max(16, Math.floor(w / pitch));
  const used = count * pitch - gap;
  const start = -used / 2 + slatW / 2;
  const slatParts = [];
  for (let i = 0; i < count; i++) {
    slatParts.push({ w: slatW, h: h - 0.02, d: 0.05, x: start + i * pitch, y: h / 2, z: 0.018 });
  }
  group.add(instancedBoxes(slatMat, slatParts, { castShadow: false }));

  const z0 = 0.055;
  function panel(x, y, pw, ph, lift = 0.028) {
    const m = box(pw, ph, 0.03, metal, x, y, z0 + lift, false);
    group.add(m);
    return m;
  }

  function brandFace(x, y, z, bw, bh, tex, glow = 0.55) {
    const face = new THREE.Mesh(
      PLANE,
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.22,
        metalness: 0.28,
        emissive: "#ffffff",
        emissiveMap: tex,
        emissiveIntensity: 0.08,
      })
    );
    face.scale.set(bw, bh, 1);
    face.position.set(x, y, z);
    group.add(face);
  }

  panel(-w * 0.34, h * 0.62, w * 0.26, h * 0.42, 0.034);
  panel(-w * 0.34, h * 0.28, w * 0.26, h * 0.18, 0.026);
  panel(-w * 0.06, h * 0.78, w * 0.32, h * 0.16, 0.03);
  panel(-w * 0.06, h * 0.5, w * 0.32, h * 0.28, 0.028);
  panel(w * 0.28, h * 0.8, w * 0.3, h * 0.18, 0.03);
  panel(w * 0.28, h * 0.52, w * 0.18, h * 0.28, 0.026);

  const iphoneTex = makeWallBrandTex("wall-iphone-v2", (ctx, tw, th) => {
    ctx.clearRect(0, 0, tw, th);
    const pw = tw * 0.22;
    const ph = th * 0.58;
    ctx.save();
    ctx.translate(tw / 2, th * 0.42);
    ctx.strokeStyle = "#f2f4f8";
    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = 8;
    ctx.lineWidth = Math.max(4, tw * 0.012);
    ctx.beginPath();
    ctx.roundRect(-pw, -ph / 2, pw * 2, ph, pw * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-pw * 0.28, -ph / 2 + ph * 0.08, pw * 0.56, ph * 0.06, 4);
    ctx.fillStyle = "#f2f4f8";
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4f6fa";
    ctx.shadowBlur = 4;
    let size = Math.min(th * 0.16, tw / 8);
    ctx.font = `700 ${Math.round(size)}px 'DM Sans', sans-serif`;
    ctx.fillText("iPhone", tw / 2, th * 0.88);
  });
  brandFace(-w * 0.34, h * 0.64, z0 + 0.055, w * 0.24, h * 0.38, iphoneTex, 0.7);

  const samsungTex = makeWallBrandTex("wall-samsung-v2", (ctx, tw, th) => {
    ctx.clearRect(0, 0, tw, th);
    fitBrandWord(ctx, "SAMSUNG", tw, th, "#f4f8ff");
  });
  brandFace(-w * 0.06, h * 0.78, z0 + 0.054, w * 0.3, h * 0.13, samsungTex, 0.85);

  const kingsTex = makeWallBrandTex("wall-kings-v2", (ctx, tw, th) => {
    ctx.clearRect(0, 0, tw, th);
    const s = Math.min(tw, th) * 0.16;
    ctx.save();
    ctx.translate(tw / 2, th * 0.34);
    ctx.fillStyle = "#e0b84a";
    ctx.strokeStyle = "#f3e2b0";
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, s * 0.45);
    ctx.lineTo(-s * 0.72, -s * 0.12);
    ctx.lineTo(-s * 0.32, s * 0.28);
    ctx.lineTo(0, -s * 0.55);
    ctx.lineTo(s * 0.32, s * 0.28);
    ctx.lineTo(s * 0.72, -s * 0.12);
    ctx.lineTo(s * 1.1, s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e8c45a";
    ctx.shadowColor = "rgba(255,217,120,0.35)";
    ctx.shadowBlur = 6;
    let size = Math.min(th * 0.22, tw / 12);
    ctx.font = `800 ${Math.round(size)}px 'DM Sans', sans-serif`;
    while (size > 12 && ctx.measureText("MOBILE KINGS").width > tw * 0.9) {
      size -= 2;
      ctx.font = `800 ${Math.round(size)}px 'DM Sans', sans-serif`;
    }
    ctx.fillText("MOBILE KINGS", tw / 2, th * 0.78);
  });
  brandFace(w * 0.28, h * 0.8, z0 + 0.054, w * 0.28, h * 0.15, kingsTex, 0.62);

  function glassShelf(x, y, sw) {
    group.add(box(sw, 0.018, 0.28, glass, x, y, 0.2, false));
  }
  glassShelf(-w * 0.05, 1.42, w * 0.34);
  glassShelf(-w * 0.05, 1.92, w * 0.34);
  glassShelf(w * 0.27, 1.42, w * 0.22);
  glassShelf(w * 0.27, 1.92, w * 0.22);

  const cols = QUALITY.high ? 5 : 4;
  const phoneRows = QUALITY.stockLite ? 1 : 2;
  const span = w * 0.5;
  for (let row = 0; row < phoneRows; row++) {
    const y = row === 0 ? 1.44 : 1.94;
    for (let i = 0; i < cols; i++) {
      const x = -w * 0.18 + (cols === 1 ? 0 : (i / (cols - 1)) * span);
      placeDisplay(group, item, `wallp-${row}-${i}`, {
        category: "phones",
        index: (i + row * 3) % 12,
        x,
        y,
        z: 0.24,
        scale: 1.85,
        shelf: true,
      });
    }
  }

  const lidDark = new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.4 });
  const lidWood = new THREE.MeshStandardMaterial({ color: "#c4a574", roughness: 0.4 });
  function cabinet(x, cw) {
    const cy = 0.52;
    const ch = 0.92;
    const cd = 0.38;
    group.add(box(cw, ch, cd, dark, x, cy, 0.16, false));
    group.add(box(cw - 0.06, ch - 0.1, 0.016, glass, x, cy, 0.16 + cd / 2 + 0.002, false));
    const boxCols = QUALITY.low ? 3 : Math.max(4, Math.round(cw / 0.28));
    const boxRows = QUALITY.low ? 1 : 2;
    const whites = [];
    const darkLids = [];
    const woodLids = [];
    for (let r = 0; r < boxRows; r++) {
      for (let c = 0; c < boxCols; c++) {
        const bx = x - cw / 2 + 0.16 + c * ((cw - 0.28) / Math.max(1, boxCols - 1));
        const by = cy - 0.18 + r * 0.28;
        whites.push({ w: 0.12, h: 0.16, d: 0.08, x: bx, y: by, z: 0.12 });
        const lid = { w: 0.12, h: 0.012, d: 0.08, x: bx, y: by + 0.09, z: 0.12 };
        (c % 2 ? darkLids : woodLids).push(lid);
      }
    }
    group.add(instancedBoxes(whiteBox, whites, { castShadow: false, receiveShadow: false }));
    if (darkLids.length) group.add(instancedBoxes(lidDark, darkLids, { castShadow: false, receiveShadow: false }));
    if (woodLids.length) group.add(instancedBoxes(lidWood, woodLids, { castShadow: false, receiveShadow: false }));
  }
  cabinet(-w * 0.08, w * 0.38);
  cabinet(w * 0.26, w * 0.24);

  const hookMat = new THREE.MeshStandardMaterial({ color: "#e85d04", roughness: 0.45 });
  const hookX0 = w * 0.4;
  const hooks = [];
  const packs = [];
  const hookN = QUALITY.low ? 3 : 6;
  for (let i = 0; i < hookN; i++) {
    const hy = 1.35 + (i % 3) * 0.28;
    const ox = i < 3 ? -0.08 : 0.08;
    hooks.push({ w: 0.04, h: 0.04, d: 0.08, x: hookX0 + ox, y: hy, z: 0.08 });
    packs.push({ w: 0.09, h: 0.14, d: 0.02, x: hookX0 + ox, y: hy - 0.08, z: 0.12 });
  }
  group.add(instancedBoxes(dark, hooks, { castShadow: false, receiveShadow: false }));
  group.add(instancedBoxes(hookMat, packs, { castShadow: false, receiveShadow: false }));
}

function makeKingPanelTex() {
  return boutiqueTex("king-panel", 768, 512, (ctx, tw, th) => {
    const g = ctx.createLinearGradient(0, 0, tw, th);
    g.addColorStop(0, "rgba(230,236,248,0.92)");
    g.addColorStop(0.55, "rgba(210,218,235,0.88)");
    g.addColorStop(1, "rgba(176,188,230,0.9)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, tw, th);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, 0, tw, 8);
    ctx.save();
    ctx.translate(tw / 2, 118);
    ctx.strokeStyle = "#111111";
    ctx.fillStyle = "#ff7a18";
    ctx.lineWidth = 10;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-70, 28);
    ctx.lineTo(-48, -8);
    ctx.lineTo(-22, 18);
    ctx.lineTo(0, -38);
    ctx.lineTo(22, 18);
    ctx.lineTo(48, -8);
    ctx.lineTo(70, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.moveTo(-18, 8);
    ctx.lineTo(0, -22);
    ctx.lineTo(18, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 72px 'DM Sans', Arial Black, sans-serif";
    ctx.fillStyle = "#111111";
    ctx.fillText("MOBILE", tw / 2 - 92, 230);
    ctx.fillStyle = "#ff7a18";
    ctx.fillText("KING", tw / 2 + 148, 230);
    ctx.fillStyle = "#2a2a2a";
    ctx.font = "700 22px 'DM Sans', sans-serif";
    ctx.fillText("SALES  •  REPAIR  •  ACCESSORIES", tw / 2, 292);
    const icons = ["f", "ig", "in", "tk", "yt"];
    icons.forEach((label, i) => {
      const x = tw / 2 - 140 + i * 70;
      ctx.beginPath();
      ctx.arc(x, 360, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#111111";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 13px 'DM Sans', sans-serif";
      ctx.fillText(label, x, 361);
    });
  });
}

function makeAcFaceTex() {
  return boutiqueTex("ac-face-print-v3", 1024, 420, (ctx, tw, th) => {
    ctx.clearRect(0, 0, tw, th);
    const label = (x, y, num, title, sub) => {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(x, y, 70, 64);
      ctx.strokeStyle = "rgba(90,98,108,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 68, 62);
      ctx.fillStyle = "#1f242b";
      ctx.textAlign = "center";
      ctx.font = "700 28px DM Sans, sans-serif";
      ctx.fillText(num, x + 35, y + 28);
      ctx.font = "600 8px DM Sans, sans-serif";
      ctx.fillStyle = "#5a616a";
      ctx.fillText(title, x + 35, y + 44);
      ctx.font = "500 7px DM Sans, sans-serif";
      ctx.fillText(sub, x + 35, y + 54);
    };
    label(28, 148, "10", "INVERTER", "R-32");
    label(28, 226, "3", "STAR", "ISEER");
    ctx.fillStyle = "rgba(40,46,54,0.78)";
    ctx.font = "500 34px DM Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("elgin", tw * 0.62, th * 0.58);
  });
}

const AC_TEMPS = [16, 17, 18, 19, 20, 21, 22, 23, 24];
let acLive = false;
let acDisplay = null;

export function resetAcDisplays() {
  acLive = false;
}

function getLiveAcDisplay() {
  if (acDisplay) return acDisplay;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 168;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  acDisplay = { canvas, ctx, tex, last: "" };
  drawAcNumber(ctx, canvas, AC_TEMPS[0]);
  tex.needsUpdate = true;
  return acDisplay;
}

function drawAcNumber(ctx, canvas, value) {
  const tw = canvas.width;
  const th = canvas.height;
  ctx.clearRect(0, 0, tw, th);
  ctx.fillStyle = "#f4fbff";
  ctx.shadowColor = "#bfe8ff";
  ctx.shadowBlur = 20;
  ctx.font = "700 108px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), tw / 2, th / 2 + 6);
}

export function updateAcDisplays(now) {
  if (!acLive) return false;
  const d = getLiveAcDisplay();
  const tick = Math.floor(now / 850);
  const value = AC_TEMPS[tick % AC_TEMPS.length];
  const key = String(value);
  if (d.last === key) return false;
  d.last = key;
  drawAcNumber(d.ctx, d.canvas, value);
  d.tex.needsUpdate = true;
  return true;
}

function acSideProfile(h, d) {
  const s = new THREE.Shape();
  const back = -d * 0.5;
  const front = d * 0.5;
  const lo = -h * 0.5;
  const hi = h * 0.5;
  const mouth = h * 0.3;
  s.moveTo(back + 0.004, lo + 0.01);
  s.lineTo(back, lo + 0.018);
  s.lineTo(back, hi - 0.036);
  s.quadraticCurveTo(back, hi, back + 0.038, hi);
  s.lineTo(front - 0.05, hi);
  s.quadraticCurveTo(front + 0.008, hi - 0.004, front, hi - 0.05);
  s.lineTo(front, lo + mouth);
  s.quadraticCurveTo(front - 0.004, lo + mouth * 0.62, front - 0.04, lo + mouth * 0.48);
  s.lineTo(back + 0.018, lo + 0.01);
  s.closePath();
  return s;
}

function addSplitAc(group, item, w, h, d) {
  const y = item.lift ?? 3.92;
  const plastic = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: item.color || "#f3f5f7",
        roughness: 0.055,
        metalness: 0.0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
        sheen: 0.2,
        sheenColor: "#ffffff",
      })
    : new THREE.MeshStandardMaterial({
        color: item.color || "#f3f5f7",
        roughness: 0.1,
        metalness: 0.02,
        envMapIntensity: 1.05,
      });
  const dark = new THREE.MeshStandardMaterial({ color: "#14181d", roughness: 0.7, metalness: 0.06 });
  const vane = new THREE.MeshStandardMaterial({ color: "#2a3036", roughness: 0.42, metalness: 0.16 });
  const cool = new THREE.MeshStandardMaterial({
    color: "#e8f4ff",
    emissive: "#b9dcff",
    emissiveIntensity: 0.42,
    roughness: 0.35,
  });

  const segs = QUALITY.low ? 8 : 20;
  const shellGeo = new THREE.ExtrudeGeometry(acSideProfile(h, d), {
    depth: Math.max(0.4, w - 0.07),
    bevelEnabled: !QUALITY.low,
    bevelThickness: 0.028,
    bevelSize: 0.026,
    bevelSegments: QUALITY.low ? 1 : 3,
    curveSegments: segs,
  });
  shellGeo.rotateY(-Math.PI / 2);
  shellGeo.translate((w - 0.07) / 2, 0, 0);
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, plastic);
  shell.position.y = y;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  group.add(box(w * 0.92, h * 0.92, 0.01, dark, 0, y, -d / 2 + 0.004, false));

  const faceZ = d * 0.5 + 0.002;
  const face = new THREE.Mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: makeAcFaceTex(),
      transparent: true,
      roughness: 0.12,
      metalness: 0,
      depthWrite: false,
    })
  );
  face.scale.set(w * 0.72, h * 0.42, 1);
  face.position.set(0, y + h * 0.08, faceZ);
  group.add(face);

  acLive = true;
  const live = getLiveAcDisplay();
  const disp = new THREE.Mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: live.tex,
      transparent: true,
      roughness: 0.08,
      metalness: 0,
      emissive: "#eef8ff",
      emissiveMap: live.tex,
      emissiveIntensity: 1.7,
      depthWrite: false,
    })
  );
  disp.scale.set(0.058, 0.04, 1);
  disp.position.set(w * 0.32, y + h * 0.03, faceZ + 0.002);
  group.add(disp);

  const cavW = w * 0.78;
  const cavH = h * 0.3;
  const cavY = y - h * 0.28;
  group.add(box(cavW, cavH, d * 0.62, dark, 0, cavY, -0.01, false));
  group.add(box(cavW * 0.92, 0.012, d * 0.34, cool, 0, cavY + 0.03, 0.01, false));

  if (!QUALITY.low) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.07, h * 0.07, cavW * 0.88, 18), vane);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, cavY + 0.01, -0.02);
    drum.castShadow = false;
    group.add(drum);
  }

  const slatN = QUALITY.low ? 4 : 6;
  for (let i = 0; i < slatN; i++) {
    const slat = box(cavW * 0.9, 0.005, 0.055, vane, 0, cavY - 0.02 + i * 0.015, d * 0.18, false);
    slat.rotation.x = 0.7;
    group.add(slat);
  }

  const flap = box(w * 0.82, 0.008, 0.08, plastic, 0, y - h * 0.17, d * 0.46, false);
  flap.rotation.x = 0.7;
  flap.castShadow = true;
  group.add(flap);
  const flapEdge = box(w * 0.8, 0.004, 0.012, plastic, 0, y - h * 0.2, d * 0.5, false);
  flapEdge.rotation.x = 0.7;
  group.add(flapEdge);

  if (!QUALITY.low) {
    for (let i = 0; i < 7; i++) {
      const x = -w * 0.32 + i * ((w * 0.64) / 6);
      group.add(box(0.018, 0.004, 0.07, dark, x, y + h * 0.46, 0, false));
    }
  }
}

function addHaloDesk(group, item, w, h, d) {
  const on = item.lightOn !== false;
  const black = QUALITY.physical
    ? new THREE.MeshPhysicalMaterial({
        color: item.color || "#111111",
        roughness: 0.14,
        metalness: 0.42,
        clearcoat: 0.82,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.15,
      })
    : new THREE.MeshStandardMaterial({
        color: item.color || "#111111",
        roughness: 0.16,
        metalness: 0.38,
        envMapIntensity: 1.05,
      });
  const chrome = metalMat("#c8ccd2");
  const top = new THREE.MeshStandardMaterial({
    color: "#1a1c20",
    roughness: 0.38,
    metalness: 0.08,
  });
  const goldLed = new THREE.MeshStandardMaterial({
    color: "#ffe7a8",
    emissive: item.accent || "#ff9a18",
    emissiveIntensity: on ? 2.4 : 0.08,
    roughness: 0.16,
    metalness: 0.12,
  });
  const orangeLed = new THREE.MeshStandardMaterial({
    color: "#ffb080",
    emissive: "#ff7a28",
    emissiveIntensity: on ? 1.7 : 0.05,
  });
  const blueLed = new THREE.MeshStandardMaterial({
    color: "#9aa8ff",
    emissive: item.lightColor || "#5b6bff",
    emissiveIntensity: on ? 1.85 : 0.05,
  });
  const purpleLed = new THREE.MeshStandardMaterial({
    color: "#d9a8ff",
    emissive: "#b44cff",
    emissiveIntensity: on ? 1.4 : 0.05,
  });
  const frostGlow = new THREE.MeshStandardMaterial({
    color: "#d8e4ff",
    emissive: "#9eb0ff",
    emissiveIntensity: on ? 0.85 : 0.06,
    roughness: 0.32,
    metalness: 0.04,
  });

  const wingW = Math.max(0.82, d * 1.12);
  const wingD = Math.max(1.22, d * 1.7);
  const overlap = 0.06;
  const mainX = -wingW * 0.22;
  const wingX = w / 2 + wingW / 2 - overlap + mainX;
  const wingZ = -wingD / 2 + d / 2;

  function run(bw, bh, bd, x, y, z, mat, heavy = true) {
    const m = box(bw, bh, bd, mat, x, y, z, heavy);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  run(w, h - 0.08, d - 0.06, mainX, (h - 0.08) / 2, 0, black);
  run(w + 0.04, 0.04, d + 0.02, mainX, h - 0.02, 0, top);
  run(w + 0.03, 0.038, d + 0.01, mainX, h - 0.09, 0, goldLed, false);
  run(w + 0.02, 0.055, d, mainX, 0.05, 0, goldLed, false);
  run(w - 0.08, 0.016, 0.018, mainX, h - 0.125, d / 2 - 0.02, orangeLed, false);
  run(w - 0.1, 0.016, 0.018, mainX, 0.09, d / 2 - 0.01, blueLed, false);
  run(w - 0.12, 0.012, 0.04, mainX, 0.03, d / 2 + 0.01, purpleLed, false);

  run(wingW, h - 0.1, wingD, wingX, (h - 0.1) / 2, wingZ, black);
  run(wingW + 0.03, 0.038, wingD + 0.02, wingX, h - 0.04, wingZ, top);
  run(wingW + 0.02, 0.036, wingD + 0.01, wingX, h - 0.11, wingZ, goldLed, false);
  run(wingW + 0.02, 0.055, wingD, wingX, 0.05, wingZ, goldLed, false);
  run(0.016, 0.016, wingD - 0.12, wingX + wingW / 2 - 0.02, h - 0.14, wingZ, orangeLed, false);
  run(0.016, 0.016, wingD - 0.14, wingX + wingW / 2 - 0.012, 0.09, wingZ, blueLed, false);
  run(wingW - 0.1, 0.014, 0.016, wingX, 0.09, wingZ - wingD / 2 + 0.02, purpleLed, false);

  const panelW = Math.min(1.55, w * 0.58);
  const panelH = 0.58;
  const faceZ = d / 2 + 0.03;
  const py = h * 0.48;
  run(panelW + 0.04, panelH + 0.04, 0.012, mainX, py, faceZ - 0.01, frostGlow, false);
  const panelTex = makeKingPanelTex();
  const panel = new THREE.Mesh(
    PLANE,
    new THREE.MeshStandardMaterial({
      map: panelTex,
      roughness: 0.28,
      metalness: 0.06,
      emissive: "#ffffff",
      emissiveMap: panelTex,
      emissiveIntensity: on ? 0.42 : 0.08,
      transparent: true,
      opacity: 0.96,
    })
  );
  panel.scale.set(panelW, panelH, 1);
  panel.position.set(mainX, py, faceZ + 0.018);
  group.add(panel);
  const corners = [
    [-panelW / 2 + 0.06, panelH / 2 - 0.06],
    [panelW / 2 - 0.06, panelH / 2 - 0.06],
    [-panelW / 2 + 0.06, -panelH / 2 + 0.06],
    [panelW / 2 - 0.06, -panelH / 2 + 0.06],
  ];
  for (const [sx, sy] of corners) {
    group.add(post(0.012, 0.04, chrome, mainX + sx, py + sy, faceZ, false));
  }

  const acrylic = new THREE.MeshStandardMaterial({
    color: "#d7e8f6",
    transparent: true,
    opacity: 0.22,
    roughness: 0.06,
    metalness: 0.08,
    envMapIntensity: 1.2,
    depthWrite: false,
  });
  const tag = new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.72 });
  const nPhones = QUALITY.high ? 4 : 2;
  for (let i = 0; i < nPhones; i++) {
    const x = mainX - w * 0.34 + i * (w * 0.16);
    const z = 0.06;
    const stand = box(0.07, 0.09, 0.02, acrylic, x, h + 0.04, z, false);
    stand.rotation.x = -0.42;
    group.add(stand);
    placeDisplay(group, item, `king-${i}`, {
      category: "phones",
      index: i,
      x,
      y: h + 0.09,
      z: z - 0.01,
      scale: 0.92,
    });
    group.add(box(0.05, 0.002, 0.035, tag, x, h + 0.006, z + 0.12, false));
  }

  group.add(box(0.22, 0.025, 0.14, black, mainX + w * 0.32, h + 0.02, 0.04, false));
  for (let i = 0; i < 4; i++) {
    group.add(box(0.012, 0.008, 0.11, new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.45 }), mainX + w * 0.26 + i * 0.03, h + 0.038, 0.04, false));
  }

  const posX = wingX;
  const posZ = wingZ + 0.08;
  const posY = h;
  if (!isHiddenSlot(item, "desk-laptop")) {
    const mapped = item.productMap?.["desk-laptop"];
    placeDeskProduct(
      group,
      item,
      {
        slotId: "desk-laptop",
        category: mapped?.category || "laptops",
        index: mapped?.index ?? 1,
        x: posX - 0.02,
        z: posZ - 0.02,
        rotY: 0.22,
        scale: mapped?.scale ?? 1,
      },
      posY
    );
  }
  if (!isHiddenSlot(item, "desk-ipad")) {
    const mapped = item.productMap?.["desk-ipad"];
    placeDeskProduct(
      group,
      item,
      {
        slotId: "desk-ipad",
        category: mapped?.category || "tablets",
        index: mapped?.index ?? 2,
        x: posX + 0.32,
        z: posZ + 0.04,
        rotY: -0.35,
        scale: mapped?.scale ?? 1.12,
      },
      posY
    );
  }
  const matBlue = new THREE.MeshStandardMaterial({ color: "#2f6dff", roughness: 0.7 });
  group.add(box(0.22, 0.006, 0.16, matBlue, posX + 0.16, posY + 0.005, posZ + 0.18, false));
  const orange = new THREE.MeshStandardMaterial({ color: item.accent || "#ff7a18", roughness: 0.4 });
  group.add(box(0.1, 0.06, 0.07, orange, posX + 0.22, posY + 0.035, posZ + 0.16, false));
  group.add(box(0.08, 0.025, 0.12, orange, posX + 0.08, posY + 0.016, posZ + 0.2, false));

  if (on && takeLampSlot()) {
    const wash = new THREE.PointLight("#7a88ff", Math.min(12, Math.max(6, Number(item.lightPower ?? 20))), 3.8, 2);
    wash.position.set(mainX, 0.12, d / 2 + 0.2);
    wash.castShadow = false;
    group.add(wash);
  }
}

function addLuxuryRod(group, ax, ay, az, bx, by, bz, r, mat) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.01;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
  rod.scale.set(1, len, 1);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
  rod.castShadow = false;
  group.add(rod);
}

function addLuxuryHaloRing(group, radius, y, brass, led, haze, on) {
  const segs = QUALITY.low ? 28 : 64;
  const radial = QUALITY.low ? 8 : 12;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.015, radial, segs), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = y;
  rim.castShadow = false;
  group.add(rim);

  const tube = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.01, radial, segs), led);
  tube.rotation.x = Math.PI / 2;
  tube.position.y = y - 0.003;
  group.add(tube);

  const core = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.006, 6, segs),
    new THREE.MeshBasicMaterial({ color: on ? "#fff4dc" : "#5a5048" })
  );
  core.rotation.x = Math.PI / 2;
  core.position.y = y - 0.004;
  group.add(core);

  if (haze && !QUALITY.low) {
    const bloom = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.03, 8, segs), haze);
    bloom.rotation.x = Math.PI / 2;
    bloom.position.y = y - 0.003;
    bloom.renderOrder = 2;
    group.add(bloom);
  }
}

function addCrystalChandelier(group, item) {
  const on = item.lightOn !== false;
  const y = item.lift ?? 4.66;
  const span = Math.max(0.95, item.width || 1.28);
  const oldChrome = !item.color || item.color === "#e8eef4" || item.color === "#f4efe6" || item.color === "#f4eee6";
  const housing = metalMat(oldChrome ? "#161412" : item.color);
  const brass = metalMat(!item.accent || item.accent === "#c8d0d8" ? "#c6a56a" : item.accent);
  const warm = item.lightColor && item.lightColor !== "#f2f6ff" ? item.lightColor : "#ffe4b8";
  const led = new THREE.MeshStandardMaterial({
    color: "#fff6ea",
    emissive: warm,
    emissiveIntensity: on ? 2.7 : 0.04,
    roughness: 0.16,
    metalness: 0.02,
  });
  const haze = new THREE.MeshBasicMaterial({
    color: on ? "#ffd39a" : "#4a4038",
    transparent: true,
    opacity: on ? 0.2 : 0.03,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const roseR = Math.min(0.2, span * 0.16);
  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(roseR + 0.05, 28),
    new THREE.MeshBasicMaterial({ color: "#070605", transparent: true, opacity: 0.42, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = y + 0.046;
  group.add(contact);

  const rose = new THREE.Mesh(new THREE.CylinderGeometry(roseR, roseR + 0.01, 0.05, 32), housing);
  rose.position.y = y + 0.02;
  rose.castShadow = false;
  group.add(rose);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(roseR + 0.006, 0.008, 10, 32), brass);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = y - 0.004;
  group.add(lip);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(roseR * 0.55, roseR * 0.62, 0.016, 24), housing);
  well.position.y = y - 0.006;
  group.add(well);
  const canopyGlow = new THREE.Mesh(new THREE.CircleGeometry(roseR * 0.42, 22), led);
  canopyGlow.rotation.x = -Math.PI / 2;
  canopyGlow.position.y = y - 0.016;
  group.add(canopyGlow);

  const stemH = 0.11;
  group.add(post(0.007, stemH, brass, 0, y - stemH / 2 - 0.01, 0));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.022, 16), brass);
  hub.position.y = y - stemH - 0.02;
  group.add(hub);

  const rings = [
    { r: span * 0.4, drop: 0.17, rods: 3, twist: 0 },
    { r: span * 0.26, drop: 0.3, rods: 3, twist: Math.PI / 3 },
    { r: span * 0.14, drop: 0.43, rods: 3, twist: Math.PI / 6 },
  ];
  const hangFrom = y - 0.018;
  for (const ring of rings) {
    const ringY = y - ring.drop;
    addLuxuryHaloRing(group, ring.r, ringY, brass, led, haze, on);
    for (let i = 0; i < ring.rods; i++) {
      const a = ring.twist + (i / ring.rods) * Math.PI * 2;
      const x = Math.cos(a) * ring.r;
      const z = Math.sin(a) * ring.r;
      addLuxuryRod(group, x * 0.18, hangFrom, z * 0.18, x, ringY + 0.01, z, 0.0036, brass);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), brass);
      cap.position.set(x, ringY + 0.01, z);
      group.add(cap);
    }
  }

  const dropY = y - rings[2].drop - 0.07;
  addLuxuryRod(group, 0, y - stemH - 0.03, 0, 0, dropY + 0.012, 0, 0.0032, brass);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), brass);
  finial.position.y = dropY;
  group.add(finial);

  const power = Math.min(QUALITY.high ? 18 : 10, Math.max(0, Number(item.lightPower ?? 64)));
  if (takeLampSlot()) {
    const spot = new THREE.SpotLight(warm, on ? power : 0, 14, 0.7, 0.58, 1.2);
    spot.position.set(0, y - 0.1, 0);
    const target = new THREE.Object3D();
    target.position.set(0, 0.05, 0);
    group.add(target);
    spot.target = target;
    group.add(spot);
  }
  if (takeLampSlot()) {
    const fill = new THREE.PointLight(warm, on ? power * 0.32 : 0, 7.2, 1.75);
    fill.position.set(0, y - 0.3, 0);
    group.add(fill);
  }
}

function addDressBoutiqueShelf(group, item, w, h, d) {
  const cream = bodyMat(item.color || "#f4eee6");
  const oak = woodMat(item.accent || "#b08968");
  const chrome = metalMat("#c5ccd3");
  const { n, bay, xs } = dressShelfLayout(w);
  const railY = dressShelfRailY(h);

  group.add(box(w, h, 0.04, cream, 0, h / 2, -d / 2 + 0.02));
  group.add(box(0.08, h, d, cream, -w / 2 + 0.04, h / 2, 0));
  group.add(box(0.08, h, d, cream, w / 2 - 0.04, h / 2, 0));
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + 0.08 + i * ((w - 0.16) / n);
    group.add(box(0.04, h, d - 0.04, cream, x, h / 2, 0));
  }
  group.add(box(w, 0.07, d, cream, 0, h - 0.035, 0));
  group.add(box(w, 0.08, d, oak, 0, 0.04, 0));

  const boxColors = ["#d8c4a8", "#3a2a24", "#b76e79"];
  xs.forEach((bx) => {
    group.add(box(bay - 0.08, 0.025, d - 0.1, oak, bx, h - 0.22, 0.02));
    [-0.28, 0, 0.28].forEach((sx, si) => {
      if (Math.abs(sx) > bay / 2 - 0.16) return;
      group.add(box(0.16, 0.12, 0.2, bodyMat(boxColors[si]), bx + sx, h - 0.14, 0.02));
    });
    const rail = shadow(new THREE.Mesh(TUBE, chrome));
    rail.scale.set(0.012, Math.max(0.2, bay - 0.16), 0.012);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(bx, railY, 0);
    group.add(rail);
    group.add(box(bay - 0.1, Math.max(0.28, h * 0.22), 0.03, cream, bx, h * 0.17, 0.02));
    group.add(box(0.012, 0.08, 0.012, metalMat("#c9a36a"), bx + bay * 0.18, h * 0.17, 0.04, false));
  });
  group.add(box(w - 0.2, 0.012, 0.02, LED_MAT, 0, railY + 0.02, -d / 2 + 0.05, false));
}

export function createFurniture(item) {
  const type = item.type;
  const w = item.width;
  const d = item.depth;
  const h = item.height;
  const pbr = SURFACE_PBR[item.texture] || {};
  const main = item._map
    ? woodMat(item.color, { map: item._map })
    : item.texture && item.texture !== "paint"
      ? mappedColorMat(isTerrazzo(item.texture) ? "#ffffff" : item.color, item.texture, {
          roughness: pbr.roughness ?? 0.18,
          metalness: pbr.metalness ?? 0.05,
          env: isTerrazzo(item.texture) ? 1.35 : 0.85,
          repeat: isTerrazzo(item.texture) ? 2.2 : 1.6,
          nStr: isTerrazzo(item.texture) ? 0.5 : 0.75,
          nSc: isTerrazzo(item.texture) ? 0.2 : 0.32,
        })
      : bodyMat(item.color);
  const acc = metalMat(item.accent);
  const group = new THREE.Group();

  const top = marbleTop(isDarkBody(item.color) ? "#2a2420" : "#f6f1e8");
  const brass = metalMat("#c6a56a");

  if (type === "desk") {
    const stone = marbleTop(isDarkBody(item.color) ? "#2a2420" : "#f6f1e8");
    const plinth = metalMat("#2a2622");
    group.add(box(w - 0.14, 0.07, d - 0.12, plinth, 0, 0.035, 0));
    group.add(box(w - 0.06, h - 0.14, d - 0.08, main, 0, (h - 0.14) / 2 + 0.06, 0));
    group.add(box(w - 0.18, 0.1, 0.02, main, 0, h * 0.52, d / 2 - 0.032));
    group.add(box(0.14, 0.012, 0.012, brass, 0, h * 0.52, d / 2 - 0.018, false));
    group.add(box(w + 0.08, 0.014, d + 0.08, brass, 0, h - 0.018, 0));
    group.add(box(w + 0.05, 0.046, d + 0.05, stone, 0, h + 0.014, 0));
    group.add(box(w - 0.08, 0.008, d - 0.08, brass, 0, h + 0.038, 0, false));
    const ox = w / 2 - 0.11;
    const oz = d / 2 - 0.1;
    for (const [x, z] of [[ox, oz], [-ox, oz], [ox, -oz], [-ox, -oz]]) {
      group.add(post(0.022, h - 0.12, brass, x, (h - 0.12) / 2 + 0.05, z, true));
    }
    addBrandPlate(group, 0, 0.42, d / 2 - 0.01);
    addMallKickLight(group, w, d, 0.055);
    if (item.liveCheckout) addLiveCheckout(group, w, h + 0.04, d, brass);
  } else if (type === "counter") {
    const kick = 0.08;
    const stone = marbleTop("#f7f3ec");
    group.add(box(w - 0.1, 0.06, d - 0.08, metalMat("#1c1916"), 0, 0.03, 0));
    group.add(box(w - 0.04, h - 0.14 - kick, d - 0.06, main, 0, kick + (h - 0.14 - kick) / 2, 0.01));
    group.add(box(0.05, h - 0.12, d + 0.02, stone, -w / 2 + 0.02, h / 2 + 0.02, 0));
    group.add(box(0.05, h - 0.12, d + 0.02, stone, w / 2 - 0.02, h / 2 + 0.02, 0));
    group.add(box(w + 0.1, 0.016, d + 0.08, brass, 0, h - 0.028, 0));
    group.add(box(w + 0.06, 0.05, d + 0.04, stone, 0, h + 0.012, 0));
    group.add(box(w - 0.12, 0.016, d - 0.1, glassMat("#eaf4fc"), 0, h + 0.042, 0, false));
    group.add(box(w - 0.18, 0.09, 0.018, main, 0, kick + h * 0.32, d / 2 - 0.028));
    group.add(box(w - 0.22, 0.01, 0.016, LED_MAT, 0, h - 0.06, d / 2 - 0.05, false));
    addBrandPlate(group, 0, kick + 0.38, d / 2 - 0.014);
    addMallKickLight(group, w, d, kick * 0.55);
  } else if (type === "haloDesk") {
    addHaloDesk(group, item, w, h, d);
  } else if (type === "cashier") {
    const kick = 0.08;
    group.add(box(w, h * 0.72 - kick, d, main, 0, kick + (h * 0.72 - kick) / 2, 0));
    group.add(box(w + 0.04, 0.04, d + 0.04, top, 0, h * 0.72 + 0.01, 0));
    group.add(box(w * 0.36, 0.06, d * 0.5, brass, w * 0.28, h * 0.72 + 0.1, 0));
    group.add(post(0.018, 0.3, brass, w * 0.28, h * 0.72 + 0.28, -d * 0.1));
    group.add(box(0.22, 0.14, 0.02, acc, w * 0.28, h * 0.72 + 0.44, -d * 0.1, false));
    addBrandPlate(group, -w * 0.22, kick + 0.32, d / 2 + 0.01);
    addMallKickLight(group, w, d, kick * 0.52);
    addLiveCheckout(group, w, h * 0.72 + 0.04, d, brass);
  } else if (type === "table") {
    const segs = QUALITY.low ? 10 : 18;
    const slab = shadow(new THREE.Mesh(extrudeRoundSlab(w, d, 0.07, 0.034, segs), top));
    slab.position.y = h - 0.01;
    group.add(slab);
    group.add(box(w - 0.06, 0.008, d - 0.06, brass, 0, h - 0.04, 0, false));
    const ped = shadow(new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.14, Math.min(w, d) * 0.18, h - 0.08, 16), brass));
    ped.position.y = (h - 0.08) / 2;
    group.add(ped);
    const foot = new THREE.Mesh(extrudeRoundSlab(w * 0.42, d * 0.42, 0.05, 0.03, 12), main);
    foot.position.y = 0.02;
    group.add(foot);
  } else if (type === "coffeeTable") {
    addCoffeeTable(group, item);
  } else if (type === "loungeChair") {
    addLoungeChair(group, item);
  } else if (type === "ottoman") {
    addOttoman(group, item);
  } else if (type === "sideboard") {
    addSideboard(group, item);
  } else if (type === "shelf") {
    group.add(box(w, h, 0.04, main, 0, h / 2, -d / 2 + 0.02));
    group.add(box(w, 0.05, d, top, 0, 0.03, 0));
    const shelves = 4;
    for (let i = 1; i <= shelves; i++) {
      const y = (h / (shelves + 0.3)) * i;
      group.add(box(w - 0.04, 0.028, d - 0.02, main, 0, y, 0.01));
    }
    group.add(box(0.028, h, d, brass, -w / 2 + 0.02, h / 2, 0));
    group.add(box(0.028, h, d, brass, w / 2 - 0.02, h / 2, 0));
  } else if (type === "dressNiche") {
    addDressBoutiqueShelf(group, item, w, h, d);
  } else if (type === "marbleIsland") {
    const stone = marbleTop("#f7f3ec");
    const bodyH = Math.max(0.22, h - 0.03);
    const rad = d / 2;
    const mid = Math.max(0.2, w - d);
    group.add(box(mid, bodyH, d, stone, 0, bodyH / 2 + 0.02, 0));
    const capL = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, bodyH, 28), stone));
    capL.position.set(-(w / 2 - rad), bodyH / 2 + 0.02, 0);
    group.add(capL);
    const capR = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, bodyH, 28), stone));
    capR.position.set(w / 2 - rad, bodyH / 2 + 0.02, 0);
    group.add(capR);
    group.add(box(w - 0.12, 0.035, d - 0.12, brass, 0, 0.028, 0));
    addMallKickLight(group, w, d, 0.05);
  } else if (type === "marblePlinth") {
    const stone = marbleTop(isDarkBody(item.color) ? "#2a2420" : "#f7f3ec");
    const shaft = shadow(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.4, w * 0.44, h, 28), stone));
    shaft.position.y = h / 2 + 0.03;
    group.add(shaft);
    const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.52, 0.06, 28), brass));
    base.position.y = 0.03;
    group.add(base);
    addMallKickLight(group, w * 1.05, d * 1.05, 0.045);
  } else if (type === "goldArch") {
    const lift = item.lift ?? 0.14;
    const mount = new THREE.Group();
    addArchedFloorMirror(mount, w, h);
    mount.position.y = lift;
    group.add(mount);
  } else if (type === "rack") {
    const gold = metalMat(item.accent || "#c6a56a");
    const r = 0.0125;
    const px = w / 2 - 0.03;
    const [lowY, topY] = rackRailYs(h);
    group.add(post(r, h, gold, -px, h / 2, 0));
    group.add(post(r, h, gold, px, h / 2, 0));
    const rail = (y) => {
      const bar = shadow(new THREE.Mesh(TUBE, gold));
      bar.scale.set(r, w - 0.04, r);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, y, 0);
      group.add(bar);
    };
    rail(lowY);
    rail(topY);
    const foot = (x) => {
      const bar = shadow(new THREE.Mesh(TUBE, gold));
      bar.scale.set(r, d - 0.04, r);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(x, r + 0.008, 0);
      group.add(bar);
    };
    foot(-px);
    foot(px);
    const base = shadow(new THREE.Mesh(TUBE, gold));
    base.scale.set(r, w - 0.04, r);
    base.rotation.z = Math.PI / 2;
    base.position.set(0, r + 0.008, 0);
    group.add(base);
  } else if (type === "cube") {
    group.add(box(w, h - 0.04, d, main, 0, (h - 0.04) / 2, 0));
    group.add(box(w + 0.03, 0.028, d + 0.03, brass, 0, h + 0.01, 0));
    group.add(box(w - 0.02, 0.02, d - 0.02, top, 0, h + 0.03, 0, false));
  } else if (type === "plant") {
    const goldPot = item.pot === "gold";
    const potPts = [];
    potPts.push(new THREE.Vector2(0, 0));
    potPts.push(new THREE.Vector2(w * 0.22, 0.01));
    potPts.push(new THREE.Vector2(w * 0.26, h * 0.08));
    potPts.push(new THREE.Vector2(w * 0.2, h * 0.34));
    potPts.push(new THREE.Vector2(w * 0.18, h * 0.38));
    const pot = shadow(new THREE.Mesh(new THREE.LatheGeometry(potPts, 22), goldPot ? brass : ceramicMat("#f3ebe0")));
    group.add(pot);
    group.add(box(w * 0.36, 0.01, w * 0.36, goldPot ? brass : metalMat("#c6a56a"), 0, h * 0.38, 0, false));
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.16, w * 0.16, 0.03, 16), new THREE.MeshStandardMaterial({ color: "#2a2018", roughness: 0.92 }));
    soil.position.y = h * 0.36;
    group.add(soil);
    const leaf = new THREE.MeshStandardMaterial({ color: item.accent || "#3f8f5a", roughness: 0.58, envMapIntensity: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: "#245a38", roughness: 0.7, envMapIntensity: 0.22 });
    const mid = new THREE.MeshStandardMaterial({ color: "#3f8f5a", roughness: 0.64, envMapIntensity: 0.26 });
    const greens = [leaf, dark, mid];
    const stem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, h * 0.38, 8), woodMat("#3a2a18", { roughness: 0.84 })));
    stem.position.y = h * 0.52;
    group.add(stem);
    for (let i = 0; i < 11; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(w * (0.1 + (i % 4) * 0.03), 14, 12), greens[i % 3]);
      const a = (i / 11) * Math.PI * 2;
      const r = 0.04 + (i % 3) * 0.035;
      bush.position.set(Math.cos(a) * r, h * 0.58 + (i % 4) * 0.07, Math.sin(a) * r);
      bush.scale.set(1, 0.72 + (i % 3) * 0.08, 1);
      group.add(bush);
    }
  } else if (type === "light") {
    const on = item.lightOn !== false;
    group.add(post(0.09, 0.04, brass, 0, 0.02, 0));
    group.add(post(0.018, h - 0.22, brass, 0, (h - 0.22) / 2, 0, true));
    const shade = shadow(new THREE.Mesh(TAPER, fabricMat(item.color || "#f4eee6")));
    shade.scale.set(0.16, 0.2, 0.16);
    shade.position.y = h - 0.12;
    group.add(shade);
    group.add(box(0.12, 0.03, 0.12, glowMat(item.lightColor, on), 0, h - 0.2, 0, false));
    addLampLight(group, item, h - 0.18, "point");
  } else if (type === "pendant") {
    const on = item.lightOn !== false;
    const y = item.lift ?? 3.15;
    const rodH = Math.max(0.18, h * 0.55);
    const gold = metalMat(item.accent || "#d4af37");
    gold.side = THREE.DoubleSide;
    group.add(post(0.06, 0.02, gold, 0, y + rodH + 0.02, 0));
    group.add(post(0.01, rodH, gold, 0, y + rodH / 2, 0));
    const shade = shadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.18, w * 0.46, 0.22, 24, 1, true),
        gold
      )
    );
    shade.position.y = y + 0.05;
    group.add(shade);
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.16, w * 0.43, 0.2, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: "#fff6ea",
        emissive: item.lightColor || "#ffe6b0",
        emissiveIntensity: on ? 0.95 : 0.06,
        roughness: 0.68,
        side: THREE.BackSide,
      })
    );
    liner.position.y = y + 0.05;
    group.add(liner);
    const bulb = shadow(new THREE.Mesh(new THREE.SphereGeometry(w * 0.09, 14, 10), glowMat(item.lightColor, on)));
    bulb.position.y = y + 0.04;
    group.add(bulb);
    addLampLight(group, item, y - 0.08, "point");
  } else if (type === "crystalChandelier") {
    addCrystalChandelier(group, item);
  } else if (type === "ceilingCan") {
    const on = item.lightOn !== false;
    const y = item.lift ?? 4.55;
    const gold = metalMat(item.accent || "#d4af37");
    group.add(box(Math.max(w, 0.2), 0.016, Math.max(d, 0.2), gold, 0, y + 0.055, 0));
    const well = shadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.34, w * 0.4, 0.09, 20),
        new THREE.MeshStandardMaterial({ color: "#141210", metalness: 0.48, roughness: 0.32 })
      )
    );
    well.position.y = y + 0.012;
    group.add(well);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.38, 0.012, 8, 24), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y - 0.028;
    group.add(ring);
    const baffle = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.2, w * 0.3, 0.032, 16),
      new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.94 })
    );
    baffle.position.y = y - 0.018;
    group.add(baffle);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(w * 0.16, 20), glowMat(item.lightColor, on));
    lens.rotation.x = Math.PI / 2;
    lens.position.y = y - 0.036;
    group.add(lens);
    addLampLight(group, item, y - 0.08, "spot");
  } else if (type === "wallSconce") {
    const on = item.lightOn !== false;
    const y = item.lift ?? 1.75;
    group.add(box(0.08, 0.18, 0.02, brass, 0, y, -0.02));
    group.add(box(0.03, 0.04, 0.06, brass, 0, y, 0.02));
    const shade = shadow(new THREE.Mesh(TAPER, fabricMat(item.color || "#f4eee6")));
    shade.scale.set(0.09, 0.12, 0.09);
    shade.position.set(0, y + 0.02, 0.08);
    group.add(shade);
    group.add(box(0.06, 0.02, 0.06, glowMat(item.lightColor, on), 0, y - 0.02, 0.08, false));
    addLampLight(group, item, y, "sconce");
  } else if (type === "deskLamp") {
    const on = item.lightOn !== false;
    const baseY = item.lift ?? 0.78;
    group.add(post(0.07, 0.03, brass, 0, baseY + 0.015, 0));
    const arm = shadow(new THREE.Mesh(TUBE, brass));
    arm.scale.set(0.01, 0.22, 0.01);
    arm.position.set(0.06, baseY + 0.16, 0);
    arm.rotation.z = -0.55;
    group.add(arm);
    const shade = shadow(new THREE.Mesh(TAPER, fabricMat(item.color || "#f4eee6")));
    shade.scale.set(0.09, 0.08, 0.09);
    shade.position.set(0.14, baseY + 0.28, 0);
    group.add(shade);
    group.add(box(0.06, 0.015, 0.06, glowMat(item.lightColor, on), 0.14, baseY + 0.24, 0, false));
    if (takeLampSlot()) {
      const bulb = new THREE.PointLight(item.lightColor || "#ffe6b8", on ? Math.min(14, Math.max(0, Number(item.lightPower ?? 32))) : 0, 4.2, 2);
      bulb.position.set(0.14, baseY + 0.24, 0);
      group.add(bulb);
    }
  } else if (type === "bench") {
    group.add(box(w, 0.07, d, leatherMat(item.color || "#4a3426"), 0, h, 0));
    group.add(box(w - 0.08, 0.012, d - 0.06, brass, 0, h - 0.04, 0, false));
    group.add(post(0.028, h - 0.02, brass, -w / 2 + 0.1, (h - 0.02) / 2, d / 2 - 0.08, true));
    group.add(post(0.028, h - 0.02, brass, w / 2 - 0.1, (h - 0.02) / 2, d / 2 - 0.08, true));
    group.add(post(0.028, h - 0.02, brass, -w / 2 + 0.1, (h - 0.02) / 2, -d / 2 + 0.08, true));
    group.add(post(0.028, h - 0.02, brass, w / 2 - 0.1, (h - 0.02) / 2, -d / 2 + 0.08, true));
  } else if (type === "ledGlassBay") {
    addLedGlassBay(group, item, w, h, d);
  } else if (type === "phoneBar") {
    const white = new THREE.MeshStandardMaterial({ color: item.color || "#f2f4f6", roughness: 0.28, metalness: 0.04 });
    const chrome = metalMat("#c5c8cc");
    group.add(box(w, h - 0.08, d, white, 0, (h - 0.08) / 2, 0));
    group.add(box(w + 0.04, 0.03, d + 0.04, chrome, 0, h - 0.02, 0));
    group.add(box(w - 0.06, 0.018, d - 0.06, glassMat("#c8f6ff"), 0, h + 0.02, 0, false));
    group.add(box(w - 0.12, 0.012, d - 0.12, CYAN_LED, 0, h - 0.04, 0, false));
    group.add(box(w - 0.16, 0.01, 0.018, CYAN_LED, 0, h - 0.08, d / 2 - 0.03, false));
    const screens = Math.max(4, Math.round(w / 0.52));
    for (let i = 0; i < screens; i++) {
      const x = screens === 1 ? 0 : -w / 2 + 0.32 + (i * (w - 0.64)) / (screens - 1);
      const tex = makeLedBannerTex({ posterText: i % 2 ? "5G LIVE" : "iPHONE", color: "#081018", accent: "#2ad4e8" }, true);
      const face = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.18,
        metalness: 0.06,
        emissive: "#ffffff",
        emissiveMap: tex,
        emissiveIntensity: 0.7,
      });
      const pane = new THREE.Mesh(PLANE, face);
      pane.scale.set(0.28, h * 0.62, 1);
      pane.position.set(x, h * 0.48, d / 2 + 0.012);
      group.add(pane);
    }
  } else if (type === "phonePedestal") {
    const wood = woodMat(item.color && !/^#f[0-9a-f]{5}$/i.test(item.color) ? item.color : "#6a4a2e", {
      repeat: 1.8,
      roughness: 0.38,
    });
    const foot = woodMat("#3a2416", { repeat: 0.7, roughness: 0.48 });
    const chrome = metalMat("#c8ccd2");
    const glassTop = QUALITY.physical
      ? new THREE.MeshPhysicalMaterial({
          color: "#e8f4fc",
          roughness: 0.04,
          metalness: 0.02,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          envMapIntensity: 1.55,
          clearcoat: 1,
          clearcoatRoughness: 0.04,
          ior: 1.5,
          reflectivity: 0.62,
        })
      : glassMat("#d8eef8");
    const underLed = new THREE.MeshStandardMaterial({
      color: "#fff8ee",
      emissive: item.lightColor || "#ffe6b8",
      emissiveIntensity: 2.2,
    });
    group.add(box(w * 0.78, 0.06, d * 0.78, foot, 0, 0.03, 0));
    group.add(box(w * 0.86, h - 0.16, d * 0.86, wood, 0, (h - 0.16) / 2 + 0.05, 0));
    group.add(box(w * 0.8, 0.014, d * 0.8, underLed, 0, h - 0.028, 0, false));
    group.add(box(w + 0.08, 0.012, 0.018, underLed, 0, h - 0.02, d / 2 + 0.01, false));
    group.add(box(w + 0.08, 0.012, 0.018, underLed, 0, h - 0.02, -d / 2 - 0.01, false));
    group.add(box(0.018, 0.012, d + 0.08, underLed, w / 2 + 0.01, h - 0.02, 0, false));
    group.add(box(0.018, 0.012, d + 0.08, underLed, -w / 2 - 0.01, h - 0.02, 0, false));
    group.add(box(w + 0.1, 0.016, d + 0.1, chrome, 0, h - 0.006, 0, false));
    group.add(box(w + 0.06, 0.028, d + 0.06, glassTop, 0, h + 0.016, 0, false));
    addMallKickLight(group, w * 0.86, d * 0.86, 0.042);
  } else if (type === "slatSignWall") {
    addSlatSignWall(group, item, w, h, d);
  } else if (type === "brandCubby") {
    const navy = new THREE.MeshStandardMaterial({ color: item.accent || "#152a4a", roughness: 0.48, metalness: 0.08 });
    const white = new THREE.MeshStandardMaterial({ color: item.color || "#f2f4f6", roughness: 0.32, metalness: 0.03 });
    group.add(box(w, h, 0.05, navy, 0, h / 2, -d / 2 + 0.025));
    group.add(box(0.04, h, d, navy, -w / 2 + 0.02, h / 2, 0));
    group.add(box(0.04, h, d, navy, w / 2 - 0.02, h / 2, 0));
    group.add(box(w, 0.05, d, navy, 0, 0.03, 0));
    group.add(box(w, 0.08, d, navy, 0, h - 0.04, 0));
    const cols = 4;
    const rows = 3;
    const cw = (w - 0.16) / cols;
    const ch = (h - 0.55) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + 0.1 + (c + 0.5) * cw;
        const y = 0.28 + (r + 0.5) * ch;
        group.add(box(cw - 0.04, ch - 0.04, d - 0.1, navy, x, y, 0));
        group.add(box(cw - 0.08, 0.016, d - 0.14, white, x, y - ch * 0.32, 0.02));
      }
    }
    group.add(box(w - 0.16, 0.01, 0.016, CYAN_LED, 0, h - 0.1, d / 2 - 0.04, false));
    const brand = String(item.posterText || "iPhone").toUpperCase();
    const mark = makeLedBannerTex({ posterText: brand, color: "#102038", accent: "#4ae0ee" }, false);
    const plate = new THREE.Mesh(
      PLANE,
      new THREE.MeshStandardMaterial({
        map: mark,
        roughness: 0.22,
        metalness: 0.08,
        emissive: "#ffffff",
        emissiveMap: mark,
        emissiveIntensity: 0.55,
      })
    );
    plate.scale.set(Math.min(w * 0.72, 1.4), 0.16, 1);
    plate.position.set(0, h - 0.2, d / 2 + 0.01);
    group.add(plate);
  } else if (type === "phoneIsland") {
    const kick = 0.1;
    group.add(box(w, h - 0.1 - kick, d, main, 0, kick + (h - 0.1 - kick) / 2, 0));
    group.add(box(w + 0.08, 0.03, d + 0.08, brass, 0, h, 0));
    group.add(box(w - 0.06, 0.028, d - 0.06, top, 0, h + 0.02, 0));
    group.add(box(w - 0.14, 0.014, d - 0.14, glassMat("#eaf4fc"), 0, h + 0.04, 0, false));
    group.add(box(w - 0.2, 0.01, 0.016, LED_MAT, 0, h - 0.06, d / 2 - 0.04, false));
    group.add(box(w * 0.2, 0.06, d * 0.2, brass, 0, h + 0.08, 0));
    addBrandPlate(group, 0, kick + 0.28, d / 2 + 0.01);
    addMallKickLight(group, w, d, kick * 0.48);
  } else if (type === "phoneCabinet") {
    group.add(box(w, h, 0.05, main, 0, h / 2, -d / 2 + 0.025));
    group.add(box(0.05, h, d, brass, -w / 2 + 0.025, h / 2, 0));
    group.add(box(0.05, h, d, brass, w / 2 - 0.025, h / 2, 0));
    group.add(box(w, 0.05, d, brass, 0, 0.1, 0));
    group.add(box(w, 0.05, d, brass, 0, h - 0.03, 0));
    group.add(box(w - 0.06, 0.72, d - 0.04, main, 0, 0.46, 0));
    addMallKickLight(group, w, d, 0.05);
    group.add(box(0.02, 0.55, d - 0.08, acc, 0, 0.42, d / 2 - 0.03));
    const shelves = 4;
    for (let i = 0; i < shelves; i++) {
      const y = 0.82 + i * ((h - 1.05) / Math.max(1, shelves - 1));
      group.add(box(w - 0.1, 0.028, d - 0.06, main, 0, y, 0.01));
    }
  } else if (type === "accessoryWall") {
    group.add(box(w, h, 0.05, main, 0, h / 2, -d / 2 + 0.03));
    group.add(box(0.04, h, d, brass, -w / 2 + 0.02, h / 2, 0));
    group.add(box(0.04, h, d, brass, w / 2 - 0.02, h / 2, 0));
    group.add(box(w, 0.05, d, brass, 0, 0.03, 0));
    group.add(box(w, 0.04, d, brass, 0, h - 0.03, 0));
    for (let i = 1; i <= 4; i++) {
      const y = 0.28 + i * 0.38;
      group.add(box(w - 0.08, 0.025, d - 0.04, main, 0, y, 0.02));
    }
  } else if (type === "glassCase") {
    const kick = 0.06;
    const watchCase = item.stock === "watches";
    if (watchCase) {
      addWatchVitrine(group, item, w, h, d);
    } else {
      const velvet = new THREE.MeshStandardMaterial({ color: "#2a1810", roughness: 0.88, metalness: 0.02 });
      group.add(box(w, h * 0.42 - kick, d, main, 0, kick + (h * 0.42 - kick) / 2, 0));
      addMallKickLight(group, w, d, kick * 0.5);
      group.add(box(w + 0.02, 0.03, d + 0.02, brass, 0, h * 0.44, 0));
      group.add(box(w - 0.1, 0.018, d - 0.1, velvet, 0, h * 0.455, 0, false));
      addBrandPlate(group, 0, kick + 0.2, d / 2 + 0.012, 0, item.posterText || "CHRONOS");
      const gh = h * 0.52;
      const glass = glassMat();
      group.add(box(w, 0.02, d, glass, 0, h * 0.44 + gh, 0));
      group.add(box(0.018, gh, d, glass, -w / 2 + 0.018, h * 0.44 + gh / 2, 0));
      group.add(box(0.018, gh, d, glass, w / 2 - 0.018, h * 0.44 + gh / 2, 0));
      group.add(box(w, gh, 0.018, glass, 0, h * 0.44 + gh / 2, d / 2 - 0.018));
      group.add(box(w, gh, 0.018, glass, 0, h * 0.44 + gh / 2, -d / 2 + 0.018));
      group.add(box(0.02, gh, 0.02, brass, -w / 2 + 0.02, h * 0.44 + gh / 2, d / 2 - 0.02));
      group.add(box(0.02, gh, 0.02, brass, w / 2 - 0.02, h * 0.44 + gh / 2, d / 2 - 0.02));
      group.add(box(w - 0.1, 0.01, 0.02, brass, 0, h * 0.46, 0, false));
    }
  } else if (type === "watchTower") {
    const gold = metalMat(item.accent || "#d4af37");
    const ebony = woodMat("#241810", { roughness: 0.3, env: 1.05, repeat: 2.2 });
    const r = Math.min(w, d) * 0.38;
    const bodyH = h - 0.1;
    group.add(box(w * 0.92, 0.05, d * 0.92, gold, 0, 0.025, 0));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.96, bodyH, 28), ebony);
    core.position.y = bodyH / 2 + 0.04;
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);
    const slats = QUALITY.low ? 14 : 20;
    for (let i = 0; i < slats; i++) {
      const a = (i / slats) * Math.PI * 2;
      const slat = box(0.016, bodyH - 0.04, 0.034, ebony, Math.cos(a) * r, bodyH / 2 + 0.04, Math.sin(a) * r);
      slat.rotation.y = -a;
      slat.castShadow = false;
      group.add(slat);
      const a2 = a + Math.PI / slats;
      const inlay = box(0.004, bodyH - 0.08, 0.01, gold, Math.cos(a2) * (r + 0.006), bodyH / 2 + 0.04, Math.sin(a2) * (r + 0.006), false);
      inlay.rotation.y = -a2;
      group.add(inlay);
    }
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.01, 8, 28), gold);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.08;
    group.add(baseRing);
    const watchS = item.watchScale ?? 1.28;
    const domeR = Math.max(r + 0.08, r * 1.18 + watchS * 0.04);
    const deckR = domeR * 0.98;
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(deckR, 0.012, 8, 28), gold);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = h - 0.02;
    group.add(topRing);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(deckR, deckR, 0.028, 28), woodMat("#2a1c14", { roughness: 0.22, env: 1.2, repeat: 1.1 }));
    deck.position.y = h + 0.006;
    deck.receiveShadow = true;
    group.add(deck);
    addAurumPlate(group, 0, h * 0.62, r + 0.03, item.posterText || "AURUM GENESIS", 0.3, 0.055);
    const standW = deckR * 0.72;
    group.add(box(standW, 0.016, standW * 0.72, ebony, 0, h + 0.024, 0, false));
    group.add(box(standW * 0.9, 0.012, standW * 0.62, leatherMat("#d4c2a4"), 0, h + 0.036, 0, false));
    addAurumPlate(group, 0, h + 0.028, standW * 0.42, item.logoWord || "GENESIS", 0.12, 0.022);
    const glow = glowMat(item.lightColor || "#ffe6b8", true);
    glow.emissiveIntensity = 3.4;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(deckR * 0.88, 0.012, 10, 36), glow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = h + 0.018;
    group.add(halo);
    const wash = new THREE.Mesh(
      new THREE.CircleGeometry(deckR * 0.82, 28),
      new THREE.MeshStandardMaterial({
        color: "#fff4d6",
        emissive: "#ffe4ae",
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    wash.rotation.x = -Math.PI / 2;
    wash.position.y = h + 0.022;
    group.add(wash);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, QUALITY.low ? 18 : 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), watchGlassMat());
    dome.position.y = h + 0.018;
    dome.castShadow = false;
    group.add(dome);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pts = [];
      for (let t = 0; t <= 10; t++) {
        const ang = (t / 10) * Math.PI * 0.56;
        pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(ang) * domeR, Math.sin(ang) * domeR, Math.sin(a) * Math.cos(ang) * domeR));
      }
      const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0036, 6, false), gold);
      rib.position.y = h + 0.018;
      rib.castShadow = false;
      group.add(rib);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), gold);
    cap.position.y = h + 0.018 + domeR * 0.93;
    group.add(cap);
    addLampLight(group, { ...item, lightOn: item.lightOn !== false, lightPower: item.lightPower ?? 26, lightColor: item.lightColor || "#ffe4ae" }, h + 0.16, "point");
  } else if (type === "mannequinCase") {
    const frame = new THREE.MeshStandardMaterial({ color: "#101010", roughness: 0.22, metalness: 0.45, envMapIntensity: 0.95 });
    const glass = glassMat("#d8eaf6");
    const floor = ceramicMat("#f8f7f4");
    const baseH = 0.14;
    const topH = 0.05;
    const pane = 0.012;
    const innerH = h - baseH - topH;
    const gy = baseH + innerH / 2;
    group.add(box(w + 0.04, baseH, d + 0.04, frame, 0, baseH / 2, 0));
    group.add(box(w - 0.1, 0.02, d - 0.1, floor, 0, baseH + 0.012, 0, false));
    group.add(box(w, innerH, pane, glass, 0, gy, d / 2 - pane / 2));
    group.add(box(w, innerH, pane, glass, 0, gy, -d / 2 + pane / 2));
    group.add(box(pane, innerH, d, glass, -w / 2 + pane / 2, gy, 0));
    group.add(box(pane, innerH, d, glass, w / 2 - pane / 2, gy, 0));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        group.add(box(0.028, h, 0.028, frame, sx * (w / 2 - 0.016), h / 2, sz * (d / 2 - 0.016)));
      }
    }
    group.add(box(w + 0.02, topH, d + 0.02, frame, 0, h - topH / 2, 0));
    const glow = glowMat(item.lightColor || "#fff4e0", item.lightOn !== false);
    for (let i = -1; i <= 1; i++) {
      const can = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.028, 14), frame));
      can.position.set(i * 0.2, h - topH - 0.02, 0);
      group.add(can);
      group.add(box(0.055, 0.008, 0.055, glow, i * 0.2, h - topH - 0.038, 0, false));
    }
    addLampLight(group, item, h - 0.22, "point");
    addDisplayMannequin(group, {
      y: baseH,
      color: item.color || "#f7f2ec",
      accent: item.accent || "#1a2a4a",
      x: item.x,
      z: item.z,
      id: item.id,
    });
  } else if (type === "glowRunway") {
    const wood = woodMat(item.color || "#e8dcc8", { roughness: 0.38, repeat: 2.4, env: 1.05 });
    const neon = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#ffffff",
      emissiveIntensity: item.lightOn === false ? 0.1 : 3.2,
      roughness: 0.08,
      metalness: 0.04,
    });
    const lowH = 0.08;
    const topH = 0.06;
    const lowR = Math.min(w, d) * 0.5;
    const topR = lowR * 0.78;
    const low = shadow(new THREE.Mesh(new THREE.CylinderGeometry(lowR, lowR * 1.05, lowH, 40), wood));
    low.position.y = lowH / 2;
    group.add(low);
    const top = shadow(new THREE.Mesh(new THREE.CylinderGeometry(topR, topR, topH, 40), wood));
    top.position.y = lowH + topH / 2;
    group.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(topR, 0.008, 10, 48), neon);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = lowH + topH + 0.002;
    group.add(rim);
    addLampLight(group, { ...item, lightColor: item.lightColor || "#ffffff", lightPower: item.lightPower ?? 22 }, lowH + topH + 1.2, "point");
    if (!addManModel(group, item, { kind: "man", height: 1.58, y: lowH + topH })) {
      addRunwayMannequin(group, { y: lowH + topH });
    }
    const heels = makeShoePair("#c4a574", 0.3, lowH + topH + 0.02, 0.18, 0.35, { scale: 0.92 });
    heels.scale.setScalar(0.95);
    group.add(heels);
  } else if (type === "mannequin") {
    const standH = addBoutiqueStand(group);
    if (addManModel(group, item, { kind: "man", height: 1.74, y: standH })) {
      /* boutique display model */
    } else {
    const skin = ceramicMat(item.color || "#f3ece4");
    const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8), brass));
    pole.position.y = 0.38;
    group.add(pole);
    const hips = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin));
    hips.scale.set(1, 0.85, 0.7);
    hips.position.y = 0.88;
    group.add(hips);
    const dress = fabricMat(item.accent);
    const look = new THREE.Group();
    const bodice = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.128, 0.34, 14), dress));
    bodice.position.set(0, 1.28, 0.01);
    look.add(bodice);
    look.add(box(0.2, 0.08, 0.1, dress, 0, 1.44, 0.02));
    const skirt = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.56, 16), dress));
    skirt.position.y = 0.9;
    look.add(skirt);
    look.add(box(0.09, 0.28, 0.06, dress, -0.14, 1.24, 0.01));
    look.add(box(0.09, 0.28, 0.06, dress, 0.14, 1.24, 0.01));
    look.add(box(0.2, 0.016, 0.13, brass, 0, 1.1, 0.04));
    const lookIdx = ["#4a1d4e", "#8b1e3f", "#1e3a5f", "#1c1916"].indexOf(item.accent);
    tagProduct(look, "dresses", Math.max(0, lookIdx), { color: item.accent, x: item.x, z: item.z });
    group.add(look);
    const jewel = new THREE.Mesh(BALL, brass);
    jewel.scale.set(0.018, 0.018, 0.018);
    jewel.position.set(0, 1.5, 0.04);
    group.add(jewel);
    const torso = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.42, 12), skin));
    torso.position.y = 1.26;
    group.add(torso);
    const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.08, 8), skin));
    neck.position.y = 1.5;
    group.add(neck);
    const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), skin));
    head.scale.set(0.92, 1.05, 0.9);
    head.position.y = 1.6;
    group.add(head);
    for (const side of [-1, 1]) {
      const arm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.42, 8), skin));
      arm.position.set(side * 0.16, 1.22, 0);
      arm.rotation.z = side * 0.18;
      group.add(arm);
    }
    }
  } else if (type === "fittingRoom") {
    const open = !!item.open;
    group.add(box(w, h, 0.04, main, 0, h / 2, -d / 2 + 0.02));
    group.add(box(0.04, h, d, main, -w / 2 + 0.02, h / 2, 0));
    group.add(box(0.04, h, d, main, w / 2 - 0.02, h / 2, 0));
    group.add(box(w, 0.05, d, main, 0, h, 0));
    group.add(box(0.05, h, 0.05, brass, -w / 2 + 0.04, h / 2, d / 2 - 0.02));
    group.add(box(0.05, h, 0.05, brass, w / 2 - 0.04, h / 2, d / 2 - 0.02));
    const gold = polishedGold(item.accent || "#c6a56a");
    const mw = Math.max(0.72, w - 0.42);
    const mh = Math.max(1.55, h - 0.55);
    const mz = -d / 2 + 0.055;
    const my = mh / 2 + 0.12;
    group.add(box(mw + 0.08, mh + 0.08, 0.03, gold, 0, my, mz - 0.012));
    group.add(box(mw + 0.04, 0.018, 0.02, gold, 0, my + mh / 2 + 0.02, mz + 0.006));
    group.add(box(mw + 0.04, 0.018, 0.02, gold, 0, my - mh / 2 - 0.02, mz + 0.006));
    const glass = makeLiveGlass(new THREE.PlaneGeometry(mw, mh));
    glass.position.set(0, my, mz + 0.012);
    group.add(glass);
    const curtain = fabricMat(item.accent);
    const rod = shadow(new THREE.Mesh(TUBE, brass));
    rod.scale.set(0.012, w - 0.08, 0.012);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, h - 0.08, d / 2 - 0.02);
    group.add(rod);
    const slide = open ? w * 0.34 : 0;
    const leftW = open ? w * 0.22 : w * 0.42;
    const rightW = open ? w * 0.2 : w * 0.28;
    group.add(box(leftW, h * 0.88, 0.03, curtain, -w * 0.18 - slide, h * 0.48, d / 2 - 0.03));
    group.add(box(rightW, h * 0.88, 0.03, curtain, w * 0.22 + slide, h * 0.48, d / 2 - 0.03));
    addBrandPlate(group, 0, h - 0.16, -d / 2 + 0.03, Math.PI);
  } else if (type === "shoeWall") {
    group.add(box(w, h, 0.05, main, 0, h / 2, -d / 2 + 0.03));
    group.add(box(w, 0.05, d, brass, 0, 0.03, 0));
    group.add(box(w, 0.03, d, brass, 0, h - 0.02, 0));
    for (let i = 1; i <= 5; i++) {
      const y = 0.22 + i * 0.34;
      group.add(box(w - 0.08, 0.028, d - 0.04, main, 0, y, 0.01));
    }
  } else if (type === "shoeIsland") {
    group.add(box(w, h - 0.06, d, main, 0, (h - 0.06) / 2, 0));
    group.add(box(w + 0.05, 0.028, d + 0.05, brass, 0, h, 0));
    group.add(box(w - 0.02, 0.024, d - 0.02, top, 0, h + 0.02, 0));
    addBrandPlate(group, 0, 0.28, d / 2 + 0.01);
  } else if (type === "mirror") {
    addStandingMirror(group, w, h, item.accent || "#c6a56a");
  } else if (type === "sofa") {
    if (!addSofaModel(group, item)) {
      const hide = leatherMat(item.color || "#3a2e28");
      group.add(box(w, 0.16, d, hide, 0, 0.3, 0));
      group.add(box(w, 0.46, 0.16, hide, 0, 0.58, -d / 2 + 0.1));
      group.add(box(0.14, 0.36, d - 0.1, hide, -w / 2 + 0.1, 0.46, 0.02));
      group.add(box(0.14, 0.36, d - 0.1, hide, w / 2 - 0.1, 0.46, 0.02));
      group.add(box(w - 0.34, 0.08, d - 0.22, leatherMat("#2a221c"), 0, 0.4, 0.04));
      group.add(post(0.03, 0.16, brass, -w / 2 + 0.12, 0.08, d / 2 - 0.1, true));
      group.add(post(0.03, 0.16, brass, w / 2 - 0.12, 0.08, d / 2 - 0.1, true));
      group.add(post(0.03, 0.16, brass, -w / 2 + 0.12, 0.08, -d / 2 + 0.1, true));
      group.add(post(0.03, 0.16, brass, w / 2 - 0.12, 0.08, -d / 2 + 0.1, true));
    }
  } else if (type === "logo") {
    const letter = item.logoLetter || "A";
    const style = item.logoStyle || "circle";
    const mount = item.logoMount || "stand";
    const lift = item.lift ?? 1.5;
    const img = item._map && item._map.image ? item._map.image : null;
    const tex = makeLogoTexture({
      letter,
      style,
      fg: item.accent,
      bg: item.color,
      word: item.logoWord || "",
      image: img,
    });
    const face = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.16,
      metalness: 0.22,
      side: THREE.DoubleSide,
    });
    const plaqueW = w;
    const plaqueH = mount === "wall" ? Math.max(0.35, h * 0.55) : Math.max(0.42, w * 0.95);
    const plate = box(plaqueW + 0.04, plaqueH + 0.04, Math.max(0.04, d), brass, 0, 0, 0);
    const mark = new THREE.Mesh(PLANE, face);
    mark.scale.set(plaqueW, plaqueH, 1);
    mark.position.z = Math.max(0.04, d) / 2 + 0.004;
    const badge = new THREE.Group();
    badge.add(plate, mark);
    if (mount === "wall") {
      badge.position.y = lift;
      group.add(badge);
    } else {
      const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.26, 0.05, 24), brass));
      base.position.y = 0.025;
      group.add(base);
      const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, h - 0.12, 12), brass));
      pole.position.y = (h - 0.12) / 2;
      group.add(pole);
      badge.position.y = h - plaqueH * 0.15;
      group.add(badge);
    }
  } else if (type === "securityGate") {
    const dark = new THREE.MeshStandardMaterial({ color: item.color || "#11141a", metalness: 0.55, roughness: 0.32 });
    const lens = new THREE.MeshStandardMaterial({
      color: "#ffb4a8",
      emissive: "#ff6a4a",
      emissiveIntensity: 0.42,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const x = side * (w / 2);
      group.add(box(0.12, 0.06, 0.22, brass, x, 0.03, 0));
      group.add(box(0.08, h - 0.08, 0.1, dark, x, (h - 0.02) / 2, 0));
      group.add(box(0.1, 0.04, 0.12, brass, x, h - 0.02, 0));
      group.add(box(0.02, h * 0.55, 0.06, lens, x + side * 0.05, h * 0.48, 0, false));
    }
  } else if (type === "logoMat") {
    const mat = new THREE.Mesh(PLANE, new THREE.MeshStandardMaterial({
      map: watchMatTex(item.posterText || item.logoWord || "CHRONOS", item.accent, item.color),
      roughness: 0.62,
      metalness: 0.08,
    }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.003;
    mat.scale.set(w, d, 1);
    mat.receiveShadow = true;
    group.add(mat);
  } else if (type === "hoursPlaque") {
    const lift = item.lift ?? 1.55;
    group.add(box(w + 0.04, h + 0.04, Math.max(0.03, d), brass, 0, lift, 0));
    const face = new THREE.Mesh(PLANE, new THREE.MeshStandardMaterial({
      map: hoursPlaqueTex(item.accent, item.color),
      roughness: 0.28,
      metalness: 0.12,
    }));
    face.scale.set(w, h, 1);
    face.position.set(0, lift, Math.max(0.03, d) / 2 + 0.004);
    group.add(face);
  } else if (type === "windowVinyl") {
    const lift = item.lift ?? 1.7;
    const face = new THREE.Mesh(PLANE, new THREE.MeshStandardMaterial({
      map: vinylTex(item.posterText || item.logoWord || "CHRONOS", item.accent),
      transparent: true,
      roughness: 0.42,
      metalness: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    face.scale.set(w, h, 1);
    face.position.y = lift;
    group.add(face);
  } else if (type === "hangingCard") {
    const lift = item.lift ?? 3.15;
    group.add(box(0.012, 0.28, 0.012, brass, 0, lift + h / 2 + 0.18, 0, false));
    group.add(box(w + 0.03, h + 0.03, Math.max(0.03, d), brass, 0, lift, 0));
    const card = new THREE.Mesh(PLANE, new THREE.MeshStandardMaterial({
      map: hangingCardTex(item.posterText || "SWISS MADE", item.accent, item.color),
      roughness: 0.3,
      metalness: 0.08,
    }));
    card.scale.set(w, h, 1);
    card.position.set(0, lift, Math.max(0.03, d) / 2 + 0.004);
    group.add(card);
  } else if (type === "ledBanner" || type === "ledDesk") {
    addDigitalBanner(group, item, brass);
  } else if (type === "splitAc") {
    addSplitAc(group, item, w, h, d);
  } else if (type === "poster") {
    const tex = posterTexture(item.posterText || "NEW IN", item.accent, item.color);
    group.add(box(w + 0.05, h + 0.05, 0.05, brass, 0, h / 2, 0));
    const board = box(w, h, 0.03, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.04 }), 0, h / 2, 0.012);
    group.add(board);
    group.add(post(0.02, 0.08, brass, -w / 2 + 0.08, 0.04, 0));
    group.add(post(0.02, 0.08, brass, w / 2 - 0.08, 0.04, 0));
  } else {
    group.add(box(w, h, d, main, 0, h / 2, 0));
  }

  fillStock(group, item);
  placeExtras(group, item);

  group.userData = {
    selectable: true,
    kind: "furniture",
    id: item.id,
    type: item.type,
  };
  group.position.set(item.x, 0, item.z);
  group.rotation.y = item.rotY || 0;
  return group;
}

export function newFurniture(type, x = 0, z = 0, extra = {}) {
  const d = DEFAULTS[type] || DEFAULTS.desk;
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2, 10)}`,
    type,
    x,
    z,
    rotY: 0,
    width: d.width,
    depth: d.depth,
    height: d.height,
    color: d.color,
    accent: d.accent,
    image: null,
    stock: d.stock || "none",
    posterText: "",
    logoLetter: "A",
    logoStyle: "circle",
    logoWord: "",
    logoMount: "stand",
    logoSnap: "",
    lift: 1.5,
    bannerShape: "portrait",
    lightOn: true,
    lightPower: 48,
    lightColor: "#ffe6b8",
    extras: [],
    hiddenSlots: [],
    ...extra,
  };
}
