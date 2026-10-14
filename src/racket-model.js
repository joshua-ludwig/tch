// racket-model.js
// Schwarzer Turnierschläger (Vorlage: Wilson Blade 98 V9 „Noir“), komplett aus Code mit Three.js.
// Keine Modell- und keine Bilddateien, alle Texturen entstehen im Canvas.
//
// Vertrag:  export const LENGTH (Gesamtlänge in cm)
//           export function buildRacket() -> THREE.Group
// Einheiten: Zentimeter. Schlägermitte im Ursprung, Längsachse Y (Kopf +Y, Griff -Y),
// die Schlagfläche zeigt nach +Z. Szene, Kamera, Licht und Renderer kommen von außen.
import * as THREE from 'three';

export const LENGTH = 68.5;

/* ============================================================
   Kleine Helfer
   ============================================================ */
const TOP = LENGTH / 2;
const Y = (ab) => TOP - ab;                                   // „cm ab Kopfspitze“ -> Modell-Y
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);

/* Catmull-Rom-Spline durch Stützpunkte, gleichmäßig nach Bogenlänge abgetastet */
function spline(pts, n, closed = false) {
  return new THREE.CatmullRomCurve3(pts, closed, 'centripetal').getSpacedPoints(n);
}

/* Lokale Koordinatensysteme entlang einer Punktfolge:
   t = Tangente, n = in der XY-Ebene senkrecht dazu (links der Laufrichtung), b = t x n (etwa +Z) */
function frames(pts, closed = false) {
  const m = pts.length, out = [];
  for (let i = 0; i < m; i++) {
    const prev = pts[closed ? (i - 1 + m) % m : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % m : Math.min(m - 1, i + 1)];
    const t = next.clone().sub(prev).normalize();
    const n = V3(-t.y, t.x, 0).normalize();
    const b = t.clone().cross(n).normalize();
    out.push({ p: pts[i], t, n, b });
  }
  return out;
}

/* Bogenlänge bis zu jedem Punkt */
function arcLengths(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return s;
}

/* Konvexes Polygon (gegen den Uhrzeigersinn) mit gerundeten Ecken -> [[u, v], ...] */
function roundPoly(verts, r, seg) {
  const out = [], m = verts.length;
  for (let i = 0; i < m; i++) {
    const P = verts[(i - 1 + m) % m], V = verts[i], Q = verts[(i + 1) % m];
    const d1 = [P[0] - V[0], P[1] - V[1]], d2 = [Q[0] - V[0], Q[1] - V[1]];
    const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
    d1[0] /= l1; d1[1] /= l1; d2[0] /= l2; d2[1] /= l2;
    const A = Math.acos(clamp(d1[0] * d2[0] + d1[1] * d2[1], -1, 1));      // Innenwinkel
    const rr = Math.min(r, 0.49 * l1 * Math.tan(A / 2), 0.49 * l2 * Math.tan(A / 2));
    const t = rr / Math.tan(A / 2);                                          // Ecke -> Tangentenpunkt
    const bis = [d1[0] + d2[0], d1[1] + d2[1]], lb = Math.hypot(bis[0], bis[1]);
    const C = [V[0] + bis[0] / lb * rr / Math.sin(A / 2), V[1] + bis[1] / lb * rr / Math.sin(A / 2)];
    const T1 = [V[0] + d1[0] * t, V[1] + d1[1] * t], T2 = [V[0] + d2[0] * t, V[1] + d2[1] * t];
    const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
    let da = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1;
    while (da < 0) da += Math.PI * 2;
    for (let k = 0; k <= seg; k++) {
      const a = a1 + da * k / seg;
      out.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
    }
  }
  return out;
}

/* Abgerundetes Rechteck: Breite w entlang n, Tiefe d entlang b, Eckradius r. Naht liegt auf der -u-Seite. */
function roundedRect(w, d, r, seg = 5) {
  const hw = w / 2, hd = d / 2;
  return roundPoly([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]], Math.min(r, hw - 0.02, hd - 0.02), seg);
}

/* Regelmäßiges Vieleck (für Saiten) */
function polygon(r, k) {
  const out = [];
  for (let i = 0; i < k; i++) { const a = Math.PI + Math.PI * 2 * i / k; out.push([r * Math.cos(a), r * Math.sin(a)]); }
  return out;
}

