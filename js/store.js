import * as THREE from "three";
import { QUALITY } from "./quality.js";
import { createFurniture, newFurniture } from "./furniture.js";
import { makePresetTexture, makeNormalFromAlbedo, resolveRoofId } from "./textures.js";

function mappedMat(color, texId, extra = {}) {
  if (!QUALITY.high) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: extra.roughness ?? 0.42,
      metalness: extra.metalness ?? 0.04,
      envMapIntensity: extra.env ?? 0.8,
    });
  }
  const src = texId ? makePresetTexture(texId) : null;
  const map = src ? src.clone() : null;
  if (map) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(extra.repeat || 2, extra.repeatY || extra.repeat || 2);
    map.needsUpdate = true;
  }
  const nrm = map && QUALITY.normals ? makeNormalFromAlbedo(map, extra.nStr ?? 0.8) : null;
  if (nrm) nrm.repeat.copy(map.repeat);
  const spec = {
    color,
    map,
    normalMap: nrm,
    normalScale: new THREE.Vector2(extra.nSc ?? 0.35, extra.nSc ?? 0.35),
    roughness: extra.roughness ?? 0.4,
    metalness: extra.metalness ?? 0.04,
    envMapIntensity: extra.env ?? 0.8,
  };
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      ...spec,
      clearcoat: extra.clearcoat ?? 0.12,
      clearcoatRoughness: extra.ccr ?? 0.42,
    });
  }
  return new THREE.MeshStandardMaterial(spec);
}

function brassMat() {
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      color: "#c6a56a",
      metalness: 0.9,
      roughness: 0.22,
      envMapIntensity: 1.35,
      clearcoat: 0.42,
      clearcoatRoughness: 0.28,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: "#c6a56a",
    metalness: 0.88,
    roughness: 0.24,
    envMapIntensity: 1.2,
  });
}

function steelMat() {
  return new THREE.MeshStandardMaterial({
    color: "#b7bdc4",
    metalness: 0.92,
    roughness: 0.3,
    envMapIntensity: 1.22,
  });
}

function brushedSteelMat() {
  return mappedMat("#c4c8cd", "metal", {
    repeat: 1.15,
    repeatY: 1.8,
    roughness: 0.34,
    metalness: 0.9,
    env: 1.28,
    nStr: 0.42,
    nSc: 0.2,
  });
}

const SLIDE_LINTEL = 0.94;

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
UNIT_BOX.userData.shared = true;
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
UNIT_PLANE.userData.shared = true;
const CAN_GEO = new THREE.CylinderGeometry(0.13, 0.15, 0.05, 10);
CAN_GEO.userData.shared = true;
const COL_SHAFT = new THREE.CylinderGeometry(0.16, 0.18, 1, QUALITY.segs);
COL_SHAFT.userData.shared = true;
const LENS_GEO = new THREE.CircleGeometry(0.1, 10);
LENS_GEO.userData.shared = true;
const WELL_GEO = new THREE.CylinderGeometry(0.09, 0.118, 0.085, 16);
WELL_GEO.userData.shared = true;
const BAFFLE_GEO = new THREE.CylinderGeometry(0.052, 0.086, 0.034, 16);
BAFFLE_GEO.userData.shared = true;
const RING_GEO = new THREE.TorusGeometry(0.12, 0.012, 8, 22);
RING_GEO.userData.shared = true;
const LENS_BRIGHT = new THREE.CircleGeometry(0.06, 18);
LENS_BRIGHT.userData.shared = true;
const HALO_GEO = new THREE.CircleGeometry(0.26, 20);
HALO_GEO.userData.shared = true;
const instDummy = new THREE.Object3D();

const THICK = 0.18;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2, 10)}`;
}

function wallUV(length, height) {
  const tile = 1.85;
  return {
    generateTopUV(_g, vertices, a, b, c) {
      const uv = (i) =>
        new THREE.Vector2((vertices[i * 3] + length / 2) / tile, vertices[i * 3 + 1] / tile);
      return [uv(a), uv(b), uv(c)];
    },
    generateSideWallUV() {
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
      ];
    },
  };
}

function wallGeometry(length, height, openings) {
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, 0);
  shape.lineTo(length / 2, 0);
  shape.lineTo(length / 2, height);
  shape.lineTo(-length / 2, height);
  shape.closePath();

  for (const o of openings) {
    const start = THREE.MathUtils.clamp(o.start, 0.04, length - 0.2);
    const end = THREE.MathUtils.clamp(o.end, start + 0.25, length - 0.04);
    const bottom = Math.max(0.0, o.bottom);
    const top = Math.min(height - 0.04, o.top);
    if (top <= bottom + 0.1) continue;
    const hole = new THREE.Path();
    const x0 = start - length / 2;
    const x1 = end - length / 2;
    hole.moveTo(x0, bottom);
    hole.lineTo(x1, bottom);
    hole.lineTo(x1, top);
    hole.lineTo(x0, top);
    hole.closePath();
    shape.holes.push(hole);
  }

  return new THREE.ExtrudeGeometry(shape, {
    depth: THICK,
    bevelEnabled: false,
    UVGenerator: wallUV(length, height),
  });
}

function openingsFor(state, wall, length, height) {
  const list = [];
  for (const door of state.doors.filter((d) => d.wall === wall)) {
    const cx = (door.pos / 100) * length;
    list.push({
      start: cx - door.width / 2,
      end: cx + door.width / 2,
      bottom: 0,
      top: Math.min(door.height + (door.style === "slide" ? SLIDE_LINTEL : 0), height - 0.08),
    });
  }
  for (const win of state.windows.filter((w) => w.wall === wall)) {
    const cx = (win.pos / 100) * length;
    const sill = win.sill ?? 0.95;
    list.push({
      start: cx - win.width / 2,
      end: cx + win.width / 2,
      bottom: sill,
      top: Math.min(sill + win.height, height - 0.08),
    });
  }
  return list;
}

function glassOpts(item) {
  return {
    glassType: item.glassType || "clear",
    glassColor: item.glassColor || item.color || "#d8eef8",
    opacity: item.opacity ?? 0.05,
  };
}

function makeGlassMaterial(opts) {
  const type = opts.glassType || "clear";
  const color = opts.glassColor || "#e8f4fc";
  if (type === "mirror") {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.96,
      roughness: 0.055,
      envMapIntensity: 1.85,
      side: THREE.DoubleSide,
    });
  }
  const spec = {
    color,
    metalness: type === "tinted" ? 0.08 : 0.04,
    roughness: type === "frosted" ? 0.38 : 0.035,
    transparent: true,
    opacity: Math.max(opts.opacity ?? 0.12, type === "frosted" ? 0.26 : 0.12),
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.55,
  };
  if (QUALITY.physical) {
    return new THREE.MeshPhysicalMaterial({
      ...spec,
      clearcoat: 1,
      clearcoatRoughness: type === "frosted" ? 0.28 : 0.05,
      reflectivity: 0.58,
      ior: 1.5,
    });
  }
  return new THREE.MeshStandardMaterial(spec);
}

function makeGlassPane(w, h, opts) {
  const mesh = new THREE.Mesh(UNIT_PLANE, makeGlassMaterial(opts));
  mesh.scale.set(Math.max(0.08, w), Math.max(0.08, h), 1);
  if (opts.glassType === "mirror") mesh.rotation.y = Math.PI;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function makeGlassSlab(w, h, d, opts) {
  const mesh = new THREE.Mesh(UNIT_BOX, makeGlassMaterial({ ...opts, opacity: Math.min(opts.opacity ?? 0.08, 0.1) }));
  mesh.scale.set(Math.max(0.04, w), Math.max(0.04, h), Math.max(0.008, d));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addGlassCurtain(g, length, height, openings, surface) {
  const matOpts = {
    glassType: surface.finish === "mirror" ? "mirror" : "clear",
    glassColor: surface.color || "#d8eef8",
    opacity: surface.opacity ?? 0.05,
  };
  const segs = [{ start: -length / 2, end: length / 2 }];
  for (const o of openings) {
    const x0 = o.start - length / 2;
    const x1 = o.end - length / 2;
    const next = [];
    for (const s of segs) {
      if (x1 <= s.start || x0 >= s.end) {
        next.push(s);
        continue;
      }
      if (x0 > s.start + 0.04) next.push({ start: s.start, end: x0 });
      if (x1 < s.end - 0.04) next.push({ start: x1, end: s.end });
    }
    segs.length = 0;
    segs.push(...next);
  }
  for (const s of segs) {
    const pw = s.end - s.start;
    if (pw < 0.1) continue;
    const pane = makeGlassPane(pw, height, matOpts);
    pane.position.set((s.start + s.end) / 2, height / 2, 0.01);
    g.add(pane);
  }
  for (const o of openings) {
    const topH = height - o.top;
    if (topH < 0.1) continue;
    const pw = o.end - o.start;
    const pane = makeGlassPane(pw, topH, matOpts);
    pane.position.set((o.start + o.end) / 2 - length / 2, o.top + topH / 2, 0.01);
    g.add(pane);
  }
  const steel = brushedSteelMat();
  const pitch = 2.4;
  const n = Math.max(2, Math.round(length / pitch));
  for (let i = 1; i < n; i++) {
    const x = -length / 2 + (length * i) / n;
    const blocked = openings.some((o) => {
      const x0 = o.start - length / 2;
      const x1 = o.end - length / 2;
      return x > x0 - 0.08 && x < x1 + 0.08;
    });
    if (blocked) continue;
    g.add(meshBox(0.035, height, 0.055, steel, x, height / 2, 0.028));
  }
  g.add(meshBox(length, 0.03, 0.06, steel, 0, 0.015, 0.03));
}

function addFrame(group, w, h, thick, depth, mat, originLeft = true) {
  const ox = originLeft ? 0 : -w / 2;
  group.add(meshBox(thick, h, depth, mat, ox + thick / 2, h / 2, 0));
  group.add(meshBox(thick, h, depth, mat, ox + w - thick / 2, h / 2, 0));
  group.add(meshBox(w, thick, depth, mat, ox + w / 2, h - thick / 2, 0));
  group.add(meshBox(w, thick, depth, mat, ox + w / 2, thick / 2, 0));
}

function makeMallSlideDoor(door, heightLimit) {
  const w = door.width;
  const lintelH = SLIDE_LINTEL;
  const h = Math.min(door.height, heightLimit - lintelH - 0.02);
  const group = new THREE.Group();
  const opts = { ...glassOpts(door), opacity: Math.min(door.opacity ?? 0.07, 0.08) };
  const steel = brushedSteelMat();
  const chrome = new THREE.MeshStandardMaterial({
    color: "#d8dce1",
    metalness: 0.96,
    roughness: 0.12,
    envMapIntensity: 1.42,
  });
  const dark = new THREE.MeshStandardMaterial({ color: "#0b0d11", metalness: 0.58, roughness: 0.34 });
  const black = new THREE.MeshStandardMaterial({ color: "#101318", metalness: 0.42, roughness: 0.4 });
  const postW = 0.3;
  const postD = 0.34;
  const portalH = h + lintelH;
  const faceZ = postD / 2;

  group.add(meshBox(postW, portalH, postD, steel, -postW / 2, portalH / 2, 0.02));
  group.add(meshBox(postW, portalH, postD, steel, w + postW / 2, portalH / 2, 0.02));
  group.add(meshBox(w + postW * 2, lintelH, postD + 0.02, steel, w / 2, h + lintelH / 2, 0.03));
  group.add(meshBox(w + postW * 2 + 0.02, 0.06, postD + 0.02, steel, w / 2, 0.03, 0.02));
  group.add(meshBox(0.018, h, 0.04, chrome, 0.01, h / 2, faceZ - 0.12));
  group.add(meshBox(0.018, h, 0.04, chrome, w - 0.01, h / 2, faceZ - 0.12));
  group.add(meshBox(w + 0.04, 0.02, 0.05, chrome, w / 2, h + 0.012, faceZ - 0.04));

  const screenW = w - 0.06;
  const screenH = 0.5;
  const screenY = h + 0.32;
  group.add(meshBox(screenW + 0.06, screenH + 0.05, 0.035, dark, w / 2, screenY, faceZ + 0.004));
  const ad = makeStorefrontAdTex("header");
  const ledMat = new THREE.MeshStandardMaterial({
    map: ad,
    roughness: 0.08,
    metalness: 0.02,
    emissive: "#ffffff",
    emissiveMap: ad,
    emissiveIntensity: 1.28,
  });
  const screen = new THREE.Mesh(UNIT_PLANE, ledMat);
  screen.scale.set(screenW, screenH, 1);
  screen.position.set(w / 2, screenY, faceZ + 0.024);
  group.add(screen);
  const backAd = screen.clone();
  backAd.rotation.y = Math.PI;
  backAd.position.z = -faceZ + 0.02;
  group.add(backAd);

  const mark = makePhoneMarkTex();
  const plaque = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshStandardMaterial({
      map: mark,
      transparent: true,
      roughness: 0.18,
      metalness: 0.12,
      emissive: "#ffffff",
      emissiveMap: mark,
      emissiveIntensity: 1.35,
      depthWrite: false,
    })
  );
  plaque.scale.set(0.3, 0.3, 1);
  plaque.position.set(w / 2, h + lintelH - 0.16, faceZ + 0.03);
  group.add(plaque);

  group.add(meshBox(0.11, 0.045, 0.055, black, w / 2, h + 0.028, faceZ + 0.01));
  group.add(meshBox(0.036, 0.014, 0.022, chrome, w / 2, h + 0.028, faceZ + 0.04));

  const grillN = 20;
  const grill = new THREE.InstancedMesh(UNIT_BOX, dark, grillN);
  for (let i = 0; i < grillN; i++) {
    instDummy.position.set((i + 0.5) * (w / grillN), 0.005, 0.05);
    instDummy.scale.set(w / grillN - 0.01, 0.01, 0.2);
    instDummy.rotation.set(0, 0, 0);
    instDummy.updateMatrix();
    grill.setMatrixAt(i, instDummy.matrix);
  }
  grill.instanceMatrix.needsUpdate = true;
  group.add(grill);
  group.add(
    meshBox(
      w * 0.94,
      0.01,
      0.78,
      new THREE.MeshStandardMaterial({ color: "#454a52", roughness: 0.78 }),
      w / 2,
      0.003,
      -0.4
    )
  );

  const leafW = w / 2;
  const glassH = h - 0.08;
  const slide = door.open ? leafW * 0.78 : 0;
  for (let i = 0; i < 2; i++) {
    const leaf = new THREE.Group();
    const pane = makeGlassSlab(leafW - 0.028, glassH - 0.05, 0.012, opts);
    pane.position.set(leafW / 2, glassH / 2 + 0.035, 0);
    leaf.add(pane);
    leaf.add(meshBox(leafW - 0.012, 0.016, 0.032, chrome, leafW / 2, glassH + 0.018, 0));
    leaf.add(meshBox(leafW - 0.012, 0.07, 0.034, chrome, leafW / 2, 0.04, 0));
    leaf.add(meshBox(0.012, glassH, 0.032, chrome, 0.008, glassH / 2 + 0.03, 0));
    leaf.add(meshBox(0.012, glassH, 0.032, chrome, leafW - 0.008, glassH / 2 + 0.03, 0));
    leaf.add(meshBox(leafW - 0.1, 0.028, 0.03, chrome, leafW / 2, 1.02, 0.028));
    leaf.position.set(i * leafW + (i === 0 ? -slide : slide), 0.035, 0.03);
    group.add(leaf);
  }

  const kioskW = 0.58;
  const leftH = Math.min(2.48, h - 0.06);
  const rightH = Math.min(2.18, h - 0.18);
  addStorefrontKiosk(group, -postW - kioskW / 2 - 0.02, 0.05 + leftH / 2, 0.05, kioskW, leftH, "galaxy");
  addStorefrontKiosk(group, w + postW + kioskW / 2 + 0.02, 0.05 + rightH / 2, 0.05, kioskW, rightH, "pro");

  group.userData = { selectable: true, kind: "door", id: door.id };
  return group;
}

function makeDoor(door, heightLimit) {
  if (door.style === "slide") return makeMallSlideDoor(door, heightLimit);
  const w = door.width;
  const h = Math.min(door.height, heightLimit - 0.05);
  const group = new THREE.Group();
  const opts = glassOpts(door);
  const hinge = new THREE.Group();
  const leaf = new THREE.Group();
  const count = door.style === "double" ? 2 : 1;
  const leafW = w / count;
  const chrome = brassMat();

  for (let i = 0; i < count; i++) {
    const panel = new THREE.Group();
    addFrame(panel, leafW, h, 0.03, 0.05, chrome, true);
    const pane = makeGlassPane(leafW - 0.05, h - 0.055, opts);
    pane.position.set(leafW / 2, h / 2, 0);
    panel.add(pane);
    const hx = i === 0 && count > 1 ? leafW - 0.1 : 0.1;
    panel.add(meshBox(0.022, 0.95, 0.022, chrome, hx, h * 0.48, 0.04));
    panel.position.x = i * leafW;
    leaf.add(panel);
  }
  group.add(meshBox(w + 0.08, 0.04, 0.08, chrome, w / 2, 0.02, 0));

  hinge.add(leaf);
  hinge.rotation.y = door.open ? -Math.PI * 0.72 : 0;
  group.add(hinge);
  group.userData = { selectable: true, kind: "door", id: door.id };
  return group;
}

function meshBox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(Math.max(0.002, w), Math.max(0.002, h), Math.max(0.002, d));
  m.position.set(x, y, z);
  const vol = w * h * d;
  m.castShadow = !QUALITY.low && vol > 0.35;
  m.receiveShadow = false;
  return m;
}

function bannerCopyFor(name) {
  const key = String(name || "YOUR STORE").toUpperCase();
  const pack = {
    "YOUR STORE": { kicker: "NOW OPEN", line: "NEW SEASON", sub: "LOOKBOOK 26" },
    ATELIER: { kicker: "COUTURE", line: "NEW ARRIVALS", sub: "READY TO WEAR" },
    "MOBILE HUB": { kicker: "LIVE", line: "LATEST 5G", sub: "PHONES & GEAR" },
    "SOLE STUDIO": { kicker: "DROP", line: "NEW KICKS", sub: "LIMITED PAIRS" },
    CHRONOS: { kicker: "SWISS", line: "TIMEPIECES", sub: "PRIVATE VIEWING" },
    "AURUM GENESIS": { kicker: "PRIVATE", line: "HAUTE HOROLOGY", sub: "BY APPOINTMENT" },
    "UNIVERSAL PHONES": { kicker: "LIVE", line: "LATEST 5G", sub: "PHONES & GEAR" },
    "COFFEE BAR": { kicker: "FRESH", line: "BREW BAR", sub: "OPEN ALL DAY" },
    "FRESH MART": { kicker: "DAILY", line: "FRESH DEALS", sub: "AISLE SPECIALS" },
    "CARE PLUS": { kicker: "CARE", line: "WELLNESS", sub: "PHARMACY NOW" },
    LUXE: { kicker: "LUXE", line: "THE EDIT", sub: "THIS WEEK" },
    NOVA: { kicker: "NOVA", line: "TECH NOW", sub: "FLAGSHIP" },
  };
  return pack[key] || { kicker: "LIVE", line: "NOW OPEN", sub: "MALL LEVEL 01" };
}

function makeDigitalBannerTex(opts) {
  const vertical = !!opts.vertical;
  const w = vertical ? 512 : 1280;
  const h = vertical ? 1280 : 360;
  const scale = 0.5;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, opts.bg || "#141018");
  g.addColorStop(1, "#07080c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < h; y += 10) ctx.fillRect(0, y, w, 1);
  ctx.strokeStyle = opts.accent || "#c6a56a";
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = vertical ? 10 : 8;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.globalAlpha = 1;
  ctx.fillStyle = opts.accent || "#c6a56a";
  ctx.fillRect(18, 18, w - 36, vertical ? 8 : 6);
  ctx.fillStyle = "#8ee0ff";
  ctx.font = `600 ${vertical ? 22 : 18}px DM Sans, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("●  DIGITAL  ·  LIVE", w / 2, vertical ? 70 : 52);
  ctx.fillStyle = opts.fg || "#f6f1e8";
  ctx.font = `600 ${vertical ? 42 : 28}px DM Sans, sans-serif`;
  ctx.fillText(String(opts.kicker || "LIVE").toUpperCase(), w / 2, vertical ? 160 : 110);
  ctx.font = `600 ${vertical ? 86 : 72}px Cormorant Garamond, serif`;
  ctx.fillText(String(opts.title || "STORE").toUpperCase().slice(0, 14), w / 2, vertical ? 320 : 210);
  ctx.fillStyle = opts.accent || "#c6a56a";
  ctx.font = `600 ${vertical ? 48 : 36}px DM Sans, sans-serif`;
  ctx.fillText(String(opts.line || "NOW OPEN").toUpperCase(), w / 2, vertical ? 430 : 280);
  ctx.fillStyle = "rgba(246,241,232,0.72)";
  ctx.font = `500 ${vertical ? 26 : 20}px DM Sans, sans-serif`;
  ctx.fillText(String(opts.sub || "LEVEL 01").toUpperCase(), w / 2, vertical ? 500 : 322);
  if (vertical) {
    ctx.fillStyle = "rgba(198,165,106,0.16)";
    ctx.fillRect(64, 560, w - 128, 2);
    ctx.fillStyle = opts.fg || "#f6f1e8";
    ctx.font = "600 34px DM Sans, sans-serif";
    ctx.fillText("SALE  ·  20% OFF", w / 2, 640);
    ctx.fillStyle = "rgba(142,224,255,0.9)";
    ctx.font = "500 20px DM Sans, sans-serif";
    ctx.fillText("SWIPE  ·  NEW IN  ·  VIP", w / 2, 720);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 8; i++) ctx.fillRect(80, 820 + i * 42, w - 160, 18);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makePhoneMarkTex() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 512, 512);
  const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 230);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, "rgba(240,248,255,0.35)");
  g.addColorStop(1, "rgba(240,248,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(256, 256, 230, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f8fbff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 22;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.roundRect(188, 100, 136, 292, 30);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f8fbff";
  ctx.beginPath();
  ctx.roundRect(228, 122, 56, 12, 6);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  return tex;
}

