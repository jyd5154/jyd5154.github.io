import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SITE } from './content.js';
import { BOOT } from './boot.js';
import { RetroOS, OS_SIZE } from './os.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090e);
scene.fog = new THREE.Fog(0x07090e, 4.5, 11);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);

// glow (bloom) post-processing
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.5, 0.97);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- helpers ----------
// Your personal photos are stored scrambled (photo.bin, photo2.bin), not as .jpg files, and unscrambled only in memory.
// They are drawn inside the 3D scene, so there is no picture element to right-click or drag out. Note: no web page can make a picture
// truly un-copyable (a screenshot always works); this removes the easy routes (saving the image, or guessing the file name).
const PHOTO_KEY = [91,12,200,33,147,5,78,219,140,66,3,171,250,29,112,188,54,9,231,97,160,44,17,205,133,72,26,249,61,190,8,121];
function loadScrambledTexture(file) {
  const tex = new THREE.Texture();
  fetch(file).then((r) => r.arrayBuffer()).then((buf) => {
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= PHOTO_KEY[i % PHOTO_KEY.length];
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    const img = new Image();
    img.onload = () => { tex.image = img; tex.needsUpdate = true; URL.revokeObjectURL(url); }; // the temporary link is dropped right away
    img.src = url;
  }).catch(() => {});
  return tex;
}
const mat = (color, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}
const floorTex = canvasTex(512, 512, (g) => {
  let s = 3;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 8; i++) {
    let y = -r() * 200;
    while (y < 512) {
      const len = 180 + r() * 220;
      g.fillStyle = `hsl(${22 + r() * 8} ${32 + r() * 12}% ${20 + r() * 8}%)`;
      g.fillRect(i * 64, y, 64, len);
      for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; g.fillRect(i * 64 + r() * 60, y, 1 + r() * 1.5, len); }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(i * 64, y, 64, 2);
      y += len;
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(i * 64, 0, 2, 512);
  }
}, 7.5, 4.875);
const wallTex = canvasTex(256, 256, (g) => { // calm, dark slate-teal paper with a barely-there diamond lattice and a soft linen grain
  let s = 31;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#1c2830';
  g.fillRect(0, 0, 256, 256);
  const tone = g.createLinearGradient(0, 0, 256, 0);
  tone.addColorStop(0, 'rgba(255,255,255,0.012)'); tone.addColorStop(0.5, 'rgba(0,0,0,0.03)'); tone.addColorStop(1, 'rgba(255,255,255,0.012)');
  g.fillStyle = tone;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(130,170,180,0.07)';
  g.lineWidth = 2;
  for (let k = -256; k <= 256; k += 128) { // diamond lattice
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke();
    g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke();
  }
  g.fillStyle = 'rgba(150,185,190,0.075)';
  for (let ix = 0; ix <= 2; ix++) for (let iy = 0; iy <= 2; iy++) { // small rosettes at the crossings
    if ((ix + iy) % 2) continue;
    const cx = ix * 128, cy = iy * 128;
    for (let p = 0; p < 8; p++) { const a = (p / 8) * Math.PI * 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 4, 2, a, 0, 7); g.fill(); }
    g.beginPath(); g.arc(cx, cy, 2.4, 0, 7); g.fill();
  }
  for (let i = 0; i < 5000; i++) { // linen weave
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.028})` : `rgba(0,0,0,${r() * 0.05})`;
    if (r() < 0.5) g.fillRect(r() * 256, r() * 256, 4 + r() * 6, 1); else g.fillRect(r() * 256, r() * 256, 1, 4 + r() * 6);
  }
}, 11, 5);
function box(w, h, d, material, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, material, x, y, z, parent = scene, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- room ----------
const woodMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 });
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.85), woodMat); // only inside the room, so the window looks onto open night
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 1.575);
floor.receiveShadow = true;
scene.add(floor);
const backWallShape = new THREE.Shape();
backWallShape.moveTo(-4.5, -2); backWallShape.lineTo(4.5, -2); backWallShape.lineTo(4.5, 2); backWallShape.lineTo(-4.5, 2); backWallShape.closePath();
const windowHole = new THREE.Path(); // real opening where the window is, so you can see out
windowHole.moveTo(-2.58, -0.87); windowHole.lineTo(-2.58, 0.37); windowHole.lineTo(-1.62, 0.37); windowHole.lineTo(-1.62, -0.87); windowHole.closePath();
backWallShape.holes.push(windowHole);
const backWallTex = wallTex.clone();
backWallTex.repeat.set(11 / 9, 5 / 4); // shape UVs are in metres
backWallTex.needsUpdate = true;
const backWall = new THREE.Mesh(new THREE.ShapeGeometry(backWallShape), new THREE.MeshStandardMaterial({ map: backWallTex, roughness: 0.95 }));
backWall.position.set(0, 2, -1.35);
backWall.receiveShadow = true;
scene.add(backWall);
const sideWallTex = wallTex.clone(); // the side walls are shorter now, so keep the stripe width the same
sideWallTex.repeat.set((11 * 5.85) / 9, 5);
sideWallTex.needsUpdate = true;
const sideWallMat = new THREE.MeshStandardMaterial({ map: sideWallTex, roughness: 0.95 });
const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(5.85, 4), sideWallMat);
leftWall.rotation.y = Math.PI / 2;
leftWall.position.set(-3, 2, 1.575);
leftWall.receiveShadow = true;
scene.add(leftWall);
const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(5.85, 4), sideWallMat);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(3, 2, 1.575);
rightWall.receiveShadow = true;
scene.add(rightWall);
// sealed ceiling and front wall: the room is a closed box, so no open sky shows from any angle
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x2c3644, roughness: 1 });
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.85), ceilMat);
ceiling.rotation.x = Math.PI / 2; // faces down into the room
ceiling.position.set(0, 4, 1.575);
scene.add(ceiling);
const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), wallMat);
frontWall.rotation.y = Math.PI; // faces into the room (toward the back wall)
frontWall.position.set(0, 2, 4.5);
scene.add(frontWall);
const crownMat = mat(0x141a20, 0.7);
box(6, 0.1, 0.1, crownMat, 0, 3.95, -1.3);
box(6, 0.1, 0.1, crownMat, 0, 3.95, 4.45);
box(0.1, 0.1, 5.85, crownMat, -2.95, 3.95, 1.575);
box(0.1, 0.1, 5.85, crownMat, 2.95, 3.95, 1.575);
box(9, 0.14, 0.03, mat(0x1c2230, 0.6), 0, 0.07, -1.335); // baseboard

// ---------- desk (group so everything on it moves together) ----------
const desk = new THREE.Group();
desk.position.set(0, 0, -0.85);
scene.add(desk);
const deskMat = mat(0x6b4a30, 0.5);
box(2.0, 0.05, 0.85, deskMat, 0, 0.725, 0, desk);
[[-0.93, -0.38], [0.93, -0.38], [-0.93, 0.38], [0.93, 0.38]].forEach(([x, z]) => box(0.06, 0.7, 0.06, deskMat, x, 0.35, z, desk));
box(1.8, 0.06, 0.04, deskMat, 0, 0.62, -0.38, desk); // back apron
// drawer unit (right side): hollow carcass with two real drawers that open when clicked
const cabWood = mat(0x5a3f29, 0.55);
const CAB_X = 0.68;
box(0.02, 0.5, 0.68, cabWood, CAB_X - 0.215, 0.45, 0.01, desk); // left wall
box(0.02, 0.5, 0.68, cabWood, CAB_X + 0.215, 0.45, 0.01, desk); // right wall
box(0.41, 0.02, 0.68, cabWood, CAB_X, 0.69, 0.01, desk); // top
box(0.41, 0.02, 0.68, cabWood, CAB_X, 0.21, 0.01, desk); // bottom
box(0.41, 0.02, 0.68, cabWood, CAB_X, 0.45, 0.01, desk); // divider
box(0.45, 0.5, 0.02, mat(0x2a1c12, 0.9), CAB_X, 0.45, -0.34, desk); // back
const drawers = [];
function makeDrawer(yc, fill, openable = true) {
  const g = new THREE.Group();
  g.position.set(CAB_X, yc, 0);
  desk.add(g);
  box(0.4, 0.205, 0.022, mat(0x6a4a30, 0.5), 0, 0, 0.349, g); // front panel
  box(0.14, 0.012, 0.012, mat(0xb08a3a, 0.3, 0.85), 0, 0.025, 0.371, g); // brass pull
  box(0.012, 0.012, 0.005, mat(0xb08a3a, 0.3, 0.85), -0.06, 0.025, 0.3625, g);
  box(0.012, 0.012, 0.005, mat(0xb08a3a, 0.3, 0.85), 0.06, 0.025, 0.3625, g);
  const label = box(0.06, 0.02, 0.002, mat(0xe8e0c8, 0.9), 0, -0.04, 0.361, g); // paper label holder
  label.castShadow = false;
  const tray = mat(0x4a3322, 0.8);
  box(0.377, 0.008, 0.606, tray, 0, -0.09, 0.035, g); // tray bottom (runs right up to the back of the front panel)
  box(0.008, 0.156, 0.612, tray, -0.1925, -0.008, 0.032, g); // tray left
  box(0.008, 0.156, 0.612, tray, 0.1925, -0.008, 0.032, g); // tray right
  box(0.377, 0.156, 0.008, tray, 0, -0.008, -0.27, g); // tray back
  [-0.14, 0.14].forEach((rx) => box(0.03, 0.016, 0.5, tray, rx, -0.102, 0.03, g)); // runners: carry the tray on the cabinet shelf
  fill(g);
  if (openable) { // the lower drawer stays shut: it is never added to the clickable list
    const state = { open: false, t: 0 };
    g.userData.drawer = state;
    g.userData.toggle = () => { state.open = !state.open; };
    drawers.push(g);
  }
  return g;
}
function floppyDisk(g, x, z, rot, color) {
  const f = new THREE.Group();
  f.position.set(x, -0.0843, z);
  f.rotation.y = rot;
  g.add(f);
  box(0.09, 0.0035, 0.09, mat(color, 0.6), 0, 0, 0, f);
  box(0.045, 0.0038, 0.03, mat(0xbfc3c8, 0.3, 0.8), 0, 0.0037, -0.03, f); // metal shutter
  box(0.05, 0.0038, 0.032, mat(0xf0ece0, 0.9), 0, 0.0037, 0.03, f); // label
}
// top drawer: papers, a folder, floppy disks, a stapler and a couple of pens
makeDrawer(0.57, (g) => {
  const folder = box(0.2, 0.004, 0.3, mat(0xd4b46a, 0.8), -0.06, -0.084, -0.04, g);
  folder.rotation.y = 0.05;
  const paper = box(0.19, 0.022, 0.28, mat(0xf1efe8, 0.9), -0.06, -0.071, -0.04, g);
  paper.rotation.y = 0.1;
  // four playing cards fanned out on top of the papers: 8, 8, 6, 8
  const cardGroup = new THREE.Group();
  cardGroup.position.set(-0.06, -0.06, -0.04);
  cardGroup.rotation.y = 0.1;
  g.add(cardGroup);
  const cardEdge = mat(0xe9e6dc, 0.7);
  [['8', '♠', '#15151a'], ['8', '♥', '#c4181f'], ['6', '♦', '#c4181f'], ['8', '♣', '#15151a']].forEach(([rank, suit, ink], i) => {
    const face = new THREE.MeshStandardMaterial({
      map: canvasTex(180, 280, (c) => {
        c.fillStyle = '#f7f5ee'; c.fillRect(0, 0, 180, 280);
        c.strokeStyle = '#c9c5b8'; c.lineWidth = 3; c.strokeRect(3, 3, 174, 274);
        c.fillStyle = ink;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        const corner = () => { c.font = 'bold 52px Georgia, serif'; c.fillText(rank, 26, 38); c.font = '40px "Segoe UI Symbol", Arial, sans-serif'; c.fillText(suit, 26, 84); };
        corner();
        c.save(); c.translate(180, 280); c.rotate(Math.PI); corner(); c.restore(); // the same index in the opposite corner
        c.font = '110px "Segoe UI Symbol", Arial, sans-serif';
        c.fillText(suit, 90, 142);
      }, 1, 1),
      roughness: 0.55,
    });
    const card = box(0.057, 0.0008, 0.089, [cardEdge, cardEdge, face, cardEdge, cardEdge, cardEdge], (i - 1.5) * 0.044, 0.0004 + i * 0.0011, (i % 2 ? 0.004 : -0.003), cardGroup);
    card.rotation.y = (i - 1.5) * 0.07;
  });
  floppyDisk(g, 0.125, 0.13, 0.25, 0x1d1f25);
  floppyDisk(g, 0.125, 0.0, -0.18, 0x2b4c8c);
  floppyDisk(g, 0.12, -0.13, 0.4, 0x8c2b2b);
  box(0.1, 0.02, 0.032, mat(0x25272c, 0.45), 0.1, -0.076, 0.23, g); // stapler
  const arm = box(0.1, 0.01, 0.028, mat(0x6a6d75, 0.35, 0.7), 0.1, -0.058, 0.23, g);
  arm.rotation.z = 0.05;
  [[-0.1, 0.24, 0.3, 0x1f4aa8], [-0.03, 0.26, -0.15, 0xc8302e]].forEach(([x, z, r, c]) => {
    const pen = cyl(0.0045, 0.0045, 0.14, mat(c, 0.5), x, -0.081, z, g, 10);
    pen.rotation.z = Math.PI / 2;
    pen.rotation.y = r;
  });
});
// bottom drawer: hanging folders and a thick binder
makeDrawer(0.33, (g) => {
  const cols = [0xd4b46a, 0x4a7a9c, 0xd4b46a, 0x6a9a6a, 0xd4b46a];
  cols.forEach((c, i) => {
    const z = 0.28 - i * 0.065;
    box(0.36, 0.13, 0.004, mat(c, 0.8), 0, -0.02, z, g);
    box(0.06, 0.016, 0.004, mat(c, 0.8), -0.12 + (i % 3) * 0.12, 0.053, z, g).castShadow = false; // tab
  });
  box(0.3, 0.07, 0.2, mat(0x24408a, 0.6), 0, -0.05, -0.16, g); // binder lying down
  box(0.3, 0.02, 0.012, mat(0xe8e0c8, 0.9), 0, -0.005, -0.075, g);
}, false); // lower drawer: shut for good, never added to the clickable list

// ---------- CRT monitor (mid-1990s: deep tapered tube housing, chunky bezel, swivel base) ----------
const beige = mat(0xcbc3a9, 0.6);
const beigeDark = mat(0xb4ac92, 0.65);
const housingMat = new THREE.MeshStandardMaterial({ color: 0xc6bea3, roughness: 0.62, flatShading: true });
const monitor = new THREE.Group();
monitor.position.set(0, 0.75, 0.0);
desk.add(monitor);

// tilt-and-swivel base and neck
cyl(0.17, 0.18, 0.02, beige, 0, 0.01, -0.15, monitor, 40);
cyl(0.135, 0.15, 0.018, beigeDark, 0, 0.029, -0.15, monitor, 40);
box(0.2, 0.22, 0.18, beige, 0, 0.145, -0.15, monitor);

// front bezel: a rounded slab with a rounded-rectangle opening for the tube
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const bezelShape = roundedRectShape(0.64, 0.52, 0.03);
bezelShape.holes.push(roundedRectShape(0.545, 0.42, 0.016));
const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 14 });
bezelGeo.translate(0, 0, -0.05);
const bezel = new THREE.Mesh(bezelGeo, beige);
bezel.position.set(0, 0.45, 0);
bezel.castShadow = true;
bezel.receiveShadow = true;
monitor.add(bezel);

// tapered rear housing (a square frustum, like the glass tube behind it)
const housingGeo = new THREE.CylinderGeometry(0.23, 0.42, 0.34, 4, 1, false, Math.PI / 4);
housingGeo.rotateX(-Math.PI / 2);
const housing = new THREE.Mesh(housingGeo, housingMat);
housing.scale.y = 0.84;
housing.position.set(0, 0.45, -0.23);
housing.castShadow = true;
housing.receiveShadow = true;
monitor.add(housing);
const tubeNeck = cyl(0.06, 0.075, 0.06, beigeDark, 0, 0.45, -0.43, monitor, 24);
tubeNeck.rotation.x = Math.PI / 2;
const neckCap = cyl(0.042, 0.042, 0.012, mat(0x2a2a2e, 0.5), 0, 0.45, -0.463, monitor, 24);
neckCap.rotation.x = Math.PI / 2;
// ventilation slots across the sloped top
const ventMat = mat(0x3a372d, 0.8);
const topSlope = Math.atan2(0.111, 0.34);
for (let i = 0; i < 9; i++) {
  const z = -0.14 - i * 0.026;
  const y = 0.45 + (0.246 - 0.111 * ((-0.06 - z) / 0.34)) + 0.001;
  const slot = box(0.2, 0.002, 0.008, ventMat, 0, y, z, monitor);
  slot.rotation.x = -topSlope;
  slot.castShadow = false;
}

// recessed tube liner (dark) behind the glass
box(0.56, 0.43, 0.004, mat(0x08080a, 0.3), 0, 0.45, 0.03, monitor);

// control strip under the screen: badge, adjustment buttons, power button and LED
const badgeCanvas = document.createElement('canvas');
badgeCanvas.width = 256; badgeCanvas.height = 48;
{
  const g = badgeCanvas.getContext('2d');
  g.fillStyle = '#2b2b30'; g.fillRect(0, 0, 256, 48);
  g.fillStyle = '#d5d8de'; g.font = 'bold 26px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('ProView', 14, 25);
  g.fillStyle = '#9a9ea8'; g.font = '20px Arial, sans-serif'; g.fillText('15"', 128, 26);
}
const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.019), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(badgeCanvas), roughness: 0.4, metalness: 0.4 }));
badge.position.set(-0.2, 0.215, 0.0635);
monitor.add(badge);
[0.03, 0.058, 0.086, 0.114].forEach((x) => {
  const b = cyl(0.0065, 0.0065, 0.006, beigeDark, x, 0.215, 0.0645, monitor, 16);
  b.rotation.x = Math.PI / 2;
});
const pwrBtn = cyl(0.011, 0.011, 0.008, mat(0xaaa28a, 0.5), 0.17, 0.215, 0.0655, monitor, 20);
pwrBtn.rotation.x = Math.PI / 2;
const led = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 12), new THREE.MeshBasicMaterial({ color: 0x55ff77 }));
led.position.set(0.21, 0.215, 0.0635);
monitor.add(led);

const os = new RetroOS(SITE, { onExit: () => leaveMonitor() });
os.openWindow('about');
const screenTex = new THREE.CanvasTexture(os.canvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
// the glass is slightly convex, like a real CRT tube
const screenGeo = new THREE.PlaneGeometry(0.5, 0.375, 24, 18);
{
  const pos = screenGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / 0.25, ny = pos.getY(i) / 0.1875;
    pos.setZ(i, 0.012 * (1 - 0.5 * nx * nx - 0.5 * ny * ny));
  }
  screenGeo.computeVertexNormals();
}
const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(0.95, 0.95, 0.95), toneMapped: false }));
screen.position.set(0, 0.45, 0.04);
monitor.add(screen);
// glass reflection sheen
const glassCanvas = document.createElement('canvas');
glassCanvas.width = 256; glassCanvas.height = 192;
{
  const g = glassCanvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 192);
  grad.addColorStop(0, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 192);
}
const glass = new THREE.Mesh(
  screenGeo.clone(),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glassCanvas), transparent: true, depthWrite: false, toneMapped: false })
);
glass.position.set(0, 0.45, 0.0412);
monitor.add(glass);

// ---------- keyboard + mouse ----------
// Full-size 104-key keyboard: real key sizes, two-tone caps, printed legends, slight tilt.
const KP = 0.0188; // key pitch (1u)
const KB_W = 23 * KP;
const KB_D = 6.5 * KP;
const KB_KEYS = [];
const addKey = (x, y, w, label, mod = false, h = 1) => KB_KEYS.push({ x, y, w, h, label, mod });
addKey(0, 0, 1, 'Esc', true);
[2, 3, 4, 5].forEach((x, i) => addKey(x, 0, 1, 'F' + (i + 1), true));
[6.5, 7.5, 8.5, 9.5].forEach((x, i) => addKey(x, 0, 1, 'F' + (i + 5), true));
[11, 12, 13, 14].forEach((x, i) => addKey(x, 0, 1, 'F' + (i + 9), true));
['Prt', 'Scr', 'Pau'].forEach((l, i) => addKey(15.5 + i, 0, 1, l, true));
'`1234567890-='.split('').forEach((c, i) => addKey(i, 1.5, 1, c));
addKey(13, 1.5, 2, 'Bksp', true);
['Ins', 'Hm', 'PgU'].forEach((l, i) => addKey(15.5 + i, 1.5, 1, l, true));
['Num', '/', '*', '-'].forEach((l, i) => addKey(19 + i, 1.5, 1, l, true));
addKey(0, 2.5, 1.5, 'Tab', true);
'QWERTYUIOP[]'.split('').forEach((c, i) => addKey(1.5 + i, 2.5, 1, c));
addKey(13.5, 2.5, 1.5, '\\');
['Del', 'End', 'PgD'].forEach((l, i) => addKey(15.5 + i, 2.5, 1, l, true));
['7', '8', '9'].forEach((l, i) => addKey(19 + i, 2.5, 1, l));
addKey(22, 2.5, 1, '+', true, 2);
addKey(0, 3.5, 1.75, 'Caps', true);
"ASDFGHJKL;'".split('').forEach((c, i) => addKey(1.75 + i, 3.5, 1, c));
addKey(12.75, 3.5, 2.25, 'Enter', true);
['4', '5', '6'].forEach((l, i) => addKey(19 + i, 3.5, 1, l));
addKey(0, 4.5, 2.25, 'Shift', true);
'ZXCVBNM,./'.split('').forEach((c, i) => addKey(2.25 + i, 4.5, 1, c));
addKey(12.25, 4.5, 2.75, 'Shift', true);
addKey(16.5, 4.5, 1, '▲', true);
['1', '2', '3'].forEach((l, i) => addKey(19 + i, 4.5, 1, l));
addKey(22, 4.5, 1, 'Ent', true, 2);
addKey(0, 5.5, 1.25, 'Ctrl', true); addKey(1.25, 5.5, 1.25, 'Win', true); addKey(2.5, 5.5, 1.25, 'Alt', true);
addKey(3.75, 5.5, 6.25, '');
addKey(10, 5.5, 1.25, 'Alt', true); addKey(11.25, 5.5, 1.25, 'Win', true); addKey(12.5, 5.5, 1.25, 'Menu', true); addKey(13.75, 5.5, 1.25, 'Ctrl', true);
['◀', '▼', '▶'].forEach((l, i) => addKey(15.5 + i, 5.5, 1, l, true));
addKey(19, 5.5, 2, '0');
addKey(21, 5.5, 1, '.');

const keyboard = new THREE.Group();
keyboard.position.set(0, 0.7585, 0.29);
keyboard.rotation.x = 0.07; // back edge raised, like a real keyboard
desk.add(keyboard);
const kbBody = new THREE.Mesh(new RoundedBoxGeometry(KB_W + 0.03, 0.02, KB_D + 0.03, 3, 0.006), mat(0xcdc3a8, 0.55));
kbBody.position.y = 0.01;
kbBody.castShadow = true;
kbBody.receiveShadow = true;
keyboard.add(kbBody);
box(KB_W + 0.006, 0.002, KB_D + 0.006, mat(0x77725f, 0.7), 0, 0.0205, 0, keyboard); // recessed key plate
// keys: one InstancedMesh per key size, light caps for letters, darker caps for modifiers
const keyGroups = new Map();
KB_KEYS.forEach((k) => {
  const id = `${k.w}x${k.h}`;
  if (!keyGroups.has(id)) keyGroups.set(id, []);
  keyGroups.get(id).push(k);
});
const keyDummy = new THREE.Object3D();
keyGroups.forEach((list) => {
  const { w, h } = list[0];
  const geo = new RoundedBoxGeometry(w * KP - 0.0022, 0.012, h * KP - 0.0022, 2, 0.0022);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), list.length);
  list.forEach((k, i) => {
    keyDummy.position.set((k.x + w / 2) * KP - KB_W / 2, 0.026, -KB_D / 2 + (k.y + h / 2) * KP);
    keyDummy.updateMatrix();
    inst.setMatrixAt(i, keyDummy.matrix);
    inst.setColorAt(i, new THREE.Color(k.mod ? 0xb9af96 : 0xe6dfca));
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  keyboard.add(inst);
});
// printed legends (transparent plane just above the key tops)
{
  const ppu = 80;
  const lc = document.createElement('canvas');
  lc.width = 23 * ppu;
  lc.height = Math.round(6.5 * ppu);
  const g = lc.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#2d2d33';
  KB_KEYS.forEach((k) => {
    if (!k.label) return;
    const single = k.label.length === 1;
    g.font = single ? `bold 34px Arial, sans-serif` : `bold 21px Arial, sans-serif`;
    g.fillText(k.label, (k.x + k.w / 2) * ppu, (k.y + k.h / 2) * ppu + 2);
  });
  const lt = new THREE.CanvasTexture(lc);
  lt.colorSpace = THREE.SRGBColorSpace;
  lt.anisotropy = 8;
  const legend = new THREE.Mesh(new THREE.PlaneGeometry(KB_W, KB_D), new THREE.MeshStandardMaterial({ map: lt, transparent: true, roughness: 0.6, depthWrite: false }));
  legend.rotation.x = -Math.PI / 2;
  legend.position.y = 0.0324;
  keyboard.add(legend);
}
// status LEDs
[-0.012, 0, 0.012].forEach((dx, i) => {
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 0.003), new THREE.MeshBasicMaterial({ color: i === 0 ? new THREE.Color(0.3, 2, 0.5) : 0x2a3a2a }));
  led.position.set(0.17 + dx * 1.0, 0.0215, -KB_D / 2 - 0.006);
  keyboard.add(led);
});