/* Achteckiges Griffprofil: halbe Breite a (X), halbe Tiefe b (Z), Fasenlänge c, Kanten leicht gerundet.
   Zusätzlich bekommt jeder Punkt seine Winkelkoordinate (0..1) für die Griffband-Textur. */
function octagon(a, b, c, rEdge = 0.14, seg = 2) {
  const q = c / Math.SQRT2;
  const verts = [[-a, -(b - q)], [-(a - q), -b], [a - q, -b], [a, -(b - q)], [a, b - q], [a - q, b], [-(a - q), b], [-a, b - q]];
  return roundPoly(verts, rEdge, seg).map(([u, v]) => {
    let w = (Math.atan2(v, u) - Math.PI) / (Math.PI * 2);
    w = ((w % 1) + 1) % 1;
    return [u, v, w];
  });
}

/* Geometrie-Sammler: mehrere Sweeps landen in einer BufferGeometry */
class Builder {
  constructor() { this.pos = []; this.uv = []; this.idx = []; this.n = 0; this.seams = []; }

  /* Zieht ein geschlossenes Profil entlang der Rahmen frs. profAt(i) -> [[u, v, (texV)], ...].
     Der erste Profilpunkt wird am Ringende wiederholt (saubere Texturnaht), die Normalen werden später gemittelt. */
  sweep(frs, profAt, { uScale = 1, capStart = false, capEnd = false } = {}) {
    const m = frs.length, K = profAt(0).length, R = K + 1, base = this.n;
    let u = 0;
    for (let i = 0; i < m; i++) {
      const f = frs[i], prof = profAt(i);
      if (i > 0) u += f.p.distanceTo(frs[i - 1].p) * uScale;
      for (let j = 0; j <= K; j++) {
        const q = prof[j % K];
        this.pos.push(f.p.x + f.n.x * q[0] + f.b.x * q[1], f.p.y + f.n.y * q[0] + f.b.y * q[1], f.p.z + f.n.z * q[0] + f.b.z * q[1]);
        this.uv.push(u, q[2] !== undefined ? q[2] + (j === K ? 1 : 0) : j / K);
      }
      this.seams.push([base + i * R, base + i * R + K]);
    }
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < K; j++) {
      const a = base + i * R + j, b = a + 1, c = a + R, d = c + 1;
      this.idx.push(a, b, c, b, d, c);
    }
    this.n += m * R;
    if (capStart) this.cap(base, K, frs[0].p, true);
    if (capEnd) this.cap(base + (m - 1) * R, K, frs[m - 1].p, false);
    return this;
  }

  cap(ring, K, p, flip) {
    const c = this.n++;
    this.pos.push(p.x, p.y, p.z); this.uv.push(0, 0);
    for (let j = 0; j < K; j++) { const a = ring + j, b = a + 1; if (flip) this.idx.push(c, b, a); else this.idx.push(c, a, b); }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    const nr = g.attributes.normal.array;
    for (const [a, b] of this.seams) {                        // Normale an der Naht mitteln
      const x = nr[a * 3] + nr[b * 3], y = nr[a * 3 + 1] + nr[b * 3 + 1], z = nr[a * 3 + 2] + nr[b * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      nr[a * 3] = nr[b * 3] = x / l; nr[a * 3 + 1] = nr[b * 3 + 1] = y / l; nr[a * 3 + 2] = nr[b * 3 + 2] = z / l;
    }
    return g;
  }
}

/* Schnittpunkte eines Polygonzugs mit einer senkrechten (x = c) bzw. waagerechten (y = c) Linie */
function hits(poly, axis, c, closed) {
  const out = [], m = poly.length, segs = closed ? m : m - 1;
  for (let i = 0; i < segs; i++) {
    const p = poly[i], q = poly[(i + 1) % m];
    const pa = p[axis], qa = q[axis];
    if ((pa - c) * (qa - c) > 0 || pa === qa) continue;
    const t = (c - pa) / (qa - pa);
    out.push({ p: p.clone().lerp(q, t), i, t });
  }
  return out;
}

/* ============================================================
   Texturen (Canvas)
   ============================================================ */