function paintAdLens(ctx, x, y, r, glass) {
  const ring = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  ring.addColorStop(0, "#d8dee6");
  ring.addColorStop(0.45, "#4a4e56");
  ring.addColorStop(1, "#1a1c20");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - r * 0.22, y - r * 0.22, r * 0.08, x, y, r * 0.78);
  g.addColorStop(0, glass[0]);
  g.addColorStop(0.45, glass[1]);
  g.addColorStop(1, glass[2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.22, y - r * 0.28, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function paintHeroPhone(ctx, cx, cy, pw, ph, theme) {
  const r = pw * 0.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(theme.tilt ?? -0.08);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.filter = "blur(22px)";
  ctx.beginPath();
  ctx.ellipse(14, ph * 0.38, pw * 0.48, ph * 0.1, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "none";

  const body = ctx.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
  body.addColorStop(0, theme.hi);
  body.addColorStop(0.38, theme.mid);
  body.addColorStop(1, theme.lo);
  ctx.shadowColor = "rgba(220,230,240,0.35)";
  ctx.shadowBlur = 32;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  const gloss = ctx.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
  gloss.addColorStop(0, "rgba(255,255,255,0.32)");
  gloss.addColorStop(0.18, "rgba(255,255,255,0.04)");
  gloss.addColorStop(0.62, "rgba(255,255,255,0)");
  gloss.addColorStop(1, "rgba(160,180,200,0.12)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
  ctx.fill();

  ctx.strokeStyle = theme.edge;
  ctx.lineWidth = Math.max(3, pw * 0.018);
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
  ctx.stroke();

  const islandW = pw * 0.46;
  const islandH = pw * 0.46;
  const ix = -pw * 0.16;
  const iy = -ph * 0.28;
  const ir = pw * 0.08;
  const bump = ctx.createLinearGradient(ix - islandW / 2, iy - islandH / 2, ix + islandW / 2, iy + islandH / 2);
  bump.addColorStop(0, theme.islandHi);
  bump.addColorStop(1, theme.islandLo);
  ctx.fillStyle = bump;
  ctx.beginPath();
  ctx.roundRect(ix - islandW / 2, iy - islandH / 2, islandW, islandH, ir);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const lensR = pw * 0.072;
  paintAdLens(ctx, ix - islandW * 0.2, iy - islandH * 0.18, lensR, theme.glass);
  paintAdLens(ctx, ix + islandW * 0.2, iy - islandH * 0.18, lensR, theme.glass);
  paintAdLens(ctx, ix - islandW * 0.2, iy + islandH * 0.2, lensR * 0.92, theme.glass);
  ctx.fillStyle = "#f4f0d8";
  ctx.beginPath();
  ctx.arc(ix + islandW * 0.2, iy + islandH * 0.18, pw * 0.028, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(ix + islandW * 0.18, iy + islandH * 0.15, pw * 0.01, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(pw * 0.28, -ph * 0.02, pw * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function paintAdBokeh(ctx, w, h, color, n) {
  for (let i = 0; i < n; i++) {
    const x = w * (0.08 + ((i * 97) % 90) / 100);
    const y = h * (0.1 + ((i * 53) % 80) / 100);
    const r = 8 + (i % 7) * 7;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.045 + (i % 5) * 0.018;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function makeStorefrontAdTex(kind) {
  const vertical = kind !== "header";
  const w = vertical ? 560 : 2560;
  const h = vertical ? 2048 : 480;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  const titanium = {
    hi: "#e4dfd6",
    mid: "#c4bbb0",
    lo: "#8f877c",
    edge: "rgba(255,255,255,0.42)",
    islandHi: "#2a2c30",
    islandLo: "#121416",
    glass: ["#7ecbff", "#16324a", "#061018"],
    tilt: -0.1,
  };
  const galaxy = {
    hi: "#3a414c",
    mid: "#1c222c",
    lo: "#0b0e12",
    edge: "rgba(150,180,220,0.35)",
    islandHi: "#2a3340",
    islandLo: "#0c1016",
    glass: ["#6ea8ff", "#123056", "#050910"],
    tilt: 0.06,
  };

  if (kind === "header") {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#05070c");
    bg.addColorStop(0.45, "#0c1018");
    bg.addColorStop(1, "#1a140e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    paintAdBokeh(ctx, w, h, "#9ad8ff", 18);
    const streak = ctx.createLinearGradient(w * 0.35, 0, w, h);
    streak.addColorStop(0, "rgba(80,160,220,0)");
    streak.addColorStop(0.5, "rgba(120,190,255,0.12)");
    streak.addColorStop(1, "rgba(255,210,140,0.08)");
    ctx.fillStyle = streak;
    ctx.fillRect(0, 0, w, h);
    paintHeroPhone(ctx, w - 430, h / 2 + 8, 220, 400, titanium);
    ctx.textAlign = "left";
    ctx.fillStyle = "#7ed6ff";
    ctx.font = "700 36px DM Sans, sans-serif";
    ctx.fillText("NEW", 88, 118);
    ctx.fillStyle = "#f7f9fc";
    ctx.font = "800 92px DM Sans, sans-serif";
    ctx.fillText("PRO CAMERA SYSTEM", 88, 230);
    ctx.fillStyle = "rgba(247,249,252,0.78)";
    ctx.font = "600 34px DM Sans, sans-serif";
    ctx.fillText("NOW AVAILABLE", 88, 300);
    ctx.fillStyle = "rgba(126,214,255,0.9)";
    ctx.font = "600 22px DM Sans, sans-serif";
    ctx.fillText("48MP  ·  SPATIAL  ·  NIGHT", 88, 360);
  } else if (kind === "galaxy") {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#071018");
    bg.addColorStop(0.5, "#0c1a33");
    bg.addColorStop(1, "#05080e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    paintAdBokeh(ctx, w, h, "#7eb6ff", 16);
    paintHeroPhone(ctx, w / 2, 760, 340, 620, galaxy);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8f1ff";
    ctx.font = "800 92px DM Sans, sans-serif";
    ctx.fillText("GALAXY", w / 2, 1280);
    ctx.fillStyle = "#7eb6ff";
    ctx.font = "700 64px DM Sans, sans-serif";
    ctx.fillText("ULTRA", w / 2, 1370);
    ctx.fillStyle = "rgba(200,220,255,0.75)";
    ctx.font = "600 28px DM Sans, sans-serif";
    ctx.fillText("TITANIUM  ·  200MP", w / 2, 1450);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#120e0c");
    bg.addColorStop(1, "#1c1612");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    paintAdBokeh(ctx, w, h, "#e8c45a", 14);
    paintHeroPhone(ctx, w / 2, 760, 320, 590, titanium);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f6f1e8";
    ctx.font = "800 96px DM Sans, sans-serif";
    ctx.fillText("PRO", w / 2, 1280);
    ctx.fillStyle = "#d4af7a";
    ctx.font = "700 56px DM Sans, sans-serif";
    ctx.fillText("CAMERA", w / 2, 1360);
    ctx.fillStyle = "rgba(246,241,232,0.72)";
    ctx.font = "600 26px DM Sans, sans-serif";
    ctx.fillText("FLAGSHIP  ·  5G", w / 2, 1440);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  return tex;
}

function addStorefrontKiosk(root, x, y, z, w, h, kind) {
  const steel = brushedSteelMat();
  const dark = new THREE.MeshStandardMaterial({ color: "#0a0c10", metalness: 0.62, roughness: 0.28 });
  root.add(meshBox(w + 0.05, h + 0.1, 0.12, dark, x, y, z));
  root.add(meshBox(w + 0.08, 0.045, 0.14, steel, x, y - h / 2 - 0.03, z));
  root.add(meshBox(w + 0.08, 0.028, 0.14, steel, x, y + h / 2 + 0.04, z));
  const tex = makeStorefrontAdTex(kind);
  const screen = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.1,
      metalness: 0.03,
      emissive: "#ffffff",
      emissiveMap: tex,
      emissiveIntensity: 1.18,
    })
  );
  screen.scale.set(w, h, 1);
  screen.position.set(x, y, z + 0.064);
  root.add(screen);
}

function addMobileStorefront(root, width, depth, height, state) {
  const frontZ = depth / 2;
  const steel = brushedSteelMat();
  const wood = mappedMat("#d7b896", "walnut", {
    repeat: 1,
    repeatY: 2.4,
    roughness: 0.44,
    metalness: 0.03,
    env: 0.68,
    nStr: 0.55,
    nSc: 0.24,
  });
  const darkBack = new THREE.MeshStandardMaterial({ color: "#1a1612", roughness: 0.72, metalness: 0.04 });
  const door = (state.doors || []).find((d) => d.wall === "front") || { height: 2.88 };
  const portalTop = Math.min((door.height || 2.88) + SLIDE_LINTEL, height - 0.5);
  const fasciaH = Math.max(0.52, height - portalTop + 0.04);
  const fasciaY = height - fasciaH / 2;
  const slatN = Math.max(28, Math.round(width * 6.4));
  const slatPitch = width / slatN;
  const slats = new THREE.InstancedMesh(UNIT_BOX, wood, slatN);
  slats.castShadow = false;
  for (let i = 0; i < slatN; i++) {
    instDummy.position.set(-width / 2 + slatPitch * (i + 0.5), fasciaY, frontZ + 0.1);
    instDummy.scale.set(slatPitch * 0.46, fasciaH - 0.08, 0.05);
    instDummy.rotation.set(0, 0, 0);
    instDummy.updateMatrix();
    slats.setMatrixAt(i, instDummy.matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  slats.computeBoundingSphere();
  root.add(meshBox(width + 0.12, fasciaH, 0.04, darkBack, 0, fasciaY, frontZ + 0.06));
  root.add(slats);
  root.add(meshBox(width + 0.16, 0.04, 0.12, steel, 0, height - 0.02, frontZ + 0.12));
  root.add(meshBox(width + 0.16, 0.04, 0.12, steel, 0, height - fasciaH + 0.02, frontZ + 0.12));

  const sign = state.store.sign || {};
  const signW = Math.min(4.35, width * 0.44);
  const signH = Math.min(0.3, fasciaH * 0.46);
  root.add(meshBox(signW + 0.16, signH + 0.1, 0.05, steel, 0, fasciaY, frontZ + 0.128));
  root.add(meshBox(signW + 0.08, 0.012, 0.02, new THREE.MeshStandardMaterial({
    color: "#7ef0ff",
    emissive: "#2ad4e8",
    emissiveIntensity: 1.55,
  }), 0, fasciaY - signH / 2 - 0.03, frontZ + 0.15));
  const signTex = makePhoneFasciaTex(sign);
  const plate = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.14,
      metalness: 0.06,
      emissive: "#ffffff",
      emissiveMap: signTex,
      emissiveIntensity: 0.95,
    })
  );
  plate.scale.set(signW, signH, 1);
  plate.position.set(0, fasciaY, frontZ + 0.156);
  root.add(plate);
}

function addDigitalScreen(root, spec) {
  const { w, h, x, y, z, ry = 0, copy, vertical } = spec;
  const g = new THREE.Group();
  const tex = makeDigitalBannerTex({ ...copy, vertical });
  const frame = new THREE.MeshStandardMaterial({
    color: "#1a1c20",
    metalness: 0.72,
    roughness: 0.28,
  });
  const trim = brassMat();
  g.add(meshBox(w + 0.06, h + 0.06, 0.05, frame, 0, 0, 0));
  g.add(meshBox(w + 0.08, 0.018, 0.06, trim, 0, h / 2 + 0.03, 0));
  g.add(meshBox(w + 0.08, 0.018, 0.06, trim, 0, -h / 2 - 0.03, 0));
  const screen = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.18,
      metalness: 0.08,
      emissive: "#ffffff",
      emissiveMap: tex,
      emissiveIntensity: 0.72,
    })
  );
  screen.scale.set(w, h, 1);
  screen.position.z = 0.028;
  g.add(screen);
  const back = screen.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.028;
  g.add(back);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.userData = { selectable: false };
  root.add(g);
  return g;
}

function addEntranceBanners(root, width, depth, height, sign, doors) {
  const door = (doors || []).find((d) => d.wall === "front") || { pos: 50, width: 2.8, height: 3.15 };
  const doorX = (door.pos / 100 - 0.5) * width;
  const doorW = door.width || 2.8;
  const doorH = Math.min(door.height || 3.15, height - 0.35);
  const copy = {
    title: sign?.text || "STORE",
    fg: sign?.fg || "#f6f1e8",
    bg: sign?.bg || "#121214",
    accent: "#c6a56a",
    ...bannerCopyFor(sign?.text),
  };
  const frontZ = depth / 2;
  const insideZ = frontZ - 0.36;
  const side = doorW / 2 + 0.62;
  const bannerW = 0.7;
  const bannerH = Math.min(1.82, height - 2.15);
  const bannerY = 1.92 + bannerH / 2;
  addDigitalScreen(root, { w: bannerW, h: bannerH, x: doorX - side, y: bannerY, z: insideZ, copy, vertical: true });
  addDigitalScreen(root, { w: bannerW, h: bannerH, x: doorX + side, y: bannerY, z: insideZ, copy, vertical: true });
  const barW = Math.min(doorW + 0.55, 3.6);
  const barY = Math.min(doorH + 0.38, height - 0.42);
  addDigitalScreen(root, { w: barW, h: 0.4, x: doorX, y: barY, z: insideZ, copy, vertical: false });
  addDigitalScreen(root, { w: barW, h: 0.4, x: doorX, y: barY, z: frontZ + 0.08, copy, vertical: false });
  const rod = new THREE.MeshStandardMaterial({ color: "#c6a56a", metalness: 0.8, roughness: 0.32 });
  for (const x of [doorX - side, doorX + side]) {
    root.add(meshBox(0.016, Math.max(0.12, height - 0.22 - (bannerY + bannerH / 2)), 0.016, rod, x, (height - 0.22 + bannerY + bannerH / 2) / 2, insideZ));
  }
}

function makeWindow(win) {
  const w = win.width;
  const h = win.height;
  const group = new THREE.Group();
  const frame = brassMat();
  addFrame(group, w, h, 0.024, 0.042, frame, false);
  group.add(meshBox(0.016, h - 0.05, 0.03, frame, 0, h / 2, 0));
  group.add(meshBox(w - 0.05, 0.016, 0.03, frame, 0, h / 2, 0));
  const opts = glassOpts(win);
  const pw = (w - 0.07) / 2;
  const ph = (h - 0.07) / 2;
  const panes = [
    [-pw / 2 - 0.008, h * 0.75],
    [pw / 2 + 0.008, h * 0.75],
    [-pw / 2 - 0.008, h * 0.25],
    [pw / 2 + 0.008, h * 0.25],
  ];
  for (const [x, y] of panes) {
    const pane = makeGlassPane(pw, ph, opts);
    pane.position.set(x, y, 0.01);
    group.add(pane);
  }
  group.userData = { selectable: true, kind: "window", id: win.id };
  return group;
}

function placeOnWall(object, wall, length, posPct, y, depth, width, extraZ = 0) {
  const along = (posPct / 100 - 0.5) * length;
  if (wall === "front") {
    object.position.set(along, y, depth / 2 + extraZ);
  } else if (wall === "back") {
    object.position.set(-along, y, -depth / 2 - extraZ);
    object.rotation.y = Math.PI;
  } else if (wall === "left") {
    object.position.set(-width / 2 - extraZ, y, along);
    object.rotation.y = Math.PI / 2;
  } else {
    object.position.set(width / 2 + extraZ, y, -along);
    object.rotation.y = -Math.PI / 2;
  }
}

function makeSignTexture(sign) {
  const c = document.createElement("canvas");
  c.width = 700;
  c.height = 140;
  const ctx = c.getContext("2d");
  ctx.fillStyle = sign.bg || "#121214";
  ctx.fillRect(0, 0, 700, 140);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 26);
  ctx.lineTo(660, 26);
  ctx.moveTo(40, 114);
  ctx.lineTo(660, 114);
  ctx.stroke();
  ctx.fillStyle = sign.fg || "#f3f1ec";
  ctx.font = "600 36px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((sign.text || "YOUR STORE").toUpperCase(), 350, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function solidWallSpans(length, openings) {
  let spans = [{ a: 0.06, b: length - 0.06 }];
  for (const o of openings.filter((hole) => hole.bottom < 0.25)) {
    const next = [];
    for (const s of spans) {
      if (o.end <= s.a || o.start >= s.b) next.push(s);
      else {
        if (o.start > s.a + 0.35) next.push({ a: s.a, b: o.start - 0.04 });
        if (o.end < s.b - 0.35) next.push({ a: o.end + 0.04, b: s.b });
      }
    }
    spans = next;
  }
  return spans.filter((s) => s.b - s.a > 0.4);
}

function addOnInnerWall(root, wall, storeW, storeD, localX, y, meshW, meshH, meshD, mat) {
  const inset = meshD * 0.5 + 0.003;
  let mesh;
  if (wall === "back") mesh = meshBox(meshW, meshH, meshD, mat, localX, y, -storeD / 2 + inset);
  else if (wall === "front") mesh = meshBox(meshW, meshH, meshD, mat, localX, y, storeD / 2 - inset);
  else if (wall === "left") mesh = meshBox(meshD, meshH, meshW, mat, -storeW / 2 + inset, y, localX);
  else mesh = meshBox(meshD, meshH, meshW, mat, storeW / 2 - inset, y, -localX);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  root.add(mesh);
}

function addWallDressing(root, width, depth, height, state) {
  const sides = [
    { id: "wall-back", wall: "back", len: width },
    { id: "wall-left", wall: "left", len: depth },
    { id: "wall-right", wall: "right", len: depth },
    { id: "wall-front", wall: "front", len: width },
  ];
  const paintSkirting = mappedMat("#f2eee6", "drywall", {
    repeat: 2.2,
    repeatY: 0.35,
    roughness: 0.5,
    metalness: 0.02,
    env: 0.55,
    nStr: 0.85,
    nSc: 0.3,
  });
  const paintCrown = mappedMat("#f0ebe3", "limewash", {
    repeat: 2.1,
    roughness: 0.56,
    metalness: 0.02,
    env: 0.5,
    nStr: 0.7,
    nSc: 0.28,
  });
  const woodSkirting = mappedMat("#2c2018", "walnut", {
    repeat: 1.6,
    repeatY: 0.45,
    roughness: 0.42,
    metalness: 0.04,
    env: 0.7,
    nStr: 0.9,
    nSc: 0.34,
  });
  const cap = new THREE.MeshStandardMaterial({
    color: "#ebe4d8",
    roughness: 0.4,
    metalness: 0.05,
    envMapIntensity: 0.58,
  });
  const woodCap = new THREE.MeshStandardMaterial({
    color: "#3a2a1e",
    roughness: 0.38,
    metalness: 0.06,
    envMapIntensity: 0.62,
  });
  const shadow = new THREE.MeshStandardMaterial({
    color: "#1c1916",
    roughness: 1,
    metalness: 0,
  });

  for (const s of sides) {
    const surface = state.store.surfaces[s.id] || {};
    const glass = surface.finish === "glass" || surface.finish === "mirror";
    const wood = surface.texture === "walnut" || surface.texture === "wood" || surface.texture === "herringbone";
    const openings = openingsFor(state, s.wall, s.len, height);
    const floorSpans = solidWallSpans(s.len, openings);
    const skirtMat = wood ? woodSkirting : paintSkirting;
    const capMat = wood ? woodCap : cap;
    const crownMat = wood ? woodSkirting : paintCrown;

    for (const span of floorSpans) {
      const mid = (span.a + span.b) / 2 - s.len / 2;
      const w = span.b - span.a;
      addOnInnerWall(root, s.wall, width, depth, mid, 0.004, w, 0.008, 0.024, shadow);
      addOnInnerWall(root, s.wall, width, depth, mid, 0.068, w, 0.124, 0.022, skirtMat);
      addOnInnerWall(root, s.wall, width, depth, mid, 0.138, w, 0.024, 0.03, capMat);
      addOnInnerWall(root, s.wall, width, depth, mid, 0.154, w, 0.01, 0.018, capMat);
    }

    if (glass) continue;
    const crownW = s.len - 0.12;
    addOnInnerWall(root, s.wall, width, depth, 0, height - 0.055, crownW, 0.07, 0.034, crownMat);
    addOnInnerWall(root, s.wall, width, depth, 0, height - 0.1, crownW, 0.02, 0.052, crownMat);
  }

  const bead = mappedMat("#efeae3", "drywall", {
    repeat: 1.2,
    roughness: 0.52,
    metalness: 0.02,
    env: 0.5,
    nStr: 0.6,
    nSc: 0.22,
  });
  const inset = 0.1;
  const beadH = height - 0.28;
  const beadY = beadH / 2 + 0.14;
  const corners = [
    [-width / 2 + inset, -depth / 2 + inset],
    [width / 2 - inset, -depth / 2 + inset],
    [-width / 2 + inset, depth / 2 - inset],
    [width / 2 - inset, depth / 2 - inset],
  ];
  for (const [x, z] of corners) {
    root.add(meshBox(0.03, beadH, 0.03, bead, x, beadY, z));
  }
}

function addInteriorFitout(root, width, depth, height, frontStyle) {
  const wood = mappedMat("#4a3426", "walnut", {
    repeat: 1,
    repeatY: 3.2,
    roughness: 0.42,
    metalness: 0.04,
    env: 0.78,
    nStr: 0.95,
    nSc: 0.42,
  });
  const gypsum = mappedMat("#f3ebe0", "limewash", {
    repeat: 1.4,
    roughness: 0.7,
    metalness: 0.02,
    env: 0.45,
    nStr: 0.5,
    nSc: 0.18,
  });
  const brass = brassMat();
  const glow = new THREE.MeshStandardMaterial({
    color: "#fff8f0",
    emissive: "#ffe8c8",
    emissiveIntensity: 1.05,
  });
  const champagne = new THREE.MeshStandardMaterial({
    color: "#e8dfd0",
    metalness: 0.16,
    roughness: 0.3,
    envMapIntensity: 0.8,
  });

  if (frontStyle === "mobile") {
    const steel = steelMat();
    const col = 0.22;
    const colZ = -depth / 2 + 1.02;
    for (const x of [-width / 2 + 0.38, width / 2 - 0.38]) {
      root.add(meshBox(col, height - 0.34, col, gypsum, x, (height - 0.2) / 2, colZ));
      root.add(meshBox(col + 0.06, 0.04, col + 0.06, steel, x, 0.06, colZ));
      root.add(meshBox(col + 0.05, 0.04, col + 0.05, steel, x, height - 0.26, colZ));
    }
    return;
  }

  const slatW = Math.min(width * 0.62, 9.5);
  const slatCount = QUALITY.low ? 8 : 14;
  const slatGap = slatW / slatCount;
  const slats = new THREE.InstancedMesh(UNIT_BOX, wood, slatCount);
  slats.castShadow = false;
  slats.receiveShadow = false;
  for (let i = 0; i < slatCount; i++) {
    const x = -slatW / 2 + slatGap * (i + 0.5);
    instDummy.position.set(x, (height - 0.35) / 2, -depth / 2 + 0.09);
    instDummy.scale.set(0.045, height - 0.7, 0.028);
    instDummy.rotation.set(0, 0, 0);
    instDummy.updateMatrix();
    slats.setMatrixAt(i, instDummy.matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  root.add(slats);
  root.add(meshBox(slatW + 0.2, 0.06, 0.04, brass, 0, height - 0.42, -depth / 2 + 0.1));
  root.add(meshBox(slatW + 0.08, 0.02, 0.03, glow, 0, height - 0.48, -depth / 2 + 0.12));

  const col = 0.28;
  const colZ = frontStyle === "mobile" ? [-depth / 2 + 1.15] : [-depth / 2 + 1.15, depth / 2 - 1.35];
  const colX = [-width / 2 + 0.42, width / 2 - 0.42];
  for (const x of colX) {
    for (const z of colZ) {
      root.add(meshBox(col, height - 0.25, col, gypsum, x, (height - 0.12) / 2, z));
      root.add(meshBox(col + 0.08, 0.05, col + 0.08, brass, x, 0.08, z));
      root.add(meshBox(col + 0.1, 0.055, col + 0.1, brass, x, height - 0.22, z));
      root.add(meshBox(col + 0.02, 0.02, col + 0.02, glow, x, height - 0.255, z));
    }
  }

  root.add(meshBox(width * 0.42, 0.12, 0.38, gypsum, 0, 0.18, -depth / 2 + 0.42));
  root.add(meshBox(width * 0.42, 0.015, 0.4, brass, 0, 0.25, -depth / 2 + 0.42));

  if (!QUALITY.low) {
    const railY = Math.min(2.48, height * 0.52);
    root.add(meshBox(0.018, 0.022, depth - 1.1, brass, -width / 2 + 0.075, railY, 0));
    root.add(meshBox(0.018, 0.022, depth - 1.1, brass, width / 2 - 0.075, railY, 0));
    root.add(meshBox(width - 1.2, 0.022, 0.018, brass, 0, railY, -depth / 2 + 0.075));
    if (frontStyle !== "mobile") {
      root.add(meshBox(width - 0.2, 0.07, 0.09, champagne, 0, height - 0.075, depth / 2 - 0.055));
      root.add(meshBox(0.09, 0.07, depth - 0.2, champagne, -width / 2 + 0.055, height - 0.075, 0));
    }
    root.add(meshBox(width - 0.2, 0.07, 0.09, champagne, 0, height - 0.075, -depth / 2 + 0.055));
    root.add(meshBox(0.09, 0.07, depth - 0.2, champagne, width / 2 - 0.055, height - 0.075, 0));
  }
}

function tagRoof(mesh) {
  mesh.userData = { selectable: true, kind: "roof", id: "roof" };
  return mesh;
}

let iceDomeCached = null;
function iceDomeMap() {
  if (iceDomeCached) return iceDomeCached;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "#fffdf6");
  g.addColorStop(1, "#e8eef4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(120,150,170,0.38)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 36; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 47) % 256, (i * 19) % 256);
    ctx.lineTo((i * 91 + 40) % 256, (i * 63 + 80) % 256);
    ctx.stroke();
  }
  iceDomeCached = new THREE.CanvasTexture(c);
  iceDomeCached.colorSpace = THREE.SRGBColorSpace;
  iceDomeCached.needsUpdate = true;
  return iceDomeCached;
}

function addCeilingSpot(root, x, y, z, housing, lens) {
  const can = new THREE.Mesh(CAN_GEO, housing);
  can.position.set(x, y, z);
  can.castShadow = false;
  const glass = new THREE.Mesh(LENS_GEO, lens);
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(x, y - 0.03, z);
  root.add(tagRoof(can), tagRoof(glass));
}

function popScrollTex() {
  if (popScrollTex.cached) return popScrollTex.cached;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  const stroke = (color, width, fn) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    fn();
    ctx.stroke();
  };
  const spiral = (cx, cy, turns, r0, r1, spin) => {
    const n = 90;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = spin + t * Math.PI * 2 * turns;
      const r = r0 + (r1 - r0) * t;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  stroke("#5c1822", 7, () => {
    spiral(118, 128, 3.15, 8, 96, 0.4);
    spiral(168, 86, 2.1, 5, 38, 2.2);
    spiral(86, 178, 2.2, 5, 34, 4.1);
  });
  stroke("#8a2432", 3.2, () => {
    spiral(118, 128, 3.15, 8, 96, 0.4);
    spiral(168, 86, 2.1, 5, 38, 2.2);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  popScrollTex.cached = tex;
  return tex;
}

function makePopHole(hw, hd) {
  const p = new THREE.Path();
  const st = Math.min(0.48, hd * 0.12);
  p.moveTo(-hw, hd * 0.22);
  p.lineTo(-hw, -hd + st * 3.1);
  p.lineTo(-hw + st, -hd + st * 3.1);
  p.lineTo(-hw + st, -hd + st * 2.05);
  p.lineTo(-hw + st * 2.05, -hd + st * 2.05);
  p.lineTo(-hw + st * 2.05, -hd + st);
  p.lineTo(-hw + st * 3.25, -hd + st);
  p.lineTo(-hw + st * 3.25, -hd);
  p.lineTo(hw - st * 1.35, -hd);
  p.lineTo(hw - st * 1.35, -hd + st * 0.85);
  p.lineTo(hw, -hd + st * 0.85);
  p.lineTo(hw, hd * 0.78);
  p.bezierCurveTo(hw * 0.42, hd + 1.22, -hw * 0.18, hd + 0.42, -hw, hd * 0.22);
  p.closePath();
  return p;
}

function extrudedCeiling(shape, thick, y, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: !QUALITY.low,
    bevelThickness: 0.01,
    bevelSize: 0.011,
    bevelSegments: 1,
    curveSegments: QUALITY.low ? 12 : 28,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return tagRoof(mesh);
}

function addPopFalseCeiling(root, width, depth, height) {
  const gypsum = mappedMat("#f4f1ea", "drywall", {
    repeat: 3.2,
    roughness: 0.92,
    metalness: 0.012,
    env: 0.22,
    nStr: 0.28,
    nSc: 0.1,
    clearcoat: 0.04,
    ccr: 0.78,
  });
  gypsum.side = THREE.DoubleSide;
  const plaster = new THREE.MeshStandardMaterial({
    color: "#f7f4ee",
    roughness: 0.9,
    metalness: 0.015,
    envMapIntensity: 0.2,
    side: THREE.DoubleSide,
  });
  const trim = mappedMat("#2a201c", "walnut", {
    repeat: 2.8,
    repeatY: 0.35,
    roughness: 0.42,
    metalness: 0.06,
    env: 0.7,
    nStr: 0.7,
    nSc: 0.28,
  });
  const warmLed = new THREE.MeshStandardMaterial({
    color: "#fff4dc",
    emissive: "#ffc56a",
    emissiveIntensity: QUALITY.low ? 1.2 : 1.7,
  });
  const coolLens = new THREE.MeshStandardMaterial({
    color: "#f4f8ff",
    emissive: "#e8f1ff",
    emissiveIntensity: 1.55,
  });
  const housing = new THREE.MeshStandardMaterial({
    color: "#eee8de",
    metalness: 0.18,
    roughness: 0.4,
  });

  const ySlab = height - 0.045;
  const yDrop = height - 0.2;
  const yInner = height - 0.3;
  const slab = meshBox(width, 0.09, depth, gypsum, 0, ySlab, 0);
  slab.receiveShadow = true;
  root.add(tagRoof(slab));

  for (const step of [
    { inset: 0.08, t: 0.07, y: height - 0.08 },
    { inset: 0.16, t: 0.06, y: height - 0.13 },
  ]) {
    addFrameBand(root, width - step.inset * 2, depth - step.inset * 2, step.t, 0.055, step.y, plaster);
  }

  const frameW = width - 0.52;
  const frameD = depth - 0.52;
  addFrameBand(root, frameW, frameD, 0.085, 0.045, height - 0.155, trim);
  addLedLoop(root, frameW - 0.16, frameD - 0.16, height - 0.175, warmLed, 0.03);

  const panelW = width - 0.72;
  const panelD = depth - 0.72;
  const hw = Math.min(width * 0.31, 5.55);
  const hd = Math.min(depth * 0.3, 4.15);
  const field = new THREE.Shape();
  field.moveTo(-panelW / 2, -panelD / 2);
  field.lineTo(panelW / 2, -panelD / 2);
  field.lineTo(panelW / 2, panelD / 2);
  field.lineTo(-panelW / 2, panelD / 2);
  field.closePath();
  field.holes.push(makePopHole(hw, hd));
  root.add(extrudedCeiling(field, 0.075, yDrop, gypsum));
  addLedLoop(root, hw * 1.72, hd * 1.55, yDrop - 0.042, warmLed, 0.026);

  const wave = new THREE.CubicBezierCurve3(
    new THREE.Vector3(hw, yDrop - 0.04, hd * 0.78),
    new THREE.Vector3(hw * 0.42, yDrop - 0.04, hd + 1.22),
    new THREE.Vector3(-hw * 0.18, yDrop - 0.04, hd + 0.42),
    new THREE.Vector3(-hw, yDrop - 0.04, hd * 0.22)
  );
  const waveLed = new THREE.Mesh(new THREE.TubeGeometry(wave, QUALITY.low ? 12 : 24, 0.013, 6, false), warmLed);
  waveLed.castShadow = false;
  root.add(tagRoof(waveLed));

  const innerW = Math.min(5.05, width * 0.28);
  const innerD = Math.min(3.55, depth * 0.26);
  const holeZ = -0.45;
  const wellR = 0.7;
  const inner = new THREE.Shape();
  inner.moveTo(-innerW / 2, -innerD / 2);
  inner.lineTo(innerW / 2, -innerD / 2);
  inner.lineTo(innerW / 2, innerD / 2);
  inner.lineTo(-innerW / 2, innerD / 2);
  inner.closePath();
  const circ = new THREE.Path();
  circ.absarc(0, holeZ, wellR, 0, Math.PI * 2, true);
  inner.holes.push(circ);
  root.add(extrudedCeiling(inner, 0.055, yInner, gypsum));
  addFrameBand(root, innerW + 0.08, innerD + 0.08, 0.04, 0.028, yInner - 0.012, trim);
  addLedLoop(root, innerW - 0.12, innerD - 0.12, yInner - 0.036, warmLed, 0.022);

  const wellH = Math.max(0.12, ySlab - yInner + 0.02);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(wellR, wellR, wellH, QUALITY.low ? 18 : 32, 1, true), plaster);
  well.position.set(0, (ySlab + yInner) / 2, holeZ);
  well.castShadow = false;
  root.add(tagRoof(well));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(wellR + 0.02, 0.016, 8, QUALITY.low ? 18 : 28), trim);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(0, yInner - 0.01, holeZ);
  root.add(tagRoof(lip));
  const wellGlow = new THREE.Mesh(new THREE.TorusGeometry(wellR - 0.04, 0.012, 8, QUALITY.low ? 16 : 24), warmLed);
  wellGlow.rotation.x = Math.PI / 2;
  wellGlow.position.set(0, yInner + 0.02, holeZ);
  root.add(tagRoof(wellGlow));

  const slatW = 1.28;
  const slatX = innerW / 2 + 0.72;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -0.42 + i * 0.42;
      root.add(tagRoof(meshBox(slatW, 0.018, 0.042, trim, side * slatX, yDrop - 0.02, z)));
    }
  }

  const scroll = new THREE.MeshStandardMaterial({
    map: popScrollTex(),
    transparent: true,
    depthWrite: false,
    roughness: 0.55,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  for (const [x, z] of [
    [-innerW * 0.32, innerD * 0.28],
    [innerW * 0.32, -innerD * 0.28],
  ]) {
    const motif = new THREE.Mesh(new THREE.CircleGeometry(0.28, 22), scroll);
    motif.rotation.x = Math.PI / 2;
    motif.position.set(x, yInner - 0.004, z);
    root.add(tagRoof(motif));
  }

  const spots = [
    [-width * 0.42, depth * 0.4],
    [width * 0.42, depth * 0.4],
    [-width * 0.42, -depth * 0.4],
    [width * 0.42, -depth * 0.4],
    [-width * 0.42, 0.15],
    [width * 0.42, 0.15],
    [0, depth * 0.42],
    [0, -depth * 0.42],
    [-width * 0.22, depth * 0.38],
    [width * 0.22, depth * 0.38],
    [-width * 0.18, -depth * 0.4],
    [width * 0.18, -depth * 0.4],
  ];
  const spotY = yDrop - 0.055;
  for (const [x, z] of spots) addCeilingSpot(root, x, spotY, z, housing, coolLens);

  if (QUALITY.high) {
    const wash = new THREE.PointLight("#ffd089", 3.2, 12, 2);
    wash.position.set(0, height - 0.85, 0);
    wash.castShadow = false;
    root.add(wash);
  }
}

function addRippleCeiling(root, width, depth, height, _roofMat) {
  const gypsum = mappedMat("#f4f1ea", "drywall", {
    repeat: 2.4,
    roughness: 0.88,
    metalness: 0.015,
    env: 0.28,
    nStr: 0.32,
    nSc: 0.12,
  });
  const warmLed = new THREE.MeshStandardMaterial({
    color: "#fff6e8",
    emissive: "#ffd89a",
    emissiveIntensity: QUALITY.low ? 1.15 : 1.55,
  });
  const lens = new THREE.MeshStandardMaterial({
    color: "#fffaf0",
    emissive: "#ffe7b8",
    emissiveIntensity: 1.42,
  });
  const housing = new THREE.MeshStandardMaterial({
    color: "#eee8de",
    metalness: 0.16,
    roughness: 0.42,
  });
  const ice = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: iceDomeMap(),
    roughness: 0.12,
    metalness: 0.08,
    emissive: "#fff2d4",
    emissiveIntensity: 0.85,
    envMapIntensity: 1.15,
  });

  const yWell = height - 0.04;
  const yField = height - 0.112;
  const yDrop = height - 0.2;
  const yLip = height - 0.148;

  const sky = meshBox(width, 0.07, depth, gypsum, 0, yWell, 0);
  sky.receiveShadow = true;
  tagRoof(sky);
  root.add(sky);

  for (const step of [
    { inset: 0.07, th: 0.08, y: height - 0.07, t: 0.08 },
    { inset: 0.14, th: 0.07, y: height - 0.12, t: 0.07 },
    { inset: 0.2, th: 0.055, y: height - 0.16, t: 0.06 },
  ]) {
    root.add(tagRoof(meshBox(width - step.inset * 2, step.th, step.t, gypsum, 0, step.y, depth / 2 - step.inset)));
    root.add(tagRoof(meshBox(width - step.inset * 2, step.th, step.t, gypsum, 0, step.y, -depth / 2 + step.inset)));
    root.add(tagRoof(meshBox(step.t, step.th, depth - step.inset * 2, gypsum, -width / 2 + step.inset, step.y, 0)));
    root.add(tagRoof(meshBox(step.t, step.th, depth - step.inset * 2, gypsum, width / 2 - step.inset, step.y, 0)));
  }

  const fw = 0.7;
  const frameInset = 0.22;
  root.add(tagRoof(meshBox(width - frameInset * 2, 0.09, fw, gypsum, 0, yDrop, depth / 2 - fw / 2 - frameInset)));
  root.add(tagRoof(meshBox(width - frameInset * 2, 0.09, fw, gypsum, 0, yDrop, -depth / 2 + fw / 2 + frameInset)));
  root.add(tagRoof(meshBox(fw, 0.09, depth - frameInset * 2, gypsum, -width / 2 + fw / 2 + frameInset, yDrop, 0)));
  root.add(tagRoof(meshBox(fw, 0.09, depth - frameInset * 2, gypsum, width / 2 - fw / 2 - frameInset, yDrop, 0)));

  const innerW = width - fw * 2 - 0.55;
  const innerD = depth - fw * 2 - 0.55;
  const wellW = Math.min(width * 0.3, 3.35);
  const wellD = Math.min(depth * 0.52, 6.1);
  const hx = wellW / 2;
  const hz = wellD / 2;
  const slotW = 0.26;
  const slotD = wellD * 0.62;
  const slotX = hx + 0.58;

  const addField = (w, d, x, z) => {
    if (w < 0.08 || d < 0.08) return;
    const m = meshBox(w, 0.065, d, gypsum, x, yField, z);
    m.receiveShadow = true;
    root.add(tagRoof(m));
  };

  const frontBand = innerD / 2 - hz;
  addField(innerW, frontBand, 0, hz + frontBand / 2);
  addField(innerW, frontBand, 0, -hz - frontBand / 2);

  const sideSpan = wellD;
  const left = -innerW / 2;
  const wellL = -hx;
  const wellR = hx;
  const right = innerW / 2;
  const slotL = -slotX - slotW / 2;
  const slotR = -slotX + slotW / 2;
  const slotL2 = slotX - slotW / 2;
  const slotR2 = slotX + slotW / 2;
  const slotHz = slotD / 2;

  addField(slotL - left, sideSpan, (left + slotL) / 2, 0);
  addField(wellL - slotR, sideSpan, (slotR + wellL) / 2, 0);
  addField(slotL2 - wellR, sideSpan, (wellR + slotL2) / 2, 0);
  addField(right - slotR2, sideSpan, (slotR2 + right) / 2, 0);
  addField(slotW + 0.04, (sideSpan - slotD) / 2, -slotX, slotHz + (sideSpan - slotD) / 4);
  addField(slotW + 0.04, (sideSpan - slotD) / 2, -slotX, -slotHz - (sideSpan - slotD) / 4);
  addField(slotW + 0.04, (sideSpan - slotD) / 2, slotX, slotHz + (sideSpan - slotD) / 4);
  addField(slotW + 0.04, (sideSpan - slotD) / 2, slotX, -slotHz - (sideSpan - slotD) / 4);

  const lip = 0.11;
  const straight = Math.max(0.4, wellD - wellW);
  root.add(tagRoof(meshBox(lip, 0.055, straight, gypsum, -hx, yLip, 0)));
  root.add(tagRoof(meshBox(lip, 0.055, straight, gypsum, hx, yLip, 0)));
  root.add(tagRoof(meshBox(wellW * 0.72, 0.055, lip, gypsum, 0, yLip, -hz + hx * 0.15)));
  root.add(tagRoof(meshBox(wellW * 0.72, 0.055, lip, gypsum, 0, yLip, hz - hx * 0.15)));

  if (!QUALITY.low) {
    for (const z of [-hz + hx * 0.15, hz - hx * 0.15]) {
      const cap = new THREE.Mesh(new THREE.TorusGeometry(hx * 0.92, 0.045, 8, 20, Math.PI), gypsum);
      cap.rotation.x = Math.PI / 2;
      cap.rotation.z = z > 0 ? 0 : Math.PI;
      cap.position.set(0, yLip, z);
      cap.castShadow = false;
      root.add(tagRoof(cap));
    }
  }

  const coveY = yLip - 0.028;
  root.add(tagRoof(meshBox(0.03, 0.016, straight * 0.96, warmLed, -hx + 0.07, coveY, 0)));
  root.add(tagRoof(meshBox(0.03, 0.016, straight * 0.96, warmLed, hx - 0.07, coveY, 0)));
  root.add(tagRoof(meshBox(wellW * 0.62, 0.016, 0.03, warmLed, 0, coveY, -hz + hx * 0.28)));
  root.add(tagRoof(meshBox(wellW * 0.62, 0.016, 0.03, warmLed, 0, coveY, hz - hx * 0.28)));

  for (const x of [-slotX, slotX]) {
    root.add(tagRoof(meshBox(slotW + 0.1, 0.05, 0.08, gypsum, x, yLip, slotHz)));
    root.add(tagRoof(meshBox(slotW + 0.1, 0.05, 0.08, gypsum, x, yLip, -slotHz)));
    root.add(tagRoof(meshBox(0.08, 0.05, slotD, gypsum, x - slotW / 2, yLip, 0)));
    root.add(tagRoof(meshBox(0.08, 0.05, slotD, gypsum, x + slotW / 2, yLip, 0)));
    root.add(tagRoof(meshBox(slotW * 0.7, 0.014, 0.025, warmLed, x, coveY, slotHz - 0.04)));
    root.add(tagRoof(meshBox(slotW * 0.7, 0.014, 0.025, warmLed, x, coveY, -slotHz + 0.04)));
    root.add(tagRoof(meshBox(0.022, 0.014, slotD * 0.86, warmLed, x - slotW / 2 + 0.04, coveY, 0)));
    root.add(tagRoof(meshBox(0.022, 0.014, slotD * 0.86, warmLed, x + slotW / 2 - 0.04, coveY, 0)));
  }

  const innerLed = width - fw * 2 - 0.7;
  const innerLedD = depth - fw * 2 - 0.7;
  root.add(tagRoof(meshBox(innerLed, 0.014, 0.035, warmLed, 0, yDrop - 0.04, depth / 2 - fw - 0.12)));
  root.add(tagRoof(meshBox(innerLed, 0.014, 0.035, warmLed, 0, yDrop - 0.04, -depth / 2 + fw + 0.12)));
  root.add(tagRoof(meshBox(0.035, 0.014, innerLedD, warmLed, -width / 2 + fw + 0.12, yDrop - 0.04, 0)));
  root.add(tagRoof(meshBox(0.035, 0.014, innerLedD, warmLed, width / 2 - fw - 0.12, yDrop - 0.04, 0)));

  const fx = width / 2 - fw / 2 - frameInset;
  const fz = depth / 2 - fw / 2 - frameInset;
  const spotY = yDrop - 0.06;
  const frameSpots = [
    [fx, fz],
    [-fx, fz],
    [fx, -fz],
    [-fx, -fz],
    [0, fz],
    [0, -fz],
    [fx, 0],
    [-fx, 0],
  ];
  for (const [x, z] of frameSpots) addCeilingSpot(root, x, spotY, z, housing, lens);
  addCeilingSpot(root, 0, yWell - 0.02, wellD * 0.22, housing, lens);
  addCeilingSpot(root, 0, yWell - 0.02, -wellD * 0.22, housing, lens);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 28), housing);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, yWell - 0.02, 0);
  root.add(tagRoof(ring));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, QUALITY.low ? 12 : 22, QUALITY.low ? 8 : 14, 0, Math.PI * 2, 0, Math.PI * 0.58), ice);
  dome.position.set(0, yWell - 0.04, 0);
  dome.castShadow = false;
  root.add(tagRoof(dome));

  if (QUALITY.high) {
    const fill = new THREE.PointLight("#ffd89a", 2.8, 10, 2);
    fill.position.set(0, height - 0.72, 0);
    fill.castShadow = false;
    root.add(fill);
  }
}

