import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GALAXY_STORE, GALAXY_FURNITURE, GALAXY_PRODUCTS } from "./galaxyData.js?v=large1";

let store = GALAXY_STORE;
let furniture = GALAXY_FURNITURE;
let products = GALAXY_PRODUCTS;

export function setGalaxySource(pack) {
  store = pack?.store || GALAXY_STORE;
  furniture = pack?.furniture || GALAXY_FURNITURE;
  products = pack?.products || GALAXY_PRODUCTS;
}

const PANEL = 0.16;
const loader = new GLTFLoader();
const fontLoader = new FontLoader();

let galaxyRoot = null;
let buildGen = 0;
let phoneTemplates = null;
let phoneLoad = null;
let fontLoad = null;
let ping = () => {};

export function onGalaxyChange(fn) {
  ping = fn;
}

export function galaxyAnimating() {
  return Boolean(galaxyRoot && galaxyRoot.parent);
}

export function updateGalaxy(dt) {
  const root = galaxyRoot;
  if (!root || !root.parent) return;
  const spins = root.userData.spinners || [];
  for (const item of spins) item.object.rotation[item.axis] += item.speed * dt;
  root.userData.mixer?.update(dt);
}

function canvasTex(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeWoodMaps() {
  const size = 1024;
  const panels = 8;
  const pw = size / panels;
  const color = canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = "#c4a06a";
    ctx.fillRect(0, 0, w, h);
    for (let p = 0; p < panels; p++) {
      const x0 = p * pw;
      const tone = 188 + hash(p + 2) * 22;
      const g = 150 + hash(p + 9) * 18;
      const b = 88 + hash(p + 14) * 16;
      ctx.fillStyle = `rgb(${tone | 0},${g | 0},${b | 0})`;
      ctx.fillRect(x0, 0, pw, h);
      const grd = ctx.createLinearGradient(x0, 0, x0 + pw, 0);
      grd.addColorStop(0, "rgba(70,42,16,0.18)");
      grd.addColorStop(0.07, "rgba(255,230,190,0.08)");
      grd.addColorStop(0.5, "rgba(255,255,255,0)");
      grd.addColorStop(0.94, "rgba(80,50,20,0.06)");
      grd.addColorStop(1, "rgba(50,28,10,0.22)");
      ctx.fillStyle = grd;
      ctx.fillRect(x0, 0, pw, h);
      for (let i = 0; i < 70; i++) {
        const gx = x0 + 6 + hash(p * 80 + i) * (pw - 12);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${90 + hash(i) * 40},${55 + hash(i + 3) * 25},${20},${0.05 + hash(i + 7) * 0.1})`;
        ctx.lineWidth = 1 + hash(i + 11) * 2.2;
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(gx + 4, h * 0.3, gx - 5, h * 0.65, gx + 2, h);
        ctx.stroke();
      }
    }
  });
  const bump = canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let p = 0; p < panels; p++) {
      const x0 = p * pw;
      ctx.fillStyle = "#4a4a4a";
      ctx.fillRect(x0, 0, 3, h);
      ctx.fillStyle = "#c8c8c8";
      ctx.fillRect(x0 + 3, 0, 4, h);
    }
  });
  const roughness = canvasTex(size, size, (ctx, w, h) => {
    ctx.fillStyle = "#6e6e6e";
    ctx.fillRect(0, 0, w, h);
    for (let p = 0; p < panels; p++) {
      const x0 = p * pw;
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(x0, 0, 5, h);
      ctx.fillStyle = "#5a5a5a";
      ctx.fillRect(x0 + 10, 0, pw - 16, h);
    }
  });
  for (const tex of [color, bump, roughness]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
  }
  return { map: color, bump, roughness };
}

function cloneWood(maps, repeatX, repeatY = 1) {
  const wrap = (tex) => {
    const c = tex.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(repeatX, repeatY);
    c.needsUpdate = true;
    return c;
  };
  return { map: wrap(maps.map), bump: wrap(maps.bump), roughness: wrap(maps.roughness) };
}

function laminate(maps) {
  return new THREE.MeshPhysicalMaterial({
    color: "#8d6a4b",
    map: maps.map,
    bumpMap: maps.bump,
    bumpScale: 0.035,
    roughnessMap: maps.roughness,
    roughness: 0.34,
    metalness: 0.035,
    clearcoat: 0.38,
    clearcoatRoughness: 0.24,
  });
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.04, ...extra });
}

function phys(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.2, ...extra });
}

function led(intensity = 4) {
  return new THREE.MeshStandardMaterial({
    color: "#fff1bd",
    emissive: "#ffd87a",
    emissiveIntensity: intensity,
    toneMapped: false,
  });
}

function shelfGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: "#e9f9ff",
    transparent: true,
    opacity: 0.34,
    transmission: 0.78,
    thickness: 0.025,
    roughness: 0.035,
    metalness: 0.04,
    clearcoat: 0.75,
    clearcoatRoughness: 0.06,
    depthWrite: false,
  });
}

function box(parent, w, h, d, material, x, y, z, rot) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function rbox(parent, w, h, d, radius, smooth, material, x, y, z, rot) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, smooth, radius), material);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(parent, rt, rb, height, seg, material, x, y, z, rot) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, height, seg), material);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function light(parent, x, y, z, color, intensity, distance) {
  const p = new THREE.PointLight(color, intensity, distance, 2);
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

function markLive(obj) {
  obj.traverse((o) => {
    o.userData.liveWalk = true;
  });
}

function spin(root, object, speed, axis = "y") {
  markLive(object);
  root.userData.spinners.push({ object, speed, axis });
}

function shareTemplate(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.userData.shared = true;
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      m.userData.shared = true;
      for (const key of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap"]) {
        if (m[key]) m[key].userData.shared = true;
      }
    }
  });
}

function makeFloorTexture() {
  const tex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#d5d5d5";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(18, 18, w - 80, 14);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 16);
  return tex;
}

function makeBoxTexture(item) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = item.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = item.color === "#f5f5f5" || item.color === "#eeeeee" ? "#e8e8e8" : "#ffffff";
    ctx.fillRect(0, 0, w, 118);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 118, w, 6);
    ctx.fillStyle = item.textColor || "#ffffff";
    ctx.font = "bold 36px Arial, sans-serif";
    ctx.fillText(item.brand, 28, 190);
    ctx.font = "bold 92px Arial, sans-serif";
    ctx.fillText(item.label, 28, 300);
    ctx.font = "28px Arial, sans-serif";
    ctx.globalAlpha = 0.8;
    ctx.fillText("LOGIN  |  Mobile Galaxy", 28, 360);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(w - 70, 70, 28, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeHangTexture(item) {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e2e2e2";
    ctx.fillRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = item.color;
    ctx.fillRect(40, 90, w - 80, 230);
    ctx.fillStyle = "#222";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText(item.brand, w / 2, 360);
    ctx.font = "22px Arial";
    ctx.fillText(item.label, w / 2, 396);
  });
}

function makeSignTexture(text) {
  return canvasTex(768, 220, (ctx, w, h) => {
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "bold 86px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(text, w / 2, h / 2);
  });
}

function makeWalkingTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px Arial";
    ctx.textAlign = "center";
    ctx.fillText("X", w / 2, 130);
    ctx.font = "bold 28px Arial";
    ctx.fillText("WalkingPad X", w / 2, 200);
  });
}

function buildRoom(root, wood) {
  const { width, depth, height, ceilingRed, ceilingWhite, ceilingTile } = store.room;
  const tilesX = Math.round(width / ceilingTile);
  const tilesZ = Math.round(depth / ceilingTile);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width + 2.5, depth + 3), std("#ffffff", { map: makeFloorTexture(), roughness: 0.65 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const backMaps = cloneWood(wood, width / PANEL / 8, 1);
  const sideMaps = cloneWood(wood, depth / PANEL / 8, 1);
  const thick = 0.08;
  box(root, width + thick, height, thick, laminate(backMaps), 0, height / 2, -depth / 2);
  const left = box(root, depth + thick, height, thick, laminate(sideMaps), -width / 2, height / 2, 0);
  left.rotation.y = Math.PI / 2;
  const right = box(root, depth + thick, height, thick, laminate(cloneWood(wood, depth / PANEL / 8, 1)), width / 2, height / 2, 0);
  right.rotation.y = -Math.PI / 2;

  const skirting = std("#8d6a3e", { roughness: 0.55 });
  box(root, width, 0.08, 0.03, skirting, 0, 0.04, -depth / 2 + 0.05);
  box(root, 0.03, 0.08, depth, skirting, -width / 2 + 0.05, 0.04, 0);
  box(root, 0.03, 0.08, depth, skirting, width / 2 - 0.05, 0.04, 0);
  const crown = std("#b08955", { roughness: 0.5 });
  box(root, width, 0.05, 0.04, crown, 0, height - 0.03, -depth / 2 + 0.05);
  box(root, 0.04, 0.05, depth, crown, -width / 2 + 0.05, height - 0.03, 0);
  box(root, 0.04, 0.05, depth, crown, width / 2 - 0.05, height - 0.03, 0);

  const redMat = std(ceilingRed, { roughness: 0.8 });
  const whiteMat = std(ceilingWhite, { roughness: 0.8 });
  for (let ix = 0; ix < tilesX; ix++) {
    for (let iz = 0; iz < tilesZ; iz++) {
      box(
        root,
        ceilingTile - 0.015,
        0.04,
        ceilingTile - 0.015,
        (ix + iz) % 2 === 0 ? redMat : whiteMat,
        -width / 2 + (ix + 0.5) * ceilingTile,
        height,
        -depth / 2 + (iz + 0.5) * ceilingTile,
      );
      if ((ix + iz) % 3 === 0) {
        const lx = -width / 2 + (ix + 0.5) * ceilingTile;
        const lz = -depth / 2 + (iz + 0.5) * ceilingTile;
        const ly = height - 0.03;
        cyl(root, 0.06, 0.06, 0.03, 16, std("#eee"), lx, ly, lz);
        cyl(root, 0.045, 0.045, 0.02, 16, std("#fff8e7", { emissive: "#fff2c8", emissiveIntensity: 2.2 }), lx, ly - 0.01, lz);
      }
    }
  }

  const tube = (x) => {
    box(root, 0.06, 0.04, 1.5, std("#ececec"), x, height - 0.08, 2.55);
    box(root, 0.04, 0.02, 1.4, std("#fff", { emissive: "#fff6d0", emissiveIntensity: 2 }), x, height - 0.1, 2.55);
  };
  tube(-1.4);
  tube(1.4);
  addCassette(root, furniture.ac.position);
  addWallFan(root, furniture.wallFan.position, -Math.PI / 2);
}

function addCassette(root, position) {
  const [x, y, z] = position;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  rbox(g, 0.78, 0.075, 0.78, 0.022, 4, phys("#f4f1e9", { roughness: 0.23, metalness: 0.04, clearcoat: 0.52, clearcoatRoughness: 0.18 }), 0, 0, 0);
  rbox(g, 0.71, 0.025, 0.71, 0.009, 4, phys("#ece9e1", { roughness: 0.27, metalness: 0.06, clearcoat: 0.4 }), 0, -0.048, 0);
  rbox(g, 0.455, 0.012, 0.455, 0.004, 3, std("#62676a", { metalness: 0.35, roughness: 0.58 }), 0, -0.068, 0);
  box(g, 0.4, 0.008, 0.4, std("#1c2224", { metalness: 0.18, roughness: 0.74 }), 0, -0.075, 0);
  const fan = new THREE.Group();
  fan.position.y = -0.08;
  const bladeMat = phys("#353b3e", { metalness: 0.46, roughness: 0.35, clearcoat: 0.22 });
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    rbox(fan, 0.14, 0.009, 0.046, 0.003, 2, bladeMat, Math.cos(angle) * 0.095, 0, Math.sin(angle) * 0.095, [0, -angle + 0.42, 0]);
  }
  cyl(fan, 0.038, 0.038, 0.018, 24, phys("#8c9294", { metalness: 0.78, roughness: 0.2, clearcoat: 0.45 }), 0, 0, 0);
  g.add(fan);
  spin(root, fan, 3.8);
  const grille = std("#dadcda", { metalness: 0.22, roughness: 0.42 });
  for (let i = 0; i < 13; i++) {
    const offset = (i - 6) * 0.03;
    box(g, 0.006, 0.006, 0.39, grille, offset, -0.087, 0);
    box(g, 0.39, 0.006, 0.006, grille, 0, -0.088, offset);
  }
  root.add(g);
}

function addWallFan(root, position, rotation) {
  const [x, y, z] = position;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotation;
  cyl(g, 0.025, 0.025, 0.18, 8, std("#212121"), 0, 0, 0, [0, 0, Math.PI / 2]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 20), std("#111"));
  ring.position.z = 0.08;
  g.add(ring);
  root.add(g);
}

function addStorefront(root, wood) {
  const sf = furniture.storefront;
  const banner = furniture.banner;
  const [x, , z] = sf.position;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const half = sf.width / 2;
  const columnX = half - sf.columnWidth / 2 - 0.09;
  const metal = std("#111111", { metalness: 0.72, roughness: 0.22 });
  box(g, 0.16, sf.height, sf.frameDepth, metal, -half, sf.height / 2, 0);
  box(g, 0.16, sf.height, sf.frameDepth, metal, half, sf.height / 2, 0);
  box(g, sf.width + 0.16, 0.16, sf.frameDepth, metal, 0, sf.height - 0.07, 0);
  const columnMaps = cloneWood(wood, 0.28, 1);
  const columnMat = laminate(columnMaps);
  for (const side of [-1, 1]) {
    box(g, sf.columnWidth, sf.height - 0.2, sf.frameDepth - 0.025, columnMat, side * columnX, (sf.height - 0.2) / 2, 0.015);
    box(g, 0.026, 2.22, 0.025, led(5), side * (columnX - 0.13), 1.2, 0.12);
    light(g, side * (columnX - 0.18), 1.55, -0.1, "#ffd78a", 3.5, 2.1);
  }
  box(g, sf.width - 0.22, 0.07, 0.3, std("#171717", { metalness: 0.7, roughness: 0.22 }), 0, 0.035, 0.06);
  root.add(g);

  const [bx, by, bz] = banner.position;
  box(root, banner.width + 0.12, banner.height + 0.1, 0.13, phys("#15181b", { metalness: 0.78, roughness: 0.2, clearcoat: 0.52 }), bx, by, bz - 0.035);
  box(root, banner.width, banner.height, 0.075, phys("#f5f2eb", { emissive: "#fffaf0", emissiveIntensity: 0.025, metalness: 0.08, roughness: 0.21, clearcoat: 0.72, clearcoatRoughness: 0.14 }), bx, by, bz);
  const trims = [
    [bx, by + banner.height / 2 + 0.055, bz + 0.055, banner.width + 0.24, 0.12, 0.09, "#171a1d"],
    [bx, by - banner.height / 2 - 0.055, bz + 0.055, banner.width + 0.24, 0.12, 0.09, "#171a1d"],
    [bx - banner.width / 2 - 0.06, by, bz + 0.055, 0.16, banner.height + 0.06, 0.08, "#c8b28d"],
    [bx + banner.width / 2 + 0.06, by, bz + 0.055, 0.16, banner.height + 0.06, 0.08, "#c8b28d"],
  ];
  for (const t of trims) box(root, t[3], t[4], t[5], phys(t[6], { metalness: 0.78, roughness: 0.17, clearcoat: 0.64 }), t[0], t[1], t[2]);
  for (const side of [-1, 1]) {
    box(root, 0.025, banner.height - 0.14, 0.018, led(5), bx + side * (banner.width / 2 - 0.105), by, bz + 0.102);
    light(root, bx + side * (banner.width / 2 - 0.16), by, bz + 0.24, "#ffd69a", 1.2, 1.05);
  }
  root.userData.signAnchors = [
    { text: "MOBILE GALAXY F-69", size: 0.29, depth: 0.02, x: bx, y: by + 0.055, z: bz + 0.055, color: "#c52222", emissive: "#b81414" },
    { text: "LOGIN SMART TECHNOLOGY  •  SHOP F-69", size: 0.072, depth: 0.012, x: bx, y: by - 0.22, z: bz + 0.052, color: "#393b3d", emissive: "#000000" },
  ];
  for (const spotX of [-2, -1.2, -0.4, 0.4, 1.2, 2]) {
    cyl(root, 0.028, 0.034, 0.018, 16, phys("#f0eee8", { metalness: 0.46, roughness: 0.16, clearcoat: 0.75 }), bx + spotX, by + banner.height / 2 - 0.06, bz + 0.074, [Math.PI / 2, 0, 0]);
  }
  for (const haloX of [-1.65, -0.83, 0, 0.83, 1.65]) light(root, bx + haloX, by + 0.07, bz + 0.13, "#ffd39d", 0.34, 0.43);
  for (const lightX of [-1.55, 0, 1.55]) light(root, bx + lightX, by + 0.02, bz + 0.28, "#fff0d8", 0.72, 1.35);
  const fasciaBottom = by - banner.height / 2;
  box(root, banner.width - 0.12, 0.026, 0.025, std("#fffdf4", { emissive: "#fff0d1", emissiveIntensity: 4.4, toneMapped: false }), bx, fasciaBottom - 0.055, bz + 0.07);
  light(root, 0, fasciaBottom - 0.15, bz - 0.35, "#ffe0a0", 3, 3.5);
}

function addGate(root) {
  const gate = furniture.mainGate;
  const [x, y, z] = gate.position;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const panelWidth = gate.width / 2;
  const frame = 0.055;
  const glass = phys("#e6f8ff", {
    transparent: true,
    opacity: gate.glassOpacity,
    roughness: 0.018,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.018,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const steel = std("#c7ccce", { metalness: 0.88, roughness: 0.14 });
  const handleMat = std("#aeb4b6", { metalness: 0.92, roughness: 0.12 });
  box(g, panelWidth - 0.065, gate.height - 0.1, 0.018, glass, -panelWidth / 2, 0, 0);
  rbox(g, frame, gate.height, gate.depth, 0.018, 3, steel, -gate.width / 2, 0, 0);
  rbox(g, frame, gate.height, gate.depth, 0.018, 3, steel, gate.width / 2, 0, 0);
  rbox(g, 0.012, gate.height - 0.11, 0.012, 0.005, 2, led(5), -gate.width / 2 + 0.038, 0, gate.depth / 2 + 0.012);
  light(g, -gate.width / 2 + 0.15, 0, -0.15, "#ffd990", 3, 2);
  rbox(g, 0.026, 0.45, 0.03, 0.012, 3, handleMat, -0.105, -0.02, gate.depth / 2 + 0.04);

  const hinge = new THREE.Group();
  hinge.position.set(gate.width / 2 - 0.02, 0, 0.02);
  hinge.rotation.y = Math.PI / 2;
  const leaf = panelWidth - 0.1;
  box(hinge, leaf, gate.height - 0.12, 0.018, glass, -leaf / 2, 0, 0);
  rbox(hinge, 0.04, gate.height - 0.08, 0.06, 0.012, 2, steel, -leaf + 0.02, 0, 0);
  rbox(hinge, 0.012, gate.height - 0.16, 0.012, 0.005, 2, led(5), -0.04, 0, 0.02);
  rbox(hinge, 0.026, 0.45, 0.03, 0.012, 3, handleMat, -leaf + 0.08, -0.02, 0.04);
  g.add(hinge);
  rbox(g, gate.width, frame, gate.depth, 0.018, 3, steel, 0, gate.height / 2, 0);
  rbox(g, gate.width, frame, gate.depth, 0.018, 3, steel, 0, -gate.height / 2, 0);
  rbox(g, 0.042, gate.height - 0.055, gate.depth - 0.01, 0.012, 2, std("#bfc5c7", { metalness: 0.9, roughness: 0.13 }), 0, 0, 0);
  rbox(g, gate.width - 0.11, 0.012, 0.012, 0.005, 2, led(5), 0, gate.height / 2 - 0.038, gate.depth / 2 + 0.012);
  rbox(g, gate.width - 0.11, 0.012, 0.012, 0.005, 2, led(5), 0, -(gate.height / 2 - 0.038), gate.depth / 2 + 0.012);
  box(g, gate.width + 0.06, 0.035, 0.12, std("#9ca2a4", { metalness: 0.85, roughness: 0.16 }), 0, -gate.height / 2 - 0.018, 0);
  root.add(g);
}

function addBackCabinet(root, wood) {
  const cab = furniture.backCabinet;
  const [x, y, z] = cab.position;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const maps = cloneWood(wood, cab.width / PANEL / 8, 1);
  box(g, cab.width, cab.height, cab.depth, laminate(maps), 0, cab.height / 2, -0.02);
  const frame = std("#6f4828", { roughness: 0.38 });
  box(g, 0.07, cab.height, cab.depth + 0.025, frame, -(cab.width / 2 - 0.035), cab.height / 2, 0.035);
  box(g, 0.07, cab.height, cab.depth + 0.025, frame, cab.width / 2 - 0.035, cab.height / 2, 0.035);
  box(g, cab.width, 0.09, cab.depth + 0.025, frame, 0, 0.045, 0.035);
  box(g, cab.width, 0.09, cab.depth + 0.025, frame, 0, cab.height - 0.045, 0.035);
  const shelfMat = std("#754824", { roughness: 0.36 });
  const lip = std("#714726", { roughness: 0.34 });
  const glass = shelfGlass();
  const shelves = [];
  for (let i = 0; i < cab.shelfCount; i++) {
    const sy = 0.22 + (i * (cab.height - 0.28)) / (cab.shelfCount - 1);
    shelves.push(sy);
    box(g, cab.width - 0.1, 0.04, cab.depth - 0.015, shelfMat, 0, sy, 0.025);
    box(g, cab.width - 0.14, 0.012, cab.depth - 0.045, glass, 0, sy + 0.027, 0.034);
    box(g, cab.width - 0.08, 0.052, 0.038, lip, 0, sy, cab.depth / 2 + 0.014);
    if (i > 0) box(g, cab.width - 0.18, 0.014, 0.014, led(3.2), 0, sy - 0.037, cab.depth / 2 + 0.036);
  }
  const divider = std("#714726", { roughness: 0.37 });
  for (let i = 0; i < cab.columns - 1; i++) {
    const dx = ((i + 1) / cab.columns - 0.5) * cab.width;
    box(g, 0.048, cab.height - 0.09, cab.depth + 0.012, divider, dx, cab.height / 2, 0.035);
  }
  for (let i = 0; i < cab.columns; i++) {
    const lx = -cab.width / 2 + ((i + 0.5) * cab.width) / cab.columns;
    light(g, lx, cab.height - 0.16, cab.depth / 2 + 0.22, "#ffd996", 2.4, 1.45);
  }
  root.add(g);
  return shelves;
}

function addGoldShelves(root) {
  const spec = furniture.goldShelves;
  const [x, y, z] = spec.position;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const glass = shelfGlass();
  for (const sy of spec.heights) {
    box(g, spec.width, 0.025, spec.depth, std("#d8b07a"), 0.12, sy, 0);
    box(g, spec.width - 0.025, 0.012, spec.depth - 0.02, glass, 0.12, sy + 0.021, 0);
    box(g, spec.width, 0.03, 0.01, std("#d4af37", { metalness: 0.7, roughness: 0.25 }), 0.12, sy, spec.depth / 2 + 0.004);
  }
  root.add(g);
}

function addSideCabinets(root, wood) {
  const config = furniture.sideCabinets;
  const maps = cloneWood(wood, config.length / PANEL / 8, 1);
  const body = laminate(maps);
  const shelfMat = std("#754824", { roughness: 0.36 });
  const endMat = std("#6f4828", { roughness: 0.42 });
  const glass = shelfGlass();
  const shelfGap = (config.height - 0.18) / config.shelfCount;
  for (const sideName of config.sides) {
    const side = sideName === "left" ? -1 : 1;
    const x = side * (store.room.width / 2 - config.depth / 2 - 0.045);
    const innerX = side * (store.room.width / 2 - config.depth - 0.055);
    box(root, config.depth, config.height, config.length, body, x, config.height / 2 + 0.08, config.centerZ);
    for (let i = 0; i <= config.shelfCount; i++) {
      box(root, config.depth + 0.06, 0.035, config.length - 0.08, shelfMat, innerX, 0.14 + i * shelfGap, config.centerZ);
      box(root, config.depth + 0.035, 0.012, config.length - 0.12, glass, innerX - side * 0.012, 0.165 + i * shelfGap, config.centerZ);
    }
    for (const end of [-1, 1]) {
      box(root, config.depth + 0.055, config.height, 0.055, endMat, innerX, config.height / 2 + 0.08, config.centerZ + end * (config.length / 2 - 0.03));
    }
    box(root, 0.026, 0.026, config.length - 0.12, led(4), innerX - side * 0.012, config.height + 0.105, config.centerZ);
  }
}

function placeRow(items, center, maxWidth) {
  const units = [];
  for (const row of items) {
    const item = products.catalog[row.sku];
    if (!item) continue;
    for (let i = 0; i < row.count; i++) units.push({ sku: row.sku, item });
  }
  if (!units.length) return [];
  const gap = 0.018;
  const total = units.reduce((s, u) => s + u.item.w, 0) + gap * (units.length - 1);
  const scale = total > maxWidth ? maxWidth / total : 1;
  let x = center[0] - (total * scale) / 2;
  return units.map((u) => {
    const w = u.item.w * scale;
    const pos = [x + w / 2, center[1] + (u.item.h * scale) / 2, center[2]];
    x += w + gap * scale;
    return { ...u, position: pos, scale };
  });
}

function addProduct(parent, item, position, map, scale = 1, rotation) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), std("#ffffff", { map, roughness: 0.45, metalness: 0.08 }));
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.setScalar(scale);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function addProducts(root, textures) {
  const cab = furniture.backCabinet;
  const ys = Array.from(
    { length: cab.shelfCount },
    (_, i) => cab.position[1] + 0.24 + (i * (cab.height - 0.3)) / (cab.shelfCount - 1),
  ).reverse();
  products.backRows.forEach((row, i) => {
    const y = ys[i] ?? ys[ys.length - 1];
    const placed = placeRow(row.items, [cab.position[0], y, cab.position[2] + cab.depth / 2 + 0.02], cab.width - 0.16);
    for (const b of placed) addProduct(root, b.item, b.position, textures.boxes[b.sku], b.scale);
  });
  furniture.goldShelves.heights.forEach((y) => {
    const placed = placeRow(
      [{ sku: products.goldShelfBoxes.sku, count: products.goldShelfBoxes.perShelf }],
      [furniture.goldShelves.position[0] + 0.12, y + 0.012, furniture.goldShelves.position[2]],
      furniture.goldShelves.width - 0.06,
    );
    for (const b of placed) addProduct(root, b.item, b.position, textures.boxes[b.sku], b.scale);
  });
  const config = furniture.sideCabinets;
  const shelfGap = (config.height - 0.18) / config.shelfCount;
  const skus = ["acc-white-tall", "acc-white", "case-purple"];
  for (const sideName of config.sides) {
    const side = sideName === "left" ? -1 : 1;
    for (let row = 0; row < config.shelfCount; row++) {
      for (let col = 0; col < config.productsPerShelf; col++) {
        const sku = skus[(row + col) % skus.length];
        const item = products.catalog[sku];
        const pz = config.centerZ - config.length / 2 + 0.14 + (col * (config.length - 0.28)) / (config.productsPerShelf - 1);
        const px = side * (store.room.width / 2 - config.depth - 0.065 - item.d / 2);
        const py = 0.16 + row * shelfGap + item.h / 2;
        addProduct(root, item, [px, py, pz], textures.boxes[sku], 1, [0, (-side * Math.PI) / 2, 0]);
      }
    }
  }
}

function addHanging(root, hangs) {
  const h = products.hanging;
  const panelWidth = (h.cols - 1) * h.colGap + 0.34;
  const panelHeight = (h.rows - 1) * h.rowGap + 0.4;
  const centerY = h.origin[1] + ((h.rows - 1) * h.rowGap) / 2;
  const centerZ = h.origin[2] + ((h.cols - 1) * h.colGap) / 2;
  const panelX = h.origin[0] - 0.028;
  box(root, 0.045, panelHeight, panelWidth, std("#34271d", { roughness: 0.62 }), panelX, centerY, centerZ);
  for (let row = 0; row < h.rows; row++) {
    box(root, 0.022, 0.018, panelWidth - 0.1, std("#84603d", { metalness: 0.18, roughness: 0.38 }), panelX + 0.027, h.origin[1] + row * h.rowGap, centerZ);
  }
  for (const side of [-1, 1]) {
    box(root, 0.07, panelHeight + 0.08, 0.065, std("#6f4828", { roughness: 0.36 }), panelX + 0.014, centerY, centerZ + side * (panelWidth / 2 - 0.025));
    box(root, 0.012, panelHeight - 0.08, 0.012, led(4.5), panelX + 0.055, centerY, centerZ + side * (panelWidth / 2 - 0.065));
    box(root, 0.07, 0.065, panelWidth + 0.08, std("#6f4828", { roughness: 0.36 }), panelX + 0.014, centerY + side * (panelHeight / 2), centerZ);
  }
  light(root, panelX + 0.48, centerY + 0.2, centerZ, "#ffe0a0", 2.2, 1.9);
  h.skus.forEach((sku, i) => {
    const item = products.catalog[sku];
    if (!item) return;
    const col = i % h.cols;
    const row = Math.floor(i / h.cols);
    const pos = [h.origin[0], h.origin[1] + (h.rows - 1 - row) * h.rowGap, h.origin[2] + col * h.colGap];
    const pack = new THREE.Group();
    pack.position.set(pos[0], pos[1], pos[2]);
    pack.rotation.y = Math.PI / 2;
    pack.scale.setScalar(1.08);
    cyl(pack, 0.008, 0.008, 0.04, 8, std("#9e9e9e", { metalness: 0.7, roughness: 0.25 }), 0, 0.12, 0.02);
    addProduct(pack, item, [0, 0, 0], hangs[sku], 1);
    root.add(pack);
  });
}

function addChair(root, position, rotation) {
  const g = new THREE.Group();
  g.position.set(position[0], position[1], position[2]);
  g.rotation.y = rotation;
  const leather = phys("#6b4334", { roughness: 0.62, metalness: 0.02, clearcoat: 0.12 });
  const deep = phys("#55362b", { roughness: 0.66, metalness: 0.02 });
  rbox(g, 0.48, 0.072, 0.46, 0.022, 3, leather, 0, 0.5, 0.015);
  cyl(g, 0.032, 0.032, 0.44, 16, leather, 0, 0.492, 0.22, [0, 0, Math.PI / 2]);
  rbox(g, 0.44, 0.58, 0.065, 0.018, 3, leather, 0, 0.9, -0.275, [-0.07, 0, 0]);
  rbox(g, 0.26, 0.09, 0.06, 0.02, 3, leather, 0, 1.2, -0.3, [-0.11, 0, 0]);
  for (const side of [-1, 1]) {
    box(g, 0.016, 0.14, 0.028, std("#8d9398", { metalness: 0.78, roughness: 0.24 }), side * 0.235, 0.55, -0.1);
    rbox(g, 0.05, 0.024, 0.28, 0.01, 2, deep, side * 0.235, 0.642, 0.03);
  }
  cyl(g, 0.02, 0.024, 0.12, 12, std("#d7dbde", { metalness: 0.9, roughness: 0.16 }), 0, 0.36, 0);
  cyl(g, 0.046, 0.06, 0.045, 16, std("#1c1e20", { metalness: 0.5, roughness: 0.36 }), 0, 0.2, 0);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Group();
    leg.rotation.y = (i / 5) * Math.PI * 2 + 0.25;
    box(leg, 0.26, 0.015, 0.038, std("#2e3236", { metalness: 0.72, roughness: 0.28 }), 0.15, 0.11, 0, [0, 0, -0.2]);
    cyl(leg, 0.028, 0.028, 0.016, 12, std("#121314", { roughness: 0.78 }), 0.29, 0.049, 0, [Math.PI / 2, 0, 0]);
    g.add(leg);
  }
  root.add(g);
}

function addDesk(root) {
  const d = furniture.desk;
  const g = new THREE.Group();
  g.position.set(d.position[0], d.position[1], d.position[2]);
  box(g, d.width, d.height - 0.08, d.depth, std("#f7f7f7", { roughness: 0.35 }), 0, d.height / 2 - 0.04, 0);
  box(g, d.width + 0.01, 0.06, d.depth + 0.01, std("#c62828"), 0, 0.12, 0);
  box(g, d.width + 0.06, 0.02, d.depth + 0.06, phys("#dff3ff", { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.15 }), 0, d.height - 0.015, 0);
  box(g, 0.28, 0.02, 0.2, std("#111"), 0, d.height + 0.02, 0.08);
  box(g, 0.12, 0.04, 0.08, std("#eee"), 0.32, d.height + 0.03, -0.05);
  const globe = new THREE.Group();
  globe.position.set(-0.32, d.height + 0.01, 0);
  cyl(globe, 0.1, 0.112, 0.024, 20, std("#241c14", { metalness: 0.48, roughness: 0.34 }), 0, 0.012, 0);
  cyl(globe, 0.013, 0.018, 0.14, 12, std("#c6a15a", { metalness: 0.82, roughness: 0.22 }), 0, 0.1, 0);
  const earthTex = canvasTex(512, 256, (ctx, w, h) => {
    const ocean = ctx.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, "#f3f7fb");
    ocean.addColorStop(0.2, "#1b6eb8");
    ocean.addColorStop(0.8, "#1b6eb8");
    ocean.addColorStop(1, "#f4f8fb");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3e8f45";
    ctx.beginPath();
    ctx.ellipse(w * 0.22, h * 0.42, 70, 48, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.38, 54, 40, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c2a15a";
    ctx.beginPath();
    ctx.ellipse(w * 0.72, h * 0.55, 36, 28, 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 32, 24),
    phys("#ffffff", { map: earthTex, roughness: 0.46, metalness: 0.04, clearcoat: 0.62 }),
  );
  earth.position.y = 0.31;
  globe.add(earth);
  spin(root, earth, 0.55);
  g.add(globe);
  root.add(g);
}

function addStool(root) {
  const [x, y, z] = furniture.stool.position;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cyl(g, 0.175, 0.175, 0.016, 24, phys("#1c1e21", { roughness: 0.28, metalness: 0.24, clearcoat: 0.48 }), 0, 0.735, 0);
  cyl(g, 0.016, 0.02, 0.58, 12, std("#9aa0a6", { metalness: 0.84, roughness: 0.2 }), 0, 0.4, 0);
  cyl(g, 0.15, 0.162, 0.016, 20, std("#1a1c1f", { metalness: 0.5, roughness: 0.34 }), 0, 0.02, 0);
  root.add(g);
}

function addCounter(root) {
  const c = furniture.counter;
  const g = new THREE.Group();
  g.position.set(c.position[0], c.position[1], c.position[2]);
  g.rotation.y = c.rotation;
  const bodyHeight = c.height * 0.72;
  const glassHeight = c.height * 0.38;
  const glassCenterY = bodyHeight + glassHeight / 2;
  const glassTopY = bodyHeight + glassHeight;
  box(g, c.width, bodyHeight, c.depth, std("#f5f2ed", { roughness: 0.32 }), 0, bodyHeight / 2, 0);
  box(g, c.width, 0.1, 0.02, std("#a90f18", { roughness: 0.28 }), 0, 0.08, c.depth / 2 + 0.001);
  box(g, c.width, 0.08, 0.02, std("#a90f18", { roughness: 0.28 }), 0, bodyHeight - 0.055, c.depth / 2 + 0.001);
  const panelW = c.width / c.panels;
  for (let i = 0; i < c.panels; i++) {
    const px = -c.width / 2 + panelW / 2 + i * panelW;
    const diamond = box(g, 0.16, 0.16, 0.01, std("#f8f7f4"), px, bodyHeight * 0.48, c.depth / 2 + 0.012);
    diamond.rotation.z = Math.PI / 4;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(diamond.geometry), new THREE.LineBasicMaterial({ color: "#171717" }));
    lines.position.copy(diamond.position);
    lines.rotation.copy(diamond.rotation);
    g.add(lines);
  }
  const glassMat = phys("#e9fbff", {
    transparent: true,
    opacity: 0.14,
    roughness: 0.025,
    metalness: 0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    box(g, c.width - 0.065, glassHeight, 0.012, glassMat, 0, glassCenterY, side * (c.depth / 2 - 0.035));
    box(g, 0.012, glassHeight, c.depth - 0.08, glassMat, side * (c.width / 2 - 0.035), glassCenterY, 0);
  }
  box(g, c.width - 0.055, 0.028, c.depth - 0.055, glassMat, 0, glassTopY + 0.008, 0);
  box(g, c.width + 0.025, 0.035, c.depth + 0.025, std("#b8bec0", { metalness: 0.72, roughness: 0.2 }), 0, bodyHeight, 0);
  const steel = std("#c9ced0", { metalness: 0.8, roughness: 0.16 });
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      box(g, 0.025, glassHeight, 0.025, steel, xSide * (c.width / 2 - 0.015), glassCenterY, zSide * (c.depth / 2 - 0.015));
      box(g, 0.008, glassHeight - 0.055, 0.008, led(5), xSide * (c.width / 2 - 0.029), glassCenterY, zSide * (c.depth / 2 - 0.029));
    }
  }
  box(g, c.width - 0.09, 0.018, c.depth - 0.09, std("#176b38", { roughness: 0.96, metalness: 0 }), 0, bodyHeight + 0.022, 0);
  light(g, -c.width / 4, glassTopY - 0.08, 0, "#ffe3a3", 1.4, 1.35);
  light(g, c.width / 4, glassTopY - 0.08, 0, "#ffe3a3", 1.4, 1.35);
  root.add(g);
}

function addSigns(root) {
  const [x, y, z] = furniture.sign.position;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.2), std("#ffffff", { map: makeSignTexture(furniture.sign.text), roughness: 0.55 }));
  mesh.position.set(x, y, z);
  root.add(mesh);
  const pad = furniture.walkingPad;
  box(root, pad.size[0], pad.size[1], pad.size[2], std("#ffffff", { map: makeWalkingTexture(), roughness: 0.4 }), pad.position[0], pad.position[1], pad.position[2]);
}

function displayTexture(index) {
  const style = index % 6;
  if (displayTexture.cache[style]) return displayTexture.cache[style];
  const tex = canvasTex(432, 900, (ctx) => {
    const palettes = [
      ["#071528", "#176b87", "#f0674b"],
      ["#160c31", "#6c28a2", "#ff6f91"],
      ["#061e1d", "#16886d", "#72d89c"],
      ["#1b0d08", "#ad4f20", "#ffc76d"],
      ["#081631", "#2454b8", "#5dd3ff"],
      ["#24111f", "#a32955", "#ff9d71"],
    ];
    const [top, middle] = palettes[style];
    const wallpaper = ctx.createLinearGradient(0, 0, 432, 900);
    wallpaper.addColorStop(0, top);
    wallpaper.addColorStop(0.53, middle);
    wallpaper.addColorStop(1, "#03070d");
    ctx.fillStyle = wallpaper;
    ctx.fillRect(0, 0, 432, 900);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 28px Segoe UI, sans-serif";
    ctx.fillText("9:41", 28, 48);
    ctx.font = "300 72px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("9:41", 216, 190);
    ctx.font = "500 22px Segoe UI, sans-serif";
    ctx.fillText("Mobile Galaxy  ·  F-69", 216, 236);
  });
  tex.userData.shared = true;
  tex.anisotropy = 8;
  displayTexture.cache[style] = tex;
  return tex;
}
displayTexture.cache = {};

function tunePhone(material, bodyColor, screenIntensity, display) {
  const tuned = material.clone();
  const name = (tuned.name || "").toLowerCase();
  if (tuned.isMeshStandardMaterial) {
    if (/screen|display_activearea/.test(name)) {
      tuned.color.set("#ffffff");
      tuned.emissive.set("#ffffff");
      if (display) {
        tuned.map = display;
        tuned.emissiveMap = display;
      }
      tuned.emissiveIntensity = screenIntensity;
      tuned.metalness = 0.02;
      tuned.roughness = 0.035;
      tuned.toneMapped = false;
    } else if (/metal|frame|rearcase/.test(name)) {
      tuned.metalness = 0.92;
      tuned.roughness = 0.12;
    } else if (/basecolor|back_cover_glass/.test(name)) {
      tuned.color.lerp(new THREE.Color(bodyColor), 0.28);
      tuned.metalness = 0.48;
      tuned.roughness = 0.14;
    }
  }
  tuned.needsUpdate = true;
  return tuned;
}

function placePhone(slot) {
  if (!phoneTemplates) return;
  const spec = slot.userData.phone;
  const iphone = spec.index % 2 === 0;
  const src = iphone ? phoneTemplates.iphone : phoneTemplates.galaxy;
  const model = src.clone(true);
  const display = displayTexture(spec.index);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.geometry) object.geometry.userData.shared = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const tuned = materials.map((material) => tunePhone(material, spec.bodyColor, spec.screenIntensity, display));
    object.material = Array.isArray(object.material) ? tuned : tuned[0];
  });
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  model.position.sub(bounds.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.position.set(spec.position[0], spec.position[1], spec.position[2]);
  holder.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
  holder.scale.setScalar(spec.scale);
  const orient = new THREE.Group();
  orient.rotation.x = -Math.PI / 2;
  if (iphone) {
    orient.scale.setScalar(0.11);
    const yaw = new THREE.Group();
    yaw.rotation.y = Math.PI / 2;
    yaw.add(model);
    orient.add(yaw);
  } else {
    orient.scale.setScalar(0.035);
    orient.add(model);
  }
  holder.add(orient);
  slot.add(holder);
}

function loadPhones(root, gen) {
  if (!phoneLoad) {
    phoneLoad = Promise.all([
      loader.loadAsync("models/phones/iphone-16-pro-max.glb"),
      loader.loadAsync("models/phones/galaxy-s22-ultra.glb"),
    ]).then(([iphone, galaxy]) => {
      shareTemplate(iphone.scene);
      shareTemplate(galaxy.scene);
      phoneTemplates = { iphone: iphone.scene, galaxy: galaxy.scene };
    });
  }
  phoneLoad.then(() => {
    if (gen !== buildGen || !root.parent) return;
    for (const slot of root.userData.phoneSlots || []) placePhone(slot);
    ping();
  }).catch((err) => console.error("galaxy phones", err));
}

function loadSign(root, gen) {
  if (!fontLoad) fontLoad = fontLoader.loadAsync("fonts/helvetiker_bold.typeface.json");
  fontLoad.then((font) => {
    if (gen !== buildGen || !root.parent) return;
    for (const anchor of root.userData.signAnchors || []) {
      const geo = new TextGeometry(anchor.text, {
        font,
        size: anchor.size,
        depth: anchor.depth,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
      const mesh = new THREE.Mesh(geo, phys(anchor.color, {
        emissive: anchor.emissive,
        emissiveIntensity: anchor.emissive === "#000000" ? 0 : 0.1,
        metalness: 0.46,
        roughness: 0.19,
        clearcoat: 0.9,
      }));
      mesh.position.set(anchor.x, anchor.y, anchor.z);
      mesh.castShadow = true;
      root.add(mesh);
    }
    ping();
  }).catch((err) => console.error("galaxy sign", err));
}

export function buildGalaxyStore() {
  const gen = ++buildGen;
  const root = new THREE.Group();
  root.name = "galaxy-store";
  root.userData.spinners = [];
  root.userData.phoneSlots = [];
  galaxyRoot = root;
  const wood = makeWoodMaps();
  const ambient = new THREE.AmbientLight("#fff6ea", store.lights.ambient);
  root.add(ambient);
  for (const p of store.lights.points) {
    light(root, p.position[0], p.position[1], p.position[2], p.color, p.intensity, 7);
  }
  buildRoom(root, wood);
  addStorefront(root, wood);
  addGate(root);
  addBackCabinet(root, wood);
  addGoldShelves(root);
  addSideCabinets(root, wood);
  const boxes = {};
  const hangs = {};
  for (const [sku, item] of Object.entries(products.catalog)) {
    if (item.kind === "hang") hangs[sku] = makeHangTexture(item);
    else boxes[sku] = makeBoxTexture(item);
  }
  addProducts(root, { boxes });
  addHanging(root, hangs);
  addDesk(root);
  for (const chair of furniture.chairs) addChair(root, chair.position, chair.rotation);
  addCounter(root);
  addStool(root);
  addSigns(root);
  loadSign(root, gen);
  return root;
}