// 1990s three-button ball mouse: off-white egg-shaped shell, three buttons at the front, plain dome (no logo), cord from the front
const mouse3d = new THREE.Group();
mouse3d.position.set(0.42, 0.754, 0.3);
mouse3d.rotation.y = 0.12;
desk.add(mouse3d);
const MA = 0.032, MB = 0.057, MC = 0.022; // half-width, half-length, dome height
const mouseW = (zu) => 0.8 + 0.2 * (zu + 1) / 2; // narrower at the front (zu = -1), wider at the back (zu = +1)
const mouseGeo = new THREE.SphereGeometry(1, 56, 36);
{
  const p = mouseGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x * mouseW(z), y > 0 ? y : y * 0.12, z);
  }
  mouseGeo.computeVertexNormals();
}
const mouseWhite = new THREE.MeshStandardMaterial({ color: 0xcdcac0, roughness: 0.42, metalness: 0 });
const mouseShell = new THREE.Mesh(mouseGeo, mouseWhite);
mouseShell.scale.set(MA, MC, MB);
mouseShell.position.y = 0.003;
mouseShell.castShadow = true;
mouse3d.add(mouseShell);
const mouseSkirt = new THREE.Mesh(mouseGeo, mat(0xb9b5aa, 0.6)); // slightly wider grey base plate
mouseSkirt.scale.set(MA * 1.012, MC * 0.14, MB * 1.01);
mouseSkirt.position.y = 0.0018;
mouse3d.add(mouseSkirt);
// points on the dome surface, so the button grooves and the logo hug the curve
const domeY = (x, z) => {
  const zu = z / MB, xu = x / (MA * mouseW(zu));
  return MC * Math.sqrt(Math.max(0, 1 - xu * xu - zu * zu)) + 0.003;
};
const grooveMat = mat(0x6b685f, 0.7);
const groove = (pts, r) => { // thin dark channel following the dome
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, domeY(x, z) + 0.0002, z)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), grooveMat);
  mouse3d.add(m);
};
const zSeam = -0.012, zFront = -0.049;
const across = []; // where the three buttons meet the shell
for (let k = -6; k <= 6; k++) across.push([k * 0.0045, zSeam]);
groove(across, 0.00085);
[-0.0098, 0.0098].forEach((gx) => { // the two grooves between the buttons
  const along = [];
  for (let k = 0; k <= 8; k++) along.push([gx, zFront + (zSeam - zFront) * (k / 8)]);
  groove(along, 0.00085);
});
const mouseBoot = cyl(0.0028, 0.004, 0.012, mat(0x111113, 0.6), 0, 0.0072, -0.0585, mouse3d, 14); // cord strain relief
mouseBoot.rotation.x = Math.PI / 2;

// ---------- desk lamp ----------
const lamp = new THREE.Group();
lamp.position.set(-0.78, 0.75, -0.12);
desk.add(lamp);
const metal = mat(0x2a2a2e, 0.4, 0.6);
cyl(0.09, 0.1, 0.025, metal, 0, 0.0125, 0, lamp);
// classic two-arm desk lamp with a dome shade
const lampBlack = mat(0x1b1d22, 0.35, 0.7);
const lampBrass = mat(0xb08a3a, 0.3, 0.85);
function link(a, b, r, material, parent) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}
const lampA = new THREE.Vector3(0, 0.03, 0);
const lampB = new THREE.Vector3(0.1, 0.4, 0);
const lampC = new THREE.Vector3(0.3, 0.385, 0);
[-0.009, 0.009].forEach((z) => link(lampA.clone().setZ(z), lampB.clone().setZ(z), 0.0055, lampBlack, lamp)); // lower arm (two bars)
link(lampB, lampC, 0.0075, lampBlack, lamp); // upper arm
[lampA, lampB].forEach((p) => {
  const j = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 12), lampBrass);
  j.position.copy(p);
  lamp.add(j);
});
const dome = new THREE.Mesh(
  new THREE.SphereGeometry(0.075, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x1f5a45, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide })
);
dome.position.set(0.3, 0.31, 0);
lamp.add(dome);
const domeRim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.003, 8, 40), lampBrass);
domeRim.rotation.x = Math.PI / 2;
domeRim.position.set(0.3, 0.31, 0);
lamp.add(domeRim);
cyl(0.012, 0.012, 0.02, lampBrass, 0.3, 0.39, 0, lamp, 12);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 1.3) }));
bulb.position.set(0.3, 0.3, 0);
lamp.add(bulb);
const lampLight = new THREE.SpotLight(0xffb866, 18, 5, 0.85, 0.7, 1.6);
lampLight.position.set(-0.48, 1.03, -0.97);
lampLight.target.position.set(-0.15, 0.75, -0.65);
lampLight.castShadow = true;
lampLight.shadow.mapSize.set(1024, 1024);
lampLight.shadow.camera.near = 0.05; // the bulb is only ~0.3 m above the desk, so the default near plane let its light pass straight through the desktop
lampLight.shadow.bias = -0.0005;
scene.add(lampLight, lampLight.target);

// ---------- props on the desk ----------
// Scotch on the rocks (rocks glass, amber whisky, one ice cube)
const scotch = new THREE.Group();
scotch.position.set(0.7, 0.75, 0.22);
desk.add(scotch);
const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe0ee, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false });
const glassBody = cyl(0.042, 0.036, 0.09, glassMat, 0, 0.045, 0, scotch, 32);
glassBody.castShadow = false;
const glassBase = cyl(0.034, 0.034, 0.016, glassMat, 0, 0.008, 0, scotch, 32);
glassBase.castShadow = false;
const whisky = cyl(0.037, 0.034, 0.05, new THREE.MeshStandardMaterial({ color: 0xb35c0c, emissive: 0x8a3f06, emissiveIntensity: 1.3, roughness: 0.2, transparent: true, opacity: 0.95 }), 0, 0.044, 0, scotch, 32);
whisky.castShadow = false;
// ice cubes: slightly melted, irregular, glassy with faint cracks, half-submerged in the whisky
const iceCrackTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#c4dff0';
  g.fillRect(0, 0, 128, 128);
  let s = 21;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) { // internal cracks and frost
    g.strokeStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
    g.lineWidth = 0.8 + r() * 1.6;
    g.beginPath();
    let x = r() * 128, y = r() * 128;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.5})`; g.beginPath(); g.arc(r() * 128, r() * 128, 1 + r() * 3, 0, 7); g.fill(); } // trapped air bubbles
});
function iceCube(size, seed) {
  const geo = new RoundedBoxGeometry(size, size, size, 6, size * 0.3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { // uneven, melted surface
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 190 + seed) * Math.sin(y * 170 + seed * 2) * Math.sin(z * 210 + seed * 3);
    const k = 1 + 0.05 * n + 0.03 * Math.sin((x + y) * 90 + seed);
    p.setXYZ(i, x * k, y * (k - 0.03 * (y > 0 ? 1 : 0)), z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: 0xcfe6f7, map: iceCrackTex, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.34,
    clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.31, depthWrite: false,
  }));
  return m;
}
const ice1 = iceCube(0.03, 1.3);
ice1.position.set(0.007, 0.06, 0.004);
ice1.rotation.set(0.35, 0.7, 0.18);
scotch.add(ice1);
const ice2 = iceCube(0.024, 4.1);
ice2.position.set(-0.014, 0.05, -0.016);
ice2.rotation.set(-0.3, 0.2, 0.4);
scotch.add(ice2);
// clicking the glass makes the whisky slosh for a moment
const sloshState = { start: -10 };
scotch.userData.toggle = () => { sloshState.start = performance.now() / 1000; };
const ice1Base = ice1.position.clone(), ice2Base = ice2.position.clone();
function updateScotch() {
  const wt = performance.now() / 1000 - sloshState.start;
  const k = wt < 3 ? Math.exp(-wt * 2.4) : 0;
  whisky.rotation.x = Math.sin(wt * 21) * 0.07 * k;
  whisky.rotation.z = Math.cos(wt * 17) * 0.07 * k;
  whisky.position.y = 0.044 + Math.sin(wt * 29) * 0.0012 * k;
  ice1.position.set(ice1Base.x + Math.sin(wt * 17) * 0.0016 * k, ice1Base.y + Math.sin(wt * 29) * 0.0012 * k, ice1Base.z + Math.cos(wt * 21) * 0.0016 * k);
  ice2.position.set(ice2Base.x + Math.cos(wt * 19) * 0.0014 * k, ice2Base.y + Math.sin(wt * 31) * 0.001 * k, ice2Base.z + Math.sin(wt * 23) * 0.0014 * k);
}

// ashtray with a lit cigar

// the Diamond Crown cigar band (drawn by hand in the brand's black-and-gold style): text runs around the cigar, as on a real band
const dcBandTex = canvasTex(1024, 480, (g) => {
  // The band is drawn upright, the crown on top and the wording under it, then turned half way round on the canvas so that,
  // once it is wrapped on a cigar lying sideways, the whole label reads turned a quarter turn clockwise.
  g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, 1024, 480);
  g.translate(1024, 480);
  g.rotate(Math.PI);
  const gold = '#d4af4a';
  g.strokeStyle = gold;
  g.lineWidth = 9; g.beginPath(); g.moveTo(0, 10); g.lineTo(1024, 10); g.moveTo(0, 470); g.lineTo(1024, 470); g.stroke(); // gold edges all the way round
  g.lineWidth = 3; g.beginPath(); g.moveTo(0, 32); g.lineTo(1024, 32); g.moveTo(0, 448); g.lineTo(1024, 448); g.stroke();
  const label = (cx) => { // one complete label centred at cx (around the cigar)
    g.save(); g.translate(cx, 122); g.scale(2.1, 2.1); g.fillStyle = gold; // the crown, on top
    g.beginPath(); g.moveTo(-36, 16); g.lineTo(-42, -24); g.lineTo(-21, -5); g.lineTo(0, -34); g.lineTo(21, -5); g.lineTo(42, -24); g.lineTo(36, 16); g.closePath(); g.fill();
    g.fillRect(-36, 21, 72, 9);
    [[-42, -28], [0, -38], [42, -28]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill(); });
    g.restore();
    g.fillStyle = gold; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 74px Georgia, "Times New Roman", serif';
    if ('letterSpacing' in g) g.letterSpacing = '5px';
    g.fillText('DIAMOND', cx, 272); // the wording, below the crown
    g.fillText('CROWN', cx, 362);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  };
  label(512); // the front of the band
  label(0); label(1024); // and the back, split by the seam
}, 1, 1);
const dcBandMat = new THREE.MeshStandardMaterial({ map: dcBandTex, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
function dcBand(radius, width, parent, x, y, z) { // a band that goes around a cigar lying along x
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 32, 1, true, Math.PI, Math.PI * 2), dcBandMat);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

const cigarSet = new THREE.Group();
cigarSet.position.set(0.58, 0.75, 0.02);
desk.add(cigarSet);
cyl(0.062, 0.056, 0.018, mat(0x15151c, 0.15, 0.2), 0, 0.009, 0, cigarSet, 32);
cyl(0.05, 0.05, 0.004, mat(0x050507, 0.4), 0, 0.017, 0, cigarSet, 32);
const cigar = new THREE.Group();
cigarSet.add(cigar);
const cigarA = new THREE.Vector3(-0.02, 0.036, 0.0); // lit end
const cigarB = new THREE.Vector3(0.15, 0.009, 0.01); // mouth end
const cigarLen = cigarA.distanceTo(cigarB);
cigar.position.copy(cigarA).add(cigarB).multiplyScalar(0.5);
// build the cigar along local +X, then tilt it
cigar.rotation.set(0, 0, Math.atan2(cigarB.y - cigarA.y, cigarB.x - cigarA.x));
const cigarBody = cyl(0.0095, 0.0095, cigarLen, mat(0x5a3a1e, 0.85), 0, 0, 0, cigar, 14);
cigarBody.rotation.z = Math.PI / 2;
const cigarBand = dcBand(0.0099, 0.026, cigar, cigarLen * 0.28, 0, 0); // the real band, on the lit cigar too
const ember = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0088, 0.004, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.9, 0.15) }));
ember.rotation.z = Math.PI / 2;
ember.position.set(-cigarLen / 2 - 0.001, 0, 0);
cigar.add(ember);
const emberLight = new THREE.PointLight(0xff7a2a, 0.35, 0.6, 2);
emberLight.position.set(-cigarLen / 2 - 0.02, 0.02, 0);
cigar.add(emberLight);
const cigarHit = new THREE.Mesh(new THREE.BoxGeometry(cigarLen + 0.03, 0.035, 0.035), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
cigar.add(cigarHit); // makes the small cigar easy to click


// two boxes of Diamond Crown cigars (party only): one shut, one open
const cigarBoxes = new THREE.Group();
cigarBoxes.position.set(0, 0.75, 0);
desk.add(cigarBoxes);
{
  const BW = 0.17, BD = 0.14, BH = 0.04, WT = 0.004;
  const lacquer = mat(0x15110e, 0.45);
  const cedar = mat(0xa8643a, 0.8);
  const lidTop = new THREE.MeshStandardMaterial({ map: canvasTex(512, 422, (g) => {
    g.fillStyle = '#0f0d0c'; g.fillRect(0, 0, 512, 422);
    g.strokeStyle = '#d4af4a'; g.lineWidth = 8; g.strokeRect(14, 14, 484, 394);
    g.lineWidth = 2.5; g.strokeRect(30, 30, 452, 362);
    g.fillStyle = '#d4af4a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px Georgia, "Times New Roman", serif';
    g.fillText('DIAMOND', 256, 170); g.fillText('CROWN', 256, 245);
    g.font = '24px Georgia, serif'; g.fillText('H A N D M A D E   C I G A R S', 256, 330);
    g.save(); g.translate(256, 92); g.fillStyle = '#d4af4a'; // crown
    g.beginPath(); g.moveTo(-38, 14); g.lineTo(-44, -22); g.lineTo(-22, -4); g.lineTo(0, -32); g.lineTo(22, -4); g.lineTo(44, -22); g.lineTo(38, 14); g.closePath(); g.fill(); g.fillRect(-38, 18, 76, 8);
    g.restore();
  }, 1, 1), roughness: 0.4, metalness: 0.1 });
  // box 1: closed
  const shut = new THREE.Group();
  shut.position.set(0.86, 0, 0.3);
  shut.rotation.y = 0.15;
  cigarBoxes.add(shut);
  box(BW, BH - 0.006, BD, lacquer, 0, (BH - 0.006) / 2, 0, shut);
  box(BW + 0.004, 0.006, BD + 0.004, [lacquer, lacquer, lidTop, lacquer, lacquer, lacquer], 0, BH - 0.003, 0, shut);
  // box 2: open, the lid standing up at the back, cigars lying in rows on the cedar tray
  const open = new THREE.Group();
  open.position.set(0.84, 0, -0.2);
  open.rotation.y = -0.12;
  cigarBoxes.add(open);
  box(BW, WT, BD, cedar, 0, WT / 2, 0, open); // floor
  box(BW, BH, WT, lacquer, 0, BH / 2, BD / 2 - WT / 2, open); // front wall
  box(BW, BH, WT, lacquer, 0, BH / 2, -BD / 2 + WT / 2, open); // back wall
  box(WT, BH, BD, lacquer, -BW / 2 + WT / 2, BH / 2, 0, open); // side walls
  box(WT, BH, BD, lacquer, BW / 2 - WT / 2, BH / 2, 0, open);
  const wrapper = mat(0x4a2c14, 0.8);
  const cr = 0.0085, clen = BW - 2 * WT - 0.01;
  for (let i = 0; i < 7; i++) { // seven cigars, each with its band
    const z = -BD / 2 + WT + 0.0095 + i * (2 * cr + 0.0009);
    const cg = cyl(cr, cr, clen, wrapper, 0, WT + cr, z, open, 14);
    cg.rotation.z = Math.PI / 2;
    dcBand(cr + 0.0004, 0.024, open, 0.03, WT + cr, z);
  }
  const lid = new THREE.Group(); // hinged along the top of the back wall
  lid.position.set(0, BH, -BD / 2);
  lid.rotation.x = -(Math.PI / 2 + 0.2);
  open.add(lid);
  const lidInner = new THREE.MeshStandardMaterial({ map: lidTop.map, roughness: 0.4, metalness: 0.1 });
  const lp = box(BW + 0.004, 0.006, BD + 0.004, [lacquer, lacquer, lacquer, lidInner, lacquer, lacquer], 0, 0.003, (BD + 0.004) / 2, lid);
}

// green bottle of Dalmore whisky to the right of the cigar
const bottle = new THREE.Group();
bottle.position.set(0.9, 0.75, 0.02);
bottle.rotation.y = 0.35;
desk.add(bottle);
const bottleProfile = [[0, 0], [0.033, 0], [0.0365, 0.006], [0.0365, 0.095], [0.034, 0.112], [0.024, 0.126], [0.0145, 0.139], [0.0125, 0.16], [0.0135, 0.19], [0.0145, 0.196], [0, 0.196]].map(([rr, yy]) => new THREE.Vector2(rr, yy));
const greenGlass = new THREE.MeshPhysicalMaterial({ color: 0x1c5a34, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
bottle.add(new THREE.Mesh(new THREE.LatheGeometry(bottleProfile, 40), greenGlass));
const whiskyInBottle = new THREE.Mesh( // dark amber whisky behind the green glass
  new THREE.LatheGeometry([[0, 0.006], [0.0335, 0.006], [0.0345, 0.012], [0.0345, 0.092], [0.032, 0.108], [0.0225, 0.122], [0.0135, 0.135], [0, 0.135]].map(([rr, yy]) => new THREE.Vector2(rr, yy)), 32),
  new THREE.MeshStandardMaterial({ color: 0x7a3f08, emissive: 0x4a2403, emissiveIntensity: 1.0, roughness: 0.25 })
);
bottle.add(whiskyInBottle);
cyl(0.0153, 0.0153, 0.02, mat(0x14161a, 0.35, 0.6), 0, 0.186, 0, bottle, 24); // foil collar
const cork = cyl(0.0118, 0.0118, 0.028, mat(0x7a5a38, 0.9), 0, 0.208, 0, bottle, 20); // cork stopper
// clicking the bottle pulls the cork out and lays it on the desk; clicking again puts it back in
const corkState = { out: false, p: 0 };
bottle.userData.toggle = () => { corkState.out = !corkState.out; };
const ease = (x) => x * x * (3 - 2 * x);
function updateBottle(dt) {
  const goal = corkState.out ? 1 : 0, step = dt / 1.1;
  corkState.p = corkState.p < goal ? Math.min(goal, corkState.p + step) : Math.max(goal, corkState.p - step);
  const p = corkState.p;
  if (p < 0.4) { // straight up out of the neck
    cork.position.set(0, 0.208 + 0.075 * ease(p / 0.4), 0);
    cork.rotation.x = 0;
  } else { // swing over to the side, tipping over, and come down to lie on the desk
    const v = ease((p - 0.4) / 0.6);
    cork.position.set(0, 0.283 + (0.0118 - 0.283) * v + 0.04 * Math.sin(v * Math.PI), 0.095 * v);
    cork.rotation.x = v * Math.PI / 2;
  }
}
function drawStag(g, cx, cy, s) { // a front-facing royal stag: shaggy neck, ears, a 12-point set of antlers and a shaded head
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = '#2a2118';
  // shaggy neck mane behind the head
  const neck = [[-20, 24], [-26, 34], [-23, 44], [-28, 52], [-19, 58]];
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(-14, 8);
  neck.forEach(([x, y]) => g.lineTo(x, y));
  g.lineTo(0, 62);
  neck.slice().reverse().forEach(([x, y]) => g.lineTo(-x, y));
  g.lineTo(14, 8);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(239,229,200,0.3)'; g.lineWidth = 0.8;
  for (let i = 0; i < 34; i++) { // hair strokes
    const x = -22 + (i % 17) * 2.6 + (i > 16 ? 1.2 : 0), y = 20 + (i * 7) % 36;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < 0 ? -2.5 : 2.5), y + 7); g.stroke();
  }
  // ears
  [-1, 1].forEach((sd) => {
    g.save();
    g.translate(sd * 22, -17);
    g.rotate(-sd * 0.6);
    g.fillStyle = ink; g.beginPath(); g.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6f5d43'; g.beginPath(); g.ellipse(sd * -1, 0, 10, 3.6, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  });
  // antlers: main beam plus brow, bez, trez and a three-point crown on each side
  const beam = [[9, -17], [20, -25], [30, -38], [35, -52], [35, -66], [31, -79], [25, -88]];
  const tines = [
    [[13, -22], [15, -32], [12, -42], [8, -49]],
    [[22, -30], [24, -41], [20, -51], [15, -58]],
    [[31, -44], [29, -55], [23, -62]],
    [[35, -62], [42, -72], [44, -83]],
    [[34, -72], [37, -86], [34, -96]],
    [[28, -82], [23, -94], [16, -99]],
  ];
  const smooth = (pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  };
  [-1, 1].forEach((sd) => {
    const m = (pts) => pts.map(([x, y]) => [sd * x, y]);
    g.strokeStyle = ink; g.lineWidth = 5.2; smooth(m(beam)); g.stroke();
    g.lineWidth = 3.2; tines.forEach((t) => { smooth(m(t)); g.stroke(); });
    g.strokeStyle = 'rgba(239,229,200,0.42)'; g.lineWidth = 0.9; smooth(m(beam.map(([x, y]) => [x - 1.2, y]))); g.stroke(); // lit ridge
  });
  // head
  const hg = g.createLinearGradient(0, -22, 0, 50);
  hg.addColorStop(0, '#2a2118'); hg.addColorStop(0.55, '#4a3b2a'); hg.addColorStop(1, '#2a2118');
  g.fillStyle = hg;
  g.beginPath();
  g.moveTo(-13, -20);
  g.bezierCurveTo(-23, -8, -19, 16, -11, 36);
  g.lineTo(-8, 46);
  g.quadraticCurveTo(0, 53, 8, 46);
  g.lineTo(11, 36);
  g.bezierCurveTo(19, 16, 23, -8, 13, -20);
  g.quadraticCurveTo(0, -27, -13, -20);
  g.closePath();
  g.fill();
  g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = 'rgba(214,194,150,0.30)'; g.beginPath(); g.ellipse(0, 36, 8.5, 12, 0, 0, 7); g.fill(); // muzzle
  g.fillStyle = 'rgba(214,194,150,0.16)';
  [-1, 1].forEach((sd) => { g.beginPath(); g.ellipse(sd * 11, 14, 4.5, 14, sd * -0.12, 0, 7); g.fill(); }); // cheeks
  g.strokeStyle = 'rgba(239,229,200,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -22); g.lineTo(0, 18); g.stroke(); // brow ridge
  [-1, 1].forEach((sd) => { // eyes
    g.save();
    g.translate(sd * 12, -3);
    g.rotate(-sd * 0.3);
    g.fillStyle = '#120e0a'; g.beginPath(); g.ellipse(0, 0, 4.6, 2.4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(239,229,200,0.55)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 0, 5.4, 3.1, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#efe5c8'; g.beginPath(); g.arc(-1.3, -0.7, 0.9, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(239,229,200,0.3)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sd * 9, 4); g.quadraticCurveTo(sd * 8, 9, sd * 9, 13); g.stroke(); // tear line
  });
  g.fillStyle = '#0e0b08'; g.beginPath(); g.ellipse(0, 46, 7, 4.6, 0, 0, Math.PI * 2); g.fill(); // nose
  g.strokeStyle = 'rgba(239,229,200,0.5)'; g.lineWidth = 0.9;
  [-1, 1].forEach((sd) => { g.beginPath(); g.moveTo(sd * 3.6, 44.6); g.quadraticCurveTo(sd * 2.2, 47.6, sd * 1.4, 48); g.stroke(); });
  g.strokeStyle = 'rgba(239,229,200,0.4)'; g.beginPath(); g.moveTo(-7, 51); g.quadraticCurveTo(0, 55, 7, 51); g.stroke(); // mouth
  g.restore();
}
const labelTex = canvasTex(256, 236, (g) => {
  g.fillStyle = '#efe5c8'; g.fillRect(0, 0, 256, 236);
  g.strokeStyle = '#a8842f'; g.lineWidth = 4; g.strokeRect(8, 8, 240, 220);
  g.lineWidth = 1.5; g.strokeRect(15, 15, 226, 206);
  drawStag(g, 128, 86, 0.66);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#2a2118';
  g.font = 'bold 40px Georgia, "Times New Roman", serif';
  g.fillText('DALMORE', 128, 152);
  g.fillStyle = '#a8842f'; g.fillRect(52, 174, 152, 2);
  g.fillStyle = '#2a2118'; g.font = '14px Georgia, serif';
  g.fillText('SINGLE MALT HIGHLAND', 128, 191);
  g.fillText('SCOTCH WHISKY', 128, 208);
}, 1, 1);
const bottleLabel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.0372, 0.0372, 0.058, 32, 1, true, -0.85, 1.7),
  new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.7, side: THREE.DoubleSide })
);
bottleLabel.position.y = 0.056;
bottle.add(bottleLabel);
// stack of papers; the top sheet carries the title
const paperSide = mat(0xf1efe8, 0.9);
const paperTitleTex = canvasTex(420, 594, (g) => {
  g.fillStyle = '#f1efe8'; g.fillRect(0, 0, 420, 594);
  g.fillStyle = '#1b1b1d';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 40px Georgia, "Times New Roman", serif';
  ['What Do We Know', 'About Income', 'Shifting'].forEach((line, i) => g.fillText(line, 210, 190 + i * 54));
}, 1, 1);
const paperTitleMat = new THREE.MeshStandardMaterial({ map: paperTitleTex, roughness: 0.9 });
for (let i = 0; i < 6; i++) {
  const sheetMat = i === 5 ? [paperSide, paperSide, paperTitleMat, paperSide, paperSide, paperSide] : paperSide;
  const p = box(0.21, 0.003, 0.297, sheetMat, -0.66, 0.752 + i * 0.0032, 0.2, desk);
  p.rotation.y = 0.15 + i * 0.03;
}
// 3x3 Rubik's cube, lightly scrambled with real layer turns, resting on the mousepad
const rubik = new THREE.Group();
rubik.position.set(-0.36, 0.754 + 0.0289, 0.27);
rubik.rotation.y = 0.5;
desk.add(rubik);
let updateRubik = () => {};
{
  const P = 0.0192, S = 0.0188; // cubie spacing and size (tiny gaps between cubies)
  const plastic = mat(0x0e0e10, 0.45);
  const cols = { px: 0xc3191f, nx: 0xff6a13, py: 0xf2f2ee, ny: 0xf5d416, pz: 0x0f9e4b, nz: 0x0a49a8 };
  const stickerGeo = new THREE.ShapeGeometry(roundedRectShape(0.0158, 0.0158, 0.0028), 6);
  const stickerMats = {};
  Object.keys(cols).forEach((k) => { stickerMats[k] = new THREE.MeshStandardMaterial({ color: cols[k], roughness: 0.32 }); });
  const faces = { px: [1, 0, 0, 0, Math.PI / 2, 0], nx: [-1, 0, 0, 0, -Math.PI / 2, 0], py: [0, 1, 0, -Math.PI / 2, 0, 0], ny: [0, -1, 0, Math.PI / 2, 0, 0], pz: [0, 0, 1, 0, 0, 0], nz: [0, 0, -1, 0, Math.PI, 0] };
  const cubies = [];
  for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) for (let iz = -1; iz <= 1; iz++) {
    const c = new THREE.Group();
    c.position.set(ix * P, iy * P, iz * P);
    const body = new THREE.Mesh(new RoundedBoxGeometry(S, S, S, 2, 0.0022), plastic);
    body.castShadow = true;
    c.add(body);
    Object.entries(faces).forEach(([k, [nx, ny, nz, rx, ry, rz]]) => {
      if ((nx && nx !== ix) || (ny && ny !== iy) || (nz && nz !== iz)) return; // only the outside faces get a sticker
      const st = new THREE.Mesh(stickerGeo, stickerMats[k]);
      st.position.set(nx * (S / 2 + 0.0002), ny * (S / 2 + 0.0002), nz * (S / 2 + 0.0002));
      st.rotation.set(rx, ry, rz);
      c.add(st);
    });
    rubik.add(c);
    cubies.push(c);
  }
  const axisIndex = { x: 0, y: 1, z: 2 };
  const MOVES = [['y', 1, 1], ['x', 1, -1], ['z', -1, 1], ['y', -1, 1], ['x', -1, 1], ['z', 1, -1], ['y', 1, -1], ['x', 1, 1], ['z', -1, -1], ['y', -1, -1], ['x', -1, -1], ['z', 1, 1], ['y', 1, 1], ['x', -1, 1]];
  const axisVec = (axis) => new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const layerOf = (axis, layer) => cubies.filter((c) => Math.round([c.position.x, c.position.y, c.position.z][axisIndex[axis]] / P) === layer);
  const snap = (c) => { c.position.set(Math.round(c.position.x / P) * P, Math.round(c.position.y / P) * P, Math.round(c.position.z / P) * P); c.quaternion.normalize(); };
  MOVES.forEach(([axis, layer, dir]) => { // the starting scramble, done instantly
    const q = new THREE.Quaternion().setFromAxisAngle(axisVec(axis), (dir * Math.PI) / 2);
    layerOf(axis, layer).forEach((c) => { c.position.applyQuaternion(q); c.quaternion.premultiply(q); snap(c); });
  });
  // clicking the cube solves it, one animated layer turn at a time; clicking again scrambles it back the same way
  const cube = { scrambled: true, queue: [], cur: null, hop: 0 };
  const TURN = 0.24;
  rubik.userData.toggle = () => {
    if (cube.cur || cube.queue.length) return; // still turning
    cube.queue = cube.scrambled ? MOVES.slice().reverse().map(([a, l, d]) => [a, l, -d]) : MOVES.map((m) => m.slice());
    cube.scrambled = !cube.scrambled;
  };
  const baseY = rubik.position.y;
  updateRubik = (dt) => {
    if (!cube.cur && cube.queue.length) {
      const [axis, layer, dir] = cube.queue.shift();
      const pivot = new THREE.Group();
      rubik.add(pivot);
      const mem = layerOf(axis, layer);
      mem.forEach((c) => pivot.attach(c));
      cube.cur = { axis, dir, pivot, mem, t: 0 };
    }
    if (cube.cur) {
      const m = cube.cur;
      m.t = Math.min(1, m.t + dt / TURN);
      const e = m.t < 0.5 ? 4 * m.t * m.t * m.t : 1 - Math.pow(-2 * m.t + 2, 3) / 2; // ease in and out
      m.pivot.rotation[m.axis] = m.dir * (Math.PI / 2) * e;
      if (m.t >= 1) {
        m.mem.forEach((c) => { rubik.attach(c); snap(c); });
        rubik.remove(m.pivot);
        cube.cur = null;
      }
    }
    const busy = cube.cur || cube.queue.length;
    cube.hop += ((busy ? 1 : 0) - cube.hop) * (1 - Math.exp(-dt * 10));
    rubik.position.y = baseY + cube.hop * 0.004; // lifts a hair while it is being solved
  };
}

// ---------- bookshelf ----------
const shelf = new THREE.Group();
shelf.position.set(1.7, 0, -1.165); // pulled 3.5 cm forward so it stands in front of the baseboard
scene.add(shelf);
const shelfMat = mat(0x3b2a1c, 0.7);
box(0.04, 1.9, 0.3, shelfMat, -0.55, 0.95, 0, shelf);
box(0.04, 1.9, 0.3, shelfMat, 0.55, 0.95, 0, shelf);
box(1.06, 1.9, 0.02, mat(0x24170f, 0.9), 0, 0.95, -0.145, shelf); // back panel

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const range = (a, b) => a + rnd() * (b - a);
const BOOK_COLORS = [0x7a2430, 0x1f3556, 0x2f5a3a, 0xb8892f, 0x5a1f2e, 0x246a6a, 0xd8cfb4, 0x2b2d33, 0xa5502a, 0x4e2f5e, 0x6b6a2e, 0x4a7aa8, 0xa88a5a];
const TITLES = ['TAXATION', 'ACCOUNTING', 'Econometrics', 'Statistics', 'TAX NOTES', 'Corporate Finance', 'AUDIT', 'Ledger', 'Regression', 'Markets', 'GAAP', 'Law Review', 'Tax Law', 'Auditing', 'Financial Reporting', 'Cost Accounting', 'Managerial Accounting', 'Business Law', 'Microeconomics', 'Intermediate Accounting'];
const pagesMat = mat(0xddd2b4, 0.95);

function spineTexture(wm, hm, baseHex, forcedTitle) {
  const ppm = 1400;
  const cw = Math.max(32, Math.round(wm * ppm));
  const ch = Math.max(32, Math.round(hm * ppm));
  return canvasTex(cw, ch, (g) => {
    const vertical = ch >= cw;
    const S = vertical ? cw : ch;
    const L = vertical ? ch : cw;
    g.fillStyle = '#' + new THREE.Color(baseHex).getHexString();
    g.fillRect(0, 0, cw, ch);
    g.save();
    if (!vertical) { g.translate(0, ch); g.rotate(-Math.PI / 2); }
    const accent = pick(['#d4af5a', '#e9e0c4', '#c9ccd2', '#d4af5a']);
    const sh = g.createLinearGradient(0, 0, S, 0); // rounded-spine shading
    sh.addColorStop(0, 'rgba(0,0,0,0.42)');
    sh.addColorStop(0.28, 'rgba(255,255,255,0.1)');
    sh.addColorStop(0.65, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = sh;
    g.fillRect(0, 0, S, L);
    g.fillStyle = accent;
    g.globalAlpha = 0.9;
    const bands = Math.floor(rnd() * 3);
    if (bands >= 1) { g.fillRect(0, L * 0.07, S, S * 0.07); g.fillRect(0, L * 0.07 + S * 0.11, S, S * 0.025); }
    if (bands >= 2) g.fillRect(0, L * 0.9, S, S * 0.07);
    g.globalAlpha = 1;
    const picked = pick(TITLES);
    const title = forcedTitle || picked;
    g.fillStyle = accent;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.save();
    g.translate(S / 2, L * (forcedTitle ? 0.5 : range(0.44, 0.56)));
    g.rotate(Math.PI / 2);
    const fit = (text, size, maxLen) => { g.font = `bold ${size}px Georgia, serif`; const tw = g.measureText(text).width; if (tw > maxLen) { size *= maxLen / tw; g.font = `bold ${size}px Georgia, serif`; } return size; };
    if (title.length > 14 && S >= 40) { // long title: two lines stacked across the spine
      const words = title.split(' ');
      let best = 1, diff = 1e9, run = 0;
      words.forEach((wd, i) => { run += wd.length + 1; const dd = Math.abs(run - title.length / 2); if (i < words.length - 1 && dd < diff) { diff = dd; best = i + 1; } });
      const l1 = words.slice(0, best).join(' '), l2 = words.slice(best).join(' ');
      const size = Math.min(fit(l1, S * 0.27, L * 0.72), fit(l2, S * 0.27, L * 0.72));
      g.font = `bold ${size}px Georgia, serif`;
      g.fillText(l1, 0, -size * 0.62);
      g.fillText(l2, 0, size * 0.62);
    } else {
      fit(title, S * 0.4, L * 0.62);
      g.fillText(title, 0, 0);
    }
    g.restore();
    for (let i = 0; i < 40; i++) { // wear and scuffs
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${range(0.03, 0.08)})`;
      g.fillRect(rnd() * S, rnd() * L, range(1, 3), range(2, 10));
    }
    g.restore();
  });
}

