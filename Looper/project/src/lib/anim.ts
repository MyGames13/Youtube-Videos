// Frame driven animation helpers. Everything here is a pure function of time.
export const FPS = 30;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
// quick pop: 0.9 to 1.0 with 4 percent overshoot over ~7 frames
export const pop = (t: number) => {
  const x = clamp(t);
  if (x <= 0) return 0;
  const s = 1.70158 * 0.55;
  const y = x - 1;
  return 1 + (s + 1) * y * y * y + s * y * y;
};

// seeded hash noise, deterministic
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.0), hash(i + 1 + seed * 57.0), u) * 2 - 1;
};
// smooth handheld drift in units, t in seconds
export const handheld = (t: number, amp: number, seed = 1) => [
  (noise1(t * 0.9, seed) + 0.5 * noise1(t * 2.3, seed + 3)) * amp,
  (noise1(t * 0.8, seed + 7) + 0.5 * noise1(t * 2.1, seed + 9)) * amp,
];

export type V3 = [number, number, number];
export const v3lerp = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// piecewise keyframes: [[time, value], ...] with easing between keys
export type Key<T> = [number, T, ((t: number) => number)?];
export function keys(t: number, k: Key<number>[]): number {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, v0] = k[i];
    const [t1, v1, e] = k[i + 1];
    if (t <= t1) return lerp(v0, v1, (e ?? easeInOut)((t - t0) / (t1 - t0)));
  }
  return k[k.length - 1][1];
}
export function keys3(t: number, k: Key<V3>[]): V3 {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, v0] = k[i];
    const [t1, v1, e] = k[i + 1];
    if (t <= t1) return v3lerp(v0, v1, (e ?? easeInOut)((t - t0) / (t1 - t0)));
  }
  return k[k.length - 1][1];
}

// palette (section 6.7)
export const C = {
  base: '#07061A',
  wallA: '#14102B',
  wallB: '#221A44',
  white: '#F4F6F8',
  teal: '#1EE6C8',
  violet: '#7B5CFF',
  gold: '#FFC24A',
  amber: '#FF9E3D',
  coral: '#FF5C7A',
  blue: '#2F6BFF',
  red: '#FF3B3B',
  granCoral: '#FF6F61',
  mustard: '#E0A526',
  hoodie: '#7D8796',
  ink: '#0B0A1E',
  brass: '#D9A441',
  cyan: '#38D6FF',
};
