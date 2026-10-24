import {at, TL} from '../events';
import {CamSpec, lerpCam} from '../world/mode';
import {PHOTO_CAM} from '../world/PhotoWorld';
import {PhotoState} from '../world/PhotoWorld';
import {lin, sm} from './types';

// How the photograph develops over the film. It is the same composition the whole
// time; the moment inside it is still happening.
export const photoStateAt = (t: number, overrides: Partial<PhotoState> = {}): PhotoState => {
	const scarf = lin(t, at('L033.ss') + 0.2, at('L033.ss') + 1.4);
	const hand = sm(lin(t, at('L044.w5'), at('L044.w5') + 0.5));
	// the laugh begins as Thing 3 says so, and widens in Thing 4
	const l1 = 0.62 * sm(lin(t, at('L046.w5'), at('L046.w5') + 1.6));
	const l2 = 0.38 * sm(lin(t, at('L061.w4'), at('L061.se')));
	const laugh = Math.min(1, l1 + l2);
	return {
		expr: laugh > 0.02 ? 'laugh' : 'blank',
		laugh,
		scarf,
		hand,
		friend: 0,
		t,
		frozen: true,
		...overrides,
	};
};

export const LAUGH_T = TL.laugh_t;

// The photograph's framing tightens each time the photographer is closer:
// 40 m wide, 18 m a little tighter, 6 m a medium shot whose right edge crops the
// friend at the arm, 1.5 m head and shoulders, 0.3 m an extreme close up.
// After the reveal it settles on the final photograph: the 6 m medium shot.
export const FRAMING: Record<string, CamSpec> = {
	m40: PHOTO_CAM,
	m18: {...PHOTO_CAM, target: [0.18, 1.34, 0], frameH: 2.3},
	m6: {...PHOTO_CAM, target: [-0.25, 1.37, 0], frameH: 1.32},
	m1: {...PHOTO_CAM, target: [0.1, 1.5, 0], frameH: 0.92},
	m0: {...PHOTO_CAM, target: [0.4, 1.62, 0], frameH: 0.56},
};
export const FINAL_CAM = FRAMING.m6;

export const photoCamAt = (t: number): CamSpec => {
	const steps: [number, CamSpec][] = [
		[at('L030.se') + 0.35, FRAMING.m18],
		[at('L042.se') + 0.35, FRAMING.m6],
		[at('L058.se') + 0.35, FRAMING.m1],
		[at('L067.se') + 0.35, FRAMING.m0],
		[at('L069.se') + 0.35, FRAMING.m6],
	];
	let cam = FRAMING.m40;
	for (const [t0, next] of steps) {
		if (t >= t0) {
			const k = Math.min(1, (t - t0) / 0.5);
			const e = k * k * (3 - 2 * k);
			cam = lerpCam(cam, next, e);
		}
	}
	return cam;
};