const bookMeshes = [];
function makeBook(w, h, d, lying, title) {
  const baseHex = pick(BOOK_COLORS);
  const spine = new THREE.MeshStandardMaterial({ map: spineTexture(w, h, baseHex, title), roughness: 0.75 });
  const cover = mat(new THREE.Color(baseHex).multiplyScalar(0.8), 0.85);
  const mats = lying ? [pagesMat, pagesMat, cover, cover, spine, pagesMat] : [cover, cover, pagesMat, pagesMat, spine, pagesMat];
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.castShadow = true;
  m.receiveShadow = true;
  bookMeshes.push(m);
  return m;
}

// a row of upright books: uneven heights, depths, gaps, some pulled out or twisted
function standingRun(xStart, xEnd, base, maxH, specials = {}) { // specials: { n: title } puts that title on the n-th book of this run
  let x = xStart;
  let lastH = 0.3;
  let count = 0;
  for (;;) {
    if (x + 0.025 > xEnd) break;
    if (rnd() < 0.07) { x += range(0.02, 0.06); continue; }
    let w = range(0.022, 0.062);
    const special = specials[count + 1];
    if (special) w = Math.max(w, 0.052); // named books get a spine wide enough to read
    const h = range(0.19, maxH);
    const zf = 0.12 + (rnd() < 0.25 ? range(0.01, 0.035) : range(-0.025, 0.005));
    const d = Math.min(range(0.15, 0.26), zf + 0.125); // stay clear of the back panel (its front face is at z = -0.135)
    const twist = rnd() < 0.2 ? range(-0.06, 0.06) : 0;
    const ext = w * Math.cos(twist) + d * Math.abs(Math.sin(twist)); // sideways room a twisted book needs, so neighbours never touch it
    if (x + ext > xEnd) break;
    const book = makeBook(w, h, d, false, special);
    book.position.set(x + ext / 2, base + h / 2, zf - d / 2);
    book.rotation.y = twist;
    shelf.add(book);
    x += ext + 0.002;
    count++;
    lastH = h;
  }
  return { x, lastH };
}
// a book tipping over, resting its top corner against the last upright book
function leanBook(run, limit, base, maxH) {
  const a = range(0.16, 0.38);
  const w = range(0.03, 0.05);
  const d = range(0.16, 0.24);
  const h = Math.min(range(0.27, maxH - 0.02), run.lastH / Math.cos(a));
  const px = run.x + h * Math.sin(a) + 0.004;
  if (px + w * Math.cos(a) > limit || h < 0.18) return run.x;
  const grp = new THREE.Group();
  grp.position.set(px, base, 0.12 - d / 2);
  grp.rotation.z = a;
  const b = makeBook(w, h, d, false);
  b.position.set(w / 2, h / 2, 0);
  grp.add(b);
  shelf.add(grp);
  return px + w * Math.cos(a) + 0.01;
}
function lyingStack(xc, base, n) {
  let y = base;
  const maxHalf = Math.min(0.525 - xc, xc + 0.525) - 0.04; // stay inside the side boards
  for (let i = 0; i < n; i++) {
    const len = Math.min(range(0.2, 0.3), 2 * maxHalf);
    const th = range(0.028, 0.05);
    const d = range(0.17, 0.22);
    const b = makeBook(len, th, d, true);
    b.position.set(xc + range(-0.025, 0.025), y + th / 2, 0.115 - d / 2 + range(-0.01, 0.02));
    b.rotation.y = range(-0.09, 0.09);
    shelf.add(b);
    y += th;
  }
  return y;
}
function bookend(x, base, side) {
  const bm = mat(0x1f2024, 0.4, 0.7);
  box(0.075, 0.004, 0.1, bm, x, base + 0.002, 0.07, shelf);
  box(0.004, 0.12, 0.1, bm, x + side * 0.036, base + 0.06, 0.07, shelf);
}
function cactus(x, y, z) {
  // terracotta pot with a rim, dark soil and a few pebbles
  const terracotta = mat(0xb4623a, 0.85);
  cyl(0.026, 0.02, 0.036, terracotta, x, y + 0.018, z, shelf, 24);
  cyl(0.0295, 0.0295, 0.008, terracotta, x, y + 0.04, z, shelf, 24);
  cyl(0.0245, 0.0245, 0.002, mat(0x2a1a10, 1), x, y + 0.0436, z, shelf, 24);
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4;
    const peb = new THREE.Mesh(new THREE.SphereGeometry(0.0028 + (i % 3) * 0.0006, 6, 5), mat(i % 2 ? 0x8d8a84 : 0xb5afa3, 0.9));
    peb.position.set(x + Math.cos(a) * 0.016, y + 0.044, z + Math.sin(a) * 0.016);
    shelf.add(peb);
  }
  const ribTex = canvasTex(160, 64, (g) => { // ribbed, slightly speckled skin
    let s = 11;
    const rr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#4a8a52'); grad.addColorStop(1, '#2f6a3c');
    g.fillStyle = grad; g.fillRect(0, 0, 160, 64);
    for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(15,50,25,0.55)'; g.fillRect(k * 16 - 1.5, 0, 3, 64); g.fillStyle = 'rgba(140,200,120,0.18)'; g.fillRect(k * 16 + 4, 0, 4, 64); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(210,230,170,${rr() * 0.12})`; g.fillRect(rr() * 160, rr() * 64, 1.4, 1.4); }
  });
  const skin = new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.65 });
  const ribbed = (r, len, ribs, depth) => { // capsule with the surface pushed in and out to make ribs
    const geo = new THREE.CapsuleGeometry(r, len, 8, 40);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i);
      const k = 1 + depth * Math.cos(ribs * Math.atan2(pz, px));
      p.setX(i, px * k);
      p.setZ(i, pz * k);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const plant = new THREE.Group();
  plant.position.set(x, y + 0.043, z);
  shelf.add(plant);
  const trunk = new THREE.Mesh(ribbed(0.0155, 0.058, 10, 0.1), skin);
  trunk.position.y = 0.0445;
  trunk.castShadow = true;
  plant.add(trunk);
  // one side arm: out and then up
  const armOut = new THREE.Mesh(ribbed(0.0085, 0.02, 8, 0.1), skin);
  armOut.rotation.z = Math.PI / 2;
  armOut.position.set(0.0215, 0.038, 0);
  plant.add(armOut);
  const armUp = new THREE.Mesh(ribbed(0.0085, 0.026, 8, 0.1), skin);
  armUp.position.set(0.0335, 0.0545, 0);
  armUp.castShadow = true;
  plant.add(armUp);
  // spines: small clusters on every rib crest
  const spineGeo = new THREE.ConeGeometry(0.00033, 0.0052, 4);
  spineGeo.translate(0, 0.0026, 0);
  const spineMat = new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.6 });
  const spines = new THREE.InstancedMesh(spineGeo, spineMat, 10 * 9 * 5 + 8 * 4 * 4 + 8 * 5 * 4);
  const dummy = new THREE.Object3D();
  let n = 0;
  const cluster = (cx, cy, cz, nx, ny, nz, count) => { // spines radiating outward from an areole
    for (let s = 0; s < count; s++) {
      const a = (s / count) * Math.PI * 2;
      dummy.position.set(cx, cy, cz);
      dummy.lookAt(cx + nx, cy + ny, cz + nz);
      dummy.rotateX(Math.PI / 2 + 0.25 * Math.cos(a)); // cone axis along +y -> outward
      dummy.rotateZ(0.3 * Math.sin(a));
      dummy.updateMatrix();
      spines.setMatrixAt(n++, dummy.matrix);
    }
  };
  for (let k = 0; k < 10; k++) {
    const th = (k / 10) * Math.PI * 2;
    for (let j = 0; j < 9; j++) cluster(Math.cos(th) * 0.0168, 0.02 + j * 0.0054, Math.sin(th) * 0.0168, Math.cos(th), 0.15, Math.sin(th), 5);
  }
  for (let k = 0; k < 8; k++) {
    const th = (k / 8) * Math.PI * 2;
    for (let j = 0; j < 4; j++) cluster(0.0335 + Math.cos(th) * 0.0092, 0.046 + j * 0.0062, Math.sin(th) * 0.0092, Math.cos(th), 0.1, Math.sin(th), 4);
    for (let j = 0; j < 5; j++) cluster(0.0215 - 0.01 + j * 0.0052 - 0.0, 0.038 + Math.cos(th) * 0.0092, Math.sin(th) * 0.0092, 0, Math.cos(th), Math.sin(th), 4);
  }
  spines.count = n;
  spines.castShadow = false;
  plant.add(spines);
  // a small pink flower on top
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xe86a9c, roughness: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(0.0042, 0.011, 4), petalMat);
    petal.position.set(Math.cos(a) * 0.0045, 0.0875, Math.sin(a) * 0.0045);
    petal.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    plant.add(petal);
  }
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), mat(0xf4d35e, 0.6));
  bud.position.y = 0.0875;
  plant.add(bud);
}
function leafyPlant(x, y, z) {
  cyl(0.05, 0.04, 0.07, mat(0x5a6a7a, 0.6), x, y + 0.035, z, shelf, 16);
  const leaf = mat(0x2f7a4a, 0.7);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(range(0.03, 0.05), 8, 6), leaf);
    m.position.set(x + range(-0.04, 0.04), y + 0.09 + range(0, 0.07), z + range(-0.04, 0.04));
    m.castShadow = true;
    shelf.add(m);
  }
}
const globeState = { target: 'china', shown: 'china', chinaY: 0, usaY: 0, ball: null, maps: null };
let globeBall = null;
function updateGlobe(dt) { // smoothly spin to face the selected country, swapping the highlighted map part-way
  const b = globeState.ball;
  if (!b) return;
  const goal = globeState.target === 'china' ? globeState.chinaY : globeState.usaY;
  let d = goal - b.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  b.rotation.y += d * (1 - Math.exp(-dt * 3.5));
  if (globeState.shown !== globeState.target && Math.abs(d) < 1.1) { b.material.map = globeState.maps[globeState.target]; globeState.shown = globeState.target; }
}
function globe(x, base) {
  const brass = mat(0xb08a3a, 0.35, 0.8);
  const g = new THREE.Group();
  g.position.set(x, base, 0.0);
  shelf.add(g);
  // world map (equirectangular), China in red
  const W = 2048, H = 1024;
  const makeMap = (which) => canvasTex(W, H, (c) => {
    const P = (pts) => pts.map(([lo, la]) => [((lo + 180) / 360) * W, ((90 - la) / 180) * H]);
    const poly = (pts, fill, stroke) => {
      const q = P(pts);
      c.beginPath();
      c.moveTo(q[0][0], q[0][1]);
      q.slice(1).forEach(([px, py]) => c.lineTo(px, py));
      c.closePath();
      c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
    };
    const sea = c.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#1f5a8c'); sea.addColorStop(0.5, '#1a4f80'); sea.addColorStop(1, '#173f6a');
    c.fillStyle = sea; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5; // graticule
    for (let lo = -180; lo <= 180; lo += 30) { const px = ((lo + 180) / 360) * W; c.beginPath(); c.moveTo(px, 0); c.lineTo(px, H); c.stroke(); }
    for (let la = -60; la <= 60; la += 30) { const py = ((90 - la) / 180) * H; c.beginPath(); c.moveTo(0, py); c.lineTo(W, py); c.stroke(); }
    const land = '#d8c9a0', edge = '#8a7a52';
    const RED = () => '#cf2a2f';
    const STROKE = () => '#7a0f14';
    poly([[-9,43],[-9,37],[-5.5,36],[0,38.5],[3,43],[6,43.2],[8.5,44.3],[12.5,41.8],[16,38],[18.5,40.2],[13.5,45.5],[19,42],[23,40],[26,40.5],[29,41],[27,37],[31,36.5],[36,36.5],[35,33],[34,29.5],[36,28],[39,22],[43,13],[45,12.8],[52,16],[55,17.5],[58,19.5],[57,24],[52,24],[50.5,26.5],[48,30],[51,27],[56,26],[57,25.5],[61,25.2],[66.5,25.3],[70,22],[72.8,20],[73.5,16],[76.5,9],[77.5,8],[80,13],[80.3,15.8],[82,17],[87,21],[89,22],[91,22.5],[93,19.5],[94.5,17],[97.5,16.5],[98.5,13],[98.3,8],[100,6],[101.5,3],[103.5,1.5],[104.2,1.3],[103,5],[100.8,13.5],[102.5,12],[105,10],[107,10.5],[109,12],[108.5,15.5],[106.5,19.5],[108,21.5],[110,20.5],[113.5,22.3],[117,23.5],[120,26],[121.8,29.5],[121.5,31.7],[120.5,35],[119,37],[122.2,37.3],[119.5,39.2],[121.5,40.8],[124,39.8],[126.5,37.5],[126.5,34.5],[129,35.2],[129.4,37],[128,38.7],[127.5,39.8],[129.5,41],[131,42.5],[133,43],[135,43.8],[140,48],[141.5,52.5],[138,54.5],[135,54.5],[137,53.5],[142,59],[150,59.5],[156,61.5],[163,62],[165,60.5],[170,60],[177,62.5],[180,65],[180,68.8],[170,69.8],[160.5,69.5],[150,71.5],[140,72.5],[132,71.5],[128,72.5],[113,73.8],[106,77.5],[100,76.5],[95,76],[87,74],[80,73],[73,68.5],[68.5,68],[66,69.5],[60,69.5],[57,68.5],[53,68.8],[44,68.5],[40,67],[41,66],[34,66.5],[33,69.5],[28,71],[25,70.5],[18,69.8],[14,67.5],[12,65.5],[10,63.5],[7,62],[5,60.5],[5.5,58.5],[8,58],[10,59],[11,58.7],[12.5,56],[14.5,56],[16.5,57],[18.5,59.5],[17.5,60.5],[19.5,63],[21.5,65.3],[25,65.5],[24.5,64.5],[22,63],[21.5,61.5],[23,60.3],[26,60.5],[29.8,60.2],[24,59.5],[23.5,58],[21.2,57],[21,55],[19.5,54.5],[14.5,54],[10.5,54],[9.5,57],[8.2,55.5],[8.8,54],[7,53.5],[4.5,52],[3.5,51.2],[1.5,50.8],[-1.5,49.5],[-4.5,48.5],[-1.5,46.5],[-1.5,44]], land, edge);
    poly([[-17,21],[-16,14.5],[-17.5,14.7],[-13,9],[-8,4.5],[-4,5.2],[1,6],[4,6.4],[8,4.3],[9.5,3.5],[9,0],[13,-5],[12,-6],[13.5,-12],[14,-17],[12,-17.5],[15,-27],[17,-29],[18,-32.5],[20,-34.8],[26,-34],[31,-30],[33,-26],[35,-23.5],[35.5,-20],[40,-16.5],[41,-12],[39,-7],[41,-1.8],[43,1],[46,3],[51,10.5],[51,12],[44,10.5],[43.2,12.5],[41,14.5],[38.8,18],[37,21],[35,24.5],[33,28],[32.5,30],[30,31],[25,32],[20,32],[20,30.3],[15,32],[11,33],[10,37],[5,36.8],[0,35.8],[-5.5,35.8],[-9.5,32],[-13,28]], land, edge);
    poly([[44,-25],[47,-25],[50,-15],[49,-12],[47,-15],[44,-20]], land, edge);
    poly([[-168,66],[-164,68.5],[-156.5,71.3],[-141,69.7],[-128,70],[-115,68],[-108,68],[-96,68],[-95,72],[-85,69.5],[-82,66],[-88,64],[-93,61],[-94.5,58.7],[-92,57],[-85,55.2],[-82,52.8],[-79,51.5],[-79,54],[-77,57],[-78,62],[-72,61.5],[-68,58.5],[-65,60.5],[-61.5,56],[-56,52],[-60,50.2],[-66,50.2],[-64.5,48.8],[-64.5,46],[-61,45.5],[-66,44],[-70,43.5],[-70,41.7],[-74,40.5],[-76,37.5],[-76,35],[-81,31.5],[-80,27],[-80.3,25.2],[-82.7,28],[-83,30],[-86,30.4],[-89,30.2],[-90,29],[-94,29.5],[-97.2,27.5],[-97.7,22],[-97,20],[-95,18.5],[-91,18.7],[-90.5,21],[-87,21.5],[-88,18],[-87.5,15.8],[-84,15.5],[-83.5,11],[-81,8.8],[-79,9.5],[-77.5,8.5],[-78,7.5],[-80.5,7.3],[-83,8.3],[-86,11],[-87.5,13],[-91.5,14],[-94,16],[-97,15.8],[-101,17.5],[-105.5,20],[-105.5,23],[-109,26],[-112.5,30],[-114.7,31.5],[-112,27],[-110,23],[-110.3,23.2],[-112.2,25],[-114.5,28.5],[-117,32.5],[-120.5,34.5],[-122.5,37.5],[-124,40.5],[-124.5,43],[-124,46.5],[-124.7,48.4],[-127.5,50.5],[-130,54],[-133,57],[-137,58.5],[-141,60],[-146,60.5],[-150,59.5],[-152,58],[-157,56.5],[-162,55],[-165,54.8],[-160,58],[-162,59.5],[-165,61],[-166,64.5]], land, edge);
    poly([[-73,78],[-60,82],[-30,83.5],[-18,81.5],[-20,75],[-22,70],[-31,68],[-40,65],[-43,60],[-50,62],[-53,67],[-55,70],[-68,76]], land, edge);
    poly([[-77,8.5],[-72,12],[-67,10.7],[-62,10.7],[-60,8.5],[-55,6],[-52,4.5],[-50,1],[-48,-1],[-44,-2.5],[-38,-4],[-35,-6],[-35,-9],[-38.5,-13],[-39,-17.5],[-41,-22],[-45,-23.5],[-48.5,-26],[-49,-29],[-53,-33.5],[-57,-35],[-57.5,-38],[-62,-39],[-65,-41],[-64,-44],[-67.5,-46],[-66,-48],[-69,-51],[-68.5,-53],[-71,-54],[-74,-52],[-75,-47],[-73.5,-42],[-73.5,-37],[-71.5,-30],[-70.5,-18.5],[-75,-15.5],[-79,-8],[-81,-5],[-80,-2],[-80,0.5],[-78.5,2],[-77.5,6]], land, edge);
    poly([[113,-22],[114,-26],[115,-34],[118,-35],[123,-34],[129,-31.5],[135,-34.5],[138,-35],[140,-38],[145,-38.5],[150,-37.5],[153,-31],[153.5,-26],[149,-20],[146,-19],[145.5,-15],[143,-11],[142,-10.7],[141.5,-13],[139.5,-17.5],[136,-15],[137,-12],[132,-11.3],[130,-13],[127,-14],[126,-14.5],[122,-17.5],[120,-20],[116,-20.7]], land, edge);
    poly([[130,31],[131.5,34],[135,35.5],[140,41],[141.5,45],[142,43],[141,40],[142,37],[140.8,35.2],[138,34.5],[135,33.8],[132,33]], land, edge); // Japan
    poly([[-5,50],[1.5,51],[1.8,53],[-1,55],[-2,57.5],[-4,58.5],[-6,56.5],[-5,54.5],[-3,53.5],[-4.5,52]], land, edge); // Britain
    poly([[95,5.5],[98,4],[104,-2],[106,-6],[103,-5],[98,0.5]], land, edge); // Sumatra
    poly([[109,1.5],[111,2],[117,7],[119,5],[118,1],[116,-3.8],[111,-3],[109,-0.5]], land, edge); // Borneo
    poly([[-180,-70],[-120,-73],[-60,-72],[0,-70],[60,-68],[120,-66],[180,-70],[180,-90],[-180,-90]], '#e8eef2', edge); // Antarctica
    poly([[-124.7,48.4],[-123,49],[-95,49],[-94.6,48.7],[-89.5,48],[-84.8,46.8],[-82.5,45.3],[-82.5,43],[-79,43.3],[-76.5,44.2],[-74.8,45],[-71.5,45],[-69.2,47.4],[-67.8,47],[-67,45],[-70,43.6],[-70.8,42],[-70,41.7],[-72,41],[-74,40.5],[-76,37.5],[-76,35],[-78,33.8],[-81,31.5],[-80,27],[-80.3,25.2],[-82.7,28],[-83,30],[-86,30.4],[-89,30.2],[-90,29],[-94,29.5],[-97.2,27.5],[-99.5,27.5],[-101,29.5],[-103,29],[-104.5,29.7],[-106.5,31.8],[-108.2,31.8],[-111,31.3],[-114.8,32.5],[-117.1,32.5],[-118.5,34],[-120.5,34.5],[-122.5,37.5],[-124,40.5],[-124.5,43],[-124,46.5]], RED('usa'), STROKE('usa'));
    poly([[-141,69.6],[-156.5,71.3],[-166,68.5],[-164,66.5],[-168,65.6],[-162,63.5],[-165,61],[-162,59.5],[-157,56.5],[-162,55],[-165,54.8],[-157,57],[-152,59],[-146,60.5],[-141,60],[-137,58.5],[-134,56.5],[-130,55],[-130,56.5],[-135,59.5],[-141,60.3]], RED('usa'), STROKE('usa')); // Alaska
    poly([[-160.3,22],[-159.3,22.3],[-157,21.2],[-155,19.5],[-155.7,18.9],[-156.9,20.7]], RED('usa'), STROKE('usa')); // Hawaii
    // China
    poly([[73.5,39.5],[75,37],[78,35.5],[79,32],[81,30.5],[85,28.5],[88,27.8],[92,27.8],[96,28.3],[97.5,28.5],[98.5,25],[97.7,24.2],[99.5,22.2],[101.5,21.2],[103,22.5],[105.5,23],[106.7,22.8],[108,21.6],[110.5,20.4],[110.2,21.5],[113,22],[116,22.8],[119,25],[120.5,27],[122,29.5],[121.5,31.5],[120.8,34],[119.2,35.2],[121.5,37.5],[118.8,37.5],[118,39],[121,40.8],[122.5,40.5],[124.3,40],[126,41.5],[128,42],[130.5,42.8],[131,44.8],[133,47.5],[135,48.4],[131,47.7],[130,48.8],[127.5,50],[126,52.5],[121.5,53.3],[120,52],[117.5,49.7],[116,47.8],[119.2,46.7],[117.4,46.6],[113.5,44.7],[111.8,45.2],[111,43.5],[105.5,41.7],[100,42.6],[96.4,42.7],[95,44],[91,45.2],[90.5,47.5],[87.5,49.2],[85.5,47],[82.5,45.2],[80.5,45],[79.5,42.5],[74.8,40.5]], RED('china'), STROKE('china'));
    poly([[120,22],[122,25.2],[121,25.2]], RED('china'), STROKE('china')); // Taiwan
    poly([[108.6,18.3],[111,19.9],[110.6,20.1],[108.7,19.2]], RED('china'), STROKE('china')); // Hainan
    [['CHINA', 104, 35.5], ['USA', -98, 39]].forEach(([label, lo, la]) => {
      const [lx, ly] = P([[lo, la]])[0];
      c.font = 'bold 46px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 6; c.strokeStyle = 'rgba(90,10,14,0.9)'; c.strokeText(label, lx, ly);
      c.fillStyle = '#fff'; c.fillText(label, lx, ly);
    });
  });
  const texChina = makeMap('china');
  const texUsa = texChina; // both countries are always highlighted
  cyl(0.065, 0.07, 0.012, mat(0x3a2a1c, 0.5), 0, 0.006, 0, g, 24);
  cyl(0.008, 0.008, 0.12, brass, 0, 0.07, 0, g, 10);
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.2, 0);
  tilt.rotation.set(0.3, 0, 0.38); // axial tilt, leaning slightly toward the room
  g.add(tilt);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 48, 32), new THREE.MeshStandardMaterial({ map: texChina, roughness: 0.45 }));
  // spin the ball so China (about 104 deg east) faces the front of the room (+z)
  const faceLon = (lon) => { const ph = ((lon + 180) / 360) * Math.PI * 2; return Math.atan2(Math.sin(ph), -Math.cos(ph)) - Math.PI / 2; };
  globeState.chinaY = faceLon(104);
  globeState.usaY = faceLon(-98);
  ball.rotation.y = globeState.chinaY;
  globeState.ball = ball;
  globeState.maps = { china: texChina, usa: texUsa };
  // clicking the globe turns it to the other country; the red highlight follows
  ball.userData.toggle = () => { globeState.target = globeState.target === 'china' ? 'usa' : 'china'; };
  globeBall = ball;
  ball.castShadow = true;
  tilt.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 8, 48), brass);
  ring.rotation.y = 0.4;
  tilt.add(ring);
}

