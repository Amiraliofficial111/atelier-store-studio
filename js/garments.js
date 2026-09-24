import * as THREE from "three";

function halfWidth(kind, v) {
  const clamp = THREE.MathUtils.clamp;
  const lerp = THREE.MathUtils.lerp;
  if (kind === "midi") {
    if (v < 0.1) return lerp(0.055, 0.092, v / 0.1);
    if (v < 0.34) return lerp(0.092, 0.062, (v - 0.1) / 0.24);
    return lerp(0.062, 0.108, clamp((v - 0.34) / 0.66, 0, 1));
  }
  if (kind === "gown") {
    if (v < 0.08) return lerp(0.05, 0.1, v / 0.08);
    if (v < 0.3) return lerp(0.1, 0.068, (v - 0.08) / 0.22);
    return lerp(0.068, 0.2, clamp((v - 0.3) / 0.7, 0, 1));
  }
  if (kind === "shirtdress") {
    if (v < 0.1) return lerp(0.058, 0.098, v / 0.1);
    if (v < 0.36) return lerp(0.098, 0.078, (v - 0.1) / 0.26);
    return lerp(0.078, 0.122, clamp((v - 0.36) / 0.64, 0, 1));
  }
  if (kind === "shirt") {
    if (v < 0.12) return lerp(0.06, 0.1, v / 0.12);
    if (v < 0.4) return lerp(0.1, 0.086, (v - 0.12) / 0.28);
    return lerp(0.086, 0.094, clamp((v - 0.4) / 0.6, 0, 1));
  }
  if (kind === "blazer") {
    if (v < 0.1) return lerp(0.07, 0.118, v / 0.1);
    if (v < 0.45) return lerp(0.118, 0.1, (v - 0.1) / 0.35);
    return lerp(0.1, 0.108, clamp((v - 0.45) / 0.55, 0, 1));
  }
  if (v < 0.09) return lerp(0.052, 0.1, v / 0.09);
  if (v < 0.32) return lerp(0.1, 0.07, (v - 0.09) / 0.23);
  return lerp(0.07, 0.168, clamp((v - 0.32) / 0.68, 0, 1));
}

function noise(a, b) {
  const n = Math.sin(a * 17.13 + b * 43.7) * 531.17;
  return n - Math.floor(n);
}

function hangPanel({ kind, side, height, segsX, segsY, seed = 1 }) {
  const geo = new THREE.PlaneGeometry(1, 1, segsX, segsY);
  const pos = geo.attributes.position;
  const folds = kind === "gown" ? 8 : kind === "shirt" ? 5 : 6;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = 0.5 - pos.getY(i);
    const half = halfWidth(kind, v);
    let x = (u - 0.5) * 2 * half;
    let y = -v * height;
    const mid = 1 - Math.min(1, Math.abs(u - 0.5) * 2);
    if (v < 0.1 && kind !== "pants") {
      const scoop = Math.max(0, 1 - Math.abs(u - 0.5) / 0.2) * (1 - v / 0.1);
      y -= scoop * (kind === "midi" ? 0.028 : 0.018);
    }
    const n1 = noise(u * seed * 3.1, v * 5.2);
    const n2 = noise(u * 8.4 + seed, v * 6.1);
    const fold =
      Math.sin(u * Math.PI * folds + v * 2.2 + seed) * 0.007 * Math.pow(v, 0.75) +
      Math.sin(u * Math.PI * (folds * 1.6) + n1 * 2) * 0.0035 * v +
      (n2 - 0.5) * 0.004 * v;
    const sag = mid * mid * v * v * (kind === "gown" ? 0.05 : 0.032);
    let z = side * (0.015 + sag) + side * fold;
    if (v < 0.14) {
      const t = 1 - v / 0.14;
      z *= 1 - t * 0.55;
      y += t * 0.008;
      x *= 1 - t * 0.04;
    }
    if (v > 0.9) {
      const hem = (v - 0.9) / 0.1;
      z += side * hem * 0.006;
      y -= hem * 0.006;
    }
    pos.setXYZ(i, x, y, z);
  }
  const uv = geo.attributes.uv;
  if (uv) {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.1, uv.getY(i) * 2.6);
  }
  geo.computeVertexNormals();
  if (geo.index) {
    try {
      geo.computeTangents();
    } catch {
      /* ok */
    }
  }
  return geo;
}