function addLedLoop(root, w, d, y, led, t = 0.028) {
  root.add(tagRoof(meshBox(w, 0.012, t, led, 0, y, d / 2)));
  root.add(tagRoof(meshBox(w, 0.012, t, led, 0, y, -d / 2)));
  root.add(tagRoof(meshBox(t, 0.012, d, led, w / 2, y, 0)));
  root.add(tagRoof(meshBox(t, 0.012, d, led, -w / 2, y, 0)));
}

function addFrameBand(root, w, d, band, h, y, mat) {
  root.add(tagRoof(meshBox(w, h, band, mat, 0, y, d / 2 - band / 2)));
  root.add(tagRoof(meshBox(w, h, band, mat, 0, y, -d / 2 + band / 2)));
  root.add(tagRoof(meshBox(band, h, Math.max(0.05, d - band * 2), mat, -w / 2 + band / 2, y, 0)));
  root.add(tagRoof(meshBox(band, h, Math.max(0.05, d - band * 2), mat, w / 2 - band / 2, y, 0)));
}

function addIBeam(root, length, x, y, z, alongX, mat) {
  if (alongX) {
    root.add(tagRoof(meshBox(length, 0.02, 0.18, mat, x, y, z)));
    root.add(tagRoof(meshBox(length, 0.14, 0.045, mat, x, y - 0.08, z)));
    root.add(tagRoof(meshBox(length, 0.02, 0.18, mat, x, y - 0.16, z)));
  } else {
    root.add(tagRoof(meshBox(0.18, 0.02, length, mat, x, y, z)));
    root.add(tagRoof(meshBox(0.045, 0.14, length, mat, x, y - 0.08, z)));
    root.add(tagRoof(meshBox(0.18, 0.02, length, mat, x, y - 0.16, z)));
  }
}