function photoFrame(x, base) {
  const g = new THREE.Group();
  g.position.set(x, base, 0.03);
  g.rotation.x = -0.2;
  shelf.add(g);
  box(0.13, 0.17, 0.01, mat(0x2a1d12, 0.5), 0, 0.085, 0, g); // frame
  box(0.115, 0.155, 0.004, mat(0xe9e2d0, 0.9), 0, 0.085, 0.007, g); // mat
  const tex = loadScrambledTexture('photo2.bin');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const p = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.1333),
    new THREE.MeshStandardMaterial({ map: tex, color: 0xe2d6c6, roughness: 0.65, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05 })
  );
  p.position.set(0, 0.085, 0.0095);
  g.add(p);
}


// ---------- party mode: the books turn into bottles of well-known wines and whiskies ----------
const partyShelf = new THREE.Group();
partyShelf.visible = false;
shelf.add(partyShelf);
const BRANDS = [
  // [name, kind, glass, label background, label ink, small print, cap colour]
  ['CHÂTEAU MARGAUX', 'wine', 0x1b3a22, '#efe6cf', '#2a2118', '1855 · MARGAUX', 0x5a1620],
  ['OPUS ONE', 'wine', 0x141c14, '#121212', '#d9c27a', 'NAPA VALLEY', 0x111111],
  ['PENFOLDS GRANGE', 'wine', 0x1d3b26, '#e8dcc0', '#5a1d1d', 'SOUTH AUSTRALIA', 0x2a1a10],
  ['SASSICAIA', 'wine', 0x20361f, '#f2ecd8', '#7a1e1e', 'BOLGHERI', 0x7a1e1e],
  ['CAYMUS', 'wine', 0x15231a, '#e9e2cf', '#222222', 'CABERNET SAUVIGNON', 0x1a1a1a],
  ['BAREFOOT', 'wine', 0x2a4a2a, '#f6efe0', '#c1272d', 'MERLOT', 0x1c1c1c],
  ['YELLOW TAIL', 'wine', 0x24402a, '#1a1a1a', '#f2c218', 'SHIRAZ', 0xf2c218],
  ['JOSH CELLARS', 'wine', 0x1c3322, '#e8e0cc', '#243a5a', 'PINOT NOIR', 0x243a5a],
  ['KENDALL-JACKSON', 'wine', 0x203a24, '#ede5d0', '#2a4a2a', 'CHARDONNAY', 0xb89a4a],
  ['CHÂTEAU LAFITE', 'wine', 0x1a2f1d, '#efe7d2', '#3a1d1d', 'PAUILLAC', 0x3a1d1d],
  ['SILVER OAK', 'wine', 0x18281c, '#f0e8d4', '#6a1818', 'ALEXANDER VALLEY', 0x6a1818],
  ['DOM PÉRIGNON', 'champagne', 0x0f1a12, '#121212', '#e8d9a0', 'CHAMPAGNE', 0xc9a227],
  ['MOËT & CHANDON', 'champagne', 0x1c3a22, '#f2ecd8', '#2a2118', 'IMPÉRIAL', 0x1c1c1c],
  ['VEUVE CLICQUOT', 'champagne', 0x2a4a2a, '#f2b51f', '#2a2118', 'BRUT', 0xf2b51f],
  ['KRUG', 'champagne', 0x1c2a1c, '#e9dfc0', '#222222', 'GRANDE CUVÉE', 0xc9a227],
  ['JOHNNIE WALKER', 'whisky', 0x8a5a1a, '#e9dfc3', '#222222', 'BLACK LABEL', 0x111111],
  ["JACK DANIEL'S", 'whisky', 0xaab8ae, '#111111', '#f1ede0', 'OLD NO. 7', 0x111111],
  ['JAMESON', 'whisky', 0x1f4a2a, '#f1ead0', '#1f4a2a', 'IRISH WHISKEY', 0x1f4a2a],
  ['THE MACALLAN', 'whisky', 0x8a5a1a, '#efe3c0', '#6a1818', 'SHERRY OAK', 0x2a1a10],
  ['GLENFIDDICH', 'whisky', 0x2a5a3a, '#e9e2cf', '#243a24', '12 YEAR', 0x1c1c1c],
  ['THE GLENLIVET', 'whisky', 0x8a5a1a, '#f0e6c8', '#2a4a2a', 'FOUNDER\u2019S RESERVE', 0x1c1c1c],
  ['JIM BEAM', 'whisky', 0x9a6a22, '#f4f0e4', '#222222', 'KENTUCKY BOURBON', 0x111111],
  ["MAKER'S MARK", 'whisky', 0x8a5a1a, '#efe6cc', '#8a1e1e', 'KENTUCKY BOURBON', 0xa3191f],
  ['CHIVAS REGAL', 'whisky', 0x7a4a14, '#eadfc0', '#4a1a2a', '12 YEAR', 0x1c1c1c],
  ['LAPHROAIG', 'whisky', 0x6a4a14, '#f2ecd8', '#222222', 'ISLAY SINGLE MALT', 0x1c1c1c],
  ['TALISKER', 'whisky', 0x7a4a14, '#e9e0c6', '#1f3a5a', 'ISLE OF SKYE', 0x1c1c1c],
  ['HENNESSY', 'whisky', 0x6a3a10, '#eadfc0', '#5a2a10', 'V.S.O.P COGNAC', 0x2a1a10],
  ['WOODFORD RESERVE', 'whisky', 0x8a5a1a, '#ece2c4', '#2a2118', 'KENTUCKY BOURBON', 0x7a5a2a],
];
const BOTTLE_SHAPES = { // outline (radius, height) of each bottle, label size and how full it is
  wine: { r: 0.036, pts: [[0, 0], [0.033, 0], [0.036, 0.006], [0.036, 0.15], [0.0345, 0.17], [0.025, 0.19], [0.0135, 0.212], [0.0125, 0.26], [0.0135, 0.272], [0.0135, 0.285], [0, 0.285]], fill: 5, label: [0.088, 0.085], labelY: 0.09, capH: 0.05, capY: 0.262, capR: 0.0148 },
  champagne: { r: 0.043, pts: [[0, 0], [0.037, 0], [0.043, 0.008], [0.043, 0.14], [0.04, 0.18], [0.03, 0.22], [0.0185, 0.255], [0.0165, 0.3], [0.0185, 0.315], [0, 0.315]], fill: 4, label: [0.1, 0.1], labelY: 0.1, capH: 0.085, capY: 0.275, capR: 0.0215 },
  whisky: { r: 0.04, pts: [[0, 0], [0.037, 0], [0.04, 0.005], [0.04, 0.14], [0.0385, 0.16], [0.028, 0.19], [0.016, 0.208], [0.0145, 0.235], [0.0155, 0.245], [0, 0.245]], fill: 4, label: [0.1, 0.095], labelY: 0.085, capH: 0.032, capY: 0.235, capR: 0.0178 },
};
function bottleLabelTex(b, w, h) {
  const [name, , , bg, ink, small] = b;
  const H = Math.round(256 * h / w);
  return canvasTex(256, H, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, H);
    g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(8, 8, 240, H - 16);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = name.split(' ');
    const lines = name.length > 11 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [name];
    let size = 54;
    g.font = 'bold ' + size + 'px Georgia, "Times New Roman", serif';
    while (size > 14 && Math.max(...lines.map((l) => g.measureText(l).width)) > 210) { size -= 2; g.font = 'bold ' + size + 'px Georgia, "Times New Roman", serif'; }
    const y0 = H * 0.4 - ((lines.length - 1) * size * 0.6) / 2;
    lines.forEach((l, i) => g.fillText(l, 128, y0 + i * size * 1.15));
    g.fillRect(60, H * 0.66, 136, 3);
    g.font = '19px Georgia, serif';
    g.fillText(small, 128, H * 0.8);
  }, 1, 1);
}
function makeBottle(b) {
  const [, kind, glassHex, , , , capHex] = b;
  const S = BOTTLE_SHAPES[kind];
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.LatheGeometry(S.pts.map(([r, y]) => new THREE.Vector2(r, y)), 28), new THREE.MeshPhysicalMaterial({ color: glassHex, roughness: 0.08, transparent: true, opacity: 0.84, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }));
  g.add(glass);
  const liquidCol = kind === 'wine' ? 0x3a0a12 : kind === 'champagne' ? 0xc9a24a : 0x8a4a0a;
  const lp = S.pts.slice(0, S.fill + 1).map(([r, y]) => new THREE.Vector2(r * 0.93, Math.max(y, 0.005)));
  lp.push(new THREE.Vector2(0, lp[lp.length - 1].y));
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(lp, 24), new THREE.MeshStandardMaterial({ color: liquidCol, emissive: liquidCol, emissiveIntensity: kind === 'wine' ? 0.25 : 0.7, roughness: 0.25 }));
  g.add(liquid);
  const cap = cyl(S.capR, S.capR, S.capH, mat(capHex, 0.35, kind === 'champagne' ? 0.5 : 0.2), 0, S.capY + S.capH / 2, 0, g, 20);
  cap.castShadow = false;
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(S.r + 0.0009, S.r + 0.0009, S.label[1], 28, 1, true, -0.85, 1.7),
    new THREE.MeshStandardMaterial({ map: bottleLabelTex(b, S.label[0], S.label[1]), roughness: 0.7, side: THREE.DoubleSide })
  );
  label.position.y = S.labelY;
  g.add(label);
  return g;
}
const brandRand = (() => { let s = 404; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
let brandBag = [];
function nextBrand() {
  if (!brandBag.length) { brandBag = BRANDS.slice(); for (let i = brandBag.length - 1; i > 0; i--) { const j = Math.floor(brandRand() * (i + 1)); [brandBag[i], brandBag[j]] = [brandBag[j], brandBag[i]]; } }
  return brandBag.pop();
}
// a row of bottles standing side by side on a shelf, each turned a little differently
function bottleRun(xStart, xEnd, base) {
  let x = xStart;
  for (;;) {
    const brand = nextBrand();
    const r = BOTTLE_SHAPES[brand[1]].r;
    if (x + 2 * r > xEnd) break;
    const b = makeBottle(brand);
    b.position.set(x + r, base, 0.035);
    b.rotation.y = (brandRand() - 0.5) * 0.7;
    partyShelf.add(b);
    x += 2 * r + 0.004 + brandRand() * 0.012;
  }
}
// a wooden wine crate takes the place of a pile of lying books
function wineCrate(xc, base, top, text) {
  const wood = mat(0x8a6238, 0.8);
  const front = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (g) => {
    g.fillStyle = '#8a6238'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(60,35,15,' + (0.05 + (i % 5) * 0.015) + ')'; g.fillRect(0, (i * 37) % 128, 256, 1); }
    g.fillStyle = '#2a1a0c'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 58); g.font = '16px Georgia, serif'; g.fillText('PRODUCE OF FRANCE', 128, 92);
    g.strokeStyle = '#2a1a0c'; g.lineWidth = 3; g.strokeRect(10, 10, 236, 108);
  }, 1, 1), roughness: 0.8 });
  return box(0.27, top - base, 0.19, [wood, wood, wood, wood, front, wood], xc, (top + base) / 2, 0.02, partyShelf);
}

[0.05, 0.5, 0.95, 1.4, 1.88].forEach((y, level) => {
  box(1.06, 0.035, 0.285, shelfMat, 0, y, 0.0075, shelf);
  const base = y + 0.0175;
  if (level === 0) {
    const run = standingRun(-0.51, 0.12, base, 0.4, { 4: 'JATA', 9: 'ACTG 424' });
    leanBook(run, 0.19, base, 0.4);
    const top = lyingStack(0.36, base, 4);
    cactus(0.36, top, 0.07);
    bottleRun(-0.51, 0.14, base);
    wineCrate(0.36, base, top, 'BORDEAUX');
  } else if (level === 1) {
    const run = standingRun(-0.51, -0.1, base, 0.4, { 3: 'Heart of the Swarm' });
    leanBook(run, -0.045, base, 0.4);
    photoFrame(0.04, base);
    standingRun(0.17, 0.51, base, 0.4, { 3: 'Bible' });
    bottleRun(-0.51, -0.09, base);
    bottleRun(0.17, 0.51, base);
  } else if (level === 2) {
    const run = standingRun(-0.51, 0.36, base, 0.4, { 6: 'The Hitchhiker\x27s Guide to the Galaxy' });
    leanBook(run, 0.42, base, 0.4);
    bookend(0.49, base, -1);
    bottleRun(-0.51, 0.41, base);
  } else if (level === 3) {
    globe(-0.36, base);
    const run = standingRun(-0.2, 0.36, base, 0.43, { 5: 'Into the Wild' });
    leanBook(run, 0.5, base, 0.43);
    bottleRun(-0.2, 0.5, base);
  } else {
    const top4 = lyingStack(0.22, base, 3);
    wineCrate(0.22, base, top4, 'CHAMPAGNE');
    leafyPlant(-0.3, base, 0.02);
  }
});

// ---------- framed photo on the wall ----------
const frame = new THREE.Group();
frame.position.set(-1.25, 1.7, -1.33);
scene.add(frame);
{ const fw = mat(0x2a1b10, 0.45); // wooden frame: four bars around the opening
  box(0.6, 0.04, 0.03, fw, 0, 0.41, 0, frame); box(0.6, 0.04, 0.03, fw, 0, -0.41, 0, frame);
  box(0.04, 0.78, 0.03, fw, -0.28, 0, 0, frame); box(0.04, 0.78, 0.03, fw, 0.28, 0, 0, frame); }
box(0.52, 0.78, 0.02, mat(0xe9e2d0, 0.9), 0, 0, 0.012, frame); // mat board
const photoTex = loadScrambledTexture('photo.bin');
photoTex.colorSpace = THREE.SRGBColorSpace;
photoTex.anisotropy = 8;
const photo = new THREE.Mesh(
  new THREE.PlaneGeometry(0.44, 0.66),
  new THREE.MeshStandardMaterial({ map: photoTex, color: 0xe2d6c6, roughness: 0.65, emissive: 0xffffff, emissiveMap: photoTex, emissiveIntensity: 0.06 })
);
photo.position.z = 0.023;
frame.add(photo);
// during the party the wall portrait is swapped for another photo (also stored scrambled, so it is never a downloadable file)
const partyPhotoTex = loadScrambledTexture('portrait_party.bin');
partyPhotoTex.colorSpace = THREE.SRGBColorSpace;
partyPhotoTex.anisotropy = 8;
partyPhotoTex.repeat.set((0.44 / 0.66) / (1500 / 2000), 1); // the photo is a little wider than the frame's opening: trim its sides
partyPhotoTex.offset.set((1 - partyPhotoTex.repeat.x) / 2, 0);
// small brass picture light above the frame
box(0.2, 0.012, 0.05, mat(0xb08a3a, 0.3, 0.8), 0, 0.46, 0.02, frame);
box(0.012, 0.024, 0.012, mat(0xb08a3a, 0.3, 0.8), 0, 0.442, 0.02, frame);
const pictureLight = new THREE.SpotLight(0xffd8a8, 2.2, 3, 0.6, 0.9, 1.6);
pictureLight.position.set(-1.25, 2.2, -1.1);
pictureLight.target.position.set(-1.25, 1.7, -1.33);
scene.add(pictureLight, pictureLight.target);

