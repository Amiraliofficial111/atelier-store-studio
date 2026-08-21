import * as THREE from "three";
import { makePresetTexture } from "./textures.js";

const LEAF = new THREE.SphereGeometry(1, 10, 8);
const POT = new THREE.CylinderGeometry(1, 1.18, 1, 16);
const SOIL = new THREE.CylinderGeometry(1, 1, 0.12, 14);

function leafMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.64,
    metalness: 0.02,
    envMapIntensity: 0.28,
  });
}

function makeFoliage(color, r, x, y, z) {
  const m = new THREE.Mesh(LEAF, leafMat(color));
  m.scale.set(r, r * 0.82, r);
  m.position.set(x, y, z);
  m.castShadow = false;
  return m;
}

export function makeTree(x, z, scale = 1) {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: "#3a2c20", roughness: 0.88 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, 2.2 * scale, 10), bark);
  trunk.position.y = 1.1 * scale;
  g.add(trunk);
  const greens = ["#2f6a3c", "#3d7a48", "#4a8f55", "#245534"];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(
      makeFoliage(
        greens[i % greens.length],
        (0.42 + (i % 3) * 0.1) * scale,
        Math.cos(a) * 0.28 * scale,
        (1.95 + (i % 3) * 0.22) * scale,
        Math.sin(a) * 0.28 * scale
      )
    );
  }
  g.position.set(x, 0, z);
  return g;
}

export function makePlanter(x, z) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    color: "#ece6dc",
    roughness: 0.32,
    metalness: 0.08,
  });
  const rim = new THREE.MeshStandardMaterial({
    color: "#c6a56a",
    roughness: 0.36,
    metalness: 0.82,
    envMapIntensity: 1.05,
  });
  const pot = new THREE.Mesh(POT, stone);
  pot.scale.set(0.36, 0.46, 0.36);
  pot.position.y = 0.23;
  pot.castShadow = true;
  g.add(pot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 8, 20), rim);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.46;
  g.add(ring);
  const soil = new THREE.Mesh(SOIL, new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.92 }));
  soil.scale.set(0.3, 1, 0.3);
  soil.position.y = 0.44;
  g.add(soil);
  g.add(makeFoliage("#2f6a3c", 0.2, -0.05, 0.72, 0.02));
  g.add(makeFoliage("#4a8f55", 0.16, 0.08, 0.78, -0.04));
  g.add(makeFoliage("#245534", 0.12, 0.02, 0.86, 0.06));
  g.position.set(x, 0, z);
  return g;
}

export function makeNightPlaza() {
  return makeDayPlaza();
}

export function makeDayPlaza() {
  const root = new THREE.Group();
  root.name = "day-plaza";

  const src = makePresetTexture("luxury");
  const marble = src ? src.clone() : null;
  if (marble) {
    marble.wrapS = marble.wrapT = THREE.RepeatWrapping;
    marble.repeat.set(2, 2);
    marble.center.set(0.5, 0.5);
    marble.rotation = Math.PI / 4;
    marble.needsUpdate = true;
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(72, 72),
    new THREE.MeshStandardMaterial({
      color: "#f3ebe0",
      map: marble,
      roughness: 0.05,
      metalness: 0.1,
      envMapIntensity: 1.4,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  root.add(ground);

  const brass = new THREE.MeshStandardMaterial({
    color: "#c6a56a",
    metalness: 0.84,
    roughness: 0.36,
    envMapIntensity: 1.05,
  });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 42), brass);
  band.rotation.x = -Math.PI / 2;
  [-4.2, -1.4, 1.4, 4.2].forEach((x) => {
    const line = band.clone();
    line.position.set(x, -0.055, 6);
    root.add(line);
  });

  return root;
}
