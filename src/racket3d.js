// 3D-Tennisschläger des TC Grün-Weiss Heiligenwald, vollständig aus Code gebaut (keine Modelldatei, keine Texturdatei).
// Schwarzer Turnierschläger mit schmalem Ovalkopf (Proportionen eines 98-Zoll-Schlägers), schwarze Saiten, kein Logo.
// Einheiten: Zentimeter. Der Schläger ist 68,5 cm lang, der Mittelpunkt liegt im Ursprung, die Längsachse ist Y,
// die Schlagfläche zeigt nach +Z.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const LENGTH = 68.5;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Ellipsenbogen als Kurve (für den Rahmen) */
class Arc extends THREE.Curve {
  constructor(cx, cy, rx, ry) { super(); Object.assign(this, { cx, cy, rx, ry }); }
  getPoint(t, target = new THREE.Vector3()) {
    const a = Math.PI * 2 * t;
    return target.set(this.cx + this.rx * Math.cos(a), this.cy + this.ry * Math.sin(a), 0);
  }
}

/* Feine Diagonalwicklung des Griffbands, nur als Relief (bump) */
function gripTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = '#303030'; g.lineWidth = 5;
  for (let i = -512; i < 640; i += 24) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i + 128); g.stroke(); }
  g.strokeStyle = '#cfcfcf'; g.lineWidth = 2;
  for (let i = -512; i < 640; i += 24) { g.beginPath(); g.moveTo(0, i + 10); g.lineTo(128, i + 138); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function buildRacket() {
  const racket = new THREE.Group();
  const top = LENGTH / 2;

  // Maße nach einem 98-Zoll-Turnierschläger: Kopf außen etwa 26 x 34,4 cm, schmaler Rahmen, flacher Griff
  const rx = 12.25, ry = 16.55, cy = top - 17.2;
  const frameR = 0.86, depthScale = 1.7;

  const frame = new THREE.MeshPhysicalMaterial({ color: 0x1b1c20, roughness: 0.34, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.22 });
  const matte = new THREE.MeshPhysicalMaterial({ color: 0x17181b, roughness: 0.5, metalness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const stringMat = new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.4, metalness: 0.1 });
  const grommet = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.55 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.8, bumpMap: gripTexture(), bumpScale: 1.4 });

  const tube = (curve, seg, radius, rad, mat, zScale, closed = false) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, rad, closed), mat);
    m.scale.z = zScale; return m;
  };

  // Rahmen: geschlossene Ellipse
  racket.add(tube(new Arc(0, cy, rx, ry), 220, frameR, 28, frame, depthScale, true));

  // Herz (Throat): zwei fast gerade Arme laufen vom unteren Kopf zum Schaft zusammen
  const a1 = (240 * Math.PI) / 180, a2 = (300 * Math.PI) / 180;
  const p1 = new THREE.Vector3(rx * Math.cos(a1), cy + ry * Math.sin(a1), 0);
  const p2 = new THREE.Vector3(rx * Math.cos(a2), cy + ry * Math.sin(a2), 0);
  const jy = -top + 21.3; // Verbindungspunkt oberhalb des Griffs
  for (const [p, sx] of [[p1, -1], [p2, 1]]) {
    const curve = new THREE.CatmullRomCurve3([
      p.clone(),
      new THREE.Vector3(sx * 4.4, -3.0, 0),
      new THREE.Vector3(sx * 2.0, -9.4, 0),
      new THREE.Vector3(sx * 0.9, jy, 0)
    ]);
    racket.add(tube(curve, 80, 1.08, 20, matte, depthScale));
  }

  // Schaft, Griff (achteckig wie ein echtes Griffband) und Endkappe
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 3.0, 24), matte);
  shaft.scale.z = 0.85; shaft.position.y = jy - 1.1;
  racket.add(shaft);
  const gripTop = jy - 2.4, gripBottom = -top + 0.7;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 2.08, gripTop - gripBottom, 8, 1), gripMat);
  grip.rotation.y = Math.PI / 8;
  grip.position.y = (gripTop + gripBottom) / 2;
  grip.scale.z = 0.82;
  racket.add(grip);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 1.3, 8), matte);
  cap.rotation.y = Math.PI / 8;
  cap.position.y = -top + 0.65; cap.scale.z = 0.82;
  racket.add(cap);

  // Saiten: 16 Längs- und 19 Quersaiten als dünne Zylinder, an der Rahmeninnenkante abgeschnitten
  const rin = [rx - 0.8, ry - 0.8];
  const mains = 16, crosses = 19;
  const cyl = new THREE.CylinderGeometry(0.055, 0.055, 1, 6);
  const sm = new THREE.InstancedMesh(cyl, stringMat, mains + crosses);
  const dummy = new THREE.Object3D();
  const ends = [];
  let n = 0;
  for (let i = 0; i < mains; i++) {
    const x = (-0.88 + (1.76 * i) / (mains - 1)) * rin[0];
    const half = rin[1] * Math.sqrt(1 - (x / rin[0]) ** 2);
    dummy.position.set(x, cy, 0.09); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, half * 2, 1);
    dummy.updateMatrix(); sm.setMatrixAt(n++, dummy.matrix);
    ends.push([x, cy + half], [x, cy - half]);
  }
  for (let j = 0; j < crosses; j++) {
    const y = (-0.9 + (1.8 * j) / (crosses - 1)) * rin[1];
    const half = rin[0] * Math.sqrt(1 - (y / rin[1]) ** 2);
    dummy.position.set(0, cy + y, -0.09); dummy.rotation.set(0, 0, Math.PI / 2); dummy.scale.set(1, half * 2, 1);
    dummy.updateMatrix(); sm.setMatrixAt(n++, dummy.matrix);
    ends.push([half, cy + y], [-half, cy + y]);
  }
  racket.add(sm);

  // Schwarze Ösen an den Saitenenden
  const gm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 10, 8), grommet, ends.length);
  ends.forEach((e, i) => {
    dummy.position.set(e[0], e[1], 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1.6);
    dummy.updateMatrix(); gm.setMatrixAt(i, dummy.matrix);
  });
  racket.add(gm);

  return racket;
}