// ---------- mini Christmas tree on a little stool ----------
const tree = new THREE.Group();
tree.position.set(-1.6, 0, -1.0);
scene.add(tree);
const stoolWood = mat(0x4a3324, 0.6);
cyl(0.2, 0.2, 0.03, stoolWood, 0, 0.435, 0, tree, 28); // seat (top at 0.45)
[0, 1, 2].forEach((i) => {
  const a = (i * Math.PI * 2) / 3 + 0.5;
  cyl(0.015, 0.012, 0.42, stoolWood, Math.cos(a) * 0.14, 0.21, Math.sin(a) * 0.14, tree, 8);
});
cyl(0.085, 0.065, 0.1, mat(0xa3262a, 0.5), 0, 0.5, 0, tree, 20); // red pot
cyl(0.088, 0.088, 0.01, mat(0xc9a227, 0.35, 0.7), 0, 0.553, 0, tree, 20); // gold rim
cyl(0.075, 0.075, 0.004, mat(0x2a1a10, 1), 0, 0.552, 0, tree, 20); // soil
cyl(0.015, 0.02, 0.15, mat(0x4a3020, 0.9), 0, 0.62, 0, tree, 8); // trunk
// soft, bushy tiers: smooth shading, a scalloped drooping skirt and a needle texture (no hard facets)
const needleTex = canvasTex(128, 128, (g) => {
  let s = 17;
  const rr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#2a6a3a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(${rr() < 0.5 ? '12,60,28' : '80,150,90'},${0.25 + rr() * 0.3})`;
    g.lineWidth = 1;
    const x = rr() * 128, y = rr() * 128;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - 0.5) * 6, y + 6 + rr() * 8); g.stroke();
  }
}, 3, 2);
const treeGreen = new THREE.MeshStandardMaterial({ map: needleTex, color: 0xffffff, roughness: 0.95 });
function treeTier(radius, h) {
  const geo = new THREE.ConeGeometry(radius, h, 48, 8, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + h / 2) / h; // 0 at the skirt, 1 at the tip
    const a = Math.atan2(z, x);
    const k = 1 + (1 - t) * (0.09 * Math.sin(7 * a) + 0.05 * Math.sin(13 * a + 1.3));
    p.setX(i, x * k);
    p.setZ(i, z * k);
    p.setY(i, y - (1 - t) * 0.02 * (0.5 + 0.5 * Math.sin(7 * a + 0.6)));
  }
  geo.computeVertexNormals();
  return geo;
}
const tierR = [0.27, 0.22, 0.17, 0.12];
const tierH = [0.3, 0.26, 0.22, 0.18];
let ty = 0.58;
tierR.forEach((r, i) => {
  const cone = new THREE.Mesh(treeTier(r, tierH[i]), treeGreen);
  cone.position.set(0, ty + tierH[i] / 2, 0);
  cone.rotation.y = i * 0.5;
  cone.castShadow = true;
  tree.add(cone);
  ty += tierH[i] * 0.62;
});
const treeTop = ty - tierH[3] * 0.62 + tierH[3]; // tip of the highest cone
const treeRadiusAt = (y) => Math.max(0.02, 0.27 * ((treeTop - y) / (treeTop - 0.6)) * 0.95);
// gold star
const starShape = new THREE.Shape();
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
  const r = i % 2 === 0 ? 0.05 : 0.022;
  if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
}
const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.012, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.4) }));
star.position.set(0, treeTop + 0.035, -0.006);
tree.add(star);
// string of dim, slowly twinkling lights spiralling up the tree
const bulbSets = [0xff4a3a, 0xffb03a, 0x4aa8ff, 0x59e07a].map((hex, i) => ({ mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) }), base: new THREE.Color(hex), phase: i * 1.7 }));
const bulbGeo = new THREE.SphereGeometry(0.011, 10, 8);
// the real outer surface of the tree at a given height and angle, so the wire can lie right on the needles
const tierBase = [];
{ let tb = 0.58; tierH.forEach((h) => { tierBase.push(tb); tb += h * 0.62; }); }
const treeSurfaceR = (y, aw) => {
  let best = 0.02;
  tierR.forEach((r, i) => {
    const tt = (y - tierBase[i]) / tierH[i]; // 0 at the tier's skirt, 1 at its tip
    if (tt < -0.02 || tt > 1) return;
    const al = aw + i * 0.5; // each tier is turned a little, so convert to that tier's own angle
    const k = 1 + (1 - Math.max(0, tt)) * (0.09 * Math.sin(7 * al) + 0.05 * Math.sin(13 * al + 1.3));
    best = Math.max(best, r * (1 - Math.max(0, tt)) * k);
  });
  return best;
};
const M = 230; // many small steps so the wire follows the surface closely
const ys = [], ang = [], rawR = [];
for (let i = 0; i < M; i++) {
  const f = i / (M - 1);
  const y = 0.62 + f * (treeTop - 0.66);
  const a = f * Math.PI * 2 * 5.5;
  ys.push(y); ang.push(a); rawR.push(treeSurfaceR(y, a));
}
const wireR = rawR.map((r, i) => { // glides from tier to tier, but never sinks into the branches
  let sum = 0, cnt = 0;
  for (let j = Math.max(0, i - 4); j <= Math.min(M - 1, i + 4); j++) { sum += rawR[j]; cnt++; }
  return Math.max(r, sum / cnt) + 0.003;
});
const wirePts = ys.map((y, i) => new THREE.Vector3(Math.cos(ang[i]) * wireR[i], y, Math.sin(ang[i]) * wireR[i]));
const N = 46;
for (let i = 0; i < N; i++) {
  const k = Math.round((i / (N - 1)) * (M - 1));
  const bulb = new THREE.Mesh(bulbGeo, bulbSets[i % 4].mat);
  bulb.position.set(Math.cos(ang[k]) * (wireR[k] + 0.003), ys[k], Math.sin(ang[k]) * (wireR[k] + 0.003));
  tree.add(bulb);
}
tree.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), M * 2, 0.0022, 5, false), mat(0x0f2a14, 0.7)));
// baubles
const bauble = [0xc8302e, 0xd4af5a, 0xcfd3dc, 0xc8302e, 0x2f6fb0];
for (let i = 0; i < 9; i++) {
  const y = 0.66 + (i / 9) * (treeTop - 0.8) + (i % 2) * 0.03;
  const a = i * 2.4;
  const r = treeRadiusAt(y) * 0.97;
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 12), new THREE.MeshStandardMaterial({ color: bauble[i % bauble.length], roughness: 0.2, metalness: 0.8 }));
  b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
  b.castShadow = true;
  tree.add(b);
}
// two wrapped presents on the stool: patterned paper, crossed satin ribbon, a bow and a gift tag
function giftPaper(base, pattern) {
  return canvasTex(128, 128, (g) => {
    let s = 5;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    if (pattern === 'dots') {
      g.fillStyle = 'rgba(255,255,255,0.82)';
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 2.7, 0, 7); g.fill(); }
    } else if (pattern === 'stripes') {
      g.fillStyle = 'rgba(255,255,255,0.78)';
      for (let x = 0; x < 128; x += 22) g.fillRect(x, 0, 7, 128);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = 7; x < 128; x += 22) g.fillRect(x, 0, 1, 128);
    }
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.07})`; g.fillRect(r() * 128, r() * 128, 1, 1 + r() * 3); } // paper fibres
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(0,0,0,0.05)'; g.beginPath(); g.moveTo(r() * 128, 0); g.lineTo(r() * 128, 128); g.stroke(); } // faint creases
  }, 2, 2);
}
function giftBox(x, z, w, h, d, rotY, base, pattern, ribbonHex) {
  const g = new THREE.Group();
  g.position.set(x, 0.45, z);
  g.rotation.y = rotY;
  tree.add(g);
  const paper = new THREE.MeshStandardMaterial({ map: giftPaper(base, pattern), roughness: 0.5 });
  const satin = new THREE.MeshStandardMaterial({ color: ribbonHex, roughness: 0.28, metalness: 0.25 });
  const part = (geo, m, px, py, pz) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, py, pz); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const rr = 0.004; // rounded paper edges
  part(new RoundedBoxGeometry(w, h, d, 4, rr), paper, 0, h / 2, 0); // a single wrapped box (no separate lid)
  const rb = 0.011; // ribbon width
  const satinTwo = satin.clone();
  satinTwo.side = THREE.DoubleSide;
  // a ribbon that follows the box surface: up one side, over the rounded top edge, across the top and down the other side
  const ribbonOver = (halfSpan, alongZ, lift) => {
    const n = 7;
    const pts = [[-halfSpan, 0.004, -1, 0], [-halfSpan, h - rr, -1, 0]];
    for (let i = 1; i < n; i++) { const a = (i / n) * (Math.PI / 2); pts.push([-(halfSpan - rr) - rr * Math.cos(a), h - rr + rr * Math.sin(a), -Math.cos(a), Math.sin(a)]); }
    pts.push([-(halfSpan - rr), h, 0, 1], [halfSpan - rr, h, 0, 1]);
    for (let i = 1; i < n; i++) { const a = (i / n) * (Math.PI / 2); pts.push([(halfSpan - rr) + rr * Math.sin(a), h - rr + rr * Math.cos(a), Math.sin(a), Math.cos(a)]); }
    pts.push([halfSpan, h - rr, 1, 0], [halfSpan, 0.004, 1, 0]);
    // a real four-sided band: top, bottom and two edges, each with its own flat shading
    const tk = 0.0016; // ribbon thickness
    const corners = (u, y, nu, ny) => [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([s, o]) => {
      const off = lift + tk / 2 + o * (tk / 2); // lift is where the inner face starts
      const bu = u + nu * off, by = y + ny * off, sw = (s * rb) / 2;
      return alongZ ? [sw, by, bu] : [bu, by, sw];
    });
    const pos = [];
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < pts.length - 1; i++) {
      const A = corners(...pts[i]), B = corners(...pts[i + 1]);
      for (let k = 0; k < 4; k++) quad(A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]); // the four sides
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, satinTwo);
    m.castShadow = true;
    g.add(m);
  };
  ribbonOver(d / 2, true, 0.0002); // front to back
  ribbonOver(w / 2, false, 0.0018); // side to side, laid on top of the first where they cross
  const bow = new THREE.Group();
  bow.position.set(0, h + 0.0036, 0);
  g.add(bow);
  for (let k = 0; k < 2; k++) { // two big loops, like a classic bow
    const a = 0.15 + k * Math.PI;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0034, 8, 22), satin);
    loop.position.set(Math.cos(a) * 0.0115, 0.0068, Math.sin(a) * 0.0115);
    loop.rotation.y = -a;
    loop.scale.set(1, 1.2, 0.5);
    loop.castShadow = true;
    bow.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 12, 10), satin);
  knot.position.y = 0.0045;
  knot.scale.y = 0.8;
  bow.add(knot);
  [-1, 1].forEach((sd) => { // two short tails lying on the top
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0012, 0.026), satinTwo);
    tail.position.set(sd * 0.011, 0.0003, 0.019);
    tail.rotation.set(0, sd * 0.45, sd * -0.08);
    bow.add(tail);
  });
  const tag = part(new THREE.BoxGeometry(0.026, 0.0012, 0.018), mat(0xf4efe2, 0.9), w * 0.3, h + 0.0006, d * 0.2); // gift tag
  tag.rotation.y = 0.5;
  const tagText = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.003), mat(0x7a2a2a, 0.9));
  tagText.rotation.x = -Math.PI / 2;
  tagText.position.y = 0.0007;
  tag.add(tagText);
  return g;
}
giftBox(0.135, 0.06, 0.08, 0.07, 0.08, 0.4, '#2f5fa8', 'dots', 0xd4af5a);
giftBox(-0.01, 0.14, 0.06, 0.055, 0.06, -0.3, '#b32428', 'stripes', 0xf2efe6);
const treeGlowWarm = new THREE.PointLight(0xffa860, 0.45, 1.6, 2);
treeGlowWarm.position.set(-1.6, 0.9, -0.8);
const treeGlowCool = new THREE.PointLight(0x6a9aff, 0.25, 1.4, 2);
treeGlowCool.position.set(-1.45, 0.75, -1.15);
scene.add(treeGlowWarm, treeGlowCool);
// clicking the tree switches the Christmas lights on and off
const treeLights = { on: true, level: 1 };
tree.userData.toggle = () => { treeLights.on = !treeLights.on; };
let treeLast = 0;
function updateTree(t) {
  const dtl = Math.min(0.1, Math.max(0, t - treeLast)); treeLast = t;
  treeLights.level += ((treeLights.on ? 1 : 0) - treeLights.level) * (1 - Math.exp(-dtl * 9));
  const L = treeLights.level;
  const P = disco.level; // during the party the lights ignore the on/off switch and flash on the beat
  const beatIdx = Math.floor(t * BEAT_HZ), kick = beatKick(t);
  bulbSets.forEach((b, k) => {
    const calm = (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 1.3 + b.phase))) * (0.06 + 0.94 * L);
    const down = beatIdx % 4 === 0; // every fourth beat all colours burst together, the others take turns
    const rhythm = down ? 0.17 + 1.33 * kick : (k === beatIdx % 4 ? 0.2 + 1.2 * kick : 0.05);
    b.mat.color.copy(b.base).multiplyScalar(calm * (1 - P) + rhythm * P);
  });
  treeGlowWarm.intensity = (0.4 + 0.08 * Math.sin(t * 1.3 + 1.7)) * L * (1 - P) + (0.2 + 0.87 * kick) * P;
  treeGlowCool.intensity = (0.22 + 0.06 * Math.sin(t * 1.3 + 3.4)) * L * (1 - P) + (0.13 + 0.67 * (1 - kick)) * P;
}

// ---------- sleeping cat curled up on a cushion under the tree ----------
const BEAT_HZ = 1.0; // the party's tempo: 60 beats per minute
const beatKick = (tt) => Math.exp(-((tt * BEAT_HZ) % 1) * 7); // 1 right on the beat, fading until the next
const catLids = [], catOpenEyes = [], catAwake = { level: 0, last: 0 };
const cat = new THREE.Group();
cat.position.set(-1.6, 0, -0.8);
cat.rotation.y = 0.5;
scene.add(cat);
// plush cushion with gold piping
cyl(0.17, 0.18, 0.05, mat(0x7a2a2a, 0.95), 0, 0.025, 0, cat, 40);
cyl(0.145, 0.145, 0.014, mat(0x8f3636, 0.95), 0, 0.056, 0, cat, 40);
const cushionPipe = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.009, 8, 48), mat(0xb08a3a, 0.5, 0.4));
cushionPipe.rotation.x = Math.PI / 2;
cushionPipe.position.y = 0.045;
cat.add(cushionPipe);

const catRng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
// tabby coat: mottled orange with wavy dark bands wrapping the body, plus fine hair strokes
const furTex = canvasTex(256, 256, (g) => {
  const r = catRng(9);
  g.fillStyle = '#d98838';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(120,60,15,${0.05 + r() * 0.1})` : `rgba(255,200,120,${0.05 + r() * 0.1})`;
    g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 12, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(122,60,14,0.8)';
  for (let y = 10; y < 250; y += 15 + r() * 9) {
    const th = 5 + r() * 5;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x * 0.12 + y) * 3);
    for (let x = 256; x >= 0; x -= 8) g.lineTo(x, y + th + Math.sin(x * 0.12 + y + 1) * 3);
    g.closePath(); g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(90,45,10,0.28)' : 'rgba(255,225,170,0.32)';
    g.lineWidth = 1;
    const x = r() * 256, y = r() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y + 3 + r() * 5); g.stroke();
  }
});
const tailTex = canvasTex(256, 64, (g) => { // ringed tail
  g.fillStyle = '#d98838'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(110,52,12,0.85)';
  for (let x = 6; x < 256; x += 22) g.fillRect(x, 0, 9, 64);
  g.fillStyle = '#5a2c10'; g.fillRect(236, 0, 20, 64);
});
const furNoise = canvasTex(128, 128, (g) => { // alpha pattern for the fur shells
  const r = catRng(3);
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; g.fillRect(r() * 128, r() * 128, 1.3, 1.3); }
}, 5, 3);
const fur = new THREE.MeshStandardMaterial({ map: furTex, roughness: 1 });
const furLight = mat(0xf2e3c6, 1);
const headTex = canvasTex(256, 256, (g) => { // head coat: same orange, but mottled rather than banded
  const r = catRng(14);
  g.fillStyle = '#d98838';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(120,60,15,${0.05 + r() * 0.1})` : `rgba(255,205,130,${0.06 + r() * 0.12})`;
    g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 12, 0, 7); g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = r() < 0.5 ? 'rgba(90,45,10,0.28)' : 'rgba(255,225,170,0.32)';
    g.lineWidth = 1;
    const x = r() * 256, y = r() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y + 3 + r() * 5); g.stroke();
  }
});
const furHead = new THREE.MeshStandardMaterial({ map: headTex, roughness: 1 });
const SHELLS = 7;
function furShells(base, parent, step) { // stacked, slightly larger copies with a sparse alpha mask give soft, hairy edges
  for (let k = 1; k <= SHELLS; k++) {
    const m = new THREE.Mesh(base.geometry, new THREE.MeshStandardMaterial({ map: base.material.map, alphaMap: furNoise, alphaTest: 0.22 + 0.08 * k, roughness: 1, color: base.material.color.clone().multiplyScalar(1 - 0.05 * k) }));
    m.position.copy(base.position);
    m.rotation.copy(base.rotation);
    m.scale.copy(base.scale).multiplyScalar(1 + k * step);
    parent.add(m);
  }
}

// body and haunch (breathing scales this group)
const bodyG = new THREE.Group();
bodyG.position.set(0, 0.115, 0);
cat.add(bodyG);
const catBodyGeo = new THREE.SphereGeometry(1, 40, 28);
catBodyGeo.rotateZ(Math.PI / 2); // poles at the head and tail ends, so the bands wrap around the body
const catBody = new THREE.Mesh(catBodyGeo, fur);
catBody.scale.set(0.14, 0.075, 0.105);
catBody.castShadow = true;
bodyG.add(catBody);
furShells(catBody, bodyG, 0.012);
const haunchGeo = new THREE.SphereGeometry(0.075, 32, 22);
haunchGeo.rotateZ(Math.PI / 2);
const haunch = new THREE.Mesh(haunchGeo, fur);
haunch.position.set(-0.07, -0.008, -0.035);
haunch.castShadow = true;
bodyG.add(haunch);
furShells(haunch, bodyG, 0.018);
const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), furLight); // white chest patch
chest.scale.set(0.06, 0.04, 0.05);
chest.position.set(0.1, -0.025, 0.07);
bodyG.add(chest);
furShells(chest, bodyG, 0.03);

// head
const catHead = new THREE.Group();
catHead.position.set(0.125, 0.11, 0.085);
catHead.rotation.y = -0.7;
cat.add(catHead);
const skullGeo = new THREE.SphereGeometry(0.055, 32, 22);
skullGeo.rotateX(Math.PI / 2); // poles at nose and back of the head
const skull = new THREE.Mesh(skullGeo, furHead);
skull.scale.set(1, 0.9, 0.95);
skull.castShadow = true;
catHead.add(skull);
furShells(skull, catHead, 0.014);
const darkStripe = mat(0x6a300c, 0.9);
[-0.013, 0, 0.013].forEach((sx) => { // the tabby "M" on the forehead
  const st = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), darkStripe);
  st.scale.set(0.0017, 0.0012, 0.015);
  const z = 0.012;
  st.position.set(sx, 0.055 * 0.9 * Math.sqrt(Math.max(0, 1 - (sx / 0.055) ** 2 - (z / 0.052) ** 2)) + 0.0005, z);
  st.rotation.x = -0.22;
  catHead.add(st);
});
[-1, 1].forEach((side) => {
  const earG = new THREE.Group(); // ear with pink inside and a little tuft
  earG.position.set(side * 0.033, 0.047, -0.006);
  earG.rotation.z = -side * 0.35;
  catHead.add(earG);
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.042, 3), fur);
  ear.scale.z = 0.5;
  ear.position.y = 0.014;
  earG.add(ear);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.03, 3), mat(0xe29aa0, 0.9));
  inner.scale.z = 0.4;
  inner.position.set(0, 0.011, 0.006);
  earG.add(inner);
  earG.userData.side = side;
  catHead.userData['ear' + side] = earG;
  // closed, relaxed eyes and cheek stripes, fitted onto the face (on top of the fur) so they sit on the head
  const skullZ = (x, y) => 0.055 * 0.95 * Math.sqrt(Math.max(0, 1 - (x / 0.055) ** 2 - (y / (0.055 * 0.9)) ** 2));
  const onFace = (mesh, x, y, lift) => { // put a mesh on the face at (x, y), turned to follow the curve of the skull
    const z = skullZ(x, y);
    const n = new THREE.Vector3(x / (0.055 * 0.055), y / (0.0495 * 0.0495), z / (0.05225 * 0.05225)).normalize();
    mesh.position.set(x, y, z + lift);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    catHead.add(mesh);
    return mesh;
  };
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 8), fur);
  lid.scale.set(1, 0.6, 0.45);
  onFace(lid, side * 0.021, 0.014, 0.0005);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0016, 6, 14, Math.PI), mat(0x1a1210, 0.8));
  onFace(eye, side * 0.021, 0.012, 0.0058);
  eye.rotateZ(Math.PI); // a closed, curved "u" line
  catLids.push(lid, eye);
  const openEye = new THREE.Group(); // the same eye, wide awake (shown during the party)
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0098, 14, 10), mat(0xc9de7a, 0.3));
  iris.scale.set(1, 1, 0.45);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 10, 8), mat(0x090908, 0.3));
  pupil.scale.set(0.42, 1, 0.4);
  pupil.position.z = 0.003;
  openEye.add(iris, pupil);
  onFace(openEye, side * 0.021, 0.012, 0.0045);
  openEye.visible = false;
  catOpenEyes.push(openEye);
  [0, 1].forEach((k) => { // cheek stripes
    const cs = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), darkStripe);
    cs.scale.set(0.012, 0.0012, 0.0015);
    onFace(cs, side * 0.04, 0.0 - k * 0.007, 0.0045);
    cs.rotateZ(side * (0.3 - k * 0.3));
  });
});
const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), furLight);
muzzle.position.set(0, -0.013, 0.043);
muzzle.scale.set(1.15, 0.8, 1);
catHead.add(muzzle);
const catNose = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), mat(0xd98a8a, 0.6));
catNose.scale.set(1.3, 0.8, 0.8);
catNose.position.set(0, -0.0015, 0.064);
catHead.add(catNose);
[-1, 1].forEach((side) => { // mouth line
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0007, 4, 8, Math.PI), mat(0x5a3a30, 0.8));
  mouth.position.set(side * 0.0055, -0.0105, 0.0635);
  mouth.rotation.z = Math.PI;
  catHead.add(mouth);
});
const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.4 });
[-1, 1].forEach((side) => { // whiskers
  for (let k = 0; k < 3; k++) {
    const piv = new THREE.Group();
    piv.position.set(side * 0.014, -0.011 + k * 0.004, 0.055);
    piv.rotation.set(0, -side * (0.15 + k * 0.3), side * (-0.12 + k * 0.1));
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0004, 0.0002, 0.06, 5), whiskerMat);
    w.rotation.z = Math.PI / 2;
    w.position.x = side * 0.03;
    piv.add(w);
    catHead.add(piv);
  }
});
// front paws tucked under the chin, with toe beans
[[0.17, 0.115, 0.5], [0.145, 0.05, 0.3]].forEach(([px, pz, ry]) => {
  const paw = new THREE.Group();
  paw.position.set(px, 0.078, pz);
  paw.rotation.y = ry;
  cat.add(paw);
  const pm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), furLight);
  pm.scale.set(0.03, 0.02, 0.042);
  paw.add(pm);
  [-0.009, 0, 0.009].forEach((tx) => {
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), furLight);
    toe.position.set(tx, -0.003, 0.037);
    paw.add(toe);
  });
});
// ringed tail curled around the front of the body
const tailCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-0.13, 0.1, -0.02), new THREE.Vector3(-0.145, 0.084, 0.04), new THREE.Vector3(-0.105, 0.08, 0.095),
  new THREE.Vector3(-0.03, 0.079, 0.118), new THREE.Vector3(0.04, 0.081, 0.115),
]);
const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 48, 0.0135, 12, false), new THREE.MeshStandardMaterial({ map: tailTex, roughness: 1 }));
tail.castShadow = true;
// the tail hangs from a pivot at its root so it can waggle
const tailPivot = new THREE.Group();
tailPivot.position.copy(tailCurve.getPoint(0));
cat.add(tailPivot);
tail.position.copy(tailPivot.position).multiplyScalar(-1);
tailPivot.add(tail);
const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 12, 10), mat(0x5a2c10, 1));
tailTip.position.copy(tailCurve.getPoint(1)).sub(tailPivot.position);
tailPivot.add(tailTip);
// clicking the cat sets off a short waggle
const tailWag = { start: -10 };
const catHit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.36), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
catHit.position.set(0, 0.09, 0.03);
cat.add(catHit);
cat.userData.toggle = () => { tailWag.start = performance.now() / 1000; };

// gentle breathing, an occasional ear twitch, and little drifting "z"s
const zTex = canvasTex(64, 64, (g) => {
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.font = '300 56px "Segoe UI Light", "Helvetica Neue", Arial, sans-serif'; // thin strokes
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 32, 34);
});
const zzz = [0, 1, 2].map((i) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0, color: 0xdfe8ff }));
  s.userData.phase = i / 3;
  scene.add(s);
  return s;
});
const catHeadWorld = new THREE.Vector3();
scene.updateMatrixWorld(true);
catHead.getWorldPosition(catHeadWorld);
const catHeadBaseRZ = catHead.rotation.z;
function updateCat(t) {
  const nowS = performance.now() / 1000;
  const cdt = Math.min(0.1, Math.max(0, nowS - catAwake.last)); catAwake.last = nowS;
  catAwake.level += ((disco.on ? 1 : 0) - catAwake.level) * (1 - Math.exp(-cdt * 6)); // wakes up with the party, dozes off after it
  const A = catAwake.level, kick = beatKick(t);
  const br = Math.sin(t * 1.8);
  bodyG.scale.y = 1 + 0.035 * br * (1 - A) + 0.03 * kick * A;
  catHead.position.y = 0.11 + 0.0015 * br + A * (0.0093 + 0.0067 * kick);
  catHead.rotation.z = catHeadBaseRZ + A * 0.133 * Math.sin(t * Math.PI * BEAT_HZ); // bobbing its head to the beat
  const twitch = Math.pow(Math.max(0, Math.sin(t * 0.55)), 14) * 0.3;
  [-1, 1].forEach((side) => { catHead.userData['ear' + side].rotation.z = -side * ((0.35 + (side > 0 ? twitch : 0)) * (1 - A) + 0.1 * A); });
  catLids.forEach((m) => { m.visible = A < 0.5; });
  catOpenEyes.forEach((m) => { m.visible = A >= 0.5; });
  const wt = performance.now() / 1000 - tailWag.start;
  // the tail only ever swings outward from the body (never back into it) and returns to rest between flicks
  const wag = (wt < 2 ? -(1 - Math.cos(wt * 13)) * 0.5 * 0.45 * Math.exp(-wt * 1.6) : 0) - A * (0.5 + 0.5 * Math.sin(t * Math.PI * BEAT_HZ * 2)) * 0.3; // and wagging along to the music
  tailPivot.rotation.y = wag;
  tailPivot.rotation.z = -wag * 0.15;
  zzz.forEach((s) => {
    const p = (t * 0.16 + s.userData.phase) % 1;
    s.position.set(catHeadWorld.x + p * 0.1, catHeadWorld.y + 0.1 + p * 0.28, catHeadWorld.z + p * 0.04);
    s.scale.setScalar(0.05 + p * 0.07);
    s.material.opacity = Math.sin(p * Math.PI) * 0.8 * (1 - A);
  });
}

// ---------- chair ----------
const chair = new THREE.Group();
chair.position.set(-0.12, 0, 0.12);
chair.rotation.y = 0.35;
scene.add(chair);
const chairMat = mat(0x2b303c, 0.85);
function padded(w, h, d, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.03), chairMat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  m.receiveShadow = true;
  chair.add(m);
  return m;
}
padded(0.5, 0.08, 0.48, 0, 0.46, 0); // seat cushion
padded(0.44, 0.4, 0.07, 0, 0.74, 0.25, 0.14); // backrest, tilted back a little
box(0.04, 0.04, 0.04, metal, 0, 0.52, 0.24, chair).rotation.x = 0.14; // backrest post
[-0.265, 0.265].forEach((x) => { // armrests: the post is bolted flush to the side of the seat and holds the pad
  box(0.03, 0.185, 0.03, metal, x, 0.5525, 0.05, chair);
  padded(0.06, 0.03, 0.3, x, 0.66, 0.05);
});
cyl(0.05, 0.05, 0.03, metal, 0, 0.06, 0, chair, 20); // hub the five arms attach to
cyl(0.025, 0.025, 0.365, metal, 0, 0.2575, 0, chair, 12);
for (let i = 0; i < 5; i++) {
  const a = (i / 5) * Math.PI * 2;
  const leg = box(0.23, 0.025, 0.04, metal, Math.cos(a) * 0.165, 0.06, Math.sin(a) * 0.165, chair);
  leg.rotation.y = -a;
  // caster wheel on the end of each leg: swivel stem, fork and a rubber wheel
  const caster = new THREE.Group();
  caster.position.set(Math.cos(a) * 0.265, 0, Math.sin(a) * 0.265);
  caster.rotation.y = -a;
  chair.add(caster);
  cyl(0.008, 0.008, 0.03, metal, 0, 0.06, 0, caster, 10); // stem
  box(0.026, 0.012, 0.034, metal, 0, 0.0415, 0, caster); // fork top
  [-0.014, 0.014].forEach((dz) => box(0.01, 0.02, 0.004, metal, 0, 0.0255, dz, caster)); // fork sides
  const wheel = cyl(0.024, 0.024, 0.016, mat(0x141416, 0.85), 0, 0.025, 0, caster, 20);
  wheel.rotation.x = Math.PI / 2;
  const hub = cyl(0.01, 0.01, 0.019, mat(0x9a9ea8, 0.35, 0.8), 0, 0.025, 0, caster, 12);
  hub.rotation.x = Math.PI / 2;
}

// ---------- extra polish: rug, desk mat, pencil cup, window ----------
// Rug printed with a "Great Wave"-style woodblock scene (hand-drawn recreation in code)
const rugTex = canvasTex(1100, 680, (g) => {
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const FX = 38; // fringe width
  g.save();
  g.translate(FX, 0);
  const W = 1024, H = 680;
  // paper + sky
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#d9ceae'); sky.addColorStop(0.5, '#efe6c8'); sky.addColorStop(1, '#e8dcb8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(160,130,90,0.22)'; // cloud streaks
  [[300, 90, 420, 10], [620, 150, 380, 8], [120, 230, 260, 7], [700, 60, 300, 9], [520, 245, 280, 6]].forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  // distant sea band
  g.fillStyle = '#1d4468'; g.fillRect(0, 445, W, 235);
  // Mount Fuji in the trough
  g.fillStyle = '#2a527d'; g.beginPath(); g.moveTo(520, 455); g.lineTo(640, 392); g.lineTo(700, 392); g.lineTo(840, 455); g.closePath(); g.fill();
  g.fillStyle = '#f4f1e6'; g.beginPath(); g.moveTo(618, 404); g.lineTo(640, 392); g.lineTo(700, 392); g.lineTo(722, 406); g.lineTo(700, 412); g.lineTo(682, 402); g.lineTo(662, 414); g.lineTo(640, 404); g.closePath(); g.fill();
  // big wave body
  const body = new Path2D();
  body.moveTo(0, 680); body.lineTo(0, 330);
  body.bezierCurveTo(20, 250, 90, 170, 170, 130);
  body.bezierCurveTo(240, 98, 320, 80, 385, 100);
  body.bezierCurveTo(445, 118, 490, 160, 505, 215);
  body.bezierCurveTo(450, 185, 395, 190, 355, 222);
  body.bezierCurveTo(325, 248, 318, 295, 335, 335);
  body.bezierCurveTo(360, 395, 420, 430, 500, 450);
  body.bezierCurveTo(640, 480, 800, 470, 1024, 440);
  body.lineTo(1024, 680); body.closePath();
  g.fillStyle = '#17426f'; g.fill(body);
  // darker underside of the curl and lower body
  g.save(); g.clip(body);
  const shade = g.createLinearGradient(0, 100, 0, 680);
  shade.addColorStop(0, 'rgba(10,30,60,0.0)'); shade.addColorStop(1, 'rgba(8,24,50,0.65)');
  g.fillStyle = shade; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(8,26,52,0.55)'; g.beginPath(); g.moveTo(320, 215); g.bezierCurveTo(380, 175, 450, 185, 500, 222); g.bezierCurveTo(430, 262, 360, 300, 335, 335); g.bezierCurveTo(315, 285, 310, 240, 320, 215); g.fill();
  // flowing contour lines
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${170 + r() * 60},${200 + r() * 40},235,${0.12 + r() * 0.22})`;
    g.lineWidth = 1 + r() * 2.2;
    const o = i * 15 + r() * 6;
    g.beginPath(); g.moveTo(-10, 360 + o);
    g.bezierCurveTo(60, 270 + o * 0.85, 170, 195 + o * 0.7, 290 + o * 0.15, 195 + o * 0.5);
    g.stroke();
  }
  g.restore();
  // foam claws along the crest
  const crest = (t) => { // sample of the crest bezier from (170,130) to the tip
    const p0 = [170, 130], p1 = [240, 98], p2 = [320, 80], p3 = [385, 100];
    if (t < 1) { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
    return p3;
  };
  g.fillStyle = '#f6f3e8';
  for (let i = 0; i < 26; i++) {
    const t = 0.05 + (i / 26) * 1.05;
    const [x, y] = t <= 1 ? crest(t) : [385 + (t - 1) * 600, 100 + (t - 1) * 1200];
    const len = 26 + r() * 54, ang = 0.9 + r() * 0.7, w = 6 + r() * 7;
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    g.beginPath(); g.moveTo(x - w / 2, y - 3); g.quadraticCurveTo(x + len * 0.15, y + len * 0.45, ex, ey);
    g.quadraticCurveTo(x + w * 0.5 + len * 0.3, y + len * 0.2, x + w / 2, y - 3); g.closePath(); g.fill();
    g.beginPath(); g.arc(ex + 2, ey + 2, 2 + r() * 3.2, 0, 7); g.fill();
  }
  // foam cap on the crest + flying spray
  g.beginPath(); g.moveTo(150, 140); g.bezierCurveTo(230, 88, 330, 70, 395, 98); g.bezierCurveTo(430, 112, 470, 140, 490, 180); g.bezierCurveTo(430, 142, 360, 112, 300, 118); g.bezierCurveTo(230, 124, 190, 150, 150, 140); g.closePath(); g.fill();
  for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(150 + r() * 380, 40 + r() * 170, 0.8 + r() * 3.2, 0, 7); g.fill(); }
  // smaller wave on the right
  const w2 = new Path2D();
  w2.moveTo(700, 470); w2.bezierCurveTo(760, 440, 820, 400, 880, 395); w2.bezierCurveTo(920, 392, 950, 410, 960, 435); w2.bezierCurveTo(930, 425, 900, 428, 880, 445); w2.bezierCurveTo(850, 470, 800, 480, 700, 490); w2.closePath();
  g.fillStyle = '#1b4c7c'; g.fill(w2);
  g.fillStyle = '#f6f3e8';
  for (let i = 0; i < 9; i++) { const x = 840 + i * 13, y = 396 + (i % 3) * 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + 22, x + 18, y + 32); g.lineTo(x + 12, y + 8); g.closePath(); g.fill(); }
  // three long boats riding the swells
  g.fillStyle = '#c9a56a';
  [[610, 540, 1], [800, 585, 0.8], [330, 600, 0.9]].forEach(([x, y, sc]) => {
    g.save(); g.translate(x, y); g.scale(sc, sc); g.rotate(-0.12);
    g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(0, 16, 90, -2); g.quadraticCurveTo(0, 6, -90, 0); g.fill();
    g.fillStyle = '#2a2a2e';
    for (let k = -5; k <= 5; k++) { g.beginPath(); g.arc(k * 14, -5, 3.2, 0, 7); g.fill(); }
    g.fillStyle = '#c9a56a'; g.restore();
  });
  // title cartouche and red seal
  g.fillStyle = '#efe6c8'; g.fillRect(56, 34, 54, 230);
  g.strokeStyle = '#2a2a2e'; g.lineWidth = 3; g.strokeRect(56, 34, 54, 230);
  g.fillStyle = '#2a2a2e'; g.font = 'bold 34px "Yu Mincho","MS Mincho","Noto Serif JP",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  '神奈川波浪裏'.split('').forEach((c, i) => g.fillText(c, 83, 62 + i * 36));
  g.fillStyle = '#c8302e'; g.fillRect(122, 40, 30, 34);
  g.fillStyle = '#efe6c8'; g.font = 'bold 20px "Yu Mincho","MS Mincho",serif'; g.fillText('北', 137, 58);
  // aged paper grain
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '60,40,20'},${r() * 0.06})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  g.restore();
  // woven border lines + fringe at both ends
  g.strokeStyle = 'rgba(30,20,10,0.55)'; g.lineWidth = 6; g.strokeRect(FX + 3, 3, 1024 - 6, 674);
  for (let y = 0; y < 680; y += 5) {
    const a = 0.35 + r() * 0.5;
    g.strokeStyle = `rgba(235,226,200,${a})`; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(FX - 2 - r() * 4, y + (r() - 0.5) * 3); g.stroke();
    g.beginPath(); g.moveTo(1100, y); g.lineTo(1100 - FX + 2 + r() * 4, y + (r() - 0.5) * 3); g.stroke();
  }
});
const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.85), new THREE.MeshStandardMaterial({ map: rugTex, color: 0x8c8c8c, roughness: 1 }));
rug.rotation.x = -Math.PI / 2;
rug.position.set(0, 0.004, 0.4);
rug.receiveShadow = true;
scene.add(rug);
// swap in the real woodblock print (Hokusai, public domain) once it loads; the drawn version stays as a fallback
const rugImg = new Image();
rugImg.onload = () => {
  const cv = rugTex.image;
  cv.width = 2200; // higher resolution for the real print
  cv.height = 1360;
  const g = cv.getContext('2d');
  const FX = 76;
  rugTex.dispose();
  g.fillStyle = '#e8dcb8';
  g.fillRect(0, 0, cv.width, cv.height);
  const artW = cv.width - FX * 2, artH = cv.height;
  const srcAspect = rugImg.width / rugImg.height, dstAspect = artW / artH;
  let sx = 0, sy = 0, sw = rugImg.width, sh = rugImg.height;
  if (srcAspect < dstAspect) { sh = rugImg.width / dstAspect; sy = (rugImg.height - sh) / 2; } // crop top/bottom
  else { sw = rugImg.height * dstAspect; sx = (rugImg.width - sw) / 2; } // crop sides
  g.drawImage(rugImg, sx, sy, sw, sh, FX, 0, artW, artH);
  g.strokeStyle = 'rgba(30,20,10,0.55)';
  g.lineWidth = 6;
  g.strokeRect(FX + 3, 3, artW - 6, artH - 6);
  for (let y = 0; y < artH; y += 5) { // fringe
    const a = 0.35 + Math.random() * 0.5;
    g.strokeStyle = `rgba(235,226,200,${a})`;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(FX - 2 - Math.random() * 4, y + (Math.random() - 0.5) * 3); g.stroke();
    g.beginPath(); g.moveTo(cv.width, y); g.lineTo(cv.width - FX + 2 + Math.random() * 4, y + (Math.random() - 0.5) * 3); g.stroke();
  }
  rugTex.needsUpdate = true;
};
rugImg.src = 'greatwave.jpg';

