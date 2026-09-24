import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function loadGlb(url) {
  return new Promise((resolve) => {
    new GLTFLoader().load(url, resolve, undefined, () => resolve(null));
  });
}

/** Girl that walks beside the man — same idle/walk switch, in-place cycle. */
export const WALK_GIRLS = [
  {
    id: "girl-character-walk",
    name: "Girl character walk",
    url: "./models/walk-girls/girl-character-walk.glb",
    height: 1.62,
    yaw: 0,
    side: 0.46,
    license: "Sketchfab CC BY",
  },
];

/** Sketchfab CC walking girls — listed here, download needs a logged-in Sketchfab account. */
export const SKETCHFAB_WALK_GIRLS = [
  { uid: "266d11aace6843809d62a1a3ceb9876a", name: "character girl animated walk", license: "CC BY", url: "https://sketchfab.com/3d-models/character-girl-animated-walk-266d11aace6843809d62a1a3ceb9876a" },
  { uid: "c9fcda220b3a4144a6598ce196884705", name: "character girl animated walk v02", license: "CC BY", url: "https://sketchfab.com/3d-models/character-girl-animated-walk-v02-c9fcda220b3a4144a6598ce196884705" },
  { uid: "752778128b9a4b578586dbce40c0366f", name: "Low-poly Woman", license: "CC BY", url: "https://sketchfab.com/3d-models/low-poly-woman-752778128b9a4b578586dbce40c0366f" },
  { uid: "9071be68b2d4495da557247637b27232", name: "Exaggerated female walk", license: "CC BY", url: "https://sketchfab.com/3d-models/exaggerated-female-walk-9071be68b2d4495da557247637b27232" },
  { uid: "bec5b21e18bf415bb024afbef6e329ef", name: "Bunny Girl", license: "CC BY", url: "https://sketchfab.com/3d-models/bunny-girl-bec5b21e18bf415bb024afbef6e329ef" },
  { uid: "32ff946fd0734e64bad59715099a61b5", name: "Girl with animations", license: "CC BY", url: "https://sketchfab.com/3d-models/girl-with-animations-32ff946fd0734e64bad59715099a61b5" },
  { uid: "80061724b79c456195cd47a88d89e9a3", name: "Girl character walk", license: "CC BY", url: "https://sketchfab.com/3d-models/girl-character-walk-80061724b79c456195cd47a88d89e9a3" },
];

let packs = [];
let loadAll = null;
let selected = 0;

export function getWalkGirlPacks() {
  return packs;
}

export function getWalkGirlIndex() {
  return selected;
}

export function currentWalkGirlPack() {
  return packs[selected] || packs[0] || null;
}

export function cycleWalkGirlIndex() {
  if (!packs.length) return 0;
  selected = (selected + 1) % packs.length;
  return selected;
}

export function loadAllWalkGirls() {
  if (loadAll) return loadAll;
  loadAll = Promise.all(WALK_GIRLS.map(loadWalkGirlEntry)).then((list) => {
    packs = list.filter(Boolean);
    if (selected >= packs.length) selected = 0;
    return packs;
  });
  return loadAll;
}

async function loadWalkGirlEntry(entry) {
  const gltf = await loadGlb(entry.url);
  if (!gltf?.scene) return null;
  let clips = [...(gltf.animations || [])];
  const extras = await Promise.all(
    [entry.idleUrl, entry.walkUrl].filter(Boolean).map((url) => loadGlb(url))
  );
  for (const extra of extras) {
    if (extra?.animations?.length) clips = clips.concat(extra.animations);
  }
  if (!clips.length) return null;
  return { ...entry, gltf, clips };
}

function bodyMat() {
  return new THREE.MeshStandardMaterial({
    color: "#f0c2b0",
    roughness: 0.42,
    metalness: 0.02,
  });
}

function jointMat() {
  return new THREE.MeshStandardMaterial({
    color: "#7a3c34",
    roughness: 0.38,
    metalness: 0.04,
  });
}

function addPart(parent, geo, mat, y, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addJoint(parent, mat, y, r) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat);
  ball.position.y = y;
  ball.castShadow = true;
  parent.add(ball);
  return ball;
}

