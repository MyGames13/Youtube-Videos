// Shot list, mode switches and sound cues for Notice 003, as pure data.
// Anchors refer to measured voice lines: "L012.ss-0.3" is 0.3 s before the line's
// sound starts (ss), se = sound end, s / e = clip start / end, w6 = word 6 start.
// The picture (shots/*.tsx) and the sound build (audio/mix.py via events.json)
// both read this file, so cuts and hits cannot drift apart.
import timeline from './timeline.json';

export type Line = (typeof timeline.lines)[number];
export const TL = timeline;
export const FPS = timeline.fps;
export const DURATION = timeline.duration;
const byId: Record<string, Line> = Object.fromEntries(timeline.lines.map((l) => [l.id, l]));
export const line = (id: string) => byId[id];

export const at = (a: string | number): number => {
	if (typeof a === 'number') return a;
	const m = a.match(/^(L\d{3})\.(ss|se|s|e|w\d+|we\d+)([+-]\d+(?:\.\d+)?)?$/);
	if (!m) throw new Error('bad anchor ' + a);
	const l = byId[m[1]];
	let t: number;
	if (m[2] === 'ss') t = l.sound_start;
	else if (m[2] === 'se') t = l.sound_end;
	else if (m[2] === 's') t = l.start;
	else if (m[2] === 'e') t = l.end;
	else if (m[2].startsWith('we')) t = (l.words_abs[Number(m[2].slice(2))] as [string, number, number])[2];
	else t = (l.words_abs[Number(m[2].slice(1))] as [string, number, number])[1];
	return t + (m[3] ? Number(m[3]) : 0);
};

// transition fingerprints: each type has its own sound, used consistently
export type Trans = 'cut' | 'into' | 'flatten' | 'pageflip' | 'layersplit' | 'popout' | 'shutter' | 'scalejump' | 'lift';

export type ShotDef = {id: string; at: string | number; trans?: Trans; mode?: '2d' | '3d' | 'hybrid'; note?: string};