box(0.95, 0.004, 0.4, mat(0x1c1f27, 0.9), 0, 0.752, 0.225, desk); // desk mat, front edge flush with the desk edge (z = 0.425)
// pen holder: perforated black metal cup with a mix of pens, pencils, a marker and a ruler
const cup = new THREE.Group();
cup.position.set(0.6, 0.75, -0.2);
desk.add(cup);
const perfTex = canvasTex(128, 64, (g) => {
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#000';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { g.beginPath(); g.arc(4 + x * 8 + (y % 2) * 4, 4 + y * 8, 2.3, 0, 7); g.fill(); }
}, 2, 1);
const cupMetal = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.75, roughness: 0.35, alphaMap: perfTex, alphaTest: 0.5, side: THREE.DoubleSide });
const cupShell = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.105, 40, 1, true), cupMetal);
cupShell.position.y = 0.0525;
cupShell.castShadow = true;
cup.add(cupShell);
const cupLiner = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0345, 0.1, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.9, side: THREE.DoubleSide }));
cupLiner.position.y = 0.054;
cup.add(cupLiner);
const rimMetal = mat(0x4a505c, 0.3, 0.85);
cyl(0.037, 0.037, 0.008, rimMetal, 0, 0.004, 0, cup, 32); // base
const rim = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0028, 8, 40), rimMetal);
rim.rotation.x = Math.PI / 2;
rim.position.y = 0.105;
cup.add(rim);
const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.0365, 0.002, 8, 40), rimMetal);
baseRing.rotation.x = Math.PI / 2;
baseRing.position.y = 0.012;
cup.add(baseRing);

const rulerTex = canvasTex(64, 256, (g) => {
  g.fillStyle = '#d6b878'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#4a3a20';
  for (let i = 0; i < 64; i++) { const len = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9; g.fillRect(0, 4 + i * 4, len, 1.5); }
});
function addPen(kind, x, z, tx, tz, len, color) {
  const p = new THREE.Group();
  p.position.set(x, 0.014, z);
  p.rotation.set(tx, 0, tz);
  cup.add(p);
  const silver = mat(0xc9ccd2, 0.25, 0.9);
  const gold = mat(0xc9a227, 0.3, 0.85);
  const c = (rt, rb, h, m, y, seg = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.y = y;
    mesh.castShadow = true;
    p.add(mesh);
    return mesh;
  };
  const col = mat(color, 0.45);
  if (kind === 'pencil') { // sharpened end up
    c(0.0036, 0.0036, len, col, len / 2, 6);
    c(0.0036, 0.0007, 0.016, mat(0xe0b98a, 0.7), len + 0.008, 6);
    c(0.0009, 0.0007, 0.006, mat(0x2a2a2a, 0.6), len + 0.019, 6);
  } else if (kind === 'pencilE') { // eraser end up
    c(0.0036, 0.0036, len, col, len / 2, 6);
    c(0.0038, 0.0038, 0.012, silver, len + 0.004, 12);
    c(0.0034, 0.0034, 0.009, mat(0xe58c9a, 0.8), len + 0.014, 12);
  } else if (kind === 'pen') { // click ballpoint
    c(0.0045, 0.0045, len, col, len / 2);
    c(0.0047, 0.0047, 0.034, mat(0x1c1c20, 0.7), 0.04, 12);
    c(0.0038, 0.0038, 0.012, silver, len + 0.006);
    c(0.002, 0.002, 0.009, silver, len + 0.016, 8);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.05, 0.0032), silver);
    clip.position.set(0.0053, len - 0.03, 0);
    p.add(clip);
  } else if (kind === 'marker') { // highlighter
    c(0.0065, 0.0065, len, col, len / 2, 16);
    c(0.0068, 0.0068, 0.03, mat(0x2a2a2e, 0.5), len * 0.72, 16);
    c(0.0045, 0.0065, 0.014, mat(0xe8f06a, 0.4), len + 0.007, 14);
  } else if (kind === 'fountain') { // fountain pen with a gold nib
    c(0.0048, 0.0048, len, col, len / 2, 14);
    c(0.0051, 0.0051, 0.006, gold, len * 0.72, 14);
    c(0.0006, 0.0035, 0.022, gold, len + 0.011, 8);
  } else if (kind === 'ruler') { // flat wooden ruler
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, len, 0.0025), new THREE.MeshStandardMaterial({ map: rulerTex, roughness: 0.7 }));
    r.position.y = len / 2;
    r.castShadow = true;
    p.add(r);
  }
}
[
  ['pencil', -0.014, 0.004, 0.10, -0.16, 0.17, 0xe8b923],
  ['pencilE', 0.016, -0.008, -0.08, 0.2, 0.16, 0xc8302e],
  ['pen', 0.004, 0.016, 0.2, 0.05, 0.145, 0x1f4aa8],
  ['pen', -0.02, -0.012, -0.12, -0.2, 0.15, 0x1a1a1d],
  ['marker', 0.02, 0.012, 0.15, 0.17, 0.115, 0xc9e04a],
  ['fountain', -0.004, -0.02, -0.18, 0.04, 0.14, 0x14141a],
  ['ruler', 0.0, 0.0, 0.02, 0.26, 0.2, 0xd6b878],
].forEach((a) => addPen(...a));

// the window is a real opening in the back wall with a deep reveal, so the night outside has true depth
const windowG = new THREE.Group();
windowG.position.set(-2.1, 1.75, -1.335);
scene.add(windowG);
const revealMat = mat(0x232b40, 0.9);
box(0.01, 1.24, 0.15, revealMat, -0.48, 0, -0.09, windowG);
box(0.01, 1.24, 0.15, revealMat, 0.48, 0, -0.09, windowG);
box(0.95, 0.01, 0.15, revealMat, 0, 0.62, -0.09, windowG);
box(0.95, 0.01, 0.15, revealMat, 0, -0.62, -0.09, windowG);
const frameMat = mat(0x3d435a, 0.6);
box(0.94, 0.06, 0.05, frameMat, 0, 0.66, 0.02, windowG);
box(0.94, 0.06, 0.05, frameMat, 0, -0.66, 0.02, windowG);
box(0.06, 1.35, 0.05, frameMat, -0.5, 0, 0.02, windowG);
box(0.06, 1.35, 0.05, frameMat, 0.5, 0, 0.02, windowG);
box(0.03, 1.26, 0.03, frameMat, 0, 0, 0.02, windowG);
box(0.455, 0.03, 0.03, frameMat, -0.2425, 0.05, 0.02, windowG);
box(0.455, 0.03, 0.03, frameMat, 0.2425, 0.05, 0.02, windowG);
box(1.2, 0.04, 0.14, frameMat, 0, -0.72, 0.08, windowG); // sill
const moon = new THREE.SpotLight(0x7f9be0, 3, 7, 0.75, 0.9, 1.4);
moon.position.set(-2.1, 1.9, -1.1);
moon.target.position.set(-1.2, 0, 0.4);
scene.add(moon, moon.target);

// ---------- the night outside: real depth behind the window (stars, moon, clouds and hills all sit at different distances) ----------
const lcg = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const moonDir = new THREE.Vector3(-0.72, 0.085, -0.68).normalize();
const moonTex = canvasTex(512, 512, (g) => { // a plain, softly glowing yellow moon with only a hint of shading
  g.save();
  g.beginPath(); g.arc(256, 256, 254, 0, Math.PI * 2); g.clip();
  const body = g.createRadialGradient(230, 230, 20, 256, 256, 256);
  body.addColorStop(0, '#fff3b4'); body.addColorStop(0.7, '#f8da72'); body.addColorStop(1, '#eabd4c');
  g.fillStyle = body;
  g.fillRect(0, 0, 512, 512);
  [[190, 200, 90], [312, 300, 80], [272, 170, 50]].forEach(([x, y, rad]) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(190,140,40,0.2)'); gr.addColorStop(1, 'rgba(190,140,40,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  });
  g.restore();
}, 1, 1);
// sky dome: deep navy gradient, horizon glow, a faint Milky Way band, and the moon with its glow painted in at its true direction
const SKY_W = 4096, SKY_H = 2048;
const skyDomeTex = canvasTex(SKY_W, SKY_H, (g) => {
  const r = lcg(2);
  const gr = g.createLinearGradient(0, 0, 0, SKY_H);
  gr.addColorStop(0, '#02060f'); gr.addColorStop(0.3, '#040c1e'); gr.addColorStop(0.43, '#07122a');
  gr.addColorStop(0.492, '#0f1a33'); gr.addColorStop(0.505, '#070d1e'); gr.addColorStop(0.6, '#04070f'); gr.addColorStop(1, '#02030a');
  g.fillStyle = gr;
  g.fillRect(0, 0, SKY_W, SKY_H);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 700; i++) { // faint Milky Way
    const x = (i / 700) * SKY_W;
    const y = 480 + Math.sin((x / SKY_W) * Math.PI * 2 + 0.6) * 230 + (r() - 0.5) * 100;
    const rad = 60 + r() * 220;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, `rgba(150,170,220,${0.006 + r() * 0.008})`);
    rg.addColorStop(1, 'rgba(150,170,220,0)');
    g.fillStyle = rg;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  // the moon, at the same direction the room's window faces on the default view
  const mphi = (Math.atan2(moonDir.z, -moonDir.x) + Math.PI * 2) % (Math.PI * 2);
  const mx = (mphi / (Math.PI * 2)) * SKY_W;
  const my = (0.5 - Math.asin(moonDir.y) / Math.PI) * SKY_H;
  const R = 27;
  const halo = g.createRadialGradient(mx, my, R * 0.8, mx, my, R * 4);
  halo.addColorStop(0, 'rgba(255,224,110,0.55)'); halo.addColorStop(0.3, 'rgba(255,205,90,0.2)'); halo.addColorStop(0.65, 'rgba(255,190,80,0.05)'); halo.addColorStop(1, 'rgba(255,180,70,0)');
  g.fillStyle = halo;
  g.fillRect(mx - R * 6, my - R * 6, R * 12, R * 12);
  g.drawImage(moonTex.image, mx - R, my - R, R * 2, R * 2);
}, 1, 1);
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(90, 64, 32), new THREE.MeshBasicMaterial({ map: skyDomeTex, side: THREE.BackSide, fog: false, depthWrite: false }));
skyDome.renderOrder = -10;
scene.add(skyDome);