function addPinterestCeiling(root, kind, width, depth, height, mats) {
  const { cream, brass, glow, housing, led, walnut, oak, dark, chrome, champagne, trayIvory } = mats;
  const yDrop = height - 0.22;
  const yLip = height - 0.26;

  if (kind === "roof-nested") {
    const layers = QUALITY.low ? [1.15, 2.35] : [1.05, 2.05, 3.15];
    layers.forEach((inset, i) => {
      const w = Math.max(1.2, width - inset);
      const d = Math.max(1.2, depth - inset);
      addFrameBand(root, w, d, 0.14, 0.07, yDrop - i * 0.045, cream);
      addLedLoop(root, w - 0.22, d - 0.22, yLip - i * 0.045, led);
    });
    addDownlights(root, width, depth, height, 3, 3, 1.2, (width - 2.4) / 3, (depth - 2.4) / 3, housing, glow);
    return true;
  }

  if (kind === "roof-circles") {
    const rings = QUALITY.low ? [1.15, 2.05] : [0.85, 1.55, 2.35];
    rings.forEach((r, i) => {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 8, QUALITY.low ? 24 : 36), cream);
      torus.rotation.x = Math.PI / 2;
      torus.position.set(0, yDrop - i * 0.03, 0);
      root.add(tagRoof(torus));
      const strip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 6, QUALITY.low ? 20 : 32), led);
      strip.rotation.x = Math.PI / 2;
      strip.position.set(0, yLip - i * 0.03, 0);
      root.add(tagRoof(strip));
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 28), cream);
    disc.position.set(0, height - 0.14, 0);
    root.add(tagRoof(disc));
    addCeilingSpot(root, 0, height - 0.16, 0, housing, glow);
    return true;
  }

  if (kind === "roof-plus") {
    const armW = Math.min(width * 0.22, 2.4);
    const armD = Math.min(depth * 0.22, 2.4);
    root.add(tagRoof(meshBox(width - 1.4, 0.08, armD, cream, 0, yDrop, 0)));
    root.add(tagRoof(meshBox(armW, 0.08, depth - 1.4, cream, 0, yDrop, 0)));
    addLedLoop(root, width - 1.7, armD - 0.16, yLip, led);
    addLedLoop(root, armW - 0.16, depth - 1.7, yLip, led);
    addDownlights(root, width, depth, height, 3, 3, 1.15, (width - 2.3) / 3, (depth - 2.3) / 3, housing, glow);
    return true;
  }

  if (kind === "roof-island") {
    const iw = width - 2.2;
    const idp = depth - 2.2;
    root.add(tagRoof(meshBox(iw, 0.09, idp, cream, 0, yDrop, 0)));
    root.add(tagRoof(meshBox(iw + 0.08, 0.016, idp + 0.08, brass, 0, yLip + 0.02, 0)));
    addLedLoop(root, iw - 0.12, idp - 0.12, yLip, led);
    addDownlights(root, width, depth, height, 3, 2, 1.4, (width - 2.8) / 3, (depth - 2.8) / 2, housing, glow);
    return true;
  }

  if (kind === "roof-hex") {
    const r = QUALITY.low ? 0.62 : QUALITY.mid ? 0.5 : 0.42;
    const hexGeo = new THREE.CylinderGeometry(r, r, 0.045, 6);
    const hexRimGeo = new THREE.TorusGeometry(r * 0.86, 0.012, 6, 6);
    const gapX = r * 1.78;
    const gapZ = r * 1.55;
    const cols = Math.max(3, Math.floor((width - 1.6) / gapX));
    const rows = Math.max(2, Math.floor((depth - 1.6) / gapZ));
    const originX = -((cols - 1) * gapX) / 2;
    const originZ = -((rows - 1) * gapZ) / 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = originX + i * gapX + (j % 2 ? gapX * 0.5 : 0);
        const z = originZ + j * gapZ;
        if (Math.abs(x) > width / 2 - 0.9 || Math.abs(z) > depth / 2 - 0.9) continue;
        const cell = new THREE.Mesh(hexGeo, cream);
        cell.position.set(x, height - 0.16, z);
        root.add(tagRoof(cell));
        const rim = new THREE.Mesh(hexRimGeo, led);
        rim.rotation.x = Math.PI / 2;
        rim.rotation.z = Math.PI / 6;
        rim.position.set(x, height - 0.19, z);
        root.add(tagRoof(rim));
      }
    }
    return true;
  }

  if (kind === "roof-stars") {
    const n = QUALITY.low ? 20 : QUALITY.mid ? 36 : 56;
    const starGeo = new THREE.SphereGeometry(0.018, 6, 5);
    const starMat = new THREE.MeshStandardMaterial({
      color: "#fff6e0",
      emissive: "#ffe7b0",
      emissiveIntensity: 1.6,
    });
    const stars = new THREE.InstancedMesh(starGeo, starMat, n);
    for (let i = 0; i < n; i++) {
      const x = (hash01(i * 13.1) - 0.5) * (width - 0.8);
      const z = (hash01(i * 27.7) - 0.5) * (depth - 0.8);
      instDummy.position.set(x, height - 0.12, z);
      const sc = 0.6 + hash01(i * 5.3) * 1.4;
      instDummy.scale.set(sc, sc, sc);
      instDummy.rotation.set(0, 0, 0);
      instDummy.updateMatrix();
      stars.setMatrixAt(i, instDummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true;
    root.add(tagRoof(stars));
    return true;
  }

  if (kind === "roof-industrial") {
    const count = QUALITY.low ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const z = -depth / 2 + 0.9 + (i / Math.max(1, count - 1)) * (depth - 1.8);
      addIBeam(root, width - 0.7, 0, height - 0.18, z, true, dark);
    }
    addDownlights(root, width, depth, height, 4, count, 1.1, (width - 2.2) / 4, (depth - 2.2) / count, dark, glow);
    return true;
  }

  if (kind === "roof-skylight") {
    const cols = 2;
    const rows = QUALITY.low ? 2 : 3;
    const pad = 1.15;
    const cellW = (width - pad * 2) / cols;
    const cellD = (depth - pad * 2) / rows;
    const sky = new THREE.MeshStandardMaterial({
      color: "#e8f2fa",
      emissive: "#c8e0f0",
      emissiveIntensity: 0.85,
      roughness: 0.18,
    });
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -width / 2 + pad + (i + 0.5) * cellW;
        const z = -depth / 2 + pad + (j + 0.5) * cellD;
        root.add(tagRoof(meshBox(cellW - 0.16, 0.02, cellD - 0.16, sky, x, height - 0.11, z)));
        addFrameBand(root, cellW - 0.08, cellD - 0.08, 0.05, 0.04, height - 0.14, chrome);
      }
    }
    return true;
  }

  if (kind === "roof-combo") {
    addFrameBand(root, width - 0.3, depth - 0.3, 0.72, 0.08, yDrop, oak);
    root.add(tagRoof(meshBox(width - 2.0, 0.06, depth - 2.0, cream, 0, height - 0.16, 0)));
    addLedLoop(root, width - 2.15, depth - 2.15, yLip, led);
    addDownlights(root, width, depth, height, 3, 2, 1.3, (width - 2.6) / 3, (depth - 2.6) / 2, housing, glow);
    return true;
  }

  if (kind === "roof-shiplap") {
    addCeilingSlats(root, width, depth, height, cream, Math.round(width * 2.6), 0.07, 0.035, null);
    addDownlights(root, width, depth, height, 3, 3, 1.3, (width - 2.6) / 3, (depth - 2.6) / 3, housing, glow);
    return true;
  }

  if (kind === "roof-tin") {
    const g = addCofferGrid(root, width, depth, height, champagne, cream, 0.04, 0.05, { profile: "flat" });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow);
    return true;
  }

  if (kind === "roof-rings") {
    const radii = QUALITY.low ? [1.05, 1.85] : [0.85, 1.55, 2.35];
    radii.forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, QUALITY.low ? 24 : 36), housing);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, height - 0.28 - i * 0.06, 0);
      root.add(tagRoof(ring));
      const glowRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 6, QUALITY.low ? 20 : 32), led);
      glowRing.rotation.x = Math.PI / 2;
      glowRing.position.set(0, height - 0.3 - i * 0.06, 0);
      root.add(tagRoof(glowRing));
    });
    addCeilingSpot(root, 0, height - 0.16, 0, housing, glow);
    return true;
  }

  if (kind === "roof-slots") {
    const n = QUALITY.low ? 4 : 6;
    const span = width - 1.6;
    for (let i = 0; i < n; i++) {
      const x = -span / 2 + ((i + 0.5) / n) * span;
      root.add(tagRoof(meshBox(0.09, 0.05, depth - 1.3, cream, x, yDrop, 0)));
      root.add(tagRoof(meshBox(0.03, 0.016, depth - 1.5, led, x, yLip, 0)));
    }
    return true;
  }

  if (kind === "roof-waffle") {
    const concrete = new THREE.MeshStandardMaterial({ color: "#9a9690", roughness: 0.72, metalness: 0.04 });
    const g = addCofferGrid(root, width, depth, height, concrete, null, 0.12, 0.16, { profile: "flat" });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow);
    return true;
  }

  if (kind === "roof-border") {
    addFrameBand(root, width - 0.25, depth - 0.25, 0.85, 0.1, yDrop, dark);
    root.add(tagRoof(meshBox(width - 2.1, 0.05, depth - 2.1, cream, 0, height - 0.16, 0)));
    addLedLoop(root, width - 2.2, depth - 2.2, yLip, led);
    addDownlights(root, width, depth, height, 3, 2, 1.35, (width - 2.7) / 3, (depth - 2.7) / 2, housing, glow);
    return true;
  }

  if (kind === "roof-dome") {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(Math.min(1.15, width * 0.16), QUALITY.low ? 12 : 22, QUALITY.low ? 8 : 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      trayIvory
    );
    dome.position.set(0, height - 0.08, 0);
    root.add(tagRoof(dome));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(1.22, width * 0.17), 0.04, 8, 28), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, height - 0.16, 0);
    root.add(tagRoof(ring));
    addLedLoop(root, width - 1.6, depth - 1.6, yLip, led);
    addDownlights(root, width, depth, height, 3, 3, 1.25, (width - 2.5) / 3, (depth - 2.5) / 3, housing, glow);
    return true;
  }

  if (kind === "roof-vault") {
    const ribs = QUALITY.low ? 5 : 7;
    for (let i = 0; i < ribs; i++) {
      const t = i / (ribs - 1);
      const x = -width / 2 + 0.55 + t * (width - 1.1);
      const drop = 0.04 + Math.sin(t * Math.PI) * 0.16;
      root.add(tagRoof(meshBox(0.1, 0.08 + drop, depth - 0.8, cream, x, height - 0.14 - drop * 0.4, 0)));
    }
    addDownlights(root, width, depth, height, ribs, 2, 0.7, (width - 1.4) / ribs, (depth - 1.4) / 2, housing, glow);
    return true;
  }

  if (kind === "roof-jaali") {
    const step = QUALITY.low ? 0.62 : QUALITY.mid ? 0.48 : 0.38;
    const inset = 0.7;
    for (let x = -width / 2 + inset; x <= width / 2 - inset; x += step) {
      root.add(tagRoof(meshBox(0.03, 0.04, depth - inset * 2, cream, x, height - 0.16, 0)));
    }
    for (let z = -depth / 2 + inset; z <= depth / 2 - inset; z += step) {
      root.add(tagRoof(meshBox(width - inset * 2, 0.04, 0.03, cream, 0, height - 0.18, z)));
    }
    addLedLoop(root, width - 1.5, depth - 1.5, yLip, led);
    return true;
  }

  if (kind === "roof-rattan") {
    addCeilingSlats(root, width, depth, height, oak, Math.round(width * 2.1), 0.045, 0.05, null);
    const cross = QUALITY.low ? 6 : 10;
    for (let i = 0; i < cross; i++) {
      const z = -depth / 2 + 0.45 + ((i + 0.5) / cross) * (depth - 0.9);
      root.add(tagRoof(meshBox(width - 0.8, 0.02, 0.03, oak, 0, height - 0.2, z)));
    }
    addDownlights(root, width, depth, height, 3, 2, 1.3, (width - 2.6) / 3, (depth - 2.6) / 2, housing, glow);
    return true;
  }

  if (kind === "roof-mirror") {
    const mirror = new THREE.MeshStandardMaterial({
      color: "#d8dee4",
      metalness: 0.86,
      roughness: 0.08,
      envMapIntensity: 1.4,
    });
    root.add(tagRoof(meshBox(width - 0.9, 0.02, depth - 0.9, mirror, 0, height - 0.14, 0)));
    addFrameBand(root, width - 0.7, depth - 0.7, 0.08, 0.04, height - 0.16, chrome);
    addDownlights(root, width, depth, height, 3, 3, 1.4, (width - 2.8) / 3, (depth - 2.8) / 3, chrome, glow);
    return true;
  }

  if (kind === "roof-wave") {
    const n = QUALITY.low ? 7 : 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = -width / 2 + 0.5 + t * (width - 1);
      const wave = Math.sin(t * Math.PI * 2) * 0.07;
      root.add(tagRoof(meshBox(0.16, 0.07, depth - 0.9, cream, x, height - 0.18 + wave, 0)));
    }
    addLedLoop(root, width - 1.4, depth - 1.4, yLip, led);
    return true;
  }

  if (kind === "roof-diamond") {
    const size = 1.15;
    const step = 1.55;
    const cols = Math.max(2, Math.floor((width - 1.8) / step));
    const rows = Math.max(2, Math.floor((depth - 1.8) / step));
    const ox = -((cols - 1) * step) / 2;
    const oz = -((rows - 1) * step) / 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const box = meshBox(size, 0.05, size, cream, ox + i * step, height - 0.16, oz + j * step);
        box.rotation.y = Math.PI / 4;
        root.add(tagRoof(box));
        const inner = meshBox(size - 0.22, 0.02, size - 0.22, led, ox + i * step, height - 0.19, oz + j * step);
        inner.rotation.y = Math.PI / 4;
        root.add(tagRoof(inner));
      }
    }
    return true;
  }

  if (kind === "roof-board") {
    addCeilingSlats(root, width, depth, height, cream, Math.max(5, Math.round(width / 1.15)), 0.22, 0.04, null);
    addCeilingSlats(root, width, depth, height, cream, Math.max(6, Math.round(width / 1.15) + 1), 0.035, 0.07, null);
    addDownlights(root, width, depth, height, 3, 3, 1.3, (width - 2.6) / 3, (depth - 2.6) / 3, housing, glow);
    return true;
  }

  if (kind === "roof-double") {
    root.add(tagRoof(meshBox(width - 1.15, 0.07, depth - 1.15, cream, 0, height - 0.18, 0)));
    root.add(tagRoof(meshBox(width - 2.15, 0.07, depth - 2.15, cream, 0, yDrop, 0)));
    addLedLoop(root, width - 1.35, depth - 1.35, height - 0.22, led);
    addLedLoop(root, width - 2.35, depth - 2.35, yLip, led);
    addDownlights(root, width, depth, height, 3, 3, 1.2, (width - 2.4) / 3, (depth - 2.4) / 3, housing, glow);
    return true;
  }

  if (kind === "roof-cloud") {
    const blobs = [
      [0, 0, 1.7, 1.25],
      [-1.15, 0.35, 1.05, 0.85],
      [1.2, -0.25, 1.1, 0.9],
      [0.15, 0.85, 0.95, 0.75],
    ];
    for (const [x, z, w, d] of blobs) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.5, Math.min(w, d) * 0.5, 0.07, QUALITY.low ? 12 : 20), cream);
      cyl.position.set(x, yDrop, z);
      root.add(tagRoof(cyl));
    }
    addLedLoop(root, 3.4, 2.6, yLip, led);
    addCeilingSpot(root, 0, height - 0.16, 0, housing, glow);
    return true;
  }

  return false;
}

