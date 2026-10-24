import React from 'react';
import {Line, TL} from '../events';

// One caption per line; lines over 9 words split at the best sentence or comma
// boundary. Each caption hard cuts in at its first word's measured start.

export type Cap = {id: string; text: string; t0: number; t1: number; speaker: string; emph?: Record<string, string>};

// one emphasised word per caption at most (amber = the future, cyan = management, red = shock)
const EMPH: Record<string, Record<string, string>> = {
	L001: {'KEEP': '#FFA21A'},
	L003: {'REMEMBER': '#5CF2E6'},
	L006: {'EARS.': '#5CF2E6'},
	L009: {'NOTICE.': '#FFA21A'},
	L012: {'CORNER.': '#5CF2E6'},
	L014: {'FORTY': '#FFA21A'},
	L016: {'CLOSER.': '#FFA21A'},
	L017: {'WHEN': '#FFA21A'},
	L018: {'FAR': '#FFA21A'},
	L022: {'NOTHING.': '#5CF2E6'},
	L026: {'WHEN.': '#FFA21A'},
	L030: {'ONE.': '#5CF2E6'},
	L031: {'SAME.': '#FFA21A'},
	L034: {'YET.': '#FFA21A'},
	L042: {'TRAILER.': '#FFA21A'},
	L043: {'ALONE': '#FFA21A'},
	L044: {'SHOULDER.': '#FFA21A'},
	L047: {'REAL': '#FFA21A'},
	L051: {'CHEESE.': '#5CF2E6'},
	L052: {'WHEN.': '#FFA21A'},
	L055: {'HANDWRITING.': '#FFA21A'},
	L058: {'YOURS.': '#FFA21A'},
	L059: {'WARM.': '#FFA21A'},
	L063: {'UNSETTLING': '#5CF2E6'},
	L066: {'SEE': '#FFA21A'},
	L067: {'HAPPENING.': '#FFA21A'},
	L068: {'WHEN': '#FFA21A'},
	L069: {'CORNER.': '#5CF2E6'},
	L070: {'UNIT.': '#FF2B2B'},
	L071: {'TIME.': '#FFA21A'},
	L072: {'YET.': '#FFA21A'},
	L073: {'TUESDAY': '#FFA21A'},
	L077: {'GOOD': '#FFA21A'},
	L082: {'NOTHING': '#5CF2E6'},
	L086: {'DAYS': '#FFA21A'},
	L089: {'HURRY': '#5CF2E6'},
	L091: {'CORNER.': '#5CF2E6'},
	L093: {'LAUGH': '#FFA21A'},
	L094: {'TIME.': '#FFA21A'},
	L098: {'FRAME': '#FFA21A'},
	L101: {'REMINDER.': '#FFA21A'},
	L102: {'GLAD': '#FFA21A'},
	L103: {'YOURS.': '#FFA21A'},
	L106: {'GOOD': '#FFA21A'},
	L107: {'KEEP': '#FFA21A'},
	L108: {'REGRETS': '#5CF2E6'},
};

const splitLine = (tokens: string[]): number => {
	// returns the token index where a second caption starts, or -1
	if (tokens.length <= 9) return -1;
	const mid = tokens.length / 2;
	let best = -1;
	let bestScore = 1e9;
	for (let i = 2; i < tokens.length - 1; i++) {
		const prev = tokens[i - 1];
		const strong = /[.!?]$/.test(prev) || prev.endsWith('...');
		const weak = /,$/.test(prev);
		if (!strong && !weak) continue;
		const score = Math.abs(i - mid) - (strong ? 2.5 : 0);
		if (score < bestScore) {
			bestScore = score;
			best = i;
		}
	}
	if (best < 0) best = Math.round(mid);
	return best;
};

export const buildCaptions = (): Cap[] => {
	const caps: Cap[] = [];
	const lines = TL.lines as Line[];
	for (const l of lines) {
		if (l.speaker === 'W') {
			caps.push({id: l.id, text: l.text, t0: l.start, t1: l.end, speaker: 'W'});
			continue;
		}
		const tokens = l.text.split(' ');
		const words = l.words_abs as [string, number, number][];
		const cut = splitLine(tokens);
		const parts = cut === -1 ? [[0, tokens.length]] : [[0, cut], [cut, tokens.length]];
		for (const [a, b] of parts) {
			const t0 = a === 0 ? l.sound_start : words[a][1] - 0.04;
			const t1 = b === tokens.length ? l.sound_end : words[b - 1][2];
			caps.push({id: l.id, text: tokens.slice(a, b).join(' ').toUpperCase(), t0, t1, speaker: 'N', emph: EMPH[l.id]});
		}
	}
	// hold each caption until the next one if the gap is short, otherwise a little past the words
	for (let i = 0; i < caps.length; i++) {
		const next = caps[i + 1];
		const hold = caps[i].t1 + 0.55;
		caps[i].t1 = next ? Math.min(next.t0, hold) : hold;
		if (next && next.t0 - caps[i].t1 < 0.25) caps[i].t1 = next.t0;
	}
	return caps;
};

export const CAPTIONS = buildCaptions();

export const CaptionBand: React.FC<{opacity?: number}> = ({opacity = 1}) => (
	<div
		style={{
			position: 'absolute',
			left: 0,
			right: 0,
			bottom: 0,
			height: 230,
			opacity,
			background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.28) 70%, rgba(0,0,0,0) 100%)',
			pointerEvents: 'none',
		}}
	/>
);

export const Captions: React.FC<{t: number; lift?: number}> = ({t, lift = 0}) => {
	const c = CAPTIONS.find((x) => t >= x.t0 && t < x.t1);
	if (!c) return null;
	if (c.speaker === 'W') {
		return (
			<div style={{position: 'absolute', left: 0, right: 0, bottom: 64 + lift, textAlign: 'center'}}>
				<span
					style={{
						fontFamily: 'Caveat',
						fontWeight: 700,
						fontSize: 54,
						color: '#FFA21A',
						textShadow: '0 0 18px rgba(255,162,26,0.45), 0 2px 6px rgba(0,0,0,0.9)',
					}}
				>
					{c.text}
				</span>
			</div>
		);
	}
	const words = c.text.split(' ');
	return (
		<div
			style={{
				position: 'absolute',
				left: 150,
				right: 150,
				bottom: 52 + lift,
				textAlign: 'center',
				fontFamily: 'Montserrat',
				fontWeight: 800,
				fontSize: 34,
				lineHeight: 1.18,
				letterSpacing: 0.6,
				color: '#F6F7F8',
				textShadow: '0 2px 3px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.75)',
			}}
		>
			{words.map((w, i) => {
				const col = c.emph?.[w];
				return (
					<span key={i} style={{color: col ?? undefined, textShadow: col ? `0 0 14px ${col}66, 0 2px 3px rgba(0,0,0,0.95)` : undefined}}>
						{w}
						{i < words.length - 1 ? ' ' : ''}
					</span>
				);
			})}
		</div>
	);
};
