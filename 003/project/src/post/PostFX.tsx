import React, {useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {PERF} from '../perf';

// Render pipeline owned by us (priority 1 useFrame, driven by Remotion's advance):
// scene to an MSAA HDR target, quarter resolution bloom, one composite pass with
// grade, vignette, grain, scanlines, glitch, flicker, flash, fade and dither.

export type Fx = {
	bloom: number;
	exposure: number;
	warm: number; // -1 cold .. +1 warm
	vignette: number;
	grain: number;
	scan: number;
	glitch: number;
	glitchSeed: number;
	rgb: number; // chromatic split in px
	flicker: number; // brightness multiplier
	flash: number; // white
	fade: number; // black
	seed: number;
	desat: number;
};

export const defaultFx = (frame: number): Fx => ({
	bloom: 0.9,
	exposure: 1,
	warm: -0.25,
	vignette: 0.25,
	grain: 0.03,
	scan: 0.03,
	glitch: 0,
	glitchSeed: 0,
	rgb: 0,
	flicker: 1,
	flash: 0,
	fade: 0,
	seed: Math.floor(frame / 2),
	desat: 0,
});

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = `
varying vec2 vUv; uniform sampler2D tex; uniform vec2 texel;
void main(){
	vec3 c = vec3(0.0);
	for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
		vec3 s = texture2D(tex, vUv + vec2(float(i), float(j)) * texel).rgb;
		s = clamp(s, 0.0, 16.0);
		if (s.r != s.r || s.g != s.g || s.b != s.b) s = vec3(0.0);
		c += s;
	}
	c /= 9.0;
	vec3 hi = max(c - 1.0, 0.0) + max(c - 0.9, 0.0) * 0.12;
	gl_FragColor = vec4(hi, 1.0);
}`;

const BLUR = `
varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir;
void main(){
	vec3 c = texture2D(tex, vUv).rgb * 0.2270270;
	c += texture2D(tex, vUv + dir * 1.3846154).rgb * 0.3162162;
	c += texture2D(tex, vUv - dir * 1.3846154).rgb * 0.3162162;
	c += texture2D(tex, vUv + dir * 3.2307692).rgb * 0.0702703;
	c += texture2D(tex, vUv - dir * 3.2307692).rgb * 0.0702703;
	gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = `
varying vec2 vUv;
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBloom2;
uniform vec2 uRes; uniform float uBloom, uExposure, uWarm, uVignette, uGrain, uScan;
uniform float uGlitch, uGlitchSeed, uRGB, uFlicker, uFlash, uFade, uSeed, uDesat, uDither;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
	float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
vec3 tm(vec3 c){ return clamp(c, 0.0, 16.0) / (1.0 + clamp(c, 0.0, 16.0)); }
float lumaOf(vec3 c){ return dot(tm(c), vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(sampler2D t, vec2 uv){
	vec2 px = 1.0 / uRes;
	vec3 rgbM = texture2D(t, uv).rgb;
	float lNW = lumaOf(texture2D(t, uv + vec2(-1.0, -1.0) * px).rgb);
	float lNE = lumaOf(texture2D(t, uv + vec2(1.0, -1.0) * px).rgb);
	float lSW = lumaOf(texture2D(t, uv + vec2(-1.0, 1.0) * px).rgb);
	float lSE = lumaOf(texture2D(t, uv + vec2(1.0, 1.0) * px).rgb);
	float lM = lumaOf(rgbM);
	float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
	float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
	if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM;
	vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
	float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
	float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
	dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
	vec3 a = 0.5 * (texture2D(t, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(t, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
	vec3 b = a * 0.5 + 0.25 * (texture2D(t, uv + dir * -0.5).rgb + texture2D(t, uv + dir * 0.5).rgb);
	float lB = lumaOf(b);
	return (lB < lMin || lB > lMax) ? a : b;
}
vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
	vec2 uv = vUv;
	if (uGlitch > 0.001) {
		float band = floor(uv.y * 22.0 + uGlitchSeed * 13.0);
		float r = hash(vec2(band, uGlitchSeed));
		float on = step(1.0 - 0.5 * uGlitch, r);
		float px = (6.0 + 8.0 * hash(vec2(band, uGlitchSeed + 2.7))) * sign(hash(vec2(band, uGlitchSeed + 5.1)) - 0.5);
		uv.x += on * px / uRes.x;
	}
	vec2 ca = vec2(uRGB / uRes.x, 0.0);
	vec3 col = fxaa(tScene, uv);
	if (uRGB > 0.01) {
		col.r = texture2D(tScene, uv + ca).r;
		col.b = texture2D(tScene, uv - ca).b;
	}
	if (col.r != col.r || col.g != col.g || col.b != col.b) col = vec3(1.0);
	col = clamp(col, 0.0, 16.0);
	col += (texture2D(tBloom, uv).rgb * 0.75 + texture2D(tBloom2, uv).rgb * 0.6) * uBloom;
	col *= uExposure * uFlicker;
	float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
	col = mix(col, vec3(lum), uDesat);
	col *= mix(vec3(1.0), vec3(1.07, 1.0, 0.86), max(uWarm, 0.0));
	col *= mix(vec3(1.0), vec3(0.9, 1.0, 1.08), max(-uWarm, 0.0));
	// gentle shoulder so glows roll off instead of clipping
	col = col / (1.0 + max(col - 0.85, 0.0) * 0.8);
	vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
	float vig = smoothstep(1.05, 0.28, length(d));
	col *= mix(1.0 - uVignette, 1.0, vig);
	col = toSRGB(col);
	float sl = 0.5 + 0.5 * cos(gl_FragCoord.y * 3.14159265);
	col *= 1.0 - (uScan + uGlitch * 0.12) * sl;
	float g = vnoise(gl_FragCoord.xy / 2.6 + uSeed * 37.0) - 0.5;
	col += g * uGrain * (1.0 - 0.5 * lum);
	col = mix(col, vec3(1.0), uFlash);
	col *= 1.0 - uFade;
	col += uDither * (hash(gl_FragCoord.xy + fract(uSeed * 0.618) * 100.0) - 0.5) / 255.0;
	gl_FragColor = vec4(col, 1.0);
}`;

type Props = {fx: Fx; before?: (gl: THREE.WebGLRenderer) => void};

export const PostFX: React.FC<Props> = ({fx, before}) => {
	const {gl, scene, camera, size} = useThree();
	const w = Math.round(size.width);
	const h = Math.round(size.height);
	const res = useMemo(() => {
		const main = new THREE.WebGLRenderTarget(w, h, {type: PERF.half ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: PERF.msaa});
		const q = (s: number) =>
			new THREE.WebGLRenderTarget(Math.max(1, Math.round(w / s)), Math.max(1, Math.round(h / s)), {
				type: THREE.HalfFloatType,
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
			});
		const b1 = q(4);
		const b1b = q(4);
		const b2 = q(8);
		const b2b = q(8);
		const geo = new THREE.PlaneGeometry(2, 2);
		const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
			new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false});
		const bright = mk(BRIGHT, {tex: {value: null}, texel: {value: new THREE.Vector2(1 / w, 1 / h)}});
		const blur = mk(BLUR, {tex: {value: null}, dir: {value: new THREE.Vector2()}});
		const comp = mk(COMPOSITE, {
			tScene: {value: main.texture},
			tBloom: {value: b1.texture},
			tBloom2: {value: b2.texture},
			uRes: {value: new THREE.Vector2(w, h)},
			uBloom: {value: 1},
			uExposure: {value: 1},
			uWarm: {value: 0},
			uVignette: {value: 0.25},
			uGrain: {value: 0.03},
			uScan: {value: 0.03},
			uGlitch: {value: 0},
			uGlitchSeed: {value: 0},
			uRGB: {value: 0},
			uFlicker: {value: 1},
			uFlash: {value: 0},
			uFade: {value: 0},
			uSeed: {value: 0},
			uDesat: {value: 0},
			uDither: {value: 1},
		});
		const quad = new THREE.Mesh(geo, comp);
		quad.frustumCulled = false;
		const qScene = new THREE.Scene();
		qScene.add(quad);
		const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		return {main, b1, b1b, b2, b2b, bright, blur, comp, quad, qScene, qCam};
	}, [w, h]);

	const u = res.comp.uniforms;
	u.uBloom.value = fx.bloom;
	u.uExposure.value = fx.exposure;
	u.uWarm.value = fx.warm;
	u.uVignette.value = fx.vignette;
	u.uGrain.value = PERF.noise ? fx.grain : 0;
	u.uDither.value = PERF.noise ? 1 : 0;
	u.uScan.value = fx.scan;
	u.uGlitch.value = fx.glitch;
	u.uGlitchSeed.value = fx.glitchSeed;
	u.uRGB.value = fx.rgb;
	u.uFlicker.value = fx.flicker;
	u.uFlash.value = fx.flash;
	u.uFade.value = fx.fade;
	u.uSeed.value = fx.seed;
	u.uDesat.value = fx.desat;

	useFrame(() => {
		if (before) before(gl);
		const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
			res.quad.material = mat;
			gl.setRenderTarget(target);
			gl.render(res.qScene, res.qCam);
		};
		if (!PERF.post) {
			gl.setRenderTarget(null);
			gl.setClearColor('#06080B', 1);
			gl.clear(true, true, true);
			gl.render(scene, camera);
			return;
		}
		gl.setRenderTarget(res.main);
		gl.setClearColor('#06080B', 1);
		gl.clear(true, true, true);
		gl.render(scene, camera);
		if (!PERF.bloom) {
			pass(res.comp, null);
			return;
		}
		res.bright.uniforms.tex.value = res.main.texture;
		pass(res.bright, res.b1);
		const blurPass = (src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, dx: number, dy: number) => {
			res.blur.uniforms.tex.value = src.texture;
			(res.blur.uniforms.dir.value as THREE.Vector2).set(dx / src.width, dy / src.height);
			pass(res.blur, dst);
		};
		blurPass(res.b1, res.b1b, 1, 0);
		blurPass(res.b1b, res.b1, 0, 1);
		blurPass(res.b1, res.b2, 1, 0);
		blurPass(res.b2, res.b2b, 0, 1);
		blurPass(res.b2b, res.b2, 2, 0);
		blurPass(res.b2, res.b2b, 0, 2);
		res.comp.uniforms.tBloom2.value = res.b2b.texture;
		pass(res.comp, null);
	}, 10);
	return null;
};
