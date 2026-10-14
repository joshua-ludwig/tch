// Schwarzer Turnierschläger als Code-Modell (Three.js). Diese Datei ist austauschbar:
// Vertrag: export const LENGTH (Gesamtlänge in cm) und export function buildRacket() -> THREE.Group.
// Einheiten cm, Schlägermitte im Ursprung, Längsachse Y (Kopf oben, +Y), Schlagfläche zeigt nach +Z.
import * as THREE from 'three';

export const LENGTH = 68.5;

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

export function buildRacket() {
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