function sleevePanel(len, r, side, segs = 18) {
  const geo = new THREE.PlaneGeometry(1, 1, segs, Math.max(16, segs + 4));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = 0.5 - pos.getY(i);
    const x = (u - 0.5) * 2 * r * (1 + v * 0.08);
    const y = -v * len;
    const fold = Math.sin(u * Math.PI * 4 + v * 3) * 0.004 * v;
    const z = side * (0.01 + v * 0.012) + fold;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function addMesh(g, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#d0d0d0", roughness: 0.7, metalness: 0, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function segs(high) {
  return high ? { x: 46, y: 70 } : { x: 26, y: 40 };
}

export function buildHangingDress(variant = 0, high = true) {
  const kinds = ["aline", "midi", "gown", "shirtdress"];
  const kind = kinds[variant % 4];
  const h = kind === "gown" ? 0.86 : kind === "midi" ? 0.64 : kind === "shirtdress" ? 0.58 : 0.8;
  const s = segs(high);
  const g = new THREE.Group();
  g.name = `dress-${kind}`;
  addMesh(g, hangPanel({ kind, side: 1, height: h, segsX: s.x, segsY: s.y, seed: 1 + variant }));
  addMesh(g, hangPanel({ kind, side: -1, height: h, segsX: s.x, segsY: s.y, seed: 2.3 + variant }));
  if (kind === "midi") {
    addMesh(g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 8), -0.034, -0.028, 0.01);
    addMesh(g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 8), 0.034, -0.028, 0.01);
  }
  if (kind === "gown" || kind === "shirtdress") {
    const len = kind === "gown" ? 0.34 : 0.15;
    const sl = sleevePanel(len, kind === "gown" ? 0.03 : 0.034, 1, high ? 16 : 10);
    addMesh(g, sl, 0.1, -0.08, 0.012, 0.12, 0, 0.42);
    addMesh(g, sl.clone(), -0.1, -0.08, 0.012, 0.12, 0, -0.42);
  }
  return g;
}

export function buildHangingShirt(high = true) {
  const s = segs(high);
  const g = new THREE.Group();
  g.name = "shirt";
  addMesh(g, hangPanel({ kind: "shirt", side: 1, height: 0.54, segsX: s.x, segsY: s.y, seed: 4 }));
  addMesh(g, hangPanel({ kind: "shirt", side: -1, height: 0.54, segsX: s.x, segsY: s.y, seed: 5.1 }));
  const sl = sleevePanel(0.26, 0.03, 1, high ? 16 : 10);
  addMesh(g, sl, 0.098, -0.07, 0.012, 0.1, 0, 0.38);
  addMesh(g, sl.clone(), -0.098, -0.07, 0.012, 0.1, 0, -0.38);
  return g;
}

export function buildHangingPants(high = true) {
  const g = new THREE.Group();
  g.name = "pants";
  const s = segs(high);
  addMesh(g, hangPanel({ kind: "shirt", side: 1, height: 0.12, segsX: 22, segsY: 10, seed: 7 }), 0, 0, 0);
  addMesh(g, hangPanel({ kind: "shirt", side: -1, height: 0.12, segsX: 22, segsY: 10, seed: 8 }), 0, 0, 0);
  const leg = hangPanel({ kind: "shirt", side: 1, height: 0.6, segsX: high ? 18 : 12, segsY: s.y, seed: 9 });
  const scaleX = (geo, k) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * k);
    geo.computeVertexNormals();
    return geo;
  };
  addMesh(g, scaleX(leg.clone(), 0.42), 0.038, -0.12, 0.004, 0.04, 0, 0.05);
  addMesh(g, scaleX(leg.clone(), 0.42), -0.038, -0.12, 0.004, 0.04, 0, -0.05);
  addMesh(g, scaleX(hangPanel({ kind: "shirt", side: -1, height: 0.6, segsX: high ? 18 : 12, segsY: s.y, seed: 10 }), 0.42), 0.038, -0.12, -0.004, 0.04, 0, 0.05);
  addMesh(g, scaleX(hangPanel({ kind: "shirt", side: -1, height: 0.6, segsX: high ? 18 : 12, segsY: s.y, seed: 11 }), 0.42), -0.038, -0.12, -0.004, 0.04, 0, -0.05);
  return g;
}

export function buildHangingBlazer(high = true) {
  const s = segs(high);
  const g = new THREE.Group();
  g.name = "blazer";
  addMesh(g, hangPanel({ kind: "blazer", side: 1, height: 0.56, segsX: s.x, segsY: s.y, seed: 12 }));
  addMesh(g, hangPanel({ kind: "blazer", side: -1, height: 0.56, segsX: s.x, segsY: s.y, seed: 13 }));
  const sl = sleevePanel(0.36, 0.032, 1, high ? 16 : 10);
  addMesh(g, sl, 0.112, -0.08, 0.014, 0.1, 0, 0.3);
  addMesh(g, sl.clone(), -0.112, -0.08, 0.014, 0.1, 0, -0.3);
  return g;
}

export function buildGarment(style, variant = 0, high = true) {
  if (style === "pants") return buildHangingPants(high);
  if (style === "shirt") return buildHangingShirt(high);
  if (style === "blazer") return buildHangingBlazer(high);
  return buildHangingDress(variant, high);
}