function noiseCanvas(size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = clamp(Math.round(fn(x, y) * 255), 0, 255), i = (y * size + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

/* Feine Kohlefaser-Köperstruktur als Rauheitskarte (wird sehr oft gekachelt, bleibt dadurch dezent) */
function carbonTexture() {
  const tex = new THREE.CanvasTexture(noiseCanvas(128, (x, y) => {
    const twill = Math.sin((x + y) * Math.PI / 4) * 0.5;
    const weave = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) ? 0.04 : -0.04;
    return 0.5 + 0.045 * twill + weave + (hash(x, y) - 0.5) * 0.05;
  }));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.9, 3);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* Griffband: feines Lederkorn + Lochung im Dreiecksraster als Relief */
function gripBump() {
  const tex = new THREE.CanvasTexture(noiseCanvas(256, (x, y) => {
    const row = Math.floor(y / 64), gx = ((x + (row % 2) * 32) % 64) - 32, gy = (y % 64) - 32;
    const hole = Math.hypot(gx, gy) < 6 ? -0.4 : 0;
    const grain = 0.07 * Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) * Math.cos(y * 1.1 + Math.sin(x * 0.5) * 2)
      + 0.05 * (hash(Math.floor(x / 3), Math.floor(y / 3)) - 0.5);
    return 0.6 + grain + hole;
  }));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* Griffband-Farbe: dunkles Band mit Schattenkante entlang der Wicklung.
   Canvas-X = Weg entlang des Griffs (0..len), Canvas-Y = Umfang (0..1). */
function gripColor(len, pitch, phase) {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1b1c'; g.fillRect(0, 0, W, H);
  // sehr dezente Fleckigkeit (Gebrauchsspuren)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${44 + Math.random() * 24},${44 + Math.random() * 24},${48 + Math.random() * 24},0.035)`;
    g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 8 + Math.random() * 50, 0, Math.PI * 2); g.fill();
  }
  // Wickelkante: Linie texV = phase + (len - s)/pitch - k; Schattenband auf der Seite zum Griffende (+x)
  const slope = -H / (W / len) / pitch;                         // dy/dx
  for (let k = -2; k < len / pitch + 3; k++) {
    const y0 = H * (phase + len / pitch - k);                     // bei s = 0
    const band = (off, width, style) => {                         // off = Verschiebung entlang x (Pixel)
      g.strokeStyle = style; g.lineWidth = width;
      g.beginPath(); g.moveTo(0, y0 - slope * off); g.lineTo(W, y0 + slope * (W - off)); g.stroke();
    };
    band(9, 12, 'rgba(0,0,0,0.5)');
    band(4, 5, 'rgba(0,0,0,0.5)');
    band(-4, 4, 'rgba(255,255,255,0.12)');
  }
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;                                             // Canvas-Y entspricht direkt der V-Koordinate
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ============================================================
   Maße (aus den Produktfotos vermessen, Angaben in cm ab Kopfspitze)
   ============================================================ */
// Außenkontur der rechten Hälfte [ab Kopfspitze, halbe Außenbreite]: vom Schaft über die Herzstrebe
// tangential in den Kopf und bis zur Kopfspitze. Die Herzstreben sind also Teil desselben Rohrs wie der Kopf.
const OUTLINE = [
  [50.5, 1.45], [49.0, 1.48], [47.57, 1.55], [46.3, 1.73], [45.07, 2.0], [43.8, 2.35], [42.56, 2.7], [41.3, 3.1],
  [40.06, 3.55], [38.8, 4.05], [37.56, 4.6], [36.3, 5.2], [35.05, 5.9], [33.8, 6.55], [32.55, 7.3], [31.3, 8.15],
  [30.05, 9.0], [28.8, 9.8], [27.5, 10.5], [26.3, 11.05], [25.0, 11.55], [23.79, 12.0], [22.5, 12.37], [21.28, 12.65],
  [20.0, 12.87], [18.78, 13.05], [17.5, 13.12], [16.27, 13.17], [15.0, 13.12], [13.77, 13.05], [12.5, 12.85],
  [11.27, 12.6], [10.0, 12.3], [8.76, 12.1], [7.5, 11.6], [6.26, 10.95], [5.0, 10.15], [3.76, 9.15], [2.5, 7.75],
  [1.25, 5.7], [0.41, 3.3], [0, 0]
];
// Brücke (Yoke) zwischen den Streben, Mittellinie [x, ab Kopfspitze]; die Enden tauchen in die Streben ein
const YOKE = [[-7.7, 29.4], [-7.1, 30.9], [-6.3, 32.2], [-5, 33.2], [-3, 34.2], [-1.5, 34.5], [0, 34.6]];