/* Gemeinsamer Aufbau: Renderer, Licht und Kamera */
const FOV = 20, D = 180;
function setup(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.95;

  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-35, 45, 55);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.9); fill.position.set(40, 8, 30);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(10, 30, -50);
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0xd9c3a3, 0.5));

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 2000);
  return { renderer, scene, camera };
}

/**
 * Setzt den Schläger in die Bühne (stage) des Heros. Die Zeichenfläche deckt den ganzen Hero ab,
 * damit der Schläger beim Heranfliegen nicht abgeschnitten wird.
 * Rückgabe: Steuerung (setAngle, setFlight) oder null, wenn WebGL fehlt.
 */
export function init(heroPin, stage, measureEl) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'r3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const base = setup(canvas);
  if (!base) return null;
  const { renderer, scene, camera } = base;
  stage.appendChild(canvas);

  // Hierarchie: Anker (Bildschirmposition) > Blick (Maus) > Neigung (16 Grad) > Drehung (um die Längsachse)
  const anchor = new THREE.Group();
  const look = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.rotation.z = (-16 * Math.PI) / 180;
  scene.add(anchor); anchor.add(look); look.add(tilt); tilt.add(spin); spin.add(buildRacket());

  const st = { w: 1, h: 1, ppu: 1, ax: 0, ay: 0, angle: 0, flight: 0, intro: reduce ? 1 : 0, floatPx: 14, visible: true };
  const mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };

  function resize() {
    const hr = heroPin.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = Math.max(1, Math.round(hr.width)); st.h = Math.max(1, Math.round(hr.height));
    renderer.setPixelRatio(dpr);
    renderer.setSize(st.w, st.h, false);
    canvas.style.width = st.w + 'px'; canvas.style.height = st.h + 'px';
    canvas.style.left = (hr.left - sr.left) + 'px'; canvas.style.top = (hr.top - sr.top) + 'px';
    camera.aspect = st.w / st.h; camera.updateProjectionMatrix();
    const visibleH = 2 * D * Math.tan((FOV * Math.PI) / 360);
    st.ppu = st.h / visibleH;                                  // Pixel pro Welteinheit auf der Schlägerebene
    const rhPx = (measureEl && measureEl.offsetHeight) || Math.min(window.innerHeight * 0.76, 760);
    anchor.scale.setScalar(rhPx / (LENGTH * st.ppu));          // Schläger so hoch wie vorgesehen
    st.ax = ((sr.left + sr.width / 2) - (hr.left + hr.width / 2)) / st.ppu;
    st.ay = -((sr.top + sr.height / 2) - (hr.top + hr.height / 2)) / st.ppu;
    render(performance.now());
  }

  function render(now) {
    const t = now / 1000;
    const k = 1 + 8 * Math.pow(st.flight, 3);                  // beschleunigtes Heranfliegen
    const camZ = D / k;
    const f = 1 - camZ / D;
    camera.position.set(st.ax * f, st.ay * f, camZ);
    const introE = 1 - Math.pow(1 - st.intro, 3);
    const calm = st.flight < 0.03;
    cur.x += ((calm ? mouse.x : 0) - cur.x) * 0.06;
    cur.y += ((calm ? mouse.y : 0) - cur.y) * 0.06;
    look.rotation.y = cur.x * 0.28; look.rotation.x = cur.y * 0.2;
    spin.rotation.y = (st.angle * Math.PI) / 180;
    const bob = Math.sin(t * (Math.PI * 2 / 7)) * st.floatPx / st.ppu;
    anchor.position.set(st.ax, st.ay + bob - (1 - introE) * 70 / st.ppu, 0);
    tilt.rotation.z = ((-16 + Math.sin(t * (Math.PI * 2 / 7)) * -1) * Math.PI) / 180;
    canvas.style.opacity = String(introE * (1 - smooth(0.72, 0.92, st.flight)));
    renderer.render(scene, camera);
  }

  let raf = 0, last = performance.now();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!st.visible) return;
    if (st.intro < 1) st.intro = Math.min(1, st.intro + (now - last) / 1300);
    last = now;
    render(now);
  }
  if (!reduce) {
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / (window.innerWidth || 1) - 0.5;
      mouse.y = e.clientY / (window.innerHeight || 1) - 0.5;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = 0; mouse.y = 0; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { st.visible = en[0].isIntersecting; }).observe(heroPin);
    }
    raf = requestAnimationFrame(loop);
  }

  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(heroPin);
  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);

  return {
    canvas,
    setAngle(a) { st.angle = a; if (reduce) render(performance.now()); },
    setFlight(t) { st.flight = t; if (reduce) render(performance.now()); },
    resize
  };
}

