import * as THREE from 'three';

// One material family for the whole film. flat = 1 renders the exact base colour
// unlit (the 2D look); flat = 0 renders toon lighting with a rim light (the 3D look).
// Everything in between is a straight blend, so a mode switch never pops.

const ramp = (() => {
	const steps = [92, 150, 205, 255];
	const data = new Uint8Array(steps.length * 4);
	steps.forEach((v, i) => {
		data.set([v, v, v, 255], i * 4);
	});
	const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.needsUpdate = true;
	return tex;
})();

export type InkUniforms = {
	uFlat: {value: number};
	uRimColor: {value: THREE.Color};
	uRim: {value: number};
	uGlow: {value: number};
};

export type InkMaterial = THREE.MeshToonMaterial & {userData: {u: InkUniforms}};

export type InkOpts = {
	map?: THREE.Texture | null;
	rim?: number;
	rimColor?: string;
	emissive?: string;
	emissiveIntensity?: number;
	transparent?: boolean;
	opacity?: number;
	side?: THREE.Side;
	depthWrite?: boolean;
	smooth?: boolean;
};

export const makeInk = (color: string, opts: InkOpts = {}): InkMaterial => {
	const m = new THREE.MeshToonMaterial({
		color,
		map: opts.map ?? null,
		gradientMap: opts.smooth ? null : ramp,
		emissive: new THREE.Color(opts.emissive ?? '#000000'),
		emissiveIntensity: opts.emissiveIntensity ?? 1,
		transparent: opts.transparent ?? false,
		opacity: opts.opacity ?? 1,
		side: opts.side ?? THREE.FrontSide,
		depthWrite: opts.depthWrite ?? true,
	}) as InkMaterial;
	const u: InkUniforms = {
		uFlat: {value: 1},
		uRimColor: {value: new THREE.Color(opts.rimColor ?? '#9fb4c8')},
		uRim: {value: opts.rim ?? 0.35},
		uGlow: {value: 0},
	};
	m.userData.u = u;
	m.onBeforeCompile = (shader) => {
		shader.uniforms.uFlat = u.uFlat;
		shader.uniforms.uRimColor = u.uRimColor;
		shader.uniforms.uRim = u.uRim;
		shader.uniforms.uGlow = u.uGlow;
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				'#include <common>\nuniform float uFlat;\nuniform vec3 uRimColor;\nuniform float uRim;\nuniform float uGlow;',
			)
			.replace(
				'#include <opaque_fragment>',
				`{
	vec3 vdir = normalize(vViewPosition);
	float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), vdir)), 0.0, 1.0), 2.6);
	outgoingLight += uRimColor * rimF * uRim * (1.0 - uFlat);
	vec3 flatCol = diffuseColor.rgb + totalEmissiveRadiance;
	outgoingLight = mix(outgoingLight, flatCol, uFlat);
	outgoingLight += diffuseColor.rgb * uGlow;
}
#include <opaque_fragment>`,
			);
	};
	m.customProgramCacheKey = () => (opts.smooth ? 'ink-smooth' : 'ink');
	return m;
};

export const setFlat = (m: InkMaterial, flat: number, glow = 0) => {
	m.userData.u.uFlat.value = flat;
	m.userData.u.uGlow.value = glow;
};

// Constant pixel width outline (inverted hull pushed out in clip space). The same
// stroke weight in flat and 3D shots is what hides the seam between the two.
export const makeOutline = (width = 2.2, color = '#05070a') => {
	return new THREE.ShaderMaterial({
		uniforms: {
			uWidth: {value: width},
			uRes: {value: new THREE.Vector2(1280, 720)},
			uColor: {value: new THREE.Color(color)},
			uOpacity: {value: 1},
		},
		vertexShader: `
uniform float uWidth;
uniform vec2 uRes;
void main() {
	vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	vec3 vn = normalize(normalMatrix * normal);
	vec2 d = (projectionMatrix * vec4(vn, 0.0)).xy;
	float l = length(d);
	d = l > 1e-5 ? d / l : vec2(0.0);
	clip.xy += d * uWidth * 2.0 / uRes * clip.w;
	gl_Position = clip;
}`,
		fragmentShader: `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
	gl_FragColor = vec4(uColor, uOpacity);
	#include <colorspace_fragment>
}`,
		side: THREE.BackSide,
		transparent: false,
	});
};

export const COLORS = {
	bg: '#06080B',
	wallA: '#12171d',
	wallB: '#1c232b',
	wallC: '#232b35',
	white: '#F4F6F8',
	ink: '#05070a',
	amber: '#FFA21A',
	cyan: '#5CF2E6',
	red: '#FF2B2B',
	grey: '#8b97a5',
	paper: '#e9e4d8',
};