/* Rahmenprofil je nach Lage: Kopfrahmen 1,15 x 2,2 cm, Herzstreben voluminöser (1,25 x 2,5 cm).
   Kurz vor dem Schaft werden die Streben breiter, sodass sie ineinanderlaufen (die Außenkante bleibt, s. OUTLINE). */
function tubeDims(ab) {
  const k = smooth(27, 34, ab), m = smooth(46.4, 48.2, ab);
  return { w: lerp(1.15, 1.25, k) + 0.3 * m, d: lerp(2.2, 2.5, k), r: lerp(0.42, 0.5, k) };
}

/* ============================================================
   Aufbau
   ============================================================ */
export function buildRacket() {
  const racket = new THREE.Group();

  /* ---------- Materialien ---------- */
  // Halbglänzendes Schwarz: dunkle Basis mit feiner Faserstruktur in der Rauheit, darüber ein weicher Klarlack
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0e, metalness: 0.06, roughness: 1.0, roughnessMap: carbonTexture(), specularIntensity: 0.55,
    clearcoat: 0.75, clearcoatRoughness: 0.38, anisotropy: 0.2, anisotropyRotation: Math.PI / 2, envMapIntensity: 0.55
  });
  const plasticMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.55, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.5 });
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.95, metalness: 0 });
  const stringMat = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.5, metalness: 0.1 });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x111113, roughness: 0.45, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.35 });

  const GRIP_TOP = 52.0, GRIP_BOT = 64.6, PITCH = 1.6, PHASE = 0.15;   // Griffband: Lage und Wickelsteigung
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: gripColor(GRIP_BOT - GRIP_TOP, PITCH, PHASE),
    bumpMap: gripBump(), bumpScale: 0.3, roughness: 0.9, metalness: 0.0
  });
  gripMat.bumpMap.repeat.set((GRIP_BOT - GRIP_TOP) / 1.6, 11 / 1.6);

  /* ---------- Hauptrohr: linke Strebe -> Kopf -> rechte Strebe ---------- */
  const ctrl = [];
  for (const [ab, x] of OUTLINE) ctrl.push(V3(-x, Y(ab)));
  for (let i = OUTLINE.length - 2; i >= 0; i--) ctrl.push(V3(OUTLINE[i][1], Y(OUTLINE[i][0])));
  const outer = spline(ctrl, 440);                                   // Außenkante
  const oFr = frames(outer);
  const center = outer.map((p, i) => p.clone().addScaledVector(oFr[i].n, -tubeDims(TOP - p.y).w / 2));
  const cFr = frames(center);
  const inner = center.map((p, i) => p.clone().addScaledVector(cFr[i].n, -tubeDims(TOP - p.y).w / 2));

  const frameB = new Builder();
  frameB.sweep(cFr, (i) => { const { w, d, r } = tubeDims(TOP - center[i].y); return roundedRect(w, d, r); });

  /* ---------- Brücke mit Übergangsradien in die Streben ---------- */
  const yokeCtrl = YOKE.map(([x, ab]) => V3(x, Y(ab)));
  for (let i = YOKE.length - 2; i >= 0; i--) yokeCtrl.push(V3(-YOKE[i][0], Y(YOKE[i][1])));
  const yoke = spline(yokeCtrl, 96);
  const yFr = frames(yoke);                                           // n zeigt ins Saitenbett
  const yS = arcLengths(yoke), yLen = yS[yS.length - 1];
  const yokeProf = roundedRect(1.2, 2.35, 0.45);
  frameB.sweep(yFr, (i) => {
    const k = smooth(0, 3.4, Math.min(yS[i], yLen - yS[i]));          // an den Enden zur Wand hin auslaufen
    const s = lerp(0.05, 1, k), sv = lerp(0.3, 1, k);
    return yokeProf.map(([u, v]) => [-0.6 + (u + 0.6) * s, v * sv]);
  });

  /* ---------- Schaft: steckt zunächst in den verschmolzenen Streben, wächst unter dem Abschlussband zum Griffmaß ---------- */
  const shaftPts = [];
  for (let k = 0; k <= 10; k++) shaftPts.push(V3(0, Y(lerp(49.3, 51.6, k / 10))));
  frameB.sweep(frames(shaftPts), (i) => {
    const ab = TOP - shaftPts[i].y, k = smooth(50.7, 51.6, ab);
    return roundedRect(lerp(2.85, 3.36, k), lerp(2.4, 2.85, k), 0.6);
  }, { capStart: true, capEnd: true });
  racket.add(new THREE.Mesh(frameB.build(), frameMat));

  // runder, leicht versenkter Boden der Herz-Öffnung (Kugel steckt bis auf die Kuppe in den Streben)
  const fillet = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), frameMat);
  fillet.position.set(0, Y(47.5), 0);
  racket.add(fillet);

  /* ---------- Saitenbett-Rand (Innenkante Kopf + Oberkante Brücke) ---------- */
  const bed = inner.filter((p) => TOP - p.y < 31.0);
  const yokeTop = yoke.map((p, i) => p.clone().addScaledVector(yFr[i].n, 0.6)).filter((p) => Math.abs(p.x) < 6.55);
  bed.push(...yokeTop.reverse());
  const bedFr = frames(bed, true);

  // Ösenleiste auf der Innenseite
  const stripB = new Builder();
  stripB.sweep(bedFr, () => roundedRect(0.16, 1.15, 0.06, 2).map(([u, v]) => [u + 0.0, v]));
  racket.add(new THREE.Mesh(stripB.build(), plasticMat));

  /* ---------- Saiten: 16 längs, 19 quer, echt verwebt ---------- */
  const MAINS = 16, CROSSES = 19, MS = 1.42, CS = 1.55, SR = 0.075, AMP = 0.085, EXT = 0.7;
  const xs = [], ys = [];
  for (let i = 0; i < MAINS; i++) xs.push((i - (MAINS - 1) / 2) * MS);
  for (let j = 0; j < CROSSES; j++) ys.push(16.6 + (j - (CROSSES - 1) / 2) * CS);
  const strB = new Builder();
  const strProf = polygon(SR, 6);
  const holes = [];                                                   // Saitenenden an der Innenkante

  // Saitenverlauf: Stützstellen [Position entlang, z], dazwischen weich (Kosinus) interpoliert
  function stringPath(fixed, axis, knots) {
    const pts = [];
    for (let k = 0; k < knots.length - 1; k++) {
      const [a0, z0] = knots[k], [a1, z1] = knots[k + 1], sub = k === 0 || k === knots.length - 2 ? 5 : 4;
      for (let s = 0; s < sub; s++) {
        const t = s / sub, z = lerp(z0, z1, (1 - Math.cos(Math.PI * t)) / 2), a = lerp(a0, a1, t);
        pts.push(axis === 'x' ? V3(fixed, a, z) : V3(a, fixed, z));
      }
    }
    const [aE, zE] = knots[knots.length - 1];
    pts.push(axis === 'x' ? V3(fixed, aE, zE) : V3(aE, fixed, zE));
    return pts;
  }

  for (let i = 0; i < MAINS; i++) {
    const h = hits(bed, 'x', xs[i], true).map((o) => o.p.y);
    const yb = Math.min(...h), yt = Math.max(...h);
    const knots = [[yb - EXT, 0]];
    for (let j = 0; j < CROSSES; j++) if (ys[j] > yb && ys[j] < yt) knots.push([ys[j], (i + j) % 2 === 0 ? AMP : -AMP]);
    knots.push([yt + EXT, 0]);
    strB.sweep(frames(stringPath(xs[i], 'x', knots)), () => strProf);
    holes.push({ p: V3(xs[i], yb), dir: V3(0, -1), kind: 'mainBottom', i }, { p: V3(xs[i], yt), dir: V3(0, 1), kind: 'mainTop', i });
  }
  for (let j = 0; j < CROSSES; j++) {
    const h = hits(bed, 'y', ys[j], true).map((o) => o.p.x);
    const xl = Math.min(...h), xr = Math.max(...h);
    const knots = [[xl - EXT, 0]];
    for (let i = 0; i < MAINS; i++) if (xs[i] > xl && xs[i] < xr) knots.push([xs[i], (i + j) % 2 === 0 ? -AMP : AMP]);
    knots.push([xr + EXT, 0]);
    strB.sweep(frames(stringPath(ys[j], 'y', knots)), () => strProf);
    holes.push({ p: V3(xl, ys[j]), dir: V3(-1, 0), kind: 'crossLeft', j }, { p: V3(xr, ys[j]), dir: V3(1, 0), kind: 'crossRight', j });
  }
  racket.add(new THREE.Mesh(strB.build(), stringMat));

  /* ---------- Ösen innen: kleine Hülsen an jedem Saitenende ---------- */
  const dummy = new THREE.Object3D();
  const up = V3(0, 1, 0), fwd = V3(0, 0, 1);
  const grommets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 10), plasticMat, holes.length);
  holes.forEach((h, k) => {
    dummy.position.copy(h.p).addScaledVector(h.dir, 0.05);
    dummy.quaternion.setFromUnitVectors(up, h.dir); dummy.updateMatrix();
    grommets.setMatrixAt(k, dummy.matrix);
  });
  racket.add(grommets);

  /* ---------- Ösen außen + Saitenschlaufen über die Außenkante ---------- */
  const yokeBottom = yoke.map((p, i) => p.clone().addScaledVector(yFr[i].n, -0.6));
  const outerHoles = [];                                              // {p, n, idx, poly}
  for (const h of holes) {
    let o = null;
    if (h.kind === 'mainTop') { const c = hits(outer, 'x', h.p.x, false); o = c.reduce((a, b) => (b.p.y > a.p.y ? b : a)); o.poly = 'outer'; }
    else if (h.kind === 'mainBottom' && Math.abs(h.p.x) < 6.5) { const c = hits(yokeBottom, 'x', h.p.x, false); if (c.length) { o = c[0]; o.poly = 'yoke'; } }
    else if (h.kind === 'mainBottom') { const c = hits(outer, 'x', h.p.x, false).filter((q) => q.p.y < 8); if (c.length) { o = c.reduce((a, b) => (b.p.y > a.p.y ? b : a)); o.poly = 'outer'; } }
    else if (h.j >= 4) { const c = hits(outer, 'y', h.p.y, false).filter((q) => (h.kind === 'crossLeft' ? q.p.x < 0 : q.p.x > 0)); if (c.length) { o = c.reduce((a, b) => (Math.abs(b.p.x) > Math.abs(a.p.x) ? b : a)); o.poly = 'outer'; } }
    if (!o) continue;
    const n = o.poly === 'outer' ? oFr[o.i].n.clone() : yFr[o.i].n.clone().negate();
    outerHoles.push({ p: o.p, n, idx: o.i, poly: o.poly, hole: h });
  }
  const eyeRing = new THREE.InstancedMesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), plasticMat, outerHoles.length);
  const eyeHole = new THREE.InstancedMesh(new THREE.CircleGeometry(0.11, 10), slotMat, outerHoles.length);
  outerHoles.forEach((o, k) => {
    dummy.quaternion.setFromUnitVectors(fwd, o.n);
    dummy.position.copy(o.p).addScaledVector(o.n, 0.03); dummy.updateMatrix(); eyeRing.setMatrixAt(k, dummy.matrix);
    dummy.position.copy(o.p).addScaledVector(o.n, 0.04); dummy.updateMatrix(); eyeHole.setMatrixAt(k, dummy.matrix);
  });
  racket.add(eyeRing, eyeHole);

  // Schlaufen: je zwei benachbarte Löcher sind außen durch die Saite verbunden
  const loopB = new Builder();
  const byKey = (kind, n) => outerHoles.find((o) => o.hole.kind === kind && (o.hole.i === n || o.hole.j === n));
  const pairs = [];
  for (let i = 0; i < MAINS; i += 2) pairs.push([byKey('mainTop', i), byKey('mainTop', i + 1)]);
  for (let i = 3; i < 12; i += 2) pairs.push([byKey('mainBottom', i), byKey('mainBottom', i + 1)]);
  pairs.push([byKey('mainBottom', 0), byKey('mainBottom', 1)], [byKey('mainBottom', 14), byKey('mainBottom', 15)]);
  for (let j = 4; j < CROSSES - 1; j += 2) pairs.push([byKey('crossLeft', j), byKey('crossLeft', j + 1)], [byKey('crossRight', j), byKey('crossRight', j + 1)]);
  for (const [a, b] of pairs) {
    if (!a || !b || a.poly !== b.poly) continue;
    const poly = a.poly === 'outer' ? outer : yokeBottom, pf = a.poly === 'outer' ? oFr : yFr, sign = a.poly === 'outer' ? 1 : -1;
    const i0 = Math.min(a.idx, b.idx) + 1, i1 = Math.max(a.idx, b.idx);
    const pts = [a.p.clone().addScaledVector(a.n, -0.4), a.p.clone().addScaledVector(a.n, 0.12)];
    const mid = [];
    for (let i = i0; i <= i1; i++) mid.push(poly[i].clone().addScaledVector(pf[i].n, 0.13 * sign));
    if (a.idx > b.idx) mid.reverse();
    pts.push(...mid, b.p.clone().addScaledVector(b.n, 0.12), b.p.clone().addScaledVector(b.n, -0.4));
    loopB.sweep(frames(spline(pts, Math.max(10, mid.length * 2 + 8))), () => strProf);
  }
  racket.add(new THREE.Mesh(loopB.build(), stringMat));

  /* ---------- Bumper (Schutzleiste) auf der Außenkante der Kopfspitze ---------- */
  const bumperIdx = [];
  center.forEach((p, i) => { if (TOP - p.y < 9.6) bumperIdx.push(i); });
  const bFr = bumperIdx.map((i) => cFr[i]);
  const bS = arcLengths(bFr.map((f) => f.p)), bLen = bS[bS.length - 1];
  const bumperB = new Builder();
  bumperB.sweep(bFr, (k) => {
    const { w } = tubeDims(TOP - bFr[k].p.y);
    const e = smooth(0, 1.8, Math.min(bS[k], bLen - bS[k]));          // Enden auslaufen lassen
    return roundedRect(0.22, 1.45, 0.08, 2).map(([u, v]) => [w / 2 - 0.05 + u * lerp(0.3, 1, e), v * lerp(0.6, 1, e)]);
  });
  racket.add(new THREE.Mesh(bumperB.build(), plasticMat));

  /* ---------- Ausschnitte in der Seitenwand (Saitenkanäle am Herzansatz) ---------- */
  const slotShape = new THREE.Shape();
  const sw = 1.25, sh = 0.42, sr = 0.18;
  slotShape.moveTo(-sw / 2 + sr, -sh / 2);
  slotShape.lineTo(sw / 2 - sr, -sh / 2); slotShape.absarc(sw / 2 - sr, -sh / 2 + sr, sr, -Math.PI / 2, 0, false);
  slotShape.lineTo(sw / 2, sh / 2 - sr); slotShape.absarc(sw / 2 - sr, sh / 2 - sr, sr, 0, Math.PI / 2, false);
  slotShape.lineTo(-sw / 2 + sr, sh / 2); slotShape.absarc(-sw / 2 + sr, sh / 2 - sr, sr, Math.PI / 2, Math.PI, false);
  slotShape.lineTo(-sw / 2, -sh / 2 + sr); slotShape.absarc(-sw / 2 + sr, -sh / 2 + sr, sr, Math.PI, Math.PI * 1.5, false);
  const slotGeo = new THREE.ShapeGeometry(slotShape, 6);
  const slotStrB = new Builder();
  const slots = [];
  for (let j = 0; j < 4; j++) for (const side of [-1, 1]) {
    const c = hits(center, 'y', ys[j], false).filter((q) => Math.sign(q.p.x) === side);
    if (!c.length) continue;
    const o = c.reduce((a, b) => (Math.abs(b.p.x) > Math.abs(a.p.x) ? b : a));
    const f = cFr[o.i], { d } = tubeDims(TOP - o.p.y);
    for (const z of [-1, 1]) {
      slots.push({ p: V3(o.p.x, o.p.y, z * (d / 2 + 0.006)), t: f.t, z });
      const a = o.p.clone().addScaledVector(f.t, -0.45), b = o.p.clone().addScaledVector(f.t, 0.45);
      a.z = b.z = z * (d / 2 + 0.012);
      slotStrB.sweep(frames([a, a.clone().lerp(b, 0.5), b]), () => polygon(SR * 0.9, 6));
    }
  }
  const slotMesh = new THREE.InstancedMesh(slotGeo, slotMat, slots.length);
  slots.forEach((s, k) => {
    dummy.position.copy(s.p);
    dummy.quaternion.setFromUnitVectors(fwd, V3(0, 0, s.z));
    const ang = Math.atan2(s.t.y, s.t.x);
    dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(fwd, s.z > 0 ? ang : -ang));
    dummy.updateMatrix(); slotMesh.setMatrixAt(k, dummy.matrix);
  });
  racket.add(slotMesh, new THREE.Mesh(slotStrB.build(), stringMat));

  /* ---------- Griff: Achtkant, leicht konisch, mit Griffband, Abschlussband und Endkappe ---------- */
  const gripA = (ab) => lerp(1.70, 1.78, (ab - 51) / 14);            // halbe Breite (X); Tiefe = 0,86 x Breite
  const gripOct = (ab, scale = 1, rEdge = 0.14) => { const a = gripA(ab) * scale; return octagon(a, a * 0.86, a * 0.75, rEdge); };

  const gripPts = [];
  for (let k = 0; k <= 16; k++) gripPts.push(V3(0, Y(lerp(51.0, 65.2, k / 16))));
  const gripB = new Builder();
  gripB.sweep(frames(gripPts), (i) => gripOct(TOP - gripPts[i].y), { uScale: 1 / (GRIP_BOT - GRIP_TOP) });
  const gripMesh = new THREE.Mesh(gripB.build(), gripMat);
  // Textur-U so verschieben, dass s = 0 am oberen Bandende (GRIP_TOP) liegt
  gripMat.map.offset.x = -(GRIP_TOP - 51.0) / (GRIP_BOT - GRIP_TOP);
  racket.add(gripMesh);

  // Wickelkante des Griffbands als echte Erhebung (Schraubenlinie um das Achtkant)
  const ridgeFr = [];
  const yB = Y(GRIP_BOT), yT = Y(GRIP_TOP);
  const turns = (yT - yB) / PITCH, N = Math.ceil(turns * 72);
  for (let k = 0; k <= N; k++) {
    const y = lerp(yB, yT, k / N), phi = Math.PI * 2 * (PHASE + (y - yB) / PITCH) + Math.PI;
    const a = gripA(TOP - y) + 0.02, b = a * 0.86, c = a * 0.75, q = c / Math.SQRT2;
    const co = Math.abs(Math.cos(phi)), si = Math.abs(Math.sin(phi));
    const r = Math.min(a / (co || 1e-9), b / (si || 1e-9), (a + b - q) / (co + si));
    ridgeFr.push({ p: V3(r * Math.cos(phi), y, r * Math.sin(phi)), n: V3(Math.cos(phi), 0, Math.sin(phi)) });
  }
  for (let k = 0; k <= N; k++) {
    const f = ridgeFr[k];
    f.t = ridgeFr[Math.min(N, k + 1)].p.clone().sub(ridgeFr[Math.max(0, k - 1)].p).normalize();
    f.b = f.t.clone().cross(f.n).normalize();
  }
  // Profil der Tape-Stufe (u = nach außen, v = Richtung Kopf): scharfe Kante unten, Überlappung oben weich auslaufend
  const ridgeProf = [[-0.05, -0.05], [0.04, -0.03], [0.08, 0.0], [0.08, 0.35], [0.055, 0.5], [0.0, 0.64], [-0.05, 0.7]];
  const ridgeB = new Builder();
  ridgeB.sweep(ridgeFr, (k) => {
    const e = smooth(0, 0.8, Math.min(k, N - k) * (yT - yB) / N);   // Bandenden auslaufen lassen
    return ridgeProf.map(([u, v]) => [u * e, v]);
  });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1d, roughness: 0.9, metalness: 0, bumpMap: gripMat.bumpMap, bumpScale: 0.3 });
  racket.add(new THREE.Mesh(ridgeB.build(), tapeMat));

  // Abschlussband am oberen Griffende
  const collarPts = [V3(0, Y(50.9)), V3(0, Y(51.2)), V3(0, Y(51.9)), V3(0, Y(52.25))];
  const collarB = new Builder();
  collarB.sweep(frames(collarPts), (i) => gripOct(51.4, i === 0 || i === 3 ? 1.0 : 1.035, 0.12), { capStart: true, capEnd: true });
  racket.add(new THREE.Mesh(collarB.build(), plasticMat));

  // Endkappe: aus dem Griff heraus leicht ausgestellt, unten flach mit gerundeter Kante
  const capProfile = [[64.3, 1.0], [65.0, 1.02], [66.35, 1.07], [67.2, 1.18], [67.7, 1.255], [68.1, 1.255], [68.35, 1.2], [68.46, 1.05], [68.5, 0.72], [68.5, 0.3]];
  const capPts = capProfile.map(([ab]) => V3(0, Y(ab)));
  const capB = new Builder();
  capB.sweep(frames(capPts), (i) => gripOct(65, capProfile[i][1], 0.2), { capEnd: true });
  racket.add(new THREE.Mesh(capB.build(), capMat));

  return racket;
}