export const SHOTS: ShotDef[] = [
	// HOOK
	{id: 'H01_book', at: 0, mode: '2d', note: 'flat hand slides the photo out of the book; it fills the frame'},
	{id: 'H02_bin', at: 'L002.ss-0.26', trans: 'lift', mode: 'hybrid', note: 'do not throw it away: the flat photo lifts into 3D, pinched over an open bin, pulled back'},
	{id: 'H02_show', at: 'L002.w5-0.25', mode: '3d', note: 'do not show it to anyone: held out to us, then hidden behind his back'},
	{id: 'H02_remember', at: 'L003.ss-0.3', mode: 'hybrid', note: 'do not try to remember: a flat calendar riffles backwards over his head, the room flattens, it jams'},
	{id: 'H02_twice', at: 'L004.ss-0.4', mode: '3d', note: 'point of view, the gaze leaves the photo and comes back, twice'},
	{id: 'H03_compare', at: 'L005.ss-0.25', mode: '3d', note: 'holds the photo beside his face'},
	{id: 'H04_ears', at: 'L006.w3-0.15', mode: '3d', note: 'finger to the side of his head'},
	{id: 'H05_diagram', at: 'L007.ss-0.35', trans: 'flatten', mode: 'hybrid', note: 'hallway flattens into a diagram, photographer slides in'},
	{id: 'H06_flash', at: 'L008.w4-0.1', trans: 'shutter', mode: 'hybrid', note: 'flash; far end of the hallway, he turns his head'},
	{id: 'H07_notice', at: 'L010.ss-0.3', trans: 'pageflip', mode: 'hybrid', note: 'notice slides under the door and flips up flat'},
	{id: 'H08_corner', at: 'L012.ss-0.35', mode: '2d', note: 'check the corner, meter punch in'},
	{id: 'H09_distance', at: 'L013.ss-0.35', mode: '2d', note: '3 m, 40 m scale jump, telescoping lens'},
	{id: 'H10_four', at: 'L016.ss-0.3', mode: '2d', note: 'four things, the photographer steps closer'},
	{id: 'H11_when', at: 'L017.ss-0.25', mode: '2d', note: 'open loop: when'},
	// THING 1
	{id: 'T1_title', at: 'L018.ss-1.0', mode: '2d', note: 'title card over the photo'},
	{id: 'T1_dive', at: 'L018.w1-0.1', trans: 'into', mode: 'hybrid', note: 'dive into the photo, 3D bus stop from 40 m'},
	{id: 'T1_crooked', at: 'L019.ss-0.2', mode: '3d', note: 'viewfinder brackets, crooked frame, hiding'},
	{id: 'T1_close', at: 'L021.ss-0.25', mode: '3d', note: 'what you are doing in it'},
	{id: 'T1_nothing', at: 'L022.ss-0.05', mode: '3d', note: 'nothing, bus stop, coffee, staring'},
	{id: 'T1_posing', at: 'L023.ss-0.15', trans: 'shutter', mode: '2d', note: 'not posing triptych'},
	{id: 'T1_flatten', at: 'L024.ss-0.25', trans: 'flatten', mode: 'hybrid', note: 'bus stop flattens into the photo card'},
	{id: 'T1_rule', at: 'L025.ss-0.3', mode: '2d', note: 'the only rule, kinetic ask when'},
	{id: 'T1_lineup', at: 'L027.ss-0.2', mode: '2d', note: 'strangers lineup'},
	{id: 'T1_street', at: 'L029.ss-0.35', trans: 'scalejump', mode: 'hybrid', note: 'a head grows into the 3D night street'},
	{id: 'T1_tally', at: 'L030.ss-0.45', mode: '2d', note: 'forty one'},
	// THING 2
	{id: 'T2_title', at: 'L031.ss-1.0', mode: '2d'},
	{id: 'T2_putdown', at: 'L031.se-0.6', mode: '3d', note: 'put it down, look away, look back'},
	{id: 'T2_scarf', at: 'L033.ss-0.25', trans: 'scalejump', mode: '2d', note: 'scarf draws on'},
	{id: 'T2_places', at: 'L035.ss-0.25', mode: '2d', note: 'other places'},
	{id: 'T2_phone', at: 'L036.ss-0.25', trans: 'layersplit', mode: 'hybrid', note: 'gallery UI pulls back to the 3D phone'},
	{id: 'T2_call', at: 'L037.ss-0.3', trans: 'into', mode: 'hybrid', note: 'video call tile into the 3D room'},
	{id: 'T2_booth', at: 'L038.ss-0.3', trans: 'pageflip', mode: 'hybrid', note: 'booth strip unfolds in 3D'},
	{id: 'T2_shop', at: 'L039.ss-0.3', mode: '3d', note: 'shop window'},
	{id: 'T2_grid', at: 'L041.ss-0.25', trans: 'flatten', mode: '2d', note: 'grid of copies'},
	{id: 'T2_trailer', at: 'L042.w5-0.2', mode: '2d', note: 'coming soon'},
	// THING 3
	{id: 'T3_title', at: 'L043.ss-1.0', mode: '2d'},
	{id: 'T3_hand', at: 'L044.ss-0.25', trans: 'popout', mode: 'hybrid', note: 'hand on the shoulder pops into 3D'},
	{id: 'T3_cropped', at: 'L045.ss-0.2', mode: '2d', note: 'beyond the border'},
	{id: 'T3_laughs', at: 'L046.ss-0.2', mode: '2d', note: 'the laugh begins'},
	{id: 'T3_ecu', at: 'L047.ss-0.25', mode: '2d', note: 'extreme close up of the laugh'},
	{id: 'T3_escape', at: 'L048.ss-0.25', mode: '2d', note: 'the laugh gets out before the hand can manage it'},
	{id: 'T3_request', at: 'L049.ss-0.25', mode: '2d', note: 'asked to laugh naturally: a stiff face'},
	{id: 'T3_cheese', at: 'L050.ss-0.3', trans: 'scalejump', mode: '3d', note: 'table of cheese cards'},
	{id: 'T3_askwhen', at: 'L052.ss-0.3', mode: '2d'},
	{id: 'T3_turn', at: 'L053.ss-0.35', trans: 'cut', mode: '3d', note: 'turns the photo over'},
	{id: 'T3_compare', at: 'L055.ss-0.25', mode: '2d', note: 'split screen handwriting'},
	{id: 'T3_light', at: 'L056.ss-0.2', mode: '3d', note: 'holds it to the lamp'},
	{id: 'T3_match', at: 'L058.ss-0.25', mode: '2d', note: 'stamp'},
	// THING 4
	{id: 'T4_title', at: 'L059.ss-1.0', mode: '2d'},
	{id: 'T4_warm', at: 'L059.w1-0.1', mode: '3d', note: 'glowing, develops'},
	{id: 'T4_popout', at: 'L061.ss-0.25', trans: 'popout', mode: 'hybrid', note: 'flat figure steps out of the photo'},
	{id: 'T4_list', at: 'L063.ss-0.25', trans: 'pageflip', mode: '2d', note: 'the list'},
	{id: 'T4_drawer', at: 'L064.ss-0.35', mode: '3d', note: 'drawer'},
	{id: 'T4_happening', at: 'L067.ss-0.25', mode: '2d', note: 'rain moving inside the photo'},
	// REVEAL
	{id: 'R1_dark', at: 'L067.se+0.45', mode: '2d', note: 'near silence, only the meter'},
	{id: 'R2_flip', at: 'L069.ss-0.45', mode: '2d', note: 'meter to centre, unit flip'},
	{id: 'R3_wrong', at: 'L070.ss-0.35', mode: '2d', note: 'wrong unit'},
	{id: 'R4_ruler', at: 'L071.ss-0.25', trans: 'layersplit', mode: 'hybrid', note: 'ruler turns into a timeline into depth'},
	{id: 'R5_tunnel', at: 'L072.ss-0.2', mode: '3d', note: 'calendar tunnel to a Tuesday'},
	{id: 'R6_items', at: 'L074.ss-0.3', mode: 'hybrid', note: 'scarf, hand, laugh'},
	{id: 'R7_weather', at: 'L076.ss-0.3', trans: 'pageflip', mode: '2d', note: 'weather report'},
	{id: 'R8_envelope', at: 'L077.ss-0.25', mode: '2d', note: 'one good photograph, envelope'},
	{id: 'R9_post', at: 'L079.ss-0.25', mode: '2d', note: 'poor way to deliver it'},
	{id: 'R10_window', at: 'L080.ss-0.35', trans: 'into', mode: '3d', note: 'checking strangers from the window'},
	// ESCAPE
	{id: 'E1_pin', at: 'L081.ss-0.9', mode: '3d', note: 'pins the photo by the door'},
	{id: 'E2_dont', at: 'L083.ss-0.2', trans: 'flatten', mode: '2d', note: 'bus stop, scarf'},
	{id: 'E3_arrange', at: 'L084.ss-0.2', mode: '2d', note: 'staged laugh'},
	{id: 'E4_work', at: 'L085.ss-0.25', trans: 'scalejump', mode: '3d', note: 'work, home with key, kettle'},
	{id: 'E5_days', at: 'L086.ss-0.3', trans: 'pageflip', mode: 'hybrid', note: 'calendar pages flip into 3D days'},
	{id: 'E6_count', at: 'L091.ss-0.45', mode: '2d', note: 'countdown to zero'},
	{id: 'E7_tuesday', at: 'L092.ss-0.7', trans: 'into', mode: '3d', note: 'the ordinary Tuesday'},
	{id: 'E8_laugh', at: 'L093.ss-0.1', trans: 'flatten', mode: 'hybrid', note: 'laugh, freeze, flatten into the photograph'},
	{id: 'E9_ontime', at: 'L094.ss-0.4', mode: '3d', note: 'the photograph on the wall, right on time'},
	// TURN
	{id: 'O1_revision', at: 'L095.ss-0.9', trans: 'pageflip', mode: '2d', note: 'revised advice'},
	{id: 'O1_earlier', at: 'L096.ss-0.2', mode: 'hybrid', note: 'playback of the hook: he hides the photo on anyone'},
	{id: 'O1_reviewed', at: 'L097.ss-0.35', mode: '2d', note: 'struck through, REVIEWED stamp'},
	{id: 'O2_frame', at: 'L098.ss-0.35', trans: 'pageflip', mode: '3d', note: 'frame it'},
	{id: 'O3_nobody', at: 'L099.ss-0.25', mode: '3d', note: 'the photographer spot is empty'},
	{id: 'O4_reminder', at: 'L101.ss-0.25', trans: 'flatten', mode: 'hybrid', note: 'viewfinder becomes a picture frame'},
	{id: 'O5_glad', at: 'L102.ss-0.25', mode: '3d', note: 'the moment, warm'},
	{id: 'O6_write', at: 'L103.ss-0.35', mode: '3d', note: 'future him writes keep it'},
	{id: 'O7_another', at: 'L105.ss-0.35', mode: '3d', note: 'another photo in the book'},
	{id: 'O8_end', at: 'L107.ss-0.35', mode: '3d', note: 'keep them, regrets, lights off, second photograph'},
	{id: 'O9_card', at: DURATION - 2.5, mode: '2d', note: 'end card'},
];