// stars: thousands of points of different size, brightness and colour that gently twinkle
const starN = 3600;
const starPos = new Float32Array(starN * 3);
const starCol = new Float32Array(starN * 3);
const starSize = new Float32Array(starN);
const starPhase = new Float32Array(starN);
{
  const sr = lcg(77);
  for (let i = 0; i < starN; i++) {
    let x, y, z, d;
    do { x = sr() * 2 - 1; y = sr() * 2 - 1; z = sr() * 2 - 1; d = x * x + y * y + z * z; } while (d > 1 || d < 0.01);
    const l = Math.sqrt(d);
    x /= l; y /= l; z /= l;
    if (y < 0.02) y = Math.abs(y) + 0.02;
    starPos.set([x * 80, y * 80, z * 80], i * 3);
    const moonAng = Math.acos(Math.min(1, x * moonDir.x + y * moonDir.y + z * moonDir.z));
    const moonClear = Math.min(1, Math.max(0, (moonAng - 0.13) / 0.2)); // 0 inside ~7.5 degrees of the moon
    const tc = sr();
    const col = tc < 0.2 ? [0.7, 0.82, 1.0] : tc < 0.75 ? [1, 1, 1] : tc < 0.9 ? [1, 0.92, 0.75] : [1, 0.78, 0.6];
    const b = (0.5 + sr() * 0.5) * moonClear;
    starCol.set([col[0] * b, col[1] * b, col[2] * b], i * 3);
    starSize[i] = 1.7 + Math.pow(sr(), 6) * 5.5 + sr() * 0.8;
    starPhase[i] = sr();
  }
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('aColor', new THREE.BufferAttribute(starCol, 3));
starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(window.devicePixelRatio, 2) } },
  vertexShader: `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPR;
    varying vec3 vColor; varying float vTw;
    void main() {
      vColor = aColor;
      vTw = 0.78 + 0.22 * sin(uTime * (1.4 + aPhase * 2.2) + aPhase * 40.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPR * (0.9 + 0.1 * vTw);
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vTw;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor * vTw * 2.2, min(1.0, a * 1.6));
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const starPoints = new THREE.Points(starGeo, starMat);
starPoints.frustumCulled = false;
starPoints.renderOrder = -9;
scene.add(starPoints);

// the moon: a cratered, slightly gibbous disc with a soft halo, placed so it drifts across the window as you move

// slow clouds drifting between us and the moon
const cloudTex = canvasTex(512, 128, (g) => {
  const r = lcg(41);
  for (let i = 0; i < 40; i++) {
    const x = 60 + r() * 392, y = 34 + r() * 60, rw = 30 + r() * 70, rh = 8 + r() * 18;
    const gr = g.createRadialGradient(x, y, 0, x, y, rw);
    gr.addColorStop(0, 'rgba(180,195,230,0.30)'); gr.addColorStop(1, 'rgba(180,195,230,0)');
    g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y);
    g.fillStyle = gr; g.fillRect(x - rw, y - rw, rw * 2, rw * 2);
    g.restore();
  }
}, 1, 1);
const clouds = [[-30, 3.5, -52, 120, 0.34], [-90, 9, -58, 150, 0.24], [10, 15, -64, 110, 0.2]].map(([x, y, z, w, op], i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: op, depthWrite: false, fog: false }));
  m.position.set(x, y, z);
  m.renderOrder = -7.6;
  m.userData.speed = 0.25 + i * 0.1;
  scene.add(m);
  return m;
});

// layers of hills at different distances: the nearest slide fastest against the window as you move
function ridge(zPos, topMinM, topMaxM, color, seed, order, opts = {}) {
  const WCAN = 4096, HCAN = 256, WORLD_W = 420, WORLD_H = 22, BASE_Y = -8;
  const tex = canvasTex(WCAN, HCAN, (g) => {
    const r = lcg(seed);
    const yPx = (m) => HCAN - ((m - BASE_Y) / WORLD_H) * HCAN;
    const p = [r() * 6, r() * 6, r() * 6, r() * 6];
    const hAt = (x) => {
      const u = x / WCAN;
      const v = 0.5 + 0.32 * Math.sin(u * 9 + p[0]) + 0.2 * Math.sin(u * 23 + p[1]) + 0.1 * Math.sin(u * 61 + p[2]) + 0.05 * Math.sin(u * 140 + p[3]);
      return topMinM + (topMaxM - topMinM) * Math.min(1, Math.max(0, v));
    };
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, HCAN);
    for (let x = 0; x <= WCAN; x += 4) g.lineTo(x, yPx(hAt(x)));
    g.lineTo(WCAN, HCAN); g.closePath(); g.fill();
    if (opts.trees) { // pine silhouettes along the crest
      for (let x = 0; x < WCAN; x += 5 + r() * 9) {
        const base = yPx(hAt(x)) + 3, th = 8 + r() * opts.trees;
        g.beginPath(); g.moveTo(x - 4 - r() * 2, base); g.lineTo(x + (r() - 0.5) * 1.5, base - th); g.lineTo(x + 4 + r() * 2, base); g.closePath(); g.fill();
      }
    }
    for (let i = 0; i < (opts.lights || 0); i++) { // a few warm house lights
      const x = r() * WCAN;
      g.fillStyle = r() < 0.7 ? '#ffd27a' : '#fff2c4';
      g.fillRect(x, yPx(hAt(x)) + 6 + r() * 18, 2 + r() * 1.5, 2);
    }
  }, 1, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  m.position.set(-40, BASE_Y + WORLD_H / 2, zPos);
  m.renderOrder = order;
  scene.add(m);
}
ridge(-72, 3, 9, '#0a1226', 5, -7);
ridge(-46, 2, 7, '#060b17', 9, -6.5, { lights: 16 });
ridge(-24, 0.2, 3.5, '#04060c', 13, -6, { trees: 24 });
function updateSky(t, dt) {
  starMat.uniforms.uTime.value = t;
  clouds.forEach((c) => { c.position.x += dt * c.userData.speed; if (c.position.x > 170) c.position.x = -210; });
}

// steam above the mug
const puffTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
scene.updateMatrixWorld(true);
const emberWorld = new THREE.Vector3();
ember.getWorldPosition(emberWorld);
const steam = [];
const puff = { level: 0, last: -100, time: 0 }; // click the cigar to make it puff more; it settles back by itself
cigar.userData.toggle = () => { puff.level = Math.min(puff.level + 0.45, 3.2); puff.last = performance.now() / 1000; };
for (let i = 0; i < 12; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xcdd1da, transparent: true, depthWrite: false, opacity: 0 }));
  s.userData.phase = i / 12;
  scene.add(s);
  steam.push(s);
}
// floating dust in the lamp light
const dustN = 140;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) {
  dustPos[i * 3] = -1.3 + Math.random() * 2.4;
  dustPos[i * 3 + 1] = 0.9 + Math.random() * 1.1;
  dustPos[i * 3 + 2] = -1.2 + Math.random() * 1.5;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: puffTex, size: 0.016, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b0 }));
scene.add(dust);

// ---------- tower PC (on the floor, left of the desk) ----------
const tower = new THREE.Group();
tower.position.set(1.12, 0.004, -0.7);
tower.rotation.y = 0.3;
scene.add(tower);
const darkPlastic = mat(0x2a2a2e, 0.5);
box(0.2, 0.5, 0.45, beige, 0, 0.25, 0, tower); // case
box(0.18, 0.44, 0.006, mat(0xd8cfb6, 0.5), 0, 0.25, 0.228, tower); // front panel
[0.4, 0.34].forEach((y) => { // 5.25" drive bays
  box(0.15, 0.04, 0.008, darkPlastic, 0, y, 0.235, tower);
  box(0.11, 0.004, 0.002, mat(0x111111, 0.4), 0, y + 0.007, 0.24, tower);
});
box(0.08, 0.012, 0.008, darkPlastic, -0.03, 0.27, 0.235, tower); // floppy slot
box(0.04, 0.02, 0.008, mat(0xc4baa0, 0.5), -0.03, 0.245, 0.235, tower); // eject
for (let i = 0; i < 7; i++) box(0.15, 0.003, 0.004, mat(0x6f6a5c, 0.6), 0, 0.06 + i * 0.012, 0.233, tower); // vents
const pwr = cyl(0.014, 0.014, 0.01, mat(0xb8ae94, 0.4), 0.05, 0.165, 0.234, tower, 20);
pwr.rotation.x = Math.PI / 2;
const ledG = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 0.4) }));
ledG.position.set(0.05, 0.2, 0.234);
tower.add(ledG);
const ledO = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 0.1) }));
ledO.position.set(0.05, 0.215, 0.234);
tower.add(ledO);

// CD tray ejected, with a disc sitting in it
const cdTray = new THREE.Group(); // slides in and out when clicked
tower.add(cdTray);
box(0.13, 0.004, 0.17, darkPlastic, 0, 0.402, 0.31, cdTray); // tray
box(0.14, 0.012, 0.008, darkPlastic, 0, 0.405, 0.399, cdTray); // tray front lip
const discTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#d4d8e0';
  g.fillRect(0, 0, 256, 256);
  if (g.createConicGradient) {
    const cg = g.createConicGradient(0.5, 128, 128);
    [['0', '#eef1f8'], ['0.15', '#b9c8ff'], ['0.3', '#f4e1ff'], ['0.45', '#c8ffe8'], ['0.6', '#eef1f8'], ['0.75', '#ffd9c8'], ['0.9', '#c8e0ff'], ['1', '#eef1f8']].forEach(([s, c]) => cg.addColorStop(+s, c));
    g.fillStyle = cg;
    g.fillRect(0, 0, 256, 256);
  }
  g.strokeStyle = 'rgba(60,70,90,0.35)'; g.lineWidth = 1; // data tracks
  for (let r = 50; r < 126; r += 5) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
});
const disc = new THREE.Mesh(new THREE.RingGeometry(0.0075, 0.06, 64), new THREE.MeshStandardMaterial({ map: discTex, metalness: 0.6, roughness: 0.25, side: THREE.DoubleSide }));
disc.rotation.x = -Math.PI / 2;
disc.position.set(0, 0.4045, 0.315);
disc.castShadow = true;
cdTray.add(disc);
const hub = new THREE.Mesh(new THREE.RingGeometry(0.0075, 0.0195, 48), new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
hub.rotation.x = -Math.PI / 2;
hub.position.set(0, 0.405, 0.315);
cdTray.add(hub);
// invisible click target over the drive bay, plus the toggle that slides the tray
const cdHit = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.05), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
cdHit.position.set(0, 0.4, 0.25);
tower.add(cdHit);
const cdState = { open: true, t: 1 };
// The song is NOT stored on this site any more: it is played through YouTube's own embedded player (the official way to share
// someone else's music), so the rights holder's copy is what plays. The small player appears while the disc is playing.
const YT_VIDEO = 'qYcoJpqCha4'; // Nujabes - Aruarian Dance
let cdMusic = null;
let cdMusicLoading = null;
let ytPlayer = null, ytVolume = 0;
function loadCdMusic() {
  if (cdMusicLoading) return cdMusicLoading;
  cdMusicLoading = new Promise((resolve) => {
    const box = document.createElement('div'); // YouTube asks that its player stays visible, so it is a small "now playing" window
    box.style.cssText = 'position:fixed;right:16px;bottom:56px;width:280px;height:158px;z-index:5;display:none;border-radius:6px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.6);background:#000;';
    const holder = document.createElement('div');
    box.appendChild(holder);
    document.body.appendChild(box);
    const adapter = {
      get volume() { return ytVolume; },
      set volume(v) { ytVolume = v; if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(Math.round(v * 100)); },
      play() { box.style.display = 'block'; try { ytPlayer.playVideo(); } catch (err) { /* the player is not ready */ } return Promise.resolve(); },
      pause() { try { ytPlayer.pauseVideo(); } catch (err) { /* nothing to pause */ } box.style.display = 'none'; },
    };
    const make = () => {
      try {
        ytPlayer = new YT.Player(holder, {
          host: 'https://www.youtube-nocookie.com', width: 280, height: 158, videoId: YT_VIDEO,
          playerVars: { controls: 1, rel: 0, playsinline: 1, loop: 1, playlist: YT_VIDEO },
          events: { onReady: () => { cdMusic = adapter; resolve(adapter); }, onError: () => resolve(null) },
        });
      } catch (err) { resolve(null); }
    };
    if (window.YT && window.YT.Player) make();
    else {
      window.onYouTubeIframeAPIReady = make;
      const sc = document.createElement('script');
      sc.src = 'https://www.youtube.com/iframe_api';
      sc.onerror = () => resolve(null);
      document.head.appendChild(sc);
    }
  });
  return cdMusicLoading;
}
const CD_VOLUME = 0.75;
let cdFade = null;
function fadeCdMusic(target, ms, then) {
  clearInterval(cdFade);
  if (!cdMusic) { if (then) then(); return; }
  const from = cdMusic.volume, t0 = performance.now();
  cdFade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    cdMusic.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k >= 1) { clearInterval(cdFade); if (then) then(); }
  }, 30);
}
let cdPlayTimer = null;
const toggleCd = () => {
  cdState.open = !cdState.open;
  clearTimeout(cdPlayTimer);
  if (!cdState.open) { // tray slides in: the disc is now in the drive, so start the song
    cdPlayTimer = setTimeout(() => {
      loadCdMusic().then((m) => {
        if (!m || cdState.open) return;
        // no rewind: the song picks up where it was paused (it only starts from 0:00 the first time)
        m.play().then(() => fadeCdMusic(CD_VOLUME, 600)).catch(() => {});
      });
    }, 650);
  } else { // ejected: stop the music
    fadeCdMusic(0, 250, () => { if (cdMusic) cdMusic.pause(); });
  }
};
cdTray.userData.toggle = toggleCd;
cdHit.userData.toggle = toggleCd;
const clickTargets = [...drawers, cdTray, cdHit, globeBall];

// ---------- cables: keyboard, mouse and monitor all run to the tower ----------
function wire(pts, radius, color) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.35);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 14, radius, 6, false), mat(color, 0.55));
  m.castShadow = true;
  desk.add(m);
  return m;
}
const toTower = [[1.05, 0.03, -0.2], [1.1, 0.02, -0.14], [1.14, 0.15, -0.1]];
wire([[0, 0.763, 0.2], [0.04, 0.756, 0.12], [0.26, 0.756, 0.08], [0.28, 0.756, -0.2], [0.35, 0.756, -0.33], [0.7, 0.756, -0.34], [0.97, 0.753, -0.33], [1.03, 0.72, -0.3], [1.05, 0.3, -0.26], ...toTower], 0.0018, 0x0b0b0d); // keyboard (thin black cord, like the mouse)
wire([[0.413, 0.762, 0.244], [0.39, 0.756, 0.15], [0.33, 0.756, 0.0], [0.31, 0.756, -0.2], [0.4, 0.756, -0.29], [0.7, 0.756, -0.29], [0.97, 0.753, -0.28], [1.03, 0.72, -0.26], [1.06, 0.3, -0.23], ...toTower], 0.0018, 0x0b0b0d); // mouse (thin black cord)
wire([[0, 1.2, -0.472], [0, 1.1, -0.482], [0, 0.95, -0.482], [0, 0.8, -0.46], [0, 0.757, -0.41], [0.3, 0.757, -0.39], [0.7, 0.757, -0.39], [0.97, 0.754, -0.37], [1.03, 0.72, -0.34], [1.05, 0.3, -0.28], ...toTower], 0.0065, 0x111113); // monitor

// ---------- door in the right-hand wall, next to the bookshelf ----------
const door = new THREE.Group();
door.position.set(2.995, 0, -0.65);
door.rotation.y = -Math.PI / 2; // local +z points into the room
scene.add(door);
const doorWood = mat(0x121110, 0.85); // near-black, matte so it does not catch the light
const doorPanel = mat(0x0d0c0b, 0.88);
const doorTrim = mat(0x0b0a09, 0.88);
const doorBrass = mat(0xb08a3a, 0.3, 0.85);
const leafParts = []; // everything that swings with the door itself (not the frame)
const L = (m) => { leafParts.push(m); return m; };
L(box(0.9, 2.02, 0.045, doorWood, 0, 1.022, 0.04, door)); // slab, with a small gap under it
[-0.2, 0.2].forEach((x) => [0.46, 1.03, 1.6].forEach((y) => L(box(0.3, 0.5, 0.012, doorPanel, x, y, 0.068, door)))); // raised panels
box(0.075, 2.032, 0.06, doorTrim, -0.495, 1.024, 0.035, door); // casing
box(0.075, 2.032, 0.06, doorTrim, 0.495, 1.024, 0.035, door);
box(1.07, 0.09, 0.07, doorTrim, 0, 2.085, 0.04, door); // head casing
box(1.02, 0.008, 0.07, doorTrim, 0, 0.004, 0.04, door); // threshold
[0.3, 1.0, 1.75].forEach((y) => cyl(0.009, 0.009, 0.09, doorBrass, -0.445, y, 0.066, door, 10)); // hinges
const rose = L(cyl(0.026, 0.026, 0.01, doorBrass, 0.39, 1.0, 0.07, door, 20));
rose.rotation.x = Math.PI / 2;
const stem = L(cyl(0.008, 0.008, 0.05, doorBrass, 0.39, 1.0, 0.09, door, 10));
stem.rotation.x = Math.PI / 2;
L(box(0.11, 0.016, 0.016, doorBrass, 0.335, 1.0, 0.112, door)); // lever handle
L(box(0.03, 0.1, 0.006, doorBrass, 0.395, 0.86, 0.065, door)); // key plate
L(box(0.006, 0.02, 0.003, mat(0x111111, 0.5), 0.395, 0.865, 0.0695, door)); // keyhole
// warm hallway light leaking under the door: a faint hot line at the gap, a soft fan of light on the floor, and a gentle glow
const gapGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.004), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.6), transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
gapGlow.position.set(0, 0.01, 0.056); // sits inside the real 4 mm gap between slab and threshold, clear of every other surface
door.add(gapGlow);
const spillTex = canvasTex(256, 160, (g) => {
  g.clearRect(0, 0, 256, 160);
  for (let y = 0; y < 160; y++) { // bright at the door, widening and fading away from it
    const fade = Math.pow(1 - y / 160, 1.6); // reaches zero at the far edge so no hard boundary shows
    const a = (0.55 * Math.exp(-y / 34) + 0.1 * Math.exp(-y / 90)) * fade;
    const hw = 66 + y * 0.32; // fans out but stays inside the texture
    const gr = g.createLinearGradient(128 - hw, 0, 128 + hw, 0);
    gr.addColorStop(0, 'rgba(255,190,115,0)');
    gr.addColorStop(0.28, `rgba(255,190,115,${a})`);
    gr.addColorStop(0.72, `rgba(255,190,115,${a})`);
    gr.addColorStop(1, 'rgba(255,190,115,0)');
    g.fillStyle = gr;
    g.fillRect(128 - hw, y, hw * 2, 1);
  }
});
const spill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.2), new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
spill.rotation.x = -Math.PI / 2;
spill.position.set(0, 0.004, 0.176); // only a short sliver of light, right at the door: all of it comes from the gap // starts just past the threshold and lies on the floor (no shared surface, so nothing flickers)
door.add(spill);

const doorLight = new THREE.SpotLight(0xffc890, 1.1, 2.6, 0.5, 0.9, 2); // soft fill aimed only at the door itself, so it never washes the floor
doorLight.position.set(2.35, 1.9, -0.65);
doorLight.target.position.set(3.0, 1.1, -0.65);
scene.add(doorLight, doorLight.target);

// ---- the door can swing: it hangs on its hinge side and pops open a crack when the disco starts, letting the hallway light in ----
const doorLeaf = new THREE.Group();
doorLeaf.position.set(-0.445, 0, 0.04); // the hinge line
door.add(doorLeaf);
scene.updateMatrixWorld(true);
leafParts.forEach((m) => doorLeaf.attach(m));
const doorState = { open: false, a: 0, v: 0, level: 0 };
// the bright hallway seen through the doorway, only visible once the door is ajar
const hallTex = canvasTex(64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.6, 'rgba(255,196,120,1)'); gr.addColorStop(1, 'rgba(255,170,90,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
});
const hallway = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.98), new THREE.MeshBasicMaterial({ map: hallTex, color: new THREE.Color(2.4, 2.0, 1.5), transparent: true, depthWrite: false }));
hallway.position.set(0, 1.012, 0.011);
hallway.visible = false;
door.add(hallway);
// the light that pours in across the floor
const openSpill = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.2), new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
openSpill.rotation.x = -Math.PI / 2;
openSpill.position.set(0.28, 0.005, 1.2);
openSpill.rotation.z = 0.0;
openSpill.visible = false;
door.add(openSpill);
// and a real warm light shining in through the gap onto the room (always present, switched on by intensity)
const doorBeam = new THREE.SpotLight(0xffc890, 0, 7, 0.6, 0.85, 1.3);
doorBeam.position.set(3.05, 1.0, -0.4);
doorBeam.target.position.set(1.3, 0.2, 0.1);
scene.add(doorBeam, doorBeam.target);
// once the door is ajar, clicking it asks whether you really want to leave the party
const leaveBox = document.getElementById('leave') || document.createElement('div'); // (a stand-in if an older cached page lacks the box, so the scene still starts)
const showLeave = () => { leaveBox.style.display = 'flex'; document.body.style.cursor = 'default'; };
const hideLeave = () => { leaveBox.style.display = 'none'; };
const leaveNo = document.getElementById('leaveNo'), leaveYes = document.getElementById('leaveYes');
if (leaveNo) leaveNo.addEventListener('click', hideLeave);
if (leaveYes) leaveYes.addEventListener('click', () => {
  hideLeave();
  window.close(); // works when the browser allows it...
  setTimeout(() => { location.replace('about:blank'); }, 150); // ...otherwise the page is simply left behind
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && leaveBox.style.display === 'flex') hideLeave(); });
function updateDoor(dt) {
  const target = doorState.open ? 0.28 : 0;
  doorState.v += (target - doorState.a) * 70 * dt;
  doorState.v *= Math.exp(-dt * 6.5); // springy: it pops open, overshoots a touch, and settles
  doorState.a += doorState.v * dt;
  doorLeaf.rotation.y = -doorState.a; // swings into the room
  if (doorState.open && doorState.a > 0.08) door.userData.toggle = showLeave; // only clickable while it is open
  else delete door.userData.toggle;
  if (!doorState.open) hideLeave();
  doorState.level += ((doorState.open ? 1 : 0) - doorState.level) * (1 - Math.exp(-dt * 5));
  const lv = doorState.level;
  const ajar = lv > 0.02;
  hallway.visible = ajar;
  openSpill.visible = ajar;
  openSpill.material.opacity = Math.min(1, lv * 1.2);
  gapGlow.visible = lv < 0.5; // the thin line under the door is replaced by the open gap
  spill.visible = lv < 0.5;
  doorBeam.intensity = lv * 4.2;
}


// ---------- warm LED light bar under the desktop: the visible source of the glow on the floor beneath the desk ----------
const ledBar = new THREE.Group();
ledBar.position.set(-0.5, 0.688, -0.2);
desk.add(ledBar);
box(0.46, 0.012, 0.03, mat(0x9aa0a8, 0.35, 0.8), 0, 0.006, 0, ledBar); // aluminium channel stuck to the underside of the top
const ledStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.016), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.8) }));
ledStrip.rotation.x = Math.PI / 2; // faces down
ledStrip.position.y = -0.0005;
ledBar.add(ledStrip);
const underLight = new THREE.SpotLight(0xffb066, 7, 4, 1.05, 0.8, 1.5);
underLight.position.set(-0.5, 0.672, -1.05);
underLight.target.position.set(0.15, 0, -0.2); // fans out toward the front-right, the same angle as the glow was
underLight.castShadow = true;
underLight.shadow.mapSize.set(512, 512);
underLight.shadow.camera.near = 0.05;
underLight.shadow.bias = -0.0008;
scene.add(underLight, underLight.target);

// ---------- lights ----------
scene.add(new THREE.AmbientLight(0x7a88b8, 0.8));
scene.add(new THREE.HemisphereLight(0x8aa0d0, 0x2a1c10, 0.5));
const shelfLight = new THREE.PointLight(0xffc890, 1.4, 3.2, 1.8); // soft fill so the book spines are readable
shelfLight.position.set(1.2, 1.5, -0.45);
scene.add(shelfLight);
const screenGlow =new THREE.PointLight(0x7fd8ff, 2.2, 3.5, 1.8);
screenGlow.position.set(0, 1.15, 0.1);
scene.add(screenGlow);

// ---------- camera control ----------
const screenWorld = new THREE.Vector3();
screen.getWorldPosition(screenWorld);
const overviewLook = new THREE.Vector3(0.3, 1.05, -0.85);
const overviewBase = new THREE.Vector3(1.3, 1.6, 1.75);
let mode = 'intro'; // intro | overview | focus
const lookNow = new THREE.Vector3().copy(overviewLook);
const mouse = new THREE.Vector2(0, 0);

camera.position.set(2.8, 2.4, 3.6);

function targetPose() {
  const aspect = camera.aspect;
  if (mode === 'focus') {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const visH = Math.max(0.375 / 0.82, 0.5 / 0.9 / aspect);
    const d = visH / 2 / Math.tan(vfov / 2);
    return { pos: new THREE.Vector3(screenWorld.x, screenWorld.y, screenWorld.z + d), look: screenWorld.clone() };
  }
  const o = orbit;
  const sp = Math.sin(o.phi);
  const pos = new THREE.Vector3(
    o.target.x + o.radius * sp * Math.sin(o.theta),
    o.target.y + o.radius * Math.cos(o.phi),
    o.target.z + o.radius * sp * Math.cos(o.theta)
  );
  const par = Math.min(1, o.radius / 2.5);
  pos.x += mouse.x * 0.06 * par;
  pos.y += -mouse.y * 0.03 * par;
  const cl = THREE.MathUtils.clamp;
  pos.set(cl(pos.x, -2.8, 2.8), cl(pos.y, 0.25, 3.2), cl(pos.z, -1.25, 3.6));
  return { pos, look: o.target.clone() };
}

// free-look camera state (drag = orbit, wheel = zoom, right-drag = pan)
const orbit = { theta: 0, phi: 1.3, radius: 3, target: overviewLook.clone() };
function resetOrbit() {
  const off = overviewBase.clone().sub(overviewLook);
  const k = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.9 : 1;
  orbit.radius = off.length() * k;
  orbit.theta = Math.atan2(off.x, off.z);
  orbit.phi = Math.acos(off.y / off.length());
  orbit.target.copy(overviewLook);
}

const ui = {
  hint: document.getElementById('hint'),
  back: document.getElementById('back'),
  reset: document.getElementById('reset'),
};
ui.reset.addEventListener('click', () => resetOrbit());
window.addEventListener('keydown', (e) => { if ((e.key === 'r' || e.key === 'R') && mode === 'overview') resetOrbit(); });
function setMode(m) {
  mode = m;
  os.focused = m === 'focus';
  ui.back.style.display = m === 'focus' ? 'block' : 'none';
  ui.reset.style.display = m === 'overview' ? 'block' : 'none';
  ui.hint.textContent = m === 'focus'
    ? 'Scroll down past the end, press Esc, or click Back to step away from the desk'
    : 'Drag to look around  ·  scroll to zoom  ·  click the monitor to sit down';
  document.body.style.cursor = m === 'overview' ? 'grab' : 'default';
}
function enterMonitor() { if (mode === 'overview') setMode('focus'); }
function leaveMonitor() {
  if (mode !== 'focus') return;
  os.pointerLeave();
  setMode('overview');
}
ui.back.addEventListener('click', leaveMonitor);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') leaveMonitor();
  else if (mode === 'focus' && os.key(e.key)) e.preventDefault(); // typing the code, or playing a game, on the real keyboard
});
window.addEventListener('keyup', (e) => { if (mode === 'focus') os.keyUp(e.key); });

// ---------- pointer input ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function screenPoint(e) {
  setNdc(e);
  const hit = raycaster.intersectObject(screen, false)[0];
  if (!hit) return null;
  return { x: hit.uv.x * OS_SIZE.W, y: (1 - hit.uv.y) * OS_SIZE.H };
}
let monitorHover = false;
// Which interactive thing is the cursor really over? The nearest solid object along the ray decides, so
// something hidden behind or under another object (like a drawer under the desktop) can not be clicked through it.
function pickInteractive() {
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    const o = h.object;
    let shown = true;
    for (let q = o; q; q = q.parent) if (!q.visible) { shown = false; break; }
    if (!shown) continue; // hidden objects (like the party-only bottle) can not be clicked or block a click
    let a = o, target = null, isMonitor = false;
    while (a) {
      if (a.userData && a.userData.toggle) { target = a; break; }
      if (a === monitor) { isMonitor = true; break; }
      a = a.parent;
    }
    if (target) return { type: 'toggle', obj: target };
    if (isMonitor) return { type: 'monitor' };
    if (o.isSprite || o.isPoints || !o.isMesh) continue; // smoke, z's, stars and dust never block a click
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && ((m.transparent && m.opacity < 0.6) || m.side === THREE.BackSide)) continue; // clear glass and the sky do not block either
    return null; // something solid is in front
  }
  return null;
}
let lastPick = 0;
let overscroll = 0;
let lastWheel = 0;
let down = null;
const pointers = new Map();
let pinchLast = 0;
let pinchUsed = false;
const pinchDist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, button: e.button, shift: e.shiftKey };
  if (pointers.size === 2) { pinchLast = pinchDist(); pinchUsed = true; down.moved = true; }
  if (mode === 'overview') document.body.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && mode === 'overview') { // two-finger pinch zoom
    const d = pinchDist();
    if (pinchLast) orbit.radius = THREE.MathUtils.clamp(orbit.radius * (pinchLast / d), 0.35, 4.6);
    pinchLast = d;
    return;
  }
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  if (mode === 'focus') {
    if (down && e.pointerType === 'touch') {
      if (Math.abs(e.clientY - down.y) > 6) down.moved = true;
      const p = screenPoint(e);
      if (down.moved && p) os.wheel(p.x, p.y, (down.lastY - e.clientY) * 1.6);
      down.lastY = e.clientY;
      return;
    }
    const p = screenPoint(e);
    if (p) document.body.style.cursor = os.pointerMove(p.x, p.y) === 'pointer' ? 'pointer' : 'default';
    else { os.pointerLeave(); document.body.style.cursor = 'default'; }
  } else if (mode === 'overview') {
    if (down) {
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
      if (down.moved) {
        const dx = e.clientX - down.lastX, dy = e.clientY - down.lastY;
        if (down.button === 2 || down.shift) { // pan
          const s = orbit.radius * 0.0016;
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
          const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
          orbit.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
          const cl = THREE.MathUtils.clamp;
          orbit.target.set(cl(orbit.target.x, -2.5, 2.5), cl(orbit.target.y, 0.1, 2.6), cl(orbit.target.z, -1.3, 1.6));
        } else { // orbit
          orbit.theta = THREE.MathUtils.clamp(orbit.theta - dx * 0.006, -1.4, 1.4);
          orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.005, 0.3, 1.65);
        }
      }
      down.lastX = e.clientX; down.lastY = e.clientY;
      document.body.style.cursor = down.moved ? 'grabbing' : 'pointer';
      monitorHover = false;
      return;
    }
    setNdc(e);
    const nowMs = performance.now();
    if (nowMs - lastPick > 45) { // checking every object each frame is wasteful, so look a few times a second
      lastPick = nowMs;
      const pk = pickInteractive();
      monitorHover = !!pk && pk.type === 'monitor';
      document.body.style.cursor = pk ? 'pointer' : 'grab';
    }
  }
});
canvas.addEventListener('pointerup', (e) => {
  const wasMoved = (down && down.moved) || pinchUsed;
  down = null;
  pointers.delete(e.pointerId);
  pinchLast = 0;
  if (pointers.size === 0) pinchUsed = false;
  if (mode === 'overview') document.body.style.cursor = 'grab';
  if (wasMoved) return;
  if (mode === 'overview') {
    setNdc(e);
    const pk = pickInteractive();
    if (pk && pk.type === 'toggle') pk.obj.userData.toggle(); // a drawer, the CD drive, the globe or the cigar
    else if (pk && pk.type === 'monitor') enterMonitor();
  } else if (mode === 'focus') {
    const p = screenPoint(e);
    if (p) { os.pointerMove(p.x, p.y); os.click(p.x, p.y); }
  }
});
canvas.addEventListener('wheel', (e) => {
  if (mode === 'overview') { // zoom, drifting toward whatever the cursor is over
    e.preventDefault();
    const dy = Math.max(-120, Math.min(120, e.deltaY));
    if (dy < 0) {
      setNdc(e);
      const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.isMesh && !h.object.isSprite);
      if (hit) {
        const cl = THREE.MathUtils.clamp;
        const p = hit.point;
        orbit.target.lerp(new THREE.Vector3(cl(p.x, -2.5, 2.5), cl(p.y, 0.1, 2.6), cl(p.z, -1.3, 1.6)), 0.22);
      }
    }
    orbit.radius = THREE.MathUtils.clamp(orbit.radius * Math.exp(dy * 0.0015), 0.35, 4.6);
    return;
  }
  if (mode !== 'focus') return;
  e.preventDefault();
  const p = screenPoint(e);
  const result = p ? os.wheel(p.x, p.y, e.deltaY * 0.8) : 'none';
  const now = performance.now();
  if (now - lastWheel > 500) overscroll = 0; // a pause resets the "scroll away" build-up
  lastWheel = now;
  if (result === 'scrolled') { overscroll = 0; return; }
  // Nothing left to scroll (or the pointer is off the screen): keep scrolling down to step away from the desk.
  if (e.deltaY > 0) {
    overscroll += e.deltaY;
    const needed = !p ? 60 : result === 'edge' ? 260 : 120;
    if (overscroll > needed) { overscroll = 0; leaveMonitor(); }
  } else overscroll = 0;
}, { passive: false });
canvas.addEventListener('pointerleave', () => { if (mode === 'focus') os.pointerLeave(); });

// ---------- resize + loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
resetOrbit();

// ---------- solid objects: the camera is never allowed to pass through them ----------
scene.updateMatrixWorld(true);
const solidBoxes = [monitor, tower, shelf, chair, tree, cat].map((o) => new THREE.Box3().setFromObject(o));
const solidBox = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
solidBoxes.push(solidBox(-1.0, 0.7, -1.28, 1.0, 0.76, -0.42)); // desk top
[[-0.93, -0.38], [0.93, -0.38], [-0.93, 0.38], [0.93, 0.38]].forEach(([x, z]) => solidBoxes.push(solidBox(x - 0.03, 0, -0.85 + z - 0.03, x + 0.03, 0.7, -0.85 + z + 0.03))); // desk legs
solidBoxes.push(solidBox(0.45, 0.2, -1.2, 0.91, 0.7, -0.5)); // drawer cabinet
// things on the desk (the glass, bottle, cigar, pen holder, lamp, cube) are solid too
const partyDesk = { present: false }; // the cigar, bottle and drink exist only while the party is on
[cup, lamp, rubik].forEach((o) => solidBoxes.push(new THREE.Box3().setFromObject(o)));
// things that move: the drawers slide out, and the cork lies down beside the bottle. Their boxes are refreshed every frame.
const movingSolids = [...drawers, bottle, scotch, cigarSet, cigarBoxes].map((o) => ({ o, box: new THREE.Box3(), partyOnly: o === bottle || o === scotch || o === cigarSet || o === cigarBoxes }));
function refreshMovingSolids() { movingSolids.forEach((m) => { if (m.partyOnly && !partyDesk.present) { m.box.makeEmpty(); return; } m.o.updateMatrixWorld(true); m.box.setFromObject(m.o); }); }
const CAM_CLEARANCE = 0.14;
function keepOutOfSolids(p) { // push the camera out through the nearest face of any solid it has entered
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const b of [...solidBoxes, ...movingSolids.map((m) => m.box)]) {
      const x0 = b.min.x - CAM_CLEARANCE, x1 = b.max.x + CAM_CLEARANCE, y0 = b.min.y - CAM_CLEARANCE, y1 = b.max.y + CAM_CLEARANCE, z0 = b.min.z - CAM_CLEARANCE, z1 = b.max.z + CAM_CLEARANCE;
      if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 && p.z > z0 && p.z < z1) {
        const d = [p.x - x0, x1 - p.x, p.y - y0, y1 - p.y, p.z - z0, z1 - p.z];
        let k = 0;
        for (let i = 1; i < 6; i++) if (d[i] < d[k]) k = i;
        if (k === 0) p.x = x0; else if (k === 1) p.x = x1; else if (k === 2) p.y = y0; else if (k === 3) p.y = y1; else if (k === 4) p.z = z0; else p.z = z1;
        moved = true;
      }
    }
    if (!moved) break;
  }
}
const clock = new THREE.Clock();
let t = 0;

// ---------- the secret disco: a mirror ball whose light spots sweep every wall, the floor and the ceiling ----------
const disco = { on: false, level: 0, ball: new THREE.Group(), N: 280 };
disco.ball.position.set(0, 3.15, 1.2);
disco.ball.visible = false;
scene.add(disco.ball);
{
  const geo = new THREE.IcosahedronGeometry(0.22, 3).toNonIndexed();
  const col = new Float32Array(geo.attributes.position.count * 3);
  for (let f = 0; f < geo.attributes.position.count / 3; f++) { // every mirror tile a slightly different silver
    const b = 0.55 + Math.random() * 0.45;
    for (let v = 0; v < 3; v++) col.set([b, b, b * 1.05], (f * 3 + v) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  disco.ballMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0.9, roughness: 0.15, emissive: 0x6a6a90, emissiveIntensity: 0.6 });
  disco.ballMesh = new THREE.Mesh(geo, disco.ballMat);
  disco.ball.add(disco.ballMesh);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.85, 6), mat(0x222222, 0.6));
  cord.position.y = 0.22 + 0.425;
  disco.ball.add(cord);
}
disco.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
}), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
disco.glow.scale.setScalar(1.3);
disco.ball.add(disco.glow);
// a little coloured light that orbits the ball (always in the scene, switched on by intensity so nothing has to recompile)
disco.lights = [0xff2a6a, 0x2a8aff, 0x3aff8a].map((c) => { const l = new THREE.PointLight(c, 0, 5, 1.6); scene.add(l); return l; });
// the light spots: small round glows cast onto whichever surface each ray from the ball hits
{
  const spotTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  disco.spots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), disco.N);
  disco.spots.frustumCulled = false;
  disco.spots.visible = false;
  scene.add(disco.spots);
  disco.rays = [];
  const palette = [0xff3a7a, 0x3aa0ff, 0x4dff9a, 0xffd23a, 0xb25aff, 0xffffff].map((h) => new THREE.Color(h));
  for (let i = 0; i < disco.N; i++) {
    const el = Math.asin(Math.random() * 1.7 - 0.85); // fanned all around, up and down
    disco.rays.push({ az: Math.random() * Math.PI * 2, el, spin: 1 + (i % 3) * 0.25, size: 0.045 + Math.random() * 0.06 });
    disco.spots.setColorAt(i, palette[i % palette.length].clone().multiplyScalar(1.25));
  }
}

// ---------- party extras: a poster on the wall behind the computer, and a "Published" stamp on the paper ----------
const poster = new THREE.Group();
poster.position.set(0, 1.98, -1.338);
poster.visible = false;
scene.add(poster);
{
  const fr = mat(0x0d0d10, 0.5);
  const PW = 1.1, PH = (PW * 768) / 1800; // the picture is wide (1800 x 768), so the frame follows its shape exactly
  box(PW + 0.06, 0.03, 0.02, fr, 0, PH / 2 + 0.015, 0, poster); box(PW + 0.06, 0.03, 0.02, fr, 0, -PH / 2 - 0.015, 0, poster); // inner edges meet the picture's top and bottom
  box(0.03, PH, 0.02, fr, -PW / 2 - 0.015, 0, 0, poster); box(0.03, PH, 0.02, fr, PW / 2 + 0.015, 0, 0, poster); // and its left and right
  const pt = loadScrambledTexture('poster.bin'); // stored scrambled, like the photos: no image file to download
  pt.colorSpace = THREE.SRGBColorSpace;
  pt.anisotropy = 8;
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.6, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: 0.35 }));
  pm.position.z = 0.002;
  poster.add(pm);
}
const stampTex = canvasTex(420, 594, (g) => {
  g.clearRect(0, 0, 420, 594);
  g.save();
  g.translate(235, 440);
  g.rotate(-0.28);
  g.strokeStyle = '#c8202a'; g.fillStyle = '#c8202a';
  g.lineWidth = 7; g.strokeRect(-132, -36, 264, 72);
  g.lineWidth = 2.5; g.strokeRect(-124, -28, 248, 56);
  g.font = 'bold 38px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PUBLISHED', 0, 3);
  g.restore();
  // worn ink: tiny gaps scattered through the stamp
  g.globalCompositeOperation = 'destination-out';
  let s = 9; const rr = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(0,0,0,' + (0.25 + rr() * 0.6) + ')'; g.beginPath(); g.arc(90 + rr() * 290, 380 + rr() * 120, 0.8 + rr() * 2.2, 0, 7); g.fill(); }
}, 1, 1);
const stamp = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshBasicMaterial({ map: stampTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
stamp.rotation.order = 'YXZ';
stamp.rotation.set(-Math.PI / 2, 0.15 + 5 * 0.03, 0);
stamp.position.set(-0.66, 0.752 + 5 * 0.0032 + 0.0015 + 0.0004, 0.2);
stamp.visible = false;
desk.add(stamp);
const partySwap = { shown: false };
function updatePartyProps() { // everything that changes for the party, and changes back afterwards
  const on = disco.on;
  if (on !== partySwap.shown) {
    partySwap.shown = on;
    bookMeshes.forEach((m) => { m.visible = !on; });
    partyShelf.visible = on;
    setDeskParty(on);
    photo.material.map = on ? partyPhotoTex : photoTex; // the wall portrait
    photo.material.emissiveMap = photo.material.map;
    photo.material.needsUpdate = true;
  }
  const L = disco.level;
  poster.visible = L > 0.02;
  poster.scale.setScalar(0.7 + 0.3 * Math.min(1, L * 1.4));
  stamp.visible = L > 0.02;
  stamp.material.opacity = Math.min(1, L * 1.3);
}


// ---------- an 80%-finished jigsaw puzzle waits on the desk where the cigar, bottle and drink stand during the party ----------
const puzzlePieces = [];
const puzzle = new THREE.Group();
puzzle.position.set(0.78, 0.75, 0.15);
puzzle.rotation.y = 0.12;
desk.add(puzzle);
{
  const COLS = 6, ROWS = 8, P = 0.04, BW = COLS * P, BH = ROWS * P; // 48 pieces, a portrait-shaped picture
  const pic = loadScrambledTexture('puzzle.bin'); // stored scrambled, so the picture is never a downloadable file
  pic.colorSpace = THREE.SRGBColorSpace;
  pic.anisotropy = 8;
  const faceMat = new THREE.MeshStandardMaterial({ map: pic, roughness: 0.55 });
  const coreMat = mat(0x34343c, 0.8);
  let ps = 77;
  const pr = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
  const sh = [], sv = []; // which way each inner edge bulges
  for (let r = 0; r < ROWS; r++) { sh.push([]); sv.push([]); for (let c = 0; c < COLS; c++) { sh[r].push(pr() < 0.5 ? 1 : -1); sv[r].push(pr() < 0.5 ? 1 : -1); } }
  const KNOB = [[0, 0], [0.36, 0], [0.40, 0.02], [0.43, 0.07], [0.38, 0.11], [0.37, 0.16], [0.41, 0.2], [0.5, 0.225], [0.59, 0.2], [0.63, 0.16], [0.62, 0.11], [0.57, 0.07], [0.60, 0.02], [0.64, 0], [1, 0]];
  // the outline of one piece, with a rounded knob (or socket) on each inner edge
  const edgePts = (ax, ay, dx, dy, nx, ny, sign) => {
    if (!sign) return [[ax + dx * P, ay + dy * P]];
    const raw = KNOB.map(([u, b]) => new THREE.Vector2(ax + dx * P * u + nx * P * b * sign, ay + dy * P * u + ny * P * b * sign));
    return new THREE.SplineCurve(raw).getPoints(48).slice(1).map((v) => [v.x, v.y]);
  };
  const pieceGeo = (c, r) => {
    const h = P / 2;
    const sBottom = r < ROWS - 1 ? sv[r][c] : 0, sTop = r > 0 ? -sv[r - 1][c] : 0;
    const sRight = c < COLS - 1 ? sh[r][c] : 0, sLeft = c > 0 ? -sh[r][c - 1] : 0;
    const pts = [[-h, -h]];
    pts.push(...edgePts(-h, -h, 1, 0, 0, -1, sBottom)); // bottom edge, left to right
    pts.push(...edgePts(h, -h, 0, 1, 1, 0, sRight)); // right edge, going up
    pts.push(...edgePts(h, h, -1, 0, 0, 1, sTop)); // top edge, right to left
    pts.push(...edgePts(-h, h, 0, -1, -1, 0, sLeft)); // left edge, going down
    const shape = new THREE.Shape(pts.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0026, bevelEnabled: false, curveSegments: 1 });
    const cx = (c + 0.5) * P - BW / 2, cy = BH / 2 - (r + 0.5) * P; // where this piece sits on the board
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + cx + BW / 2) / BW, (pos.getY(i) + cy + BH / 2) / BH);
    return { geo, cx, cy };
  };
  // a little more than a fifth of the pieces are still missing: these ten lie loose beside the board
  const missing = new Set(['2,1', '2,2', '3,2', '3,3', '4,1', '5,3', '5,4', '6,2', '7,0', '1,5']);
  const looseSpots = [[-0.17, 0.06, 0.6], [-0.15, 0.17, 2.1], [-0.19, -0.05, 4.0], [0.17, 0.2, 1.2], [0.2, 0.09, 3.3], [0.18, -0.07, 5.2], [-0.12, 0.24, 0.3], [0.1, 0.25, 2.7], [0.0, 0.24, 4.4], [0.17, -0.2, 1.6]];
  let li = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const { geo, cx, cy } = pieceGeo(c, r);
    const m = new THREE.Mesh(geo, [faceMat, coreMat]);
    m.castShadow = true;
    m.receiveShadow = true;
    if (!missing.has(r + ',' + c)) { // in its place on the board
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0, -cy);
      puzzle.add(m);
    } else { // loose on the desk, turned any which way (its picture side up)
      const [lx, lz, ang] = looseSpots[li++];
      const g = new THREE.Group();
      g.position.set(lx + 0.0, 0, lz);
      g.rotation.y = ang;
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      puzzle.add(g);
      const piece = { g, tx: cx, tz: -cy, from: null, t: 0, placed: false, busy: false };
      puzzlePieces.push(piece);
      g.userData.toggle = () => { // only while the room is normal (the puzzle is hidden during the party anyway)
        if (piece.placed || piece.busy) return;
        piece.busy = true; piece.t = 0;
        piece.from = { x: g.position.x, z: g.position.z, ry: g.rotation.y };
        piece.toRy = Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2; // turn the short way round to the upright position
      };
    }
  }
}
function updatePuzzle(dt) { // a clicked piece lifts, slides across and turns, then settles into its gap
  puzzlePieces.forEach((p) => {
    if (!p.busy) return;
    p.t = Math.min(1, p.t + dt / 0.8);
    const e = p.t * p.t * (3 - 2 * p.t);
    p.g.position.x = p.from.x + (p.tx - p.from.x) * e;
    p.g.position.z = p.from.z + (p.tz - p.from.z) * e;
    p.g.position.y = Math.sin(e * Math.PI) * 0.035;
    p.g.rotation.y = p.from.ry + (p.toRy - p.from.ry) * e;
    if (p.t >= 1) { p.busy = false; p.placed = true; p.g.position.set(p.tx, 0, p.tz); p.g.rotation.y = 0; delete p.g.userData.toggle; }
  });
}
const setMeshesShown = (obj, on) => obj.traverse((o) => { if (o.isMesh || o.isSprite) o.visible = on; }); // lights stay put so nothing has to recompile
function setDeskParty(on) { // the cigar, its tray, the bottle and the drink are there only during the party; the puzzle only otherwise
  partyDesk.present = on;
  [cigarSet, bottle, scotch, cigarBoxes].forEach((o) => setMeshesShown(o, on));
  puzzle.visible = !on;
}
setDeskParty(false);

const discoWalls = [ // plane the rays can hit: axis, position, normal facing into the room
  { ax: 'x', v: -3, n: new THREE.Vector3(1, 0, 0) }, { ax: 'x', v: 3, n: new THREE.Vector3(-1, 0, 0) },
  { ax: 'z', v: -1.35, n: new THREE.Vector3(0, 0, 1) }, { ax: 'z', v: 4.5, n: new THREE.Vector3(0, 0, -1) },
  { ax: 'y', v: 0, n: new THREE.Vector3(0, 1, 0) }, { ax: 'y', v: 4, n: new THREE.Vector3(0, -1, 0) },
];
const dDir = new THREE.Vector3(), dPos = new THREE.Vector3(), dQ = new THREE.Quaternion(), dM = new THREE.Matrix4(), dS = new THREE.Vector3(), dZ = new THREE.Vector3(0, 0, 1);
function updateDisco(t, dt) {
  disco.level += ((disco.on ? 1 : 0) - disco.level) * (1 - Math.exp(-dt * 4));
  updatePartyProps();
  const L = disco.level;
  const show = L > 0.01;
  disco.ball.visible = show;
  disco.spots.visible = show;
  disco.lights.forEach((l, i) => {
    const a = t * (0.9 + i * 0.35) + i * 2.1;
    l.position.set(Math.cos(a) * 1.4, 1.2 + 1.1 * (0.5 + 0.5 * Math.sin(t * 1.3 + i)), 1.2 + Math.sin(a) * 1.4);
    l.intensity = L * (1.6 + 0.8 * Math.sin(t * 6 + i * 2));
  });
  if (!show) return;
  disco.ballMesh.rotation.y = t * 0.8;
  disco.ballMat.emissiveIntensity = 0.5 + 0.35 * Math.sin(t * 9);
  disco.glow.material.opacity = L * (0.6 + 0.4 * Math.sin(t * 7));
  const o = disco.ball.position;
  for (let i = 0; i < disco.N; i++) {
    const r = disco.rays[i];
    const az = r.az + t * 0.55 * r.spin;
    const ce = Math.cos(r.el);
    dDir.set(Math.cos(az) * ce, Math.sin(r.el), Math.sin(az) * ce);
    let best = Infinity, wall = null;
    for (const w of discoWalls) {
      const d = dDir[w.ax];
      if (Math.abs(d) < 1e-5) continue;
      const tt = (w.v - o[w.ax]) / d;
      if (tt > 0.05 && tt < best) { best = tt; wall = w; }
    }
    if (!wall) { dM.makeScale(0, 0, 0); disco.spots.setMatrixAt(i, dM); continue; }
    dPos.copy(o).addScaledVector(dDir, best).addScaledVector(wall.n, 0.012);
    dQ.setFromUnitVectors(dZ, wall.n);
    const s = r.size * (0.7 + best * 0.28) * L * (0.8 + 0.2 * Math.sin(t * 8 + i));
    dS.set(s, s, s);
    dM.compose(dPos, dQ, dS);
    disco.spots.setMatrixAt(i, dM);
  }
  disco.spots.instanceMatrix.needsUpdate = true;
  if (disco.spots.instanceColor) disco.spots.instanceColor.needsUpdate = true;
}
os.onDisco = (on) => {
  disco.on = on; doorState.open = on;
  if (on) { // the party begins: put the Secret app away, step back from the desk and reset the view
    const sw = os.windows.find((w) => w.id === 'secret');
    if (sw) os.closeWindow(sw);
    leaveMonitor();
    resetOrbit();
  }
};

function frameLoop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  const pose = targetPose();
  const speed = mode === 'intro' ? 1.4 : 3.2;
  const f = 1 - Math.exp(-dt * speed);
  camera.position.lerp(pose.pos, f);
  lookNow.lerp(pose.look, f);
  if (mode !== 'focus') { refreshMovingSolids(); keepOutOfSolids(camera.position); } // never let the view pass through the desk, chair, shelf and other hard objects
  camera.lookAt(lookNow);
  if (mode === 'intro' && camera.position.distanceTo(pose.pos) < 0.05) setMode('overview');
  // monitor hover glow
  screenGlow.intensity = (mode === 'focus' ? 0.8 : 2.2) + Math.sin(t * 2.1) * 0.08 + (monitorHover && mode === 'overview' ? 1.0 : 0);
  led.material.color.setHex(Math.sin(t * 1.5) > -0.9 ? 0x55ff77 : 0x226633);
  const cdPlaying = !cdState.open && cdState.t < 0.05; // the drive activity LED flickers while the disc plays
  const act = cdPlaying ? 0.35 + 0.65 * Math.abs(Math.sin(t * 9) * Math.sin(t * 5.3)) : 1;
  ledO.material.color.setRGB(2.4 * act, 0.9 * act, 0.1 * act);
  if (os.update()) screenTex.needsUpdate = true;
  // steam + dust
  if (performance.now() / 1000 - puff.last > 0.7) puff.level = Math.max(0, puff.level - dt * 0.9); // no recent clicks: back toward normal
  const pb = puff.level;
  puff.time += dt * (0.14 + 0.05 * pb);
  steam.forEach((s) => {
    const p = (puff.time + s.userData.phase) % 1;
    const sway = Math.sin(t * 0.9 + s.userData.phase * 10 + p * 5) * 0.03 * p * (1 + 0.3 * pb);
    s.position.set(emberWorld.x + sway + p * 0.03, emberWorld.y + 0.012 + p * 0.5 * (1 + 0.22 * pb), emberWorld.z + Math.cos(t * 0.7 + s.userData.phase * 8) * 0.02 * p);
    s.scale.setScalar((0.018 + p * 0.13) * (1 + 0.4 * pb));
    s.material.opacity = Math.min(0.8, Math.sin(p * Math.PI) * 0.3 * (1 + 0.55 * pb));
    s.visible = partyDesk.present;
  });
  emberLight.intensity = (0.32 + 0.22 * pb + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 17.1) * 0.03) * (partyDesk.present ? 1 : 0);
  ember.material.color.setRGB(3.2 * (1 + 0.22 * pb), 0.9 * (1 + 0.22 * pb), 0.15);
  updateTree(t);
  updateScotch();
  updateBottle(dt);
  updateRubik(dt);
  updateDisco(t, dt);
  updateDoor(dt);
  updatePuzzle(dt);
  updateCat(t);
  updateGlobe(dt);
  updateSky(t, dt);
  cdState.t += ((cdState.open ? 1 : 0) - cdState.t) * (1 - Math.exp(-dt * 6));
  cdTray.position.z = (cdState.t - 1) * 0.16; // closed: tucked into the case, open: sticking out
  drawers.forEach((g) => { const d = g.userData.drawer; d.t += ((d.open ? 1 : 0) - d.t) * (1 - Math.exp(-dt * 8)); g.position.z = d.t * 0.3; });
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3 + 1] += dt * 0.012;
    dustPos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.012;
    if (dustPos[i * 3 + 1] > 2.0) dustPos[i * 3 + 1] = 0.9;
  }
  dustGeo.attributes.position.needsUpdate = true;
  bloom.strength = mode === 'focus' ? 0.1 : 0.32;
  composer.render();
  requestAnimationFrame(frameLoop);
}

// ---------- boot sequence then start ----------
const bootEl = document.getElementById('boot');
const bootLog = document.getElementById('bootlog');
const startBtn = document.getElementById('start');
const lines = BOOT.lines; // the loading-page text lives in boot.js so it is easy to edit
bootEl.style.color = BOOT.textColor;
startBtn.textContent = BOOT.startLabel;
bootEl.style.setProperty('--btn', BOOT.buttonColor); // keeps the white hover colour working
let li = 0;
(function typeNext() {
  if (li < lines.length) {
    bootLog.textContent += lines[li++] + '\n';
    setTimeout(typeNext, BOOT.lineDelayMs);
  } else {
    startBtn.style.display = 'inline-block';
    startBtn.focus();
  }
})();
let started = false;
function start() {
  if (started) return;
  started = true;
  loadCdMusic(); // fetch and unscramble the song in the background
  bootEl.style.opacity = '0';
  setTimeout(() => (bootEl.style.display = 'none'), 1000);
  setMode('intro');
  ui.hint.textContent = '';
  clock.start();
}
startBtn.addEventListener('click', start);
window.addEventListener('keydown', (e) => { if (!started && (e.key === 'Enter' || e.key === ' ')) start(); });
setMode('intro');
frameLoop();