function makeLimb(name, upperLen, lowerLen, thick, handR, body, joint) {
  const root = new THREE.Group();
  root.name = name;
  addJoint(root, joint, 0, thick * 0.72);
  addPart(root, new THREE.CapsuleGeometry(thick, upperLen, 6, 10), body, -upperLen * 0.5 - thick * 0.15);
  const mid = new THREE.Group();
  mid.position.y = -upperLen - thick * 0.2;
  addJoint(mid, joint, 0, thick * 0.62);
  addPart(mid, new THREE.CapsuleGeometry(thick * 0.88, lowerLen, 6, 10), body, -lowerLen * 0.5 - thick * 0.1);
  const tip = new THREE.Group();
  tip.position.y = -lowerLen - thick * 0.15;
  addJoint(tip, joint, 0, thick * 0.48);
  addPart(tip, new THREE.SphereGeometry(handR, 12, 10), body, -handR * 0.55, 1, 0.72, 1.15);
  mid.add(tip);
  root.add(mid);
  return { root, mid, tip };
}

/** Peach ball-joint girl mannequin — same look as the reference dummy. */
export function createWalkMannequinGirl(side = 0.48) {
  const body = bodyMat();
  const joint = jointMat();
  const root = new THREE.Group();
  root.name = "walk-girl-mannequin";

  const hips = new THREE.Group();
  hips.position.y = 0.86;
  addPart(hips, new THREE.SphereGeometry(0.15, 16, 12), body, 0, 1.55, 0.82, 1.05);
  addJoint(hips, joint, 0.11, 0.055);

  const torso = new THREE.Group();
  torso.position.y = 0.14;
  addPart(torso, new THREE.CapsuleGeometry(0.09, 0.22, 6, 12), body, 0.16, 1.15, 1, 0.92);
  addPart(torso, new THREE.SphereGeometry(0.125, 16, 12), body, 0.36, 1.35, 0.72, 1.05);
  addJoint(torso, joint, 0.48, 0.048);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), body);
  head.position.y = 0.62;
  head.scale.set(0.95, 1.08, 0.95);
  head.castShadow = true;
  torso.add(head);

  const leftArm = makeLimb("armL", 0.2, 0.18, 0.038, 0.042, body, joint);
  leftArm.root.position.set(0.16, 0.36, 0);
  leftArm.root.rotation.z = 0.18;
  const rightArm = makeLimb("armR", 0.2, 0.18, 0.038, 0.042, body, joint);
  rightArm.root.position.set(-0.16, 0.36, 0);
  rightArm.root.rotation.z = -0.18;
  torso.add(leftArm.root, rightArm.root);
  hips.add(torso);

  const leftLeg = makeLimb("legL", 0.28, 0.26, 0.05, 0.055, body, joint);
  leftLeg.root.position.set(0.09, -0.02, 0);
  const rightLeg = makeLimb("legR", 0.28, 0.26, 0.05, 0.055, body, joint);
  rightLeg.root.position.set(-0.09, -0.02, 0);
  hips.add(leftLeg.root, rightLeg.root);
  root.add(hips);
  root.position.x = side;

  const rest = {
    hipsZ: 0,
    torsoX: 0,
    armLZ: leftArm.root.rotation.z,
    armRZ: rightArm.root.rotation.z,
  };
  let gait = "idle";
  let t = 0;

  return {
    id: "mannequin",
    root,
    mixer: null,
    anim: { actions: { idle: true, walk: true }, gait: "idle" },
    base: root.position.clone(),
    yaw: 0,
    play(next) {
      gait = next === "walk" ? "walk" : "idle";
    },
    update(dt, moving) {
      t += dt * (moving || gait === "walk" ? 8.2 : 1.6);
      const walk = moving || gait === "walk";
      const step = walk ? Math.sin(t) : Math.sin(t) * 0.08;
      const lift = walk ? Math.max(0, Math.sin(t)) : 0;
      hips.position.y = 0.86 + (walk ? Math.abs(step) * 0.028 : Math.sin(t) * 0.006);
      hips.rotation.y = walk ? step * 0.08 : 0;
      hips.rotation.z = walk ? step * 0.04 : 0;
      torso.rotation.y = walk ? -step * 0.06 : 0;
      torso.rotation.x = rest.torsoX + (walk ? -0.04 : 0);
      leftLeg.root.rotation.x = step * (walk ? 0.62 : 0.04);
      rightLeg.root.rotation.x = -step * (walk ? 0.62 : 0.04);
      leftLeg.mid.rotation.x = walk ? lift * 0.55 : 0.04;
      rightLeg.mid.rotation.x = walk ? Math.max(0, Math.sin(t + Math.PI)) * 0.55 : 0.04;
      leftArm.root.rotation.x = -step * (walk ? 0.48 : 0.03);
      rightArm.root.rotation.x = step * (walk ? 0.48 : 0.03);
      leftArm.root.rotation.z = rest.armLZ;
      rightArm.root.rotation.z = rest.armRZ;
      leftArm.mid.rotation.x = walk ? -0.18 : -0.08;
      rightArm.mid.rotation.x = walk ? -0.18 : -0.08;
    },
  };
}
