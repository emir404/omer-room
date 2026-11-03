"use client";

import { Box3, type Camera, type Mesh, Matrix4, Quaternion, ShaderMaterial, SRGBColorSpace, type Texture, Vector3 } from "three";

/**
 * The view out of the window: a photo on a large virtual plane far behind the glass. Each pixel of
 * the window looks along the ray from the camera through it and samples the photo where that ray
 * meets the plane, so moving the camera reveals more of one side, the way a real window does
 * (no geometry pokes out above the cutaway walls).
 *
 * The photo is a pinhole view with a known horizontal field of view (`fov`) and horizon row
 * (`horizon`, 0 = top). Night grades the same photo: dark, blue, the sky a little lighter than the
 * land, with a few stars.
 */
export interface WindowViewOptions {
  map: Texture;
  /** Horizontal field of view of the photo, degrees. */
  fov: number;
  /** Where the horizon sits in the photo, from the top (0) to the bottom (1). */
  horizon: number;
  /** Photo width / height. */
  aspect: number;
}

const DIST = 60; // meters behind the glass: far enough that the view barely shifts with the camera

const vertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uCam;
  uniform mat4 uToWindow;
  uniform vec2 uSize;
  uniform float uDist;
  uniform float uHorizonY;
  uniform float uHorizonV;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main() {
    vec3 p = (uToWindow * vec4(vWorld, 1.0)).xyz;
    vec3 c = (uToWindow * vec4(uCam, 1.0)).xyz;
    vec3 d = normalize(p - c);
    float t = (uDist - p.z) / max(d.z, 1e-3);
    vec2 q = p.xy + d.xy * t;
    vec2 uv = vec2(q.x / uSize.x + 0.5, uHorizonV - (q.y - uHorizonY) / uSize.y);
    vec3 day = texture2D(uMap, clamp(uv, vec2(0.001), vec2(0.999))).rgb;

    // night: the same place under a moonless sky
    float lum = dot(day, vec3(0.2126, 0.7152, 0.0722));
    float sky = smoothstep(0.02, 0.12, uHorizonV - uv.y) * smoothstep(0.05, 0.3, day.b - day.r * 0.6);
    vec3 night = mix(vec3(0.010, 0.014, 0.026) + lum * vec3(0.025, 0.035, 0.07), vec3(0.03, 0.045, 0.09) + lum * vec3(0.03, 0.04, 0.08), sky);
    vec2 cell = floor(uv * vec2(260.0, 150.0));
    float star = step(0.9935, hash(cell)) * sky * (0.6 + 0.4 * sin(uTime * 1.7 + hash(cell + 3.1) * 40.0));
    vec2 f = fract(uv * vec2(260.0, 150.0)) - 0.5;
    night += vec3(0.75, 0.8, 1.0) * star * smoothstep(0.22, 0.0, length(f));

    vec3 color = mix(day, night, uNight);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createWindowViewMaterial({ map, fov, horizon, aspect }: WindowViewOptions): ShaderMaterial {
  map.colorSpace = SRGBColorSpace;
  map.flipY = false;
  map.anisotropy = 4;
  const width = 2 * DIST * Math.tan((fov * Math.PI) / 360);
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    toneMapped: false,
    uniforms: {
      uMap: { value: map },
      uCam: { value: new Vector3() },
      uToWindow: { value: new Matrix4() },
      uSize: { value: [width, width / aspect] },
      uDist: { value: DIST },
      // the horizon sits a little below the window's middle: about eye height in the room
      uHorizonY: { value: -0.32 },
      uHorizonV: { value: horizon },
      uNight: { value: 0 },
      uTime: { value: 0 },
    },
  });
}

const tmp = { cam: new Vector3(), pos: new Vector3(), quat: new Quaternion(), scale: new Vector3(), box: new Box3() };
const ONE = new Vector3(1, 1, 1);
const FLIP_Z = new Matrix4().makeScale(1, 1, -1);

/**
 * The window's frame, in meters: origin at the glass's center, x along it, y up, z out of the room.
 * Built from the mesh's rotation only — compressed GLBs put a dequantization scale on mesh nodes.
 * glTF quads from Blender face the room along local +Z, so z is flipped to point outside.
 */
export function updateWindowView(material: ShaderMaterial, mesh: Mesh, camera: Camera, nightness: number, time: number) {
  const u = material.uniforms;
  u.uCam!.value.copy(camera.getWorldPosition(tmp.cam));
  mesh.geometry.computeBoundingBox();
  const center = tmp.box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).getCenter(tmp.pos);
  mesh.matrixWorld.decompose(tmp.scale, tmp.quat, tmp.scale);
  const toWindow = u.uToWindow!.value as Matrix4;
  toWindow.compose(center, tmp.quat, ONE).multiply(FLIP_Z).invert();
  u.uNight!.value = nightness;
  u.uTime!.value = time;
}
