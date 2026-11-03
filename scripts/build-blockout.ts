/**
 * `pnpm blockout` — generates public/3d/room.glb, the Phase 1 blockout.
 *
 * Simple shapes, but every node already carries its final contract name
 * (src/lib/scene-contract.ts), so the Blender art pass replaces this file and nothing else.
 * Units: meters, +y up. The room is a cutaway: floor + back wall (z−) + left wall (x−);
 * the camera looks in from the open front-right corner.
 *
 * UVs follow glTF convention (v = 0 at the top). Runtime textures use flipY = false.
 */
import fs from "node:fs";
import path from "node:path";
import { Document, type Material, type Mesh, type Node, NodeIO } from "@gltf-transform/core";
import { nodeName as N } from "../src/lib/scene-contract";

type V3 = [number, number, number];
interface Geom {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

// ---------------------------------------------------------------- geometry

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

type Face = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
const FACES: Record<Face, { n: V3; right: V3; up: V3 }> = {
  "+x": { n: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  "-x": { n: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  "+y": { n: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  "-y": { n: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  "+z": { n: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  "-z": { n: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
};

const half = (axis: V3, size: V3) => Math.abs(axis[0]) * size[0] * 0.5 + Math.abs(axis[1]) * size[1] * 0.5 + Math.abs(axis[2]) * size[2] * 0.5;

/** Box centered at the origin. `uvFace`: only that face gets the full 0..1 UV square (content slots);
 *  every other face collapses to the top-left corner (painted with the cover color at runtime). */
function box(size: V3, uvFace?: Face): Geom {
  const g: Geom = { positions: [], normals: [], uvs: [], indices: [] };
  for (const [face, { n, right, up }] of Object.entries(FACES) as [Face, (typeof FACES)[Face]][]) {
    const c = scale(n, half(n, size));
    const hw = half(right, size);
    const hh = half(up, size);
    const corners: V3[] = [
      add(add(c, scale(right, -hw)), scale(up, hh)), // TL
      add(add(c, scale(right, hw)), scale(up, hh)), // TR
      add(add(c, scale(right, hw)), scale(up, -hh)), // BR
      add(add(c, scale(right, -hw)), scale(up, -hh)), // BL
    ];
    const full = !uvFace || uvFace === face;
    const uv = full ? [0, 0, 1, 0, 1, 1, 0, 1] : [0.004, 0.004, 0.004, 0.004, 0.004, 0.004, 0.004, 0.004];
    const base = g.positions.length / 3;
    corners.forEach((p) => g.positions.push(...p));
    for (let i = 0; i < 4; i++) g.normals.push(...n);
    g.uvs.push(...uv);
    g.indices.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
  return g;
}

/** Plane facing +z, centered. */
function plane(w: number, h: number): Geom {
  return {
    positions: [-w / 2, h / 2, 0, w / 2, h / 2, 0, w / 2, -h / 2, 0, -w / 2, -h / 2, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 3, 2, 0, 2, 1],
  };
}

/** Cylinder along y, centered. */
function cylinder(rTop: number, rBottom: number, h: number, seg = 24, capped = true): Geom {
  const g: Geom = { positions: [], normals: [], uvs: [], indices: [] };
  const slope = (rBottom - rTop) / h;
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    const sx = Math.sin(t);
    const cz = Math.cos(t);
    const len = Math.hypot(sx, slope, cz);
    g.positions.push(rTop * sx, h / 2, rTop * cz, rBottom * sx, -h / 2, rBottom * cz);
    g.normals.push(sx / len, slope / len, cz / len, sx / len, slope / len, cz / len);
    g.uvs.push(i / seg, 0, i / seg, 1);
  }
  for (let i = 0; i < seg; i++) {
    const t0 = i * 2;
    const b0 = t0 + 1;
    const t1 = t0 + 2;
    const b1 = t0 + 3;
    g.indices.push(t0, b0, b1, t0, b1, t1);
  }
  if (capped) {
    for (const top of [true, false]) {
      const y = top ? h / 2 : -h / 2;
      const r = top ? rTop : rBottom;
      if (r <= 0) continue;
      const center = g.positions.length / 3;
      g.positions.push(0, y, 0);
      g.normals.push(0, top ? 1 : -1, 0);
      g.uvs.push(0.5, 0.5);
      for (let i = 0; i <= seg; i++) {
        const t = (i / seg) * Math.PI * 2;
        g.positions.push(r * Math.sin(t), y, r * Math.cos(t));
        g.normals.push(0, top ? 1 : -1, 0);
        g.uvs.push(0.5 + Math.sin(t) / 2, 0.5 + Math.cos(t) / 2);
      }
      for (let i = 0; i < seg; i++) {
        const a = center + 1 + i;
        const b = a + 1;
        if (top) g.indices.push(center, a, b);
        else g.indices.push(center, b, a);
      }
    }
  }
  return g;
}

function sphere(r: number, ws = 32, hs = 20): Geom {
  const g: Geom = { positions: [], normals: [], uvs: [], indices: [] };
  const grid: number[][] = [];
  let index = 0;
  for (let iy = 0; iy <= hs; iy++) {
    const row: number[] = [];
    const v = iy / hs;
    for (let ix = 0; ix <= ws; ix++) {
      const u = ix / ws;
      const x = -Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI);
      const y = Math.cos(v * Math.PI);
      const z = Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI);
      g.positions.push(x * r, y * r, z * r);
      g.normals.push(x, y, z);
      g.uvs.push(u, v);
      row.push(index++);
    }
    grid.push(row);
  }
  for (let iy = 0; iy < hs; iy++) {
    for (let ix = 0; ix < ws; ix++) {
      const a = grid[iy]![ix + 1]!;
      const b = grid[iy]![ix]!;
      const c = grid[iy + 1]![ix]!;
      const d = grid[iy + 1]![ix + 1]!;
      if (iy !== 0) g.indices.push(a, b, d);
      if (iy !== hs - 1) g.indices.push(b, c, d);
    }
  }
  return g;
}

/** Torus in the XY plane (like three's TorusGeometry). Rotate x 90° for a horizontal ring. */
function torus(R: number, r: number, radial = 10, tubular = 40): Geom {
  const g: Geom = { positions: [], normals: [], uvs: [], indices: [] };
  for (let j = 0; j <= radial; j++) {
    for (let i = 0; i <= tubular; i++) {
      const u = (i / tubular) * Math.PI * 2;
      const v = (j / radial) * Math.PI * 2;
      const cx = R * Math.cos(u);
      const cy = R * Math.sin(u);
      const x = (R + r * Math.cos(v)) * Math.cos(u);
      const y = (R + r * Math.cos(v)) * Math.sin(u);
      const z = r * Math.sin(v);
      const len = Math.hypot(x - cx, y - cy, z);
      g.positions.push(x, y, z);
      g.normals.push((x - cx) / len, (y - cy) / len, z / len);
      g.uvs.push(i / tubular, j / radial);
    }
  }
  for (let j = 1; j <= radial; j++) {
    for (let i = 1; i <= tubular; i++) {
      const a = (tubular + 1) * j + i - 1;
      const b = (tubular + 1) * (j - 1) + i - 1;
      const c = (tubular + 1) * (j - 1) + i;
      const d = (tubular + 1) * j + i;
      g.indices.push(a, b, d, b, c, d);
    }
  }
  return g;
}

// ---------------------------------------------------------------- document

const doc = new Document();
doc.createBuffer();
const buffer = doc.getRoot().listBuffers()[0]!;
const scene = doc.createScene("room");
doc.getRoot().setDefaultScene(scene);

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const materials = new Map<string, Material>();
function mat(name: string, hex: string, roughness = 0.85, metallic = 0): Material {
  const key = `${name}|${hex}|${roughness}|${metallic}`;
  const existing = materials.get(key);
  if (existing) return existing;
  const n = Number.parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => srgbToLinear(c / 255));
  const m = doc
    .createMaterial(`mat__${name}`)
    .setBaseColorFactor([rgb[0]!, rgb[1]!, rgb[2]!, 1])
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metallic);
  materials.set(key, m);
  return m;
}

function meshOf(name: string, g: Geom, material: Material): Mesh {
  const accessor = (array: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>, type: "VEC3" | "VEC2" | "SCALAR") =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const uv = accessor(new Float32Array(g.uvs), "VEC2");
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", accessor(new Float32Array(g.positions), "VEC3"))
    .setAttribute("NORMAL", accessor(new Float32Array(g.normals), "VEC3"))
    .setAttribute("TEXCOORD_0", uv)
    // Placeholder lightmap channel so the contract (UV1 = lightmap) holds from day one.
    .setAttribute("TEXCOORD_1", uv)
    .setIndices(accessor(g.positions.length / 3 > 65535 ? new Uint32Array(g.indices) : new Uint16Array(g.indices), "SCALAR"))
    .setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}

const DEG = Math.PI / 180;
function quat([x, y, z]: V3): [number, number, number, number] {
  const c1 = Math.cos((x * DEG) / 2);
  const c2 = Math.cos((y * DEG) / 2);
  const c3 = Math.cos((z * DEG) / 2);
  const s1 = Math.sin((x * DEG) / 2);
  const s2 = Math.sin((y * DEG) / 2);
  const s3 = Math.sin((z * DEG) / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

interface NodeOpts {
  t?: V3;
  r?: V3;
  s?: V3;
  extras?: Record<string, unknown>;
  children?: Node[];
}

function node(name: string, opts: NodeOpts = {}, mesh?: Mesh): Node {
  const n = doc.createNode(name);
  if (mesh) n.setMesh(mesh);
  if (opts.t) n.setTranslation(opts.t);
  if (opts.r) n.setRotation(quat(opts.r));
  if (opts.s) n.setScale(opts.s);
  if (opts.extras) n.setExtras(opts.extras);
  for (const child of opts.children ?? []) n.addChild(child);
  return n;
}

/** A mesh node: geometry + material + transform. */
const m = (name: string, g: Geom, material: Material, opts: NodeOpts = {}) => node(name, opts, meshOf(name, g, material));
const hitMat = () => mat("hit", "#ff00ff");
const hit = (id: Parameters<typeof N.hit>[0], size: V3, t: V3) => m(N.hit(id), box(size), hitMat(), { t });
const empty = (name: string, t: V3) => node(name, { t });

// ---------------------------------------------------------------- palette (art direction draft)

const C = {
  plaster: "#EFE6D6",
  plasterShade: "#E4D8C3",
  oak: "#B98A5E",
  walnut: "#6B4A33",
  walnutDark: "#4A3324",
  sage: "#8FA382",
  sageDark: "#5E7B65",
  terracotta: "#C0643F",
  navy: "#233A5E",
  cream: "#F5F1EA",
  paper: "#F7F3EA",
  mustard: "#D9B26A",
  gold: "#D4A93A",
  brass: "#C9A24B",
  ink: "#1E1B16",
  ocean: "#3D6E8F",
  leaf: "#5E8A4E",
  leafDark: "#466E3B",
  orange: "#E2662B",
  red: "#C8462F",
  bulb: "#FFE9B0",
  steel: "#9AA3A8",
};

// ---------------------------------------------------------------- room shell

const shell = [
  m(N.decor("floor"), box([4.5, 0.1, 4.5]), mat("floor", C.oak, 0.7), { t: [0, -0.05, 0] }),
  m(N.decor("wall_back"), box([4.62, 3.0, 0.12]), mat("wall", C.plaster, 0.95), { t: [-0.06, 1.5, -2.31] }),
  m(N.decor("wall_left"), box([0.12, 3.0, 4.5]), mat("wall", C.plaster, 0.95), { t: [-2.31, 1.5, 0] }),
  m(N.decor("baseboard", 1), box([4.5, 0.1, 0.02]), mat("trim", C.cream, 0.6), { t: [0, 0.05, -2.24] }),
  m(N.decor("baseboard", 2), box([0.02, 0.1, 4.5]), mat("trim", C.cream, 0.6), { t: [-2.24, 0.05, 0] }),
  m(N.decor("rug"), box([2.6, 0.012, 1.7]), mat("rug", C.sage, 1), { t: [0.15, 0.006, -0.35] }),
  m(N.decor("rug", 2), box([2.3, 0.014, 1.4]), mat("rug_inner", C.cream, 1), { t: [0.15, 0.007, -0.35] }),
  m(N.decor("rug", 3), box([2.1, 0.016, 1.2]), mat("rug", C.sage, 1), { t: [0.15, 0.008, -0.35] }),
];

// desk + chair
const desk = [
  m(N.decor("desk", 1), box([1.7, 0.05, 0.72]), mat("desk", C.walnut, 0.6), { t: [0.55, 0.745, -1.86] }),
  ...[
    [-0.8, -0.31],
    [0.8, -0.31],
    [-0.8, 0.31],
    [0.8, 0.31],
  ].map(([dx, dz], i) => m(N.decor("desk_leg", i + 1), box([0.05, 0.72, 0.05]), mat("desk", C.walnut, 0.6), { t: [0.55 + dx!, 0.36, -1.86 + dz!] })),
  m(N.decor("desk_drawer"), box([0.4, 0.4, 0.62]), mat("desk_drawer", C.walnutDark, 0.6), { t: [1.05, 0.52, -1.86] }),
  m(N.decor("desk_drawer", 2), box([0.12, 0.02, 0.02]), mat("brass", C.brass, 0.35, 0.8), { t: [1.05, 0.55, -1.54] }),
  m(N.decor("chair", 1), box([0.46, 0.06, 0.46]), mat("chair", C.terracotta, 0.8), { t: [0.45, 0.47, -1.22] }),
  m(N.decor("chair", 2), box([0.46, 0.48, 0.05]), mat("chair", C.terracotta, 0.8), { t: [0.45, 0.76, -0.99], r: [-6, 0, 0] }),
  ...[
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ].map(([dx, dz], i) => m(N.decor("chair_leg", i + 1), cylinder(0.018, 0.018, 0.44, 12), mat("desk", C.walnut, 0.6), { t: [0.45 + dx!, 0.22, -1.22 + dz!] })),
];

// lamp (night glow source R) + desk clutter
const lamp = [
  m(N.decor("lamp", 1), cylinder(0.08, 0.09, 0.025), mat("lamp", C.navy, 0.5, 0.3), { t: [1.32, 0.7825, -2.05] }),
  m(N.decor("lamp", 2), cylinder(0.012, 0.012, 0.42, 10), mat("lamp", C.navy, 0.5, 0.3), { t: [1.32, 0.99, -2.02], r: [12, 0, 0] }),
  m(N.decor("lamp", 3), cylinder(0.05, 0.12, 0.14, 24, false), mat("lamp_shade", C.mustard, 0.7), { t: [1.32, 1.2, -1.94], r: [28, 0, 0], extras: { glow: "lamp" } }),
  m(N.decor("lamp", 4), sphere(0.03, 12, 8), mat("bulb", C.bulb, 0.3), { t: [1.32, 1.17, -1.93], extras: { glow: "lamp" } }),
  m(N.decor("mug"), cylinder(0.04, 0.036, 0.09), mat("mug", C.cream, 0.4), { t: [0.95, 0.815, -1.62] }),
  m(N.decor("notebook"), box([0.18, 0.02, 0.24]), mat("notebook", C.red, 0.8), { t: [-0.08, 0.78, -2.02], r: [0, 8, 0] }),
  m(N.decor("pen"), cylinder(0.006, 0.006, 0.14, 8), mat("ink", C.ink, 0.5), { t: [-0.03, 0.8, -2.0], r: [0, 0, 90] }),
];

// "now" ticker on the desk (LED display)
const ticker = [
  m(N.decor("ticker"), box([0.34, 0.08, 0.06]), mat("ticker", C.ink, 0.4), { t: [-0.1, 0.81, -1.66] }),
  m(N.display("now"), plane(0.31, 0.05), mat("display", C.ink, 0.4), { t: [-0.1, 0.81, -1.629] }),
];

// ---------------------------------------------------------------- objects

const computer = node(N.obj("computer"), {
  t: [0.5, 0.77, -1.98],
  children: [
    m(N.part("computer", 1), box([0.62, 0.48, 0.16]), mat("monitor", "#E8E1D3", 0.55), { t: [0, 0.4, 0] }),
    m(N.screen("computer"), plane(0.52, 0.39), mat("screen", C.ink, 0.3), { t: [0, 0.405, 0.0815] }),
    m(N.part("computer", 2), box([0.08, 0.14, 0.06]), mat("monitor", "#E8E1D3", 0.55), { t: [0, 0.1, -0.02] }),
    m(N.part("computer", 3), box([0.26, 0.02, 0.18]), mat("monitor", "#E8E1D3", 0.55), { t: [0, 0.01, -0.01] }),
    m(N.part("computer", 4), box([0.44, 0.025, 0.15]), mat("keyboard", "#D9D1C2", 0.6), { t: [0, 0.0125, 0.36] }),
    m(N.part("computer", 5), box([0.06, 0.025, 0.1]), mat("keyboard", "#D9D1C2", 0.6), { t: [0.32, 0.0125, 0.38] }),
    hit("computer", [0.72, 0.68, 0.62], [0, 0.33, 0.15]),
    empty(N.label("computer"), [0, 0.76, 0]),
  ],
});

const phone = node(N.obj("phone"), {
  t: [1.02, 0.77, -1.74],
  children: [
    m(N.part("phone", 1), box([0.1, 0.015, 0.09]), mat("phone_stand", C.walnutDark, 0.6), { t: [0, 0.0075, 0] }),
    m(N.part("phone", 2), box([0.085, 0.17, 0.012]), mat("phone", C.ink, 0.35), {
      t: [0, 0.1, -0.012],
      r: [-16, 0, 0],
      children: [m(N.screen("phone"), plane(0.075, 0.155), mat("screen", C.ink, 0.3), { t: [0, 0, 0.0065] })],
    }),
    hit("phone", [0.18, 0.26, 0.16], [0, 0.12, 0]),
    empty(N.label("phone"), [0, 0.3, 0]),
  ],
});

const globe = node(N.obj("globe"), {
  t: [0.02, 0.77, -1.86],
  children: [
    m(N.part("globe", 1), cylinder(0.07, 0.08, 0.025), mat("globe_stand", C.walnutDark, 0.5), { t: [0, 0.0125, 0] }),
    m(N.part("globe", 2), cylinder(0.008, 0.008, 0.09, 10), mat("brass", C.brass, 0.35, 0.8), { t: [0, 0.07, 0] }),
    m(N.part("globe", 3), torus(0.148, 0.006, 8, 48), mat("brass", C.brass, 0.35, 0.8), { t: [0, 0.24, 0], r: [0, 90, 23] }),
    node(N.pivot("globe"), {
      t: [0, 0.24, 0],
      children: [m(N.part("globe", 4), sphere(0.13, 48, 32), mat("ocean", C.ocean, 0.45), {})],
    }),
    hit("globe", [0.34, 0.42, 0.34], [0, 0.21, 0]),
    empty(N.label("globe"), [0, 0.47, 0]),
  ],
});

const windowObj = node(N.obj("window"), {
  t: [0.5, 1.85, -2.25],
  children: [
    m(N.display("window"), plane(1.1, 0.82), mat("display", C.ink, 0.4), { t: [0, 0, 0.005] }),
    m(N.part("window", 1), box([1.22, 0.06, 0.08]), mat("window_frame", C.cream, 0.6), { t: [0, 0.44, 0.04] }),
    m(N.part("window", 2), box([1.32, 0.05, 0.16]), mat("window_frame", C.cream, 0.6), { t: [0, -0.435, 0.08] }),
    m(N.part("window", 3), box([0.06, 0.82, 0.08]), mat("window_frame", C.cream, 0.6), { t: [-0.58, 0, 0.04] }),
    m(N.part("window", 4), box([0.06, 0.82, 0.08]), mat("window_frame", C.cream, 0.6), { t: [0.58, 0, 0.04] }),
    m(N.part("window", 5), box([0.03, 0.82, 0.03]), mat("window_frame", C.cream, 0.6), { t: [0, 0, 0.02] }),
    m(N.part("window", 6), box([1.1, 0.03, 0.03]), mat("window_frame", C.cream, 0.6), { t: [0, 0.06, 0.02] }),
    hit("window", [1.28, 0.96, 0.12], [0, 0, 0.06]),
    empty(N.label("window"), [0, 0.56, 0.12]),
  ],
});

const curtains = [
  m(N.decor("curtain_rod"), cylinder(0.012, 0.012, 1.8, 10), mat("brass", C.brass, 0.35, 0.8), { t: [0.5, 2.38, -2.17], r: [0, 0, 90] }),
  m(N.decor("curtain", 1), box([0.3, 1.3, 0.05]), mat("curtain", C.mustard, 1), { t: [-0.22, 1.72, -2.16], r: [0, 0, 0.6] }),
  m(N.decor("curtain", 2), box([0.3, 1.3, 0.05]), mat("curtain", C.mustard, 1), { t: [1.22, 1.72, -2.16], r: [0, 0, -0.6] }),
];

const letter = node(N.obj("letter"), {
  t: [-0.78, 1.68, -2.25],
  r: [0, 0, -3.5],
  children: [
    m(N.part("letter", 1), box([0.46, 0.6, 0.035]), mat("frame", C.walnutDark, 0.5), { t: [0, 0, 0.0175] }),
    m(N.part("letter", 2), box([0.4, 0.54, 0.006]), mat("passepartout", C.paper, 0.9), { t: [0, 0, 0.037] }),
    m(N.display("letter"), plane(0.31, 0.42), mat("letter_paper", C.paper, 0.9), { t: [0, 0, 0.0405] }),
    hit("letter", [0.52, 0.66, 0.08], [0, 0, 0.04]),
    empty(N.label("letter"), [0, 0.42, 0.06]),
  ],
});

const hoop = node(N.obj("hoop"), {
  children: [
    m(N.part("hoop", 1), box([0.62, 0.42, 0.03]), mat("backboard", C.cream, 0.5), { t: [-1.55, 2.32, -2.235] }),
    m(N.part("hoop", 2), box([0.24, 0.18, 0.006]), mat("hoop_red", C.red, 0.6), { t: [-1.55, 2.25, -2.218] }),
    m(N.part("hoop", 3), box([0.04, 0.04, 0.14]), mat("steel", C.steel, 0.4, 0.7), { t: [-1.55, 2.14, -2.16] }),
    m(N.part("hoop", 4), torus(0.11, 0.008, 8, 40), mat("rim", C.orange, 0.4, 0.4), { t: [-1.55, 2.14, -2.0], r: [90, 0, 0] }),
    m(N.part("hoop", 5), cylinder(0.11, 0.075, 0.16, 20, false), mat("net", C.cream, 1), { t: [-1.55, 2.06, -2.0] }),
    empty(N.anchor("hoop_rim"), [-1.55, 2.14, -2.0]),
    node(N.pivot("hoop_ball"), {
      t: [-1.15, 0.12, -0.95],
      children: [
        m(N.part("hoop", 6), sphere(0.12, 32, 20), mat("ball", C.orange, 0.75), {}),
        hit("hoop", [0.3, 0.3, 0.3], [0, 0, 0]),
        empty(N.label("hoop"), [0, 0.26, 0]),
      ],
    }),
  ],
});

// bookshelf on the left wall; local x points into the room, z runs along the wall.
const SHELF_BOARD_Y = [0.04, 0.55, 1.05, 1.55];
const boardTop = (row: number) => SHELF_BOARD_Y[row]! + 0.0175;
const bookSlots: Node[] = [];
{
  // bottom row (row 0) = books; widths/heights vary like a real shelf
  const books: [number, number][] = [
    [0.045, 0.31], [0.035, 0.28], [0.05, 0.33], [0.04, 0.3], [0.03, 0.26], [0.055, 0.34],
    [0.038, 0.29], [0.045, 0.32], [0.032, 0.27], [0.05, 0.31], [0.04, 0.33], [0.036, 0.28],
  ];
  let z = 0.56;
  books.forEach(([w, h], i) => {
    z -= w / 2;
    bookSlots.push(
      m(N.slot("book", i + 1), box([0.2, h, w], "+x"), mat(`book_${i + 1}`, "#9C9488", 0.8), {
        t: [0.03, boardTop(0) + h / 2, z],
        extras: { aspect: w / h },
      }),
    );
    z -= w / 2 + 0.006;
  });
}
const photoSlots = [0, 1, 2].map((i) =>
  m(N.slot("photo", i + 1), box([0.02, 0.15, 0.2], "+x"), mat(`photo_${i + 1}`, "#9C9488", 0.8), {
    t: [0.02, boardTop(1) + 0.075 + 0.005, 0.34 - i * 0.24],
    r: [0, 0, -8],
    extras: { aspect: 0.2 / 0.15 },
  }),
);

const shelf = node(N.obj("shelf"), {
  t: [-2.08, 0, -1.25],
  children: [
    m(N.part("shelf", 1), box([0.34, 2.12, 0.04]), mat("shelf", C.walnut, 0.65), { t: [0, 1.06, 0.63] }),
    m(N.part("shelf", 2), box([0.34, 2.12, 0.04]), mat("shelf", C.walnut, 0.65), { t: [0, 1.06, -0.63] }),
    m(N.part("shelf", 3), box([0.02, 2.12, 1.3]), mat("shelf_back", "#A07A55", 0.8), { t: [-0.16, 1.06, 0] }),
    ...SHELF_BOARD_Y.map((y, i) => m(N.part("shelf", 4 + i), box([0.32, 0.035, 1.22]), mat("shelf", C.walnut, 0.65), { t: [0, y, 0] })),
    m(N.part("shelf", 8), box([0.36, 0.04, 1.34]), mat("shelf", C.walnut, 0.65), { t: [0, 2.1, 0] }),
    // olympiad row (row 2): trophy + three medals on stands
    m(N.part("shelf", 9), cylinder(0.05, 0.035, 0.12), mat("gold", C.gold, 0.3, 0.9), { t: [0.02, boardTop(2) + 0.2, 0.32] }),
    m(N.part("shelf", 10), cylinder(0.012, 0.012, 0.08, 10), mat("gold", C.gold, 0.3, 0.9), { t: [0.02, boardTop(2) + 0.1, 0.32] }),
    m(N.part("shelf", 11), box([0.12, 0.06, 0.12]), mat("shelf", C.walnutDark, 0.6), { t: [0.02, boardTop(2) + 0.03, 0.32] }),
    ...[0, 1, 2].map((i) =>
      m(N.part("shelf", 12 + i), cylinder(0.05, 0.05, 0.01, 28), mat(i === 0 ? "gold" : i === 1 ? "silver" : "bronze", i === 0 ? C.gold : i === 1 ? "#C7CCD1" : "#B87333", 0.3, 0.9), {
        t: [0.04, boardTop(2) + 0.16, 0.05 - i * 0.17],
        r: [0, 0, 90 - 10],
      }),
    ),
    ...[0, 1, 2].map((i) =>
      m(N.part("shelf", 15 + i), box([0.012, 0.13, 0.03]), mat(i === 0 ? "ribbon_red" : "ribbon_navy", i === 0 ? C.red : C.navy, 0.9), {
        t: [0.035, boardTop(2) + 0.27, 0.05 - i * 0.17],
      }),
    ),
    // MUN row (row 1): placard + photos
    m(N.part("shelf", 18), box([0.07, 0.07, 0.26]), mat("placard", C.navy, 0.6), { t: [0.04, boardTop(1) + 0.035, -0.42], r: [0, 0, 20] }),
    ...photoSlots,
    // school row (row 3): binders + paper stack
    ...[C.navy, C.red, C.sageDark, C.mustard, C.cream].map((color, i) =>
      m(N.part("shelf", 19 + i), box([0.24, 0.32, 0.05]), mat(`binder_${i}`, color, 0.7), { t: [0.0, boardTop(3) + 0.16, 0.5 - i * 0.065] }),
    ),
    m(N.part("shelf", 24), box([0.22, 0.06, 0.3]), mat("paper", C.paper, 0.9), { t: [0.02, boardTop(3) + 0.03, -0.25] }),
    m(N.part("shelf", 25), box([0.2, 0.18, 0.2]), mat("box", C.terracotta, 0.8), { t: [0.0, boardTop(3) + 0.09, 0.05] }),
    ...bookSlots,
    hit("shelf", [0.42, 2.18, 1.38], [0.03, 1.08, 0]),
    empty(N.label("shelf"), [0.22, 2.3, 0]),
  ],
});

const door = [
  m(N.decor("door", 1), box([0.05, 2.08, 0.92]), mat("door", "#5E7B8C", 0.6), { t: [-2.225, 1.04, 1.05] }),
  m(N.decor("door", 2), box([0.07, 2.16, 0.06]), mat("trim", C.cream, 0.6), { t: [-2.215, 1.08, 0.56] }),
  m(N.decor("door", 3), box([0.07, 2.16, 0.06]), mat("trim", C.cream, 0.6), { t: [-2.215, 1.08, 1.54] }),
  m(N.decor("door", 4), box([0.07, 0.06, 1.04]), mat("trim", C.cream, 0.6), { t: [-2.215, 2.13, 1.05] }),
  m(N.decor("door_knob"), sphere(0.032, 16, 12), mat("brass", C.brass, 0.35, 0.8), { t: [-2.17, 1.0, 0.66] }),
];

const contact = node(N.obj("contact"), {
  t: [-2.25, 1.2, 1.9],
  children: [
    m(N.part("contact", 1), box([0.22, 0.3, 0.32]), mat("mailbox", C.navy, 0.55, 0.2), { t: [0.14, 0, 0] }),
    m(N.part("contact", 2), box([0.012, 0.025, 0.2]), mat("ink", C.ink, 0.5), { t: [0.256, 0.08, 0] }),
    m(N.part("contact", 3), box([0.22, 0.04, 0.34]), mat("mailbox", C.navy, 0.55, 0.2), { t: [0.14, 0.165, 0] }),
    node(N.pivot("contact_flag"), {
      t: [0.2, 0.02, 0.172],
      r: [0, 0, 0],
      children: [
        m(N.part("contact", 4), box([0.012, 0.18, 0.012]), mat("steel", C.steel, 0.4, 0.7), { t: [0, 0.09, 0] }),
        m(N.part("contact", 5), box([0.07, 0.05, 0.008]), mat("flag", C.red, 0.6), { t: [-0.035, 0.155, 0] }),
      ],
    }),
    hit("contact", [0.4, 0.5, 0.5], [0.15, 0.02, 0]),
    empty(N.label("contact"), [0.2, 0.32, 0]),
  ],
});

const plant = [
  m(N.decor("plant", 1), cylinder(0.17, 0.13, 0.32, 24), mat("pot", C.terracotta, 0.85), { t: [1.85, 0.16, -1.85] }),
  ...(
    [
      [0, 0.55, 0, 0.2],
      [0.12, 0.72, 0.05, 0.16],
      [-0.1, 0.78, -0.06, 0.15],
      [0.03, 0.92, 0.02, 0.13],
      [-0.06, 0.62, 0.12, 0.14],
    ] as [number, number, number, number][]
  ).map(([x, y, z, r], i) => m(N.decor("plant", i + 2), sphere(r, 16, 12), mat(i % 2 ? "leaf_dark" : "leaf", i % 2 ? C.leafDark : C.leaf, 0.9), { t: [1.85 + x, y, -1.85 + z] })),
];

const stringLights = Array.from({ length: 11 }, (_, i) => {
  const x = -2.0 + i * 0.4;
  const sag = Math.sin((i / 10) * Math.PI) * 0.12;
  return m(N.decor("string", i + 1), sphere(0.022, 10, 8), mat("bulb", C.bulb, 0.3), { t: [x, 2.82 - sag, -2.2], extras: { glow: "string" } });
});

// ---------------------------------------------------------------- cameras (direction + target)

const cams = (
  [
    ["room", [5.6, 4.3, 6.0], [-0.25, 1.05, -0.45]],
    // looks in through the open side, clear of the desk, lamp and plant
    ["shelf", [1.2, 1.35, 0.3], [-2.0, 1.07, -1.25]],
    ["computer", [0.5, 1.24, -0.7], [0.5, 1.175, -1.98]],
    ["phone", [1.0, 1.4, -1.2], [1.02, 0.88, -1.74]],
    ["globe", [0.15, 1.25, -0.95], [0.02, 1.0, -1.86]],
    ["window", [0.5, 1.7, 0.9], [0.5, 1.85, -2.25]],
    ["letter", [-0.66, 1.62, -0.5], [-0.78, 1.68, -2.25]],
    ["contact", [-0.2, 1.5, 2.1], [-2.08, 1.22, 1.9]],
    ["hoop", [-0.2, 1.6, 0.9], [-1.4, 1.2, -1.5]],
  ] as const
).flatMap(([id, pos, target]) => [empty(N.cam(id), [...pos]), empty(N.camTarget(id), [...target])]);

// ---------------------------------------------------------------- write

for (const n of [
  ...shell,
  ...desk,
  ...lamp,
  ...ticker,
  computer,
  phone,
  globe,
  windowObj,
  ...curtains,
  letter,
  hoop,
  shelf,
  ...door,
  contact,
  ...plant,
  ...stringLights,
  ...cams,
]) {
  scene.addChild(n);
}

const out = path.join(process.cwd(), "public", "3d", "room.glb");
fs.mkdirSync(path.dirname(out), { recursive: true });
await new NodeIO().write(out, doc);
console.log(`✓ wrote ${path.relative(process.cwd(), out)}`);
