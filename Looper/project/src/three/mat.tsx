// Shared materials: stepped toon shading plus a fresnel rim, so 3D still looks drawn.
import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
export function toonRamp() {
  if (gradient) return gradient;
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.Material>();

export type ToonOpts = {
  color: string;
  rim?: string;
  rimStrength?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  flat?: number; // 0 toon lit, 1 flat unlit
};

export function toon(o: ToonOpts): THREE.MeshToonMaterial {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({
    color: o.color,
    gradientMap: toonRamp(),
    emissive: new THREE.Color(o.emissive ?? '#000000'),
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.opacity !== undefined && o.opacity < 1,
    opacity: o.opacity ?? 1,
  });
  const rim = new THREE.Color(o.rim ?? '#9fb4ff');
  const rimStrength = o.rimStrength ?? 0.0;
  const flat = o.flat ?? 0;
  const base = new THREE.Color(o.color);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = {value: rim};
    sh.uniforms.rimStrength = {value: rimStrength};
    sh.uniforms.flatAmt = {value: flat};
    sh.uniforms.flatColor = {value: base};
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float flatAmt;\nuniform vec3 flatColor;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += rimColor * rimF * rimStrength;`
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight = mix(outgoingLight, flatColor, flatAmt);
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => `toon_${rimStrength}_${flat}_${o.rim}`;
  cache.set(key, m);
  return m;
}

export function basic(color: string, opacity = 1, additive = false, side: THREE.Side = THREE.FrontSide) {
  const key = `b_${color}_${opacity}_${additive}_${side}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshBasicMaterial;
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1 || additive,
    opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !additive && opacity >= 1,
    side,
    toneMapped: false,
  });
  cache.set(key, m);
  return m;
}

// radial glow texture for fake bloom sprites
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const s = 128;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s - 0.5;
      const dy = (y + 0.5) / s - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.pow(Math.max(0, 1 - d), 2.2);
      const i = (y * s + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  glowTex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  glowTex.needsUpdate = true;
  return glowTex;
}

const glowMats = new Map<string, THREE.SpriteMaterial>();
export function glowMat(color: string, opacity: number) {
  const k = `${color}_${opacity.toFixed(2)}`;
  let m = glowMats.get(k);
  if (!m) {
    m = new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    glowMats.set(k, m);
  }
  return m;
}