export type ShotTime = ShotDef & {start: number; end: number};
export const SHOT_TIMES: ShotTime[] = SHOTS.map((s, i) => ({
	...s,
	start: at(s.at),
	end: i + 1 < SHOTS.length ? at(SHOTS[i + 1].at) : DURATION,
}));
export const shotStart = (id: string) => SHOT_TIMES.find((s) => s.id === id)!.start;
export const shotEnd = (id: string) => SHOT_TIMES.find((s) => s.id === id)!.end;

// picture events the sound has to hit
export type Ev = {t: number; kind: string; dur?: number; amt?: number};
export const glitches: Ev[] = [
	{t: at('L026.w6') - 0.05, kind: 'glitch', dur: 0.2},
	{t: at('L052.w7') - 0.05, kind: 'glitch', dur: 0.2},
	{t: at('L069.se+0.35'), kind: 'glitch', dur: 0.27, amt: 1},
	{t: at('L070.w4') - 0.05, kind: 'glitch', dur: 0.17},
	{t: at('L034.w8') - 0.04, kind: 'glitch', dur: 0.14, amt: 0.6},
	{t: at('L042.w5') - 0.05, kind: 'glitch', dur: 0.15, amt: 0.6},
	{t: at('L018.ss-1.0'), kind: 'glitch', dur: 0.15, amt: 0.5},
	{t: at('L031.ss-1.0'), kind: 'glitch', dur: 0.15, amt: 0.5},
	{t: at('L043.ss-1.0'), kind: 'glitch', dur: 0.15, amt: 0.5},
	{t: at('L059.ss-1.0'), kind: 'glitch', dur: 0.15, amt: 0.5},
];
export const flickers: Ev[] = [
	{t: at('L009.we12'), kind: 'flicker'},
	{t: at('L034.w8'), kind: 'flicker'},
	{t: at('L040.ss+0.4'), kind: 'flicker'},
	{t: at('L045.ss+0.8'), kind: 'flicker'},
	{t: at('L063.ss+1.0'), kind: 'flicker'},
	{t: at('L072.ss+0.3'), kind: 'flicker'},
];
// shutter flashes (white frames) that hide a swap
export const flashes: Ev[] = [
	{t: at('L008.w4') - 0.1, kind: 'flash', dur: 0.2},
	{t: at('L023.ss-0.15'), kind: 'flash', dur: 0.14},
	{t: at('L093.se') + 0.55, kind: 'flash', dur: 0.12, amt: 0.55},
];

export const exportEvents = () => ({
	shots: SHOT_TIMES.map((s) => ({id: s.id, start: s.start, end: s.end, trans: s.trans ?? 'cut', mode: s.mode})),
	glitches,
	flickers,
	flashes,
});