function hash01(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function addCoveLights(root, width, depth, height, cream, brass, led, theme = "cream") {
  const dark = theme === "dark";
  const fascia = dark
    ? new THREE.MeshStandardMaterial({ color: "#1a1816", roughness: 0.58, metalness: 0.08, envMapIntensity: 0.42 })
    : cream;
  const coveY = height - 0.2;
  const bright = led.clone();
  bright.emissiveIntensity = Math.max(led.emissiveIntensity || 0.6, dark ? 1.62 : 1.18);
  if (dark) {
    bright.color.set("#ffe8c4");
    bright.emissive.set("#ffd089");
  }
  root.add(meshBox(width, 0.12, 0.16, fascia, 0, coveY, depth / 2 - 0.08));
  root.add(meshBox(width, 0.12, 0.16, fascia, 0, coveY, -depth / 2 + 0.08));
  root.add(meshBox(0.16, 0.12, depth, fascia, -width / 2 + 0.08, coveY, 0));
  root.add(meshBox(0.16, 0.12, depth, fascia, width / 2 - 0.08, coveY, 0));
  root.add(meshBox(width - 0.28, 0.02, 0.035, brass, 0, height - 0.265, depth / 2 - 0.16));
  root.add(meshBox(width - 0.28, 0.02, 0.035, brass, 0, height - 0.265, -depth / 2 + 0.16));
  root.add(meshBox(0.035, 0.02, depth - 0.28, brass, -width / 2 + 0.16, height - 0.265, 0));
  root.add(meshBox(0.035, 0.02, depth - 0.28, brass, width / 2 - 0.16, height - 0.265, 0));
  root.add(meshBox(width - 0.4, 0.018, 0.05, bright, 0, height - 0.27, depth / 2 - 0.2));
  root.add(meshBox(width - 0.4, 0.018, 0.05, bright, 0, height - 0.27, -depth / 2 + 0.2));
  root.add(meshBox(0.05, 0.018, depth - 0.4, bright, -width / 2 + 0.2, height - 0.27, 0));
  root.add(meshBox(0.05, 0.018, depth - 0.4, bright, width / 2 - 0.2, height - 0.27, 0));
}

function addMoldedBeam(root, spec) {
  const { along, pos, length, yTop, beamW, beamH, beamMat, trimMat } = spec;
  const alongX = along === "x";
  const stack = [
    { w: beamW * 2.2, h: 0.024, mat: beamMat },
    { w: beamW * 1.62, h: 0.03, mat: beamMat },
    { w: beamW * 1.08, h: Math.max(0.05, beamH * 0.52), mat: beamMat },
    { w: beamW * 1.38, h: 0.012, mat: trimMat || beamMat },
    { w: beamW * 0.58, h: 0.016, mat: trimMat || beamMat },
  ];
  let y = yTop;
  for (const step of stack) {
    y -= step.h / 2;
    const mesh = alongX
      ? meshBox(length, step.h, step.w, step.mat, 0, y, pos)
      : meshBox(step.w, step.h, length, step.mat, pos, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    y -= step.h / 2;
  }
}

function addCofferGrid(root, width, depth, height, beamMat, trimMat, beamW = 0.09, beamH = 0.11, opts = {}) {
  const fancy = opts.profile !== "flat" && !QUALITY.low;
  const cols = Math.min(5, Math.max(3, Math.round(width / 3.2)));
  const rows = Math.min(4, Math.max(3, Math.round(depth / 3.2)));
  const pad = 0.42;
  const cellW = (width - pad * 2) / cols;
  const cellD = (depth - pad * 2) / rows;
  const beamY = height - 0.145;
  const yTop = height - 0.118;
  const spanZ = depth - pad * 2 + beamW;
  const spanX = width - pad * 2 + beamW;

  if (!fancy) {
    for (let i = 0; i <= cols; i++) {
      const x = -width / 2 + pad + i * cellW;
      root.add(meshBox(beamW, beamH, spanZ, beamMat, x, beamY, 0));
      if (trimMat) root.add(meshBox(beamW + 0.02, 0.016, spanZ, trimMat, x, beamY - beamH / 2 - 0.006, 0));
    }
    for (let j = 0; j <= rows; j++) {
      const z = -depth / 2 + pad + j * cellD;
      root.add(meshBox(spanX, beamH, beamW, beamMat, 0, beamY, z));
      if (trimMat) root.add(meshBox(spanX, 0.016, beamW + 0.02, trimMat, 0, beamY - beamH / 2 - 0.006, z));
    }
    return { cols, rows, pad, cellW, cellD };
  }

  for (let i = 0; i <= cols; i++) {
    addMoldedBeam(root, {
      along: "z",
      pos: -width / 2 + pad + i * cellW,
      length: spanZ,
      yTop,
      beamW,
      beamH,
      beamMat,
      trimMat,
    });
  }
  for (let j = 0; j <= rows; j++) {
    addMoldedBeam(root, {
      along: "x",
      pos: -depth / 2 + pad + j * cellD,
      length: spanX,
      yTop,
      beamW,
      beamH,
      beamMat,
      trimMat,
    });
  }

  const trayMat = opts.trayMat;
  const liner = trimMat;
  if (trayMat) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -width / 2 + pad + (i + 0.5) * cellW;
        const z = -depth / 2 + pad + (j + 0.5) * cellD;
        const tw = cellW - beamW * 2.15;
        const td = cellD - beamW * 2.15;
        const tray = meshBox(tw, 0.028, td, trayMat, x, height - 0.122, z);
        tray.receiveShadow = true;
        root.add(tray);
        const inner = meshBox(tw - 0.14, 0.018, td - 0.14, trayMat, x, height - 0.138, z);
        inner.receiveShadow = true;
        root.add(inner);
        if (liner) {
          const ly = height - 0.148;
          root.add(meshBox(tw - 0.1, 0.01, 0.014, liner, x, ly, z + (td - 0.14) / 2));
          root.add(meshBox(tw - 0.1, 0.01, 0.014, liner, x, ly, z - (td - 0.14) / 2));
          root.add(meshBox(0.014, 0.01, td - 0.1, liner, x + (tw - 0.14) / 2, ly, z));
          root.add(meshBox(0.014, 0.01, td - 0.1, liner, x - (tw - 0.14) / 2, ly, z));
        }
      }
    }
  }

  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      const x = -width / 2 + pad + i * cellW;
      const z = -depth / 2 + pad + j * cellD;
      const cap = meshBox(beamW * 2.35, 0.036, beamW * 2.35, beamMat, x, height - 0.155, z);
      cap.castShadow = true;
      root.add(cap);
      if (trimMat) {
        root.add(meshBox(beamW * 1.55, 0.012, beamW * 1.55, trimMat, x, height - 0.176, z));
        root.add(meshBox(beamW * 0.42, 0.02, beamW * 0.42, trimMat, x, height - 0.19, z));
      }
    }
  }

  return { cols, rows, pad, cellW, cellD };
}

