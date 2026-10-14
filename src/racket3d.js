// 3D-Tennisschläger des TC Grün-Weiss Heiligenwald, vollständig aus Code gebaut (keine Modelldatei, keine Texturdatei).
// Einheiten: Zentimeter. Der Schläger ist 68,5 cm lang, der Mittelpunkt liegt im Ursprung, die Längsachse ist Y,
// die Schlagfläche zeigt nach +Z.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const LENGTH = 68.5;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Ellipsenbogen als Kurve (für Rahmen, Zierstreifen und Seitenband) */
class Arc extends THREE.Curve {
  constructor(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2) { super(); Object.assign(this, { cx, cy, rx, ry, a0, a1 }); }
  getPoint(t, target = new THREE.Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t;
    return target.set(this.cx + this.rx * Math.cos(a), this.cy + this.ry * Math.sin(a), 0);
  }
}

function gripTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = '#6b6b6b'; g.lineWidth = 5;
  for (let i = -512; i < 640; i += 22) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i + 128); g.stroke(); }
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 2;
  for (let i = -512; i < 640; i += 22) { g.beginPath(); g.moveTo(0, i + 9); g.lineTo(128, i + 137); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function buildRacket() {
  const racket = new THREE.Group();
  const top = LENGTH / 2;

  // Maße nach dem Referenzbild: Kopf etwa 29 x 36 cm, Rahmen etwa 2 cm breit und 2,8 cm tief
  const rx = 14.4, ry = 17.9, cy = top - ry;
  const frameR = 1.12, depthScale = 1.35;

  const white = new THREE.MeshPhysicalMaterial({ color: 0xeeede6, roughness: 0.34, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const green = new THREE.MeshPhysicalMaterial({ color: 0x214e37, roughness: 0.5, clearcoat: 0.2 });
  const string = new THREE.MeshStandardMaterial({ color: 0xf3eee0, roughness: 0.42 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1d4832, roughness: 0.85, bumpMap: gripTexture(), bumpScale: 1.6 });

  const tube = (curve, seg, radius, rad, mat, zScale) => {
    const closed = curve instanceof Arc && curve.a1 - curve.a0 >= Math.PI * 2 - 1e-6;
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, rad, closed), mat);
    m.scale.z = zScale; return m;
  };

  // Rahmen (geschlossene Ellipse) und zwei Zierstreifen auf Vorder- und Rückseite
  racket.add(tube(new Arc(0, cy, rx, ry), 200, frameR, 28, white, depthScale));
  for (const s of [1, -1]) {
    const inlay = tube(new Arc(0, cy, rx, ry), 200, 0.27, 10, green, 1);
    inlay.position.z = s * 1.3;
    racket.add(inlay);
  }
  // Grünes Seitenband am äußeren Rahmen (wie auf den Dreiviertel-Bildern)
  racket.add(tube(new Arc(0, cy, rx + 0.82, ry + 0.82, -0.25, Math.PI + 0.25), 120, 0.5, 12, green, 2.1));

  // Herz (Throat): zwei Arme laufen vom unteren Kopf zusammen
  const a1 = (235 * Math.PI) / 180, a2 = (305 * Math.PI) / 180;
  const p1 = new THREE.Vector3(rx * Math.cos(a1), cy + ry * Math.sin(a1), 0);
  const p2 = new THREE.Vector3(rx * Math.cos(a2), cy + ry * Math.sin(a2), 0);
  const jy = -top + 20.2; // Verbindungspunkt oberhalb des Griffs
  for (const [p, sx] of [[p1, -1], [p2, 1]]) {
    const curve = new THREE.CatmullRomCurve3([
      p.clone(),
      new THREE.Vector3(sx * 6.9, p.y - 5.5, 0),
      new THREE.Vector3(sx * 3.6, (p.y + jy) / 2 - 2.5, 0),
      new THREE.Vector3(sx * 1.2, jy, 0)
    ]);
    racket.add(tube(curve, 80, 1.05, 20, white, depthScale));
  }

  // Schaft und Griff
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.6, 4.4, 28), white);
  shaft.scale.z = 1.3; shaft.position.y = jy - 1.4;
  racket.add(shaft);
  const gripTop = jy - 3.4, gripBottom = -top + 0.9;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.92, gripTop - gripBottom, 20, 1), gripMat);
  grip.position.y = (gripTop + gripBottom) / 2;
  grip.scale.z = 0.95;
  racket.add(grip);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.15, 1.5, 20), green);
  cap.position.y = -top + 0.75; cap.scale.z = 0.95;
  racket.add(cap);

  // Saiten: 16 Längs- und 19 Quersaiten als dünne Zylinder, an der Rahmeninnenkante abgeschnitten
  const rin = [rx - 1.08, ry - 1.08];
  const mains = 16, crosses = 19;
  const cyl = new THREE.CylinderGeometry(0.075, 0.075, 1, 6);
  const sm = new THREE.InstancedMesh(cyl, string, mains + crosses);
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

  // Grünliche Ösen an den Saitenenden (auf den Seitenbildern gut zu sehen)
  const gm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.27, 10, 8), green, ends.length);
  ends.forEach((e, i) => {
    dummy.position.set(e[0], e[1], 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1.5);
    dummy.updateMatrix(); gm.setMatrixAt(i, dummy.matrix);
  });
  racket.add(gm);

  return racket;
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

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const FOV = 20, D = 180;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 2000);

  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-35, 45, 55);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.8); fill.position.set(40, 8, 30);
  const rim = new THREE.DirectionalLight(0xe8f4e0, 0.9); rim.position.set(10, 30, -50);
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0xd9c3a3, 0.55));

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
    anchor.scale.setScalar(rhPx / (LENGTH * st.ppu));          // Schläger so hoch wie das Foto vorher
    st.ax = ((sr.left + sr.width / 2) - (hr.left + hr.width / 2)) / st.ppu;
    st.ay = -((sr.top + sr.height / 2) - (hr.top + hr.height / 2)) / st.ppu;
    render(performance.now());
  }

  function render(now) {
    const t = now / 1000;
    const k = 1 + 8 * Math.pow(st.flight, 3);                  // beschleunigtes Heranfliegen wie vorher
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