/**
 * Derselbe Schläger für den Block "Spiel bei uns": schräg gestellt, schwebt leicht und pendelt langsam hin und her.
 * Gerendert wird nur, solange der Block sichtbar ist.
 */
export function initCta(stage) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'r3d-canvas cta-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const base = setup(canvas);
  if (!base) return null;
  const { renderer, scene, camera } = base;
  stage.appendChild(canvas);

  const anchor = new THREE.Group();
  const look = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.rotation.z = (28 * Math.PI) / 180;
  scene.add(anchor); anchor.add(look); look.add(tilt); tilt.add(spin); spin.add(buildRacket());

  const st = { ppu: 1, visible: true, intro: reduce ? 1 : 0 };
  const mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };

  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.set(0, 0, D);
    st.ppu = h / (2 * D * Math.tan((FOV * Math.PI) / 360));
    anchor.scale.setScalar((h * 0.88) / (LENGTH * st.ppu));
    render(performance.now());
  }

  function render(now) {
    const t = now / 1000;
    const introE = 1 - Math.pow(1 - st.intro, 3);
    cur.x += (mouse.x - cur.x) * 0.06; cur.y += (mouse.y - cur.y) * 0.06;
    look.rotation.y = cur.x * 0.3; look.rotation.x = cur.y * 0.2;
    spin.rotation.y = reduce ? 0.25 : Math.sin(t * 0.55) * 0.5;
    anchor.position.y = (reduce ? 0 : Math.sin(t * (Math.PI * 2 / 7)) * 10 / st.ppu) - (1 - introE) * 40 / st.ppu;
    tilt.rotation.z = ((28 + (reduce ? 0 : Math.sin(t * (Math.PI * 2 / 7)))) * Math.PI) / 180;
    canvas.style.opacity = String(introE);
    renderer.render(scene, camera);
  }

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (!st.visible) return;
    if (st.intro < 1) st.intro = Math.min(1, st.intro + (now - last) / 1000);
    last = now;
    render(now);
  }
  if (!reduce) {
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / (window.innerWidth || 1) - 0.5;
      mouse.y = e.clientY / (window.innerHeight || 1) - 0.5;
    }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { st.visible = en[0].isIntersecting; if (st.visible) last = performance.now(); }).observe(stage);
    }
    requestAnimationFrame(loop);
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  return { canvas, resize };
}