function addCeilingSlats(root, width, depth, height, mat, count, slatW, slatH, led) {
  if (QUALITY.low) count = Math.min(count, 8);
  const inset = 0.35;
  const span = width - inset * 2;
  const slats = new THREE.InstancedMesh(UNIT_BOX, mat, count);
  slats.castShadow = false;
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + inset + ((i + 0.5) / count) * span;
    instDummy.position.set(x, height - 0.16, 0);
    instDummy.scale.set(slatW, slatH, depth - 0.55);
    instDummy.rotation.set(0, 0, 0);
    instDummy.updateMatrix();
    slats.setMatrixAt(i, instDummy.matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  root.add(slats);
  if (led) {
    for (let i = 1; i < count; i += 3) {
      const x = -width / 2 + inset + (i / count) * span;
      root.add(meshBox(0.012, 0.01, depth - 0.7, led, x, height - 0.22, 0));
    }
  }
}

function addCeilingWashLights(root, width, depth, height, cols, rows, pad, cellW, cellD) {
  const picks = [
    [Math.floor(cols / 2), Math.floor(rows / 2)],
    [Math.max(0, Math.floor(cols / 2) - 1), Math.floor(rows / 2)],
    [Math.min(cols - 1, Math.floor(cols / 2) + 1), Math.floor(rows / 2)],
    [Math.floor(cols / 2), Math.max(0, Math.floor(rows / 2) - 1)],
  ];
  const seen = new Set();
  for (const [i, j] of picks) {
    const key = `${i}:${j}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const x = -width / 2 + pad + (i + 0.5) * cellW;
    const z = -depth / 2 + pad + (j + 0.5) * cellD;
    const spot = new THREE.SpotLight("#ffe6b8", QUALITY.high ? 14 : 8, 8.5, 0.52, 0.58, 1.55);
    spot.position.set(x, height - 0.22, z);
    spot.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(x, 0.15, z);
    root.add(target);
    spot.target = target;
    root.add(spot);
  }
}

function addDownlights(root, width, depth, height, cols, rows, pad, cellW, cellD, housing, glow, opts = {}) {
  const count = cols * rows;
  const luxury = opts.luxury !== false && !QUALITY.low;

  if (!luxury) {
    const cans = new THREE.InstancedMesh(CAN_GEO, housing, count);
    const lenses = new THREE.InstancedMesh(LENS_GEO, glow, count);
    let n = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -width / 2 + pad + (i + 0.5) * cellW;
        const z = -depth / 2 + pad + (j + 0.5) * cellD;
        instDummy.position.set(x, height - 0.118, z);
        instDummy.scale.set(1, 1, 1);
        instDummy.rotation.set(0, 0, 0);
        instDummy.updateMatrix();
        cans.setMatrixAt(n, instDummy.matrix);
        instDummy.position.set(x, height - 0.145, z);
        instDummy.rotation.set(Math.PI / 2, 0, 0);
        instDummy.updateMatrix();
        lenses.setMatrixAt(n, instDummy.matrix);
        n += 1;
      }
    }
    cans.instanceMatrix.needsUpdate = true;
    lenses.instanceMatrix.needsUpdate = true;
    root.add(cans, lenses);
    return;
  }

  const wellMat =
    opts.wellMat ||
    new THREE.MeshStandardMaterial({
      color: "#1c1a18",
      metalness: 0.46,
      roughness: 0.36,
    });
  const baffleMat = new THREE.MeshStandardMaterial({
    color: "#080808",
    roughness: 0.94,
    metalness: 0.04,
  });
  const ringMat = opts.ringMat || housing;
  const lensMat = glow.clone();
  lensMat.emissive = new THREE.Color("#ffe4b0");
  lensMat.emissiveIntensity = Math.max(glow.emissiveIntensity || 1, 1.15);

  const wells = new THREE.InstancedMesh(WELL_GEO, wellMat, count);
  const baffles = new THREE.InstancedMesh(BAFFLE_GEO, baffleMat, count);
  const rings = new THREE.InstancedMesh(RING_GEO, ringMat, count);
  const lenses = new THREE.InstancedMesh(LENS_BRIGHT, lensMat, count);
  wells.castShadow = false;
  baffles.castShadow = false;
  rings.castShadow = false;

  let n = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = -width / 2 + pad + (i + 0.5) * cellW;
      const z = -depth / 2 + pad + (j + 0.5) * cellD;
      const y = height - 0.128;

      instDummy.position.set(x, y, z);
      instDummy.scale.set(1, 1, 1);
      instDummy.rotation.set(0, 0, 0);
      instDummy.updateMatrix();
      wells.setMatrixAt(n, instDummy.matrix);

      instDummy.position.set(x, y - 0.04, z);
      instDummy.updateMatrix();
      baffles.setMatrixAt(n, instDummy.matrix);

      instDummy.position.set(x, y - 0.044, z);
      instDummy.rotation.set(Math.PI / 2, 0, 0);
      instDummy.updateMatrix();
      rings.setMatrixAt(n, instDummy.matrix);

      instDummy.position.set(x, y - 0.054, z);
      instDummy.rotation.set(Math.PI / 2, 0, 0);
      instDummy.updateMatrix();
      lenses.setMatrixAt(n, instDummy.matrix);
      n += 1;
    }
  }
  wells.instanceMatrix.needsUpdate = true;
  baffles.instanceMatrix.needsUpdate = true;
  rings.instanceMatrix.needsUpdate = true;
  lenses.instanceMatrix.needsUpdate = true;
  root.add(wells, baffles, rings, lenses);
}

function addPremiumCeiling(root, kind, width, depth, height, roofMat, mats) {
  const { cream, brass, glow, housing, led, walnut, dark, chrome, champagne, trayIvory } = mats;
  const gold = champagne;
  const ivory = trayIvory;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), roofMat || cream);
  slab.position.y = height - 0.05;
  slab.receiveShadow = true;
  slab.userData = { selectable: true, kind: "roof", id: "roof" };
  root.add(slab);

  const onyx = new THREE.MeshStandardMaterial({
    color: "#2a1c12",
    emissive: "#c47a28",
    emissiveIntensity: 0.42,
    roughness: 0.22,
    metalness: 0.12,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#d8c4a4",
    roughness: 0.58,
    metalness: 0.04,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: "#6a4524",
    metalness: 0.78,
    roughness: 0.28,
    envMapIntensity: 1.05,
  });
  const gloss = new THREE.MeshStandardMaterial({
    color: "#2a2420",
    metalness: 0.42,
    roughness: 0.08,
    envMapIntensity: 1.35,
  });
  const glowPanel = new THREE.MeshStandardMaterial({
    color: "#fff4e2",
    emissive: "#ffd089",
    emissiveIntensity: 1.35,
    roughness: 0.28,
  });

  if (kind === "roof-goldleaf") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    const g = addCofferGrid(root, width, depth, height, gold, gold, 0.08, 0.13, { profile: "molded", trayMat: ivory });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow, {
      luxury: true,
      wash: true,
      ringMat: gold,
    });
    return true;
  }
  if (kind === "roof-silk") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    addDownlights(root, width, depth, height, 3, 3, 1.5, (width - 3) / 3, (depth - 3) / 3, housing, glow);
    return true;
  }
  if (kind === "roof-onyx") {
    addCoveLights(root, width, depth, height, cream, brass, led, "dark");
    const cols = 3;
    const rows = 2;
    const pad = 1.15;
    const cellW = (width - pad * 2) / cols;
    const cellD = (depth - pad * 2) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -width / 2 + pad + (i + 0.5) * cellW;
        const z = -depth / 2 + pad + (j + 0.5) * cellD;
        root.add(tagRoof(meshBox(cellW - 0.22, 0.03, cellD - 0.22, onyx, x, height - 0.14, z)));
        addFrameBand(root, cellW - 0.14, cellD - 0.14, 0.035, 0.03, height - 0.16, gold);
      }
    }
    return true;
  }
  if (kind === "roof-noir") {
    addCoveLights(root, width, depth, height, cream, brass, led, "dark");
    const g = addCofferGrid(root, width, depth, height, dark, gold, 0.08, 0.12, { profile: "molded", trayMat: dark });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, gold, glow, {
      luxury: true,
      wash: true,
      ringMat: gold,
    });
    return true;
  }
  if (kind === "roof-marble") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    const cols = 3;
    const rows = 2;
    const pad = 0.85;
    const cellW = (width - pad * 2) / cols;
    const cellD = (depth - pad * 2) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -width / 2 + pad + (i + 0.5) * cellW;
        const z = -depth / 2 + pad + (j + 0.5) * cellD;
        root.add(tagRoof(meshBox(cellW - 0.08, 0.03, cellD - 0.08, ivory, x, height - 0.13, z)));
        addFrameBand(root, cellW - 0.02, cellD - 0.02, 0.028, 0.02, height - 0.15, gold);
      }
    }
    addDownlights(root, width, depth, height, 3, 2, 1.1, (width - 2.2) / 3, (depth - 2.2) / 2, housing, glow);
    return true;
  }
  if (kind === "roof-champagne") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    root.add(tagRoof(meshBox(width - 1.15, 0.08, depth - 1.15, ivory, 0, height - 0.2, 0)));
    root.add(tagRoof(meshBox(width - 1.08, 0.016, depth - 1.08, gold, 0, height - 0.25, 0)));
    addLedLoop(root, width - 1.28, depth - 1.28, height - 0.26, led);
    addDownlights(root, width, depth, height, 3, 3, 1.15, (width - 2.3) / 3, (depth - 2.3) / 3, housing, glow);
    return true;
  }
  if (kind === "roof-fluted") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    addCeilingSlats(root, width, depth, height, cream, Math.round(width * 2.8), 0.05, 0.07, null);
    addDownlights(root, width, depth, height, 3, 3, 1.3, (width - 2.6) / 3, (depth - 2.6) / 3, housing, glow);
    return true;
  }
  if (kind === "roof-walnutinlay") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    addCeilingSlats(root, width, depth, height, walnut, Math.round(width * 2.2), 0.055, 0.08, null);
    const n = QUALITY.low ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const x = -width / 2 + 0.5 + ((i + 0.5) / n) * (width - 1);
      root.add(tagRoof(meshBox(0.012, 0.02, depth - 0.9, gold, x, height - 0.2, 0)));
    }
    addDownlights(root, width, depth, height, 3, 2, 1.25, (width - 2.5) / 3, (depth - 2.5) / 2, housing, glow);
    return true;
  }
  if (kind === "roof-crystal") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    const r = Math.min(1.12, width * 0.15);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(r, QUALITY.low ? 12 : 22, QUALITY.low ? 8 : 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      ivory
    );
    dome.position.set(0, height - 0.08, 0);
    root.add(tagRoof(dome));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.04, 8, 28), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, height - 0.16, 0);
    root.add(tagRoof(ring));
    addLedLoop(root, width - 1.6, depth - 1.6, height - 0.26, led);
    addDownlights(root, width, depth, height, 3, 3, 1.25, (width - 2.5) / 3, (depth - 2.5) / 3, housing, glow);
    return true;
  }
  if (kind === "roof-lacquer") {
    root.add(tagRoof(meshBox(width - 0.85, 0.03, depth - 0.85, gloss, 0, height - 0.14, 0)));
    addFrameBand(root, width - 0.7, depth - 0.7, 0.07, 0.035, height - 0.16, chrome);
    addDownlights(root, width, depth, height, 3, 3, 1.4, (width - 2.8) / 3, (depth - 2.8) / 3, chrome, glow);
    return true;
  }
  if (kind === "roof-travertine") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    const g = addCofferGrid(root, width, depth, height, stone, gold, 0.09, 0.12, { profile: "molded", trayMat: stone });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow);
    return true;
  }
  if (kind === "roof-bronze") {
    addCoveLights(root, width, depth, height, cream, brass, led, "dark");
    addCeilingSlats(root, width, depth, height, bronze, Math.round(width * 1.7), 0.04, 0.09, led);
    addDownlights(root, width, depth, height, 3, 2, 1.3, (width - 2.6) / 3, (depth - 2.6) / 2, bronze, glow);
    return true;
  }
  if (kind === "roof-alabaster") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    const cols = 3;
    const rows = QUALITY.low ? 2 : 3;
    const pad = 1.1;
    const cellW = (width - pad * 2) / cols;
    const cellD = (depth - pad * 2) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = -width / 2 + pad + (i + 0.5) * cellW;
        const z = -depth / 2 + pad + (j + 0.5) * cellD;
        root.add(tagRoof(meshBox(cellW - 0.2, 0.025, cellD - 0.2, glowPanel, x, height - 0.135, z)));
        addFrameBand(root, cellW - 0.12, cellD - 0.12, 0.03, 0.022, height - 0.155, gold);
      }
    }
    return true;
  }
  if (kind === "roof-pearl") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    addFrameBand(root, width - 1.2, depth - 1.2, 0.16, 0.06, height - 0.2, cream);
    addLedLoop(root, width - 1.45, depth - 1.45, height - 0.25, led);
    addDownlights(root, width, depth, height, 3, 3, 1.35, (width - 2.7) / 3, (depth - 2.7) / 3, housing, glow);
    return true;
  }
  if (kind === "roof-inlay") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    const size = 1.2;
    const step = 1.7;
    const cols = Math.max(2, Math.floor((width - 1.8) / step));
    const rows = Math.max(2, Math.floor((depth - 1.8) / step));
    const ox = -((cols - 1) * step) / 2;
    const oz = -((rows - 1) * step) / 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const box = meshBox(size, 0.04, size, ivory, ox + i * step, height - 0.16, oz + j * step);
        box.rotation.y = Math.PI / 4;
        root.add(tagRoof(box));
        const rim = meshBox(size - 0.18, 0.016, size - 0.18, gold, ox + i * step, height - 0.185, oz + j * step);
        rim.rotation.y = Math.PI / 4;
        root.add(tagRoof(rim));
      }
    }
    return true;
  }
  if (kind === "roof-stepcove") {
    addCoveLights(root, width, depth, height, cream, brass, led, "cream");
    root.add(tagRoof(meshBox(width - 1.1, 0.07, depth - 1.1, ivory, 0, height - 0.18, 0)));
    root.add(tagRoof(meshBox(width - 2.15, 0.07, depth - 2.15, ivory, 0, height - 0.24, 0)));
    root.add(tagRoof(meshBox(width - 1.04, 0.014, depth - 1.04, gold, 0, height - 0.22, 0)));
    root.add(tagRoof(meshBox(width - 2.08, 0.014, depth - 2.08, gold, 0, height - 0.28, 0)));
    addLedLoop(root, width - 1.28, depth - 1.28, height - 0.23, led);
    addLedLoop(root, width - 2.32, depth - 2.32, height - 0.29, led);
    addDownlights(root, width, depth, height, 3, 3, 1.2, (width - 2.4) / 3, (depth - 2.4) / 3, housing, glow);
    return true;
  }
  return false;
}

function addInteriorCeiling(root, width, depth, height, roofMat, style) {
  if (!QUALITY.high) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, depth), roofMat);
    slab.position.y = height - 0.05;
    slab.receiveShadow = true;
    slab.userData = { selectable: true, kind: "roof", id: "roof" };
    root.add(slab);
    return;
  }
  const cream = new THREE.MeshStandardMaterial({
    color: "#f4efe6",
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.28,
  });
  const brass = brassMat();
  const glow = new THREE.MeshStandardMaterial({
    color: "#fff8f0",
    emissive: "#ffe9c8",
    emissiveIntensity: 1.12,
  });
  const housing = new THREE.MeshStandardMaterial({
    color: "#ece7de",
    metalness: 0.12,
    roughness: 0.48,
  });

  const led = new THREE.MeshStandardMaterial({
    color: "#fff8f0",
    emissive: "#ffe8c4",
    emissiveIntensity: 0.98,
  });
  const walnut = mappedMat("#4a3426", "walnut", {
    repeat: 2.4,
    repeatY: 0.4,
    roughness: 0.34,
    metalness: 0.05,
    env: 0.95,
    nStr: 0.9,
    nSc: 0.4,
  });
  const oak = mappedMat("#7a5a38", "wood", {
    repeat: 2.2,
    repeatY: 0.35,
    roughness: 0.38,
    metalness: 0.04,
    env: 0.88,
    nStr: 0.85,
    nSc: 0.36,
  });
  const dark = new THREE.MeshStandardMaterial({ color: "#2a2826", roughness: 0.72, metalness: 0.06 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#c5c8cc", metalness: 0.86, roughness: 0.18 });
  const plasterBeam = mappedMat("#efe6d8", "limewash", {
    repeat: 3.4,
    repeatY: 0.45,
    roughness: 0.72,
    metalness: 0.03,
    env: 0.42,
    nStr: 0.55,
    nSc: 0.22,
  });
  const champagne = new THREE.MeshStandardMaterial({
    color: "#c6a56a",
    metalness: 0.86,
    roughness: 0.28,
    envMapIntensity: 1.15,
  });
  const trayIvory = new THREE.MeshStandardMaterial({
    color: "#f7f2e8",
    roughness: 0.9,
    metalness: 0.015,
    envMapIntensity: 0.22,
  });

  const kind = resolveRoofId(style || "paint");
  if (
    addPremiumCeiling(root, kind, width, depth, height, roofMat, {
      cream,
      brass,
      glow,
      housing,
      led,
      walnut,
      oak,
      dark,
      chrome,
      champagne,
      trayIvory,
    })
  ) {
    return;
  }

  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), roofMat || cream);
  slab.position.y = height - 0.05;
  slab.receiveShadow = true;
  slab.userData = { selectable: true, kind: "roof", id: "roof" };
  root.add(slab);

  addCoveLights(root, width, depth, height, cream, brass, led, kind === "roof-dark" ? "dark" : "cream");

  if (kind === "roof-slats" || kind === "roof-walnut") {
    addCeilingSlats(root, width, depth, height, kind === "roof-walnut" ? walnut : oak, Math.round(width * 2.4), 0.055, 0.09, led);
  } else if (kind === "roof-brass") {
    addCeilingSlats(root, width, depth, height, brass, Math.round(width * 1.8), 0.03, 0.07, led);
  } else if (kind === "roof-baffle") {
    addCeilingSlats(root, width, depth, height, dark, Math.round(width * 1.15), 0.08, 0.2, led);
  } else if (kind === "roof-beam") {
    addCeilingSlats(root, width, depth, height, oak, Math.max(4, Math.round(width / 2.6)), 0.16, 0.14, null);
  } else if (kind === "roof-gold") {
    const g = addCofferGrid(root, width, depth, height, champagne, cream, 0.078, 0.12, {
      profile: "molded",
      trayMat: trayIvory,
    });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow);
  } else if (kind === "roof-dark") {
    const darkBeam = new THREE.MeshStandardMaterial({
      color: "#1f1c19",
      roughness: 0.52,
      metalness: 0.1,
      envMapIntensity: 0.58,
    });
    const darkTray = new THREE.MeshStandardMaterial({
      color: "#322c27",
      roughness: 0.64,
      metalness: 0.05,
      envMapIntensity: 0.4,
    });
    const darkGlow = new THREE.MeshStandardMaterial({
      color: "#fff4e4",
      emissive: "#ffd089",
      emissiveIntensity: 2.2,
    });
    const wellMat = new THREE.MeshStandardMaterial({
      color: "#141210",
      metalness: 0.52,
      roughness: 0.3,
    });
    const g = addCofferGrid(root, width, depth, height, darkBeam, champagne, 0.085, 0.12, {
      profile: "molded",
      trayMat: darkTray,
    });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, champagne, darkGlow, {
      luxury: true,
      wash: true,
      ringMat: champagne,
      wellMat,
    });
  } else if (kind === "roof-grid" || kind === "roof-acoustic" || kind === "roof-metal" || kind === "roof-perforated") {
    const g = addCofferGrid(root, width, depth, height, chrome, null, 0.035, 0.05, { profile: "flat" });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow);
  } else if (kind === "roof-tray" || kind === "roof-cove") {
    root.add(meshBox(width - 1.1, 0.08, depth - 1.1, cream, 0, height - 0.2, 0));
    root.add(meshBox(width - 1.05, 0.016, depth - 1.05, brass, 0, height - 0.25, 0));
    root.add(meshBox(width - 1.2, 0.012, 0.03, led, 0, height - 0.26, (depth - 1.2) / 2));
    root.add(meshBox(width - 1.2, 0.012, 0.03, led, 0, height - 0.26, -(depth - 1.2) / 2));
    addDownlights(root, width, depth, height, 3, 3, 1.1, (width - 2.2) / 3, (depth - 2.2) / 3, housing, glow);
  } else if (kind === "roof-tech") {
    const navy = new THREE.MeshStandardMaterial({ color: "#152a4a", roughness: 0.52, metalness: 0.1 });
    const panelLed = new THREE.MeshStandardMaterial({
      color: "#f2fbff",
      emissive: "#c8eef8",
      emissiveIntensity: 1.05,
    });
    const cyan = new THREE.MeshStandardMaterial({
      color: "#4ae0ee",
      emissive: "#2ad4e8",
      emissiveIntensity: 0.72,
    });
    const trays = [-width * 0.3, 0, width * 0.3];
    const trayW = Math.min(3.1, width * 0.2);
    const trayD = depth - 2.4;
    for (const x of trays) {
      root.add(meshBox(trayW, 0.055, trayD, navy, x, height - 0.2, 0));
      const slats = QUALITY.low ? 6 : 16;
      for (let i = 0; i < slats; i++) {
        const z = -trayD / 2 + ((i + 0.5) / slats) * trayD;
        root.add(meshBox(trayW - 0.1, 0.028, 0.035, navy, x, height - 0.232, z));
      }
      for (const [sx, sz] of [
        [-0.22, -0.32],
        [0.22, -0.32],
        [-0.22, 0.32],
        [0.22, 0.32],
      ]) {
        root.add(meshBox(0.09, 0.018, 0.09, glow, x + sx * trayW, height - 0.246, sz * trayD));
      }
    }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const x = -width * 0.28 + i * (width * 0.28);
        const z = (j === 0 ? -0.28 : 0.28) * depth;
        root.add(meshBox(1.28, 0.022, 0.48, panelLed, x, height - 0.138, z));
      }
    }
    root.add(meshBox(width - 1.4, 0.012, 0.03, cyan, 0, height - 0.26, depth / 2 - 0.55));
    root.add(meshBox(width - 1.4, 0.012, 0.03, cyan, 0, height - 0.26, -depth / 2 + 0.55));
    addDownlights(root, width, depth, height, 4, 3, 1.2, (width - 2.4) / 4, (depth - 2.4) / 3, housing, glow);
  } else if (
    addPinterestCeiling(root, kind, width, depth, height, {
      cream,
      brass,
      glow,
      housing,
      led,
      walnut,
      oak,
      dark,
      chrome,
      champagne,
      trayIvory,
    })
  ) {
    /* Pinterest false-ceiling designs */
  } else if (kind === "roof-stretch" || kind === "roof-gypsum" || kind === "paint") {
    addDownlights(root, width, depth, height, 3, 3, 1.4, (width - 2.8) / 3, (depth - 2.8) / 3, housing, glow);
  } else {
    const g = addCofferGrid(root, width, depth, height, plasterBeam, champagne, 0.1, 0.13, {
      profile: "molded",
      trayMat: trayIvory,
    });
    addDownlights(root, width, depth, height, g.cols, g.rows, g.pad, g.cellW, g.cellD, housing, glow);
  }
}

function addShopFurniture(group, type, x, z, extra = {}) {
  const item = newFurniture(type, x, z, extra);
  const node = createFurniture(item);
  node.userData = { selectable: false };
  node.traverse((c) => {
    if (c.userData) c.userData.selectable = false;
  });
  group.add(node);
}

function makePhoneFasciaTex(sign) {
  const c = document.createElement("canvas");
  const tw = 512;
  const th = 96;
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#070c12";
  ctx.fillRect(0, 0, tw, th);
  const line = ctx.createLinearGradient(0, 0, tw, 0);
  line.addColorStop(0, "rgba(42,212,232,0)");
  line.addColorStop(0.18, "rgba(42,212,232,0.9)");
  line.addColorStop(0.82, "rgba(42,212,232,0.9)");
  line.addColorStop(1, "rgba(42,212,232,0)");
  ctx.fillStyle = line;
  ctx.fillRect(24, 13, tw - 48, 2);
  ctx.fillRect(24, th - 16, tw - 48, 2);
  ctx.fillStyle = sign.fg || "#4ae0ee";
  ctx.shadowColor = "#2ad4e8";
  ctx.shadowBlur = 8;
  ctx.font = "700 34px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(sign.text || "UNIVERSAL PHONES").toUpperCase(), tw / 2, th / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = QUALITY.aniso;
  return tex;
}

function makeShopSign(text, fg, bg) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(198,165,106,0.9)";
  ctx.fillRect(32, 18, 448, 2);
  ctx.fillRect(32, 108, 448, 2);
  ctx.fillStyle = fg;
  ctx.font = "600 36px Cormorant Garamond, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text).toUpperCase(), 256, 58);
  ctx.font = "500 16px DM Sans, sans-serif";
  ctx.fillStyle = "#c6a56a";
  ctx.fillText("LEVEL 01  ·  PREMIUM GALLERIA", 256, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mallMarble(repeatX = 4, repeatZ = 4) {
  const map = makePresetTexture("luxury");
  if (map) {
    const tex = map.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatZ);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      color: "#f4eee6",
      map: tex,
      roughness: 0.05,
      metalness: 0.1,
      envMapIntensity: 1.4,
    });
  }
  return new THREE.MeshStandardMaterial({ color: "#f0e8dc", roughness: 0.12, metalness: 0.06 });
}

function addMallColumn(root, x, z, h, stone, dark, brass) {
  const shaft = new THREE.Mesh(COL_SHAFT, stone);
  shaft.scale.y = h - 0.28;
  shaft.position.set(x, (h - 0.14) / 2, z);
  shaft.castShadow = true;
  root.add(shaft);
  root.add(meshBox(0.52, 0.1, 0.52, dark, x, 0.05, z));
  root.add(meshBox(0.46, 0.04, 0.46, brass, x, 0.11, z));
  root.add(meshBox(0.5, 0.08, 0.5, dark, x, h - 0.06, z));
  root.add(meshBox(0.44, 0.03, 0.44, brass, x, h - 0.12, z));
}

function makeMallShop(opts) {
  const { x, z, w, d, h, name, fg, bg, theme } = opts;
  const g = new THREE.Group();
  const wall = mappedMat(theme === "cafe" ? "#efe6d8" : "#f3ebe0", "limewash", {
    repeat: 1.6,
    roughness: 0.7,
    metalness: 0.02,
    env: 0.45,
    nStr: 0.5,
    nSc: 0.18,
  });
  const floor = mallMarble(1.4, 1.4);
  const cream = new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: bg, metalness: 0.42, roughness: 0.32 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#2a2d32", metalness: 0.72, roughness: 0.46 });
  const brass = brassMat();
  const glass = new THREE.MeshStandardMaterial({
    color: "#c8d8e6",
    roughness: 0.06,
    metalness: 0.04,
    transparent: true,
    opacity: 0.16,
    envMapIntensity: 1.4,
    depthWrite: false,
  });
  const t = 0.1;
  const shopFloor = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, d - 0.08), floor);
  shopFloor.rotation.x = -Math.PI / 2;
  shopFloor.position.y = 0.002;
  g.add(shopFloor);
  g.add(meshBox(w, h, t, wall, 0, h / 2, -d / 2 + t / 2));
  g.add(meshBox(t, h, d, wall, -w / 2 + t / 2, h / 2, 0));
  g.add(meshBox(t, h, d, wall, w / 2 - t / 2, h / 2, 0));
  g.add(meshBox(w, 0.12, d, cream, 0, h - 0.06, 0));

  const doorW = 2.15;
  const pier = (w - doorW) / 2;
  const kick = 0.22;
  g.add(meshBox(w, kick, 0.1, dark, 0, kick / 2, d / 2 - 0.02));
  g.add(meshBox(pier, h - kick, 0.08, wall, -w / 2 + pier / 2, kick + (h - kick) / 2, d / 2 - 0.04));
  g.add(meshBox(pier, h - kick, 0.08, wall, w / 2 - pier / 2, kick + (h - kick) / 2, d / 2 - 0.04));
  g.add(meshBox(doorW, 0.38, 0.08, wall, 0, h - 0.19, d / 2 - 0.04));
  const paneL = new THREE.Mesh(UNIT_PLANE, glass);
  paneL.scale.set(pier - 0.16, h - 1.15, 1);
  paneL.position.set(-w / 2 + pier / 2, kick + (h - 1.15) / 2, d / 2 + 0.025);
  const paneR = paneL.clone();
  paneR.position.x = w / 2 - pier / 2;
  g.add(paneL, paneR);
  const doorGlass = new THREE.Mesh(UNIT_PLANE, glass);
  doorGlass.scale.set(doorW - 0.1, h - 1.0, 1);
  doorGlass.position.set(0, kick + (h - 1.0) / 2, d / 2 + 0.015);
  g.add(doorGlass);
  for (const px of [-doorW / 2 + 0.04, 0, doorW / 2 - 0.04]) {
    g.add(meshBox(0.03, h - 0.95, 0.05, chrome, px, kick + (h - 0.95) / 2, d / 2 + 0.03));
  }
  g.add(meshBox(doorW, 0.03, 0.05, chrome, 0, h * 0.55, d / 2 + 0.03));
  g.add(meshBox(0.028, 0.72, 0.04, brass, -0.18, 1.05, d / 2 + 0.05));
  g.add(meshBox(0.028, 0.72, 0.04, brass, 0.18, 1.05, d / 2 + 0.05));

  const fasciaH = 0.92;
  g.add(meshBox(w + 0.12, fasciaH, 0.2, dark, 0, h - fasciaH / 2, d / 2 + 0.08));
  g.add(meshBox(w + 0.14, 0.03, 0.22, chrome, 0, h - 0.02, d / 2 + 0.08));
  const signTex = makeShopSign(name, fg, bg);
  const sign = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.22,
      emissive: "#ffffff",
      emissiveMap: signTex,
      emissiveIntensity: 0.32,
    })
  );
  sign.scale.set(Math.min(w * 0.72, 4.6), 0.5, 1);
  sign.position.set(0, h - fasciaH / 2, d / 2 + 0.19);
  g.add(sign);

  const shopCopy = {
    title: name,
    fg,
    bg,
    accent: "#c6a56a",
    ...bannerCopyFor(name),
  };
  const shopDoorW = 2.15;
  const shopInsideZ = d / 2 - 0.32;
  const shopSide = shopDoorW / 2 + 0.55;
  const shopBannerH = Math.min(1.7, h - 2.1);
  const shopBannerY = 1.85 + shopBannerH / 2;
  addDigitalScreen(g, { w: 0.62, h: shopBannerH, x: -shopSide, y: shopBannerY, z: shopInsideZ, copy: shopCopy, vertical: true });
  addDigitalScreen(g, { w: 0.62, h: shopBannerH, x: shopSide, y: shopBannerY, z: shopInsideZ, copy: shopCopy, vertical: true });
  addDigitalScreen(g, { w: shopDoorW + 0.35, h: 0.36, x: 0, y: Math.min(h - 1.15, 3.45), z: shopInsideZ, copy: shopCopy, vertical: false });
  addDigitalScreen(g, { w: shopDoorW + 0.35, h: 0.36, x: 0, y: h - fasciaH - 0.28, z: d / 2 + 0.12, copy: shopCopy, vertical: false });

  const glow = new THREE.MeshStandardMaterial({ color: "#fff8f0", emissive: "#ffe8c4", emissiveIntensity: 0.55 });
  g.add(meshBox(w * 0.55, 0.04, 0.18, glow, 0, h - 0.16, 0.2));

  const hw = w / 2 - 0.55;
  const hd = d / 2 - 0.7;
  if (theme === "fashion") {
    addShopFurniture(g, "rack", -hw + 0.2, -0.4, { rotY: Math.PI / 2, stock: "dresses" });
    addShopFurniture(g, "rack", hw - 0.2, 0.2, { rotY: -Math.PI / 2, stock: "dresses" });
    addShopFurniture(g, "mannequin", -0.45, hd - 0.45, { accent: "#4a1d4e" });
    addShopFurniture(g, "mannequin", 0.5, hd - 0.35, { accent: "#8b1e3f" });
    addShopFurniture(g, "cube", 0, 0.35, { stock: "dresses", width: 0.7, height: 0.5, color: "#f7f3ec" });
    addShopFurniture(g, "counter", 0, -hd + 0.15, { width: 2.4, color: "#e6dccf", stock: "dresses" });
    addShopFurniture(g, "plant", hw - 0.15, hd - 0.2);
  } else if (theme === "tech") {
    const cab = { color: "#f3ebe0", accent: "#c6a56a", stock: "phones" };
    addShopFurniture(g, "phoneCabinet", 0, -hd + 0.26, { width: 3.0, ...cab });
    addShopFurniture(g, "phoneCabinet", -hw + 0.26, 0.1, { rotY: Math.PI / 2, width: 2.0, ...cab });
    addShopFurniture(g, "phoneIsland", 0, 0.45, { width: 1.5, color: "#f4eee6", accent: "#c6a56a" });
    addShopFurniture(g, "glassCase", hw - 0.85, 0.35, { width: 1.15, stock: "phones", color: "#f7f3ec", accent: "#c6a56a" });
    addShopFurniture(g, "counter", 0, -hd + 1.45, { width: 2.2, color: "#f3ebe0", accent: "#c6a56a", stock: "phones" });
  } else if (theme === "shoes") {
    addShopFurniture(g, "shoeWall", -hw + 0.15, 0, { rotY: Math.PI / 2 });
    addShopFurniture(g, "shoeWall", hw - 0.15, 0, { rotY: -Math.PI / 2 });
    addShopFurniture(g, "shoeIsland", -0.9, 0.6);
    addShopFurniture(g, "shoeIsland", 0.9, 0.6);
    addShopFurniture(g, "bench", 0, hd - 0.5);
    addShopFurniture(g, "cashier", hw - 1.1, -hd + 0.2, { color: "#d9cbb8" });
  } else {
    addShopFurniture(g, "counter", 0, -hd + 0.1, { width: 3.2, color: "#d9cbb8" });
    addShopFurniture(g, "table", -1.2, 0.4, { stock: "none", color: "#efe8dc" });
    addShopFurniture(g, "table", 1.2, 0.4, { color: "#efe8dc" });
    addShopFurniture(g, "sofa", 0, hd - 0.5, { color: "#5c4033" });
    addShopFurniture(g, "plant", -hw + 0.2, hd - 0.3);
    addShopFurniture(g, "plant", hw - 0.2, hd - 0.3);
    addShopFurniture(g, "light", -1.8, -0.2);
    addShopFurniture(g, "light", 1.8, -0.2);
  }

  g.position.set(x, 0, z);
  return g;
}

function addMallContext(root, width, depth, height, sign) {
  const stone = new THREE.MeshStandardMaterial({
    color: "#ebe4d8",
    roughness: 0.3,
    metalness: 0.07,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#1a1612",
    metalness: 0.42,
    roughness: 0.3,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: "#c5c8cc",
    metalness: 0.88,
    roughness: 0.14,
  });
  const brass = brassMat();
  const cream = new THREE.MeshStandardMaterial({
    color: "#f4efe6",
    roughness: 0.82,
    metalness: 0.02,
  });
  const led = new THREE.MeshStandardMaterial({
    color: "#fff8f0",
    emissive: "#ffe8c4",
    emissiveIntensity: 0.52,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#c8d8e6",
    roughness: 0.06,
    metalness: 0.04,
    transparent: true,
    opacity: 0.14,
    envMapIntensity: 1.4,
    depthWrite: false,
  });

  const frontZ = depth / 2;
  const walkD = 5.4;
  const walkZ = frontZ + walkD / 2 + 0.08;
  const walkW = width + 16.4;

  const deck = new THREE.Mesh(new THREE.PlaneGeometry(walkW, walkD + 0.4), mallMarble(2, 1));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0, walkZ);
  deck.receiveShadow = true;
  root.add(deck);
  root.add(meshBox(walkW, 0.002, 0.016, brass, 0, 0.0012, frontZ + 0.18));
  root.add(meshBox(walkW, 0.002, 0.016, brass, 0, 0.0012, frontZ + walkD));
  root.add(meshBox(walkW - 1.4, 0.002, 0.012, brass, 0, 0.0012, walkZ));

  root.add(meshBox(walkW, 0.18, walkD + 0.35, cream, 0, height + 0.02, walkZ));
  root.add(meshBox(walkW, 0.05, 0.1, chrome, 0, height + 0.02, frontZ + 0.16));
  root.add(meshBox(walkW, 0.05, 0.1, chrome, 0, height + 0.02, frontZ + walkD));
  for (let i = -2; i <= 2; i++) {
    root.add(meshBox(walkW - 1.4, 0.03, 0.08, led, 0, height - 0.02, walkZ + i * 0.85));
  }
  const sky = new THREE.Mesh(UNIT_PLANE, glass);
  sky.rotation.x = Math.PI / 2;
  sky.scale.set(walkW * 0.42, walkD * 0.55, 1);
  sky.position.set(0, height + 0.12, walkZ);
  root.add(sky);
  root.add(meshBox(walkW * 0.42, 0.02, walkD * 0.55, led, 0, height + 0.08, walkZ));

  const fasciaH = 1.08;
  root.add(meshBox(width + 0.55, fasciaH, 0.3, dark, 0, height - fasciaH / 2, frontZ + 0.22));
  root.add(meshBox(width + 0.6, 0.035, 0.34, brass, 0, height - 0.02, frontZ + 0.22));
  root.add(meshBox(width + 0.6, 0.035, 0.34, brass, 0, height - fasciaH + 0.02, frontZ + 0.22));
  root.add(meshBox(width + 0.25, 0.045, 0.1, led, 0, height - fasciaH - 0.03, frontZ + 0.36));

  const signW = Math.min(width * 0.58, 7.2);
  const signGroup = new THREE.Group();
  const signTex = makeSignTexture(sign);
  const face = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.2,
      metalness: 0.1,
      emissive: "#ffffff",
      emissiveMap: signTex,
      emissiveIntensity: 0.38,
    })
  );
  face.scale.set(signW, 0.62, 1);
  signGroup.add(face);
  signGroup.position.set(0, height - fasciaH / 2, frontZ + 0.4);
  signGroup.userData = { selectable: true, kind: "sign", id: "sign" };
  root.add(signGroup);

  const colCount = 6;
  for (let i = 0; i < colCount; i++) {
    const x = -walkW / 2 + 1.1 + (i * (walkW - 2.2)) / (colCount - 1);
    addMallColumn(root, x, frontZ + 4.65, height, stone, dark, brass);
  }

  root.add(meshBox(width + 0.5, 0.02, 0.62, stone, 0, 0.01, frontZ + 0.34));

  root.add(meshBox(0.22, height + 0.2, walkD + 1.2, cream, -walkW / 2, height / 2, walkZ));
  root.add(meshBox(0.22, height + 0.2, walkD + 1.2, cream, walkW / 2, height / 2, walkZ));

  const bayW = 7.2;
  const bayD = Math.max(9.2, depth - 1.2);
  const bayGap = 0.2;
  const shopZ = frontZ - bayD / 2 + 0.06;
  root.add(
    makeMallShop({
      x: -(width / 2 + bayGap + bayW / 2),
      z: shopZ,
      w: bayW,
      d: bayD,
      h: height,
      name: "LUXE",
      fg: "#f3eee4",
      bg: "#2a1624",
      theme: "fashion",
    })
  );
  root.add(
    makeMallShop({
      x: width / 2 + bayGap + bayW / 2,
      z: shopZ,
      w: bayW,
      d: bayD,
      h: height,
      name: "NOVA",
      fg: "#f3eee4",
      bg: "#121214",
      theme: "tech",
    })
  );

  addShopFurniture(root, "bench", -2.4, frontZ + 3.2, { color: "#d8cfc2", accent: "#c6a56a", width: 1.6 });
  addShopFurniture(root, "bench", 2.4, frontZ + 3.2, { color: "#d8cfc2", accent: "#c6a56a", width: 1.6 });
}

let grassTexCached = null;
function grassMap() {
  if (grassTexCached) return grassTexCached;
  const s = QUALITY.texSize;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3f7a3c";
  ctx.fillRect(0, 0, s, s);
  const n = QUALITY.high ? 220 : 80;
  for (let i = 0; i < n; i++) {
    const x = ((i * 47) % s) + (i % 5);
    const y = ((i * 91) % s) + ((i * 3) % 7);
    ctx.strokeStyle = i % 3 ? "#4f9a48" : "#2d6230";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 5) - 2), y - 5 - (i % 6));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(90,140,50,0.18)";
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse((i * 53) % s, (i * 79) % s, 8 + (i % 10), 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  grassTexCached = new THREE.CanvasTexture(c);
  grassTexCached.colorSpace = THREE.SRGBColorSpace;
  grassTexCached.wrapS = grassTexCached.wrapT = THREE.RepeatWrapping;
  grassTexCached.anisotropy = QUALITY.aniso;
  grassTexCached.repeat.set(14, 14);
  grassTexCached.needsUpdate = true;
  return grassTexCached;
}

function addYardGrass(root, width, depth) {
  const radius = Math.max(width, depth) * 1.15 + 14;
  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(radius, QUALITY.low ? 24 : 32),
    new THREE.MeshStandardMaterial({
      color: "#6a9a52",
      map: grassMap(),
      roughness: 0.94,
      metalness: 0,
    })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.028;
  grass.receiveShadow = true;
  root.add(grass);

  const edge = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.7, radius + 0.05, QUALITY.low ? 20 : 28),
    new THREE.MeshStandardMaterial({ color: "#2f5a2c", roughness: 0.92, metalness: 0 })
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = -0.024;
  root.add(edge);

  if (!QUALITY.high) return;
  const tuftGeo = new THREE.ConeGeometry(0.055, 0.14, 5);
  const tuftMat = new THREE.MeshStandardMaterial({ color: "#3d7a38", roughness: 0.96 });
  const n = 40;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (0.58 + (i % 6) * 0.055);
    instDummy.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    instDummy.rotation.set(0.12, a, 0.06);
    instDummy.scale.set(1, 0.75 + (i % 4) * 0.22, 1);
    instDummy.updateMatrix();
    tufts.setMatrixAt(i, instDummy.matrix);
  }
  tufts.instanceMatrix.needsUpdate = true;
  tufts.castShadow = false;
  root.add(tufts);
}

function addMallApron(root, width, depth, height) {
  addYardGrass(root, width, depth);
  const frontZ = depth / 2;
  const walkD = 4.2;
  const walkW = width + 3.2;
  const stone = new THREE.MeshStandardMaterial({
    color: "#d6dbe2",
    roughness: 0.16,
    metalness: 0.05,
    envMapIntensity: 1.1,
  });

  const z0 = -depth / 2 - 0.8;
  const z1 = frontZ + walkD;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(walkW, z1 - z0), stone);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, -0.008, (z0 + z1) / 2);
  pad.receiveShadow = true;
  root.add(pad);
}

export function surfaceKey(kind, id) {
  if (kind === "wall") return id;
  return kind;
}

export function buildRoom(state, materials) {
  const { width, depth, height } = state.store;
  const root = new THREE.Group();
  root.name = "store-model";

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.userData = { selectable: true, kind: "floor", id: "floor" };
  root.add(floor);

  const brass = brassMat();
  const fy = 0.0014;
  const inset = 0.48;
  root.add(meshBox(width - inset * 2, 0.003, 0.02, brass, 0, fy, depth / 2 - inset));
  root.add(meshBox(width - inset * 2, 0.003, 0.02, brass, 0, fy, -depth / 2 + inset));
  root.add(meshBox(0.02, 0.003, depth - inset * 2, brass, -width / 2 + inset, fy, 0));
  root.add(meshBox(0.02, 0.003, depth - inset * 2, brass, width / 2 - inset, fy, 0));
  root.add(meshBox(0.016, 0.003, depth - inset * 2 - 0.4, brass, -1.15, fy, 0));
  root.add(meshBox(0.016, 0.003, depth - inset * 2 - 0.4, brass, 1.15, fy, 0));

  const walls = [
    { id: "wall-front", wall: "front", length: width, x: 0, z: depth / 2, ry: 0 },
    { id: "wall-back", wall: "back", length: width, x: 0, z: -depth / 2, ry: Math.PI },
    { id: "wall-left", wall: "left", length: depth, x: -width / 2, z: 0, ry: Math.PI / 2 },
    { id: "wall-right", wall: "right", length: depth, x: width / 2, z: 0, ry: -Math.PI / 2 },
  ];

  for (const w of walls) {
    const surface = state.store.surfaces[w.id] || {};
    const finish = surface.finish || "solid";
    const g = new THREE.Group();
    if (w.wall === "front") g.position.set(0, 0, depth / 2);
    if (w.wall === "back") {
      g.position.set(0, 0, -depth / 2);
      g.rotation.y = Math.PI;
    }
    if (w.wall === "left") {
      g.position.set(-width / 2, 0, 0);
      g.rotation.y = Math.PI / 2;
    }
    if (w.wall === "right") {
      g.position.set(width / 2, 0, 0);
      g.rotation.y = -Math.PI / 2;
    }

    if (finish === "glass" || finish === "mirror") {
      const openings = openingsFor(state, w.wall, w.length, height);
      g.userData = { selectable: true, kind: "wall", id: w.id };
      if (openings.length) addGlassCurtain(g, w.length, height, openings, surface);
      else {
        const pane = makeGlassPane(w.length, height, {
          glassType: finish === "mirror" ? "mirror" : "clear",
          glassColor: surface.color || "#d8eef8",
          opacity: surface.opacity ?? 0.05,
        });
        pane.position.set(0, height / 2, 0.01);
        pane.userData = { selectable: true, kind: "wall", id: w.id };
        g.add(pane);
      }
    } else {
      const openings = openingsFor(state, w.wall, w.length, height);
      const mesh = new THREE.Mesh(wallGeometry(w.length, height, openings), materials[w.id]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { selectable: true, kind: "wall", id: w.id };
      g.add(mesh);
    }
    root.add(g);
  }

  for (const door of state.doors) {
    const length = door.wall === "left" || door.wall === "right" ? depth : width;
    const node = makeDoor(door, height);
    const along = (door.pos / 100 - 0.5) * length - door.width / 2;
    const hinge = new THREE.Group();
    hinge.add(node);
    const outset = door.style === "slide" ? 0.08 : 0.02;
    if (door.wall === "front") hinge.position.set(along, 0, depth / 2 + outset);
    if (door.wall === "back") {
      hinge.position.set(-along, 0, -depth / 2 - 0.02);
      hinge.rotation.y = Math.PI;
    }
    if (door.wall === "left") {
      hinge.position.set(-width / 2 - 0.02, 0, along);
      hinge.rotation.y = Math.PI / 2;
    }
    if (door.wall === "right") {
      hinge.position.set(width / 2 + 0.02, 0, -along);
      hinge.rotation.y = -Math.PI / 2;
    }
    node.userData = { selectable: true, kind: "door", id: door.id };
    root.add(hinge);
  }

  for (const win of state.windows) {
    const length = win.wall === "left" || win.wall === "right" ? depth : width;
    const node = makeWindow(win);
    const sill = win.sill ?? 0.95;
    placeOnWall(node, win.wall, length, win.pos, sill, depth, width, 0.02);
    root.add(node);
  }

  const roofW = width + 0.28;
  const roofD = depth + 0.28;
  const roofZ = 0;
  const showRoof = state.store.roofVisible !== false;

  const roof = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.22, roofD), materials.roof);
  roof.position.set(0, height + 0.14, roofZ);
  roof.castShadow = true;
  roof.receiveShadow = true;
  roof.visible = showRoof;
  roof.userData = { selectable: true, kind: "roof", id: "roof" };
  root.add(roof);

  const parapet = new THREE.MeshStandardMaterial({
    color: "#d8d6d1",
    roughness: 0.42,
    metalness: 0.06,
  });
  const ph = 0.42;
  const py = height + 0.25 + ph / 2;
  const parapets = [
    meshBox(roofW + 0.08, ph, 0.14, parapet, 0, py, roofZ + roofD / 2),
    meshBox(roofW + 0.08, ph, 0.14, parapet, 0, py, roofZ - roofD / 2),
    meshBox(0.14, ph, roofD, parapet, -roofW / 2, py, roofZ),
    meshBox(0.14, ph, roofD, parapet, roofW / 2, py, roofZ),
  ];
  for (const p of parapets) {
    p.visible = showRoof;
    p.userData = { selectable: true, kind: "roof", id: "roof" };
    root.add(p);
  }

  addInteriorCeiling(root, width, depth, height, materials.roof, state.store.surfaces.roof?.texture);
  addInteriorFitout(root, width, depth, height, state.store.frontStyle);
  addWallDressing(root, width, depth, height, state);
  addMallApron(root, width, depth, height);
  if (state.store.frontStyle === "mobile") addMobileStorefront(root, width, depth, height, state);
  else addEntranceBanners(root, width, depth, height, state.store.sign, state.doors);
  return root;
}

export function defaultState() {
  return {
    version: 1,
    store: {
      width: 18,
      depth: 14,
      height: 4.8,
      roofVisible: true,
      sign: { text: "YOUR STORE", fg: "#f3f1ec", bg: "#121214" },
      lighting: {
        exposure: 0.86,
        sun: 0.72,
        fill: 0.16,
        hemi: 0.62,
        warmth: 0.76,
      },
      surfaces: {
        floor: { color: "#ffffff", texture: "tz-cottage", image: null, repeat: 3 },
        roof: { color: "#ffffff", texture: "roof-goldleaf", image: null, repeat: 2 },
        "wall-front": { color: "#f3ebe0", texture: "drywall", image: null, repeat: 1.85, finish: "glass", opacity: 0.08 },
        "wall-back": { color: "#f3ebe0", texture: "limewash", image: null, repeat: 2.2, finish: "solid", opacity: 0.05 },
        "wall-left": { color: "#f3ebe0", texture: "limewash", image: null, repeat: 2.2, finish: "solid", opacity: 0.05 },
        "wall-right": { color: "#f3ebe0", texture: "limewash", image: null, repeat: 2.2, finish: "solid", opacity: 0.05 },
      },
    },
    doors: [
      {
        id: uid(),
        wall: "front",
        style: "double",
        color: "#c6a56a",
        glassType: "clear",
        glassColor: "#dce8f0",
        opacity: 0.12,
        pos: 50,
        width: 2.8,
        height: 3.15,
        open: false,
      },
    ],
    windows: [
      {
        id: uid(),
        wall: "front",
        color: "#d8eef8",
        glassType: "clear",
        glassColor: "#d8eef8",
        opacity: 0.12,
        pos: 18,
        width: 4.1,
        height: 3.45,
        sill: 0.14,
      },
      {
        id: uid(),
        wall: "front",
        color: "#d8eef8",
        glassType: "clear",
        glassColor: "#d8eef8",
        opacity: 0.12,
        pos: 82,
        width: 4.1,
        height: 3.45,
        sill: 0.14,
      },
      {
        id: uid(),
        wall: "left",
        color: "#d8eef8",
        glassType: "clear",
        glassColor: "#d8eef8",
        opacity: 0.12,
        pos: 42,
        width: 3.4,
        height: 2.9,
        sill: 0.28,
      },
      {
        id: uid(),
        wall: "right",
        color: "#d8eef8",
        glassType: "clear",
        glassColor: "#d8eef8",
        opacity: 0.12,
        pos: 42,
        width: 3.4,
        height: 2.9,
        sill: 0.28,
      },
    ],
    furniture: [],
  };
}
