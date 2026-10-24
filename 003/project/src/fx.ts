import {Fx} from './post/PostFX';
import {flashes, flickers, glitches, TL} from './events';

// global picture events: glitch with RGB split, light flicker (100, 40, 100 percent
// over 6 frames), shutter flashes, and the colour grade (cold in the briefing,
// warm in the escape and the turn).
const FLICK = [1, 0.4, 1, 0.55, 1, 0.85];

const sec = TL.sections as Record<string, number>;

export const gradeAt = (t: number) => {
	const e = sec.escape;
	const o = sec.turn;
	if (t < sec.reveal) return -0.32;
	if (t < e) return -0.45;
	if (t < o) return -0.15 + 0.55 * Math.min(1, (t - e) / (o - e));
	return 0.45;
};

export const globalFx = (t: number, frame: number): Partial<Fx> => {
	const out: Partial<Fx> = {};
	let glitch = 0;
	for (const g of glitches) {
		const d = t - g.t;
		if (d >= 0 && d < (g.dur ?? 0.2)) glitch = Math.max(glitch, (g.amt ?? 1) * (1 - 0.4 * (d / (g.dur ?? 0.2))));
	}
	if (glitch > 0) {
		out.glitch = glitch;
		out.glitchSeed = (frame * 7.31) % 100;
		out.rgb = 3 + 3 * glitch;
	}
	let flick = 1;
	for (const f of flickers) {
		const d = Math.floor((t - f.t) * 30);
		if (d >= 0 && d < FLICK.length) flick = Math.min(flick, FLICK[d]);
	}
	out.flicker = flick;
	let flash = 0;
	for (const f of flashes) {
		const d = t - f.t;
		const dur = f.dur ?? 0.15;
		if (d >= 0 && d < dur + 0.12) flash = Math.max(flash, (f.amt ?? 1) * (d < 2 / 30 ? 1 : Math.max(0, 1 - (d - 2 / 30) / (dur + 0.05))));
	}
	out.flash = flash;
	out.warm = gradeAt(t);
	return out;
};
