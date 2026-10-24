import React from 'react';
import {TL} from '../events';

// Surveillance HUD in our own language: label top left, four pips plus a camera
// icon top centre, the PHOTOGRAPHER meter top right (seven segment digits, 38 px).

const SEG: Record<string, number[]> = {
	'0': [1, 1, 1, 1, 1, 1, 0],
	'1': [0, 1, 1, 0, 0, 0, 0],
	'2': [1, 1, 0, 1, 1, 0, 1],
	'3': [1, 1, 1, 1, 0, 0, 1],
	'4': [0, 1, 1, 0, 0, 1, 1],
	'5': [1, 0, 1, 1, 0, 1, 1],
	'6': [1, 0, 1, 1, 1, 1, 1],
	'7': [1, 1, 1, 0, 0, 0, 0],
	'8': [1, 1, 1, 1, 1, 1, 1],
	'9': [1, 1, 1, 1, 0, 1, 1],
	' ': [0, 0, 0, 0, 0, 0, 0],
};

// segment polygons in a 20 x 38 cell, slight italic skew applied on the group
const segPaths = (w: number, h: number, t: number) => {
	const g = 1.2;
	const m = h / 2;
	const hz = (y: number) => `M${t / 2 + g},${y} L${t + g},${y - t / 2} L${w - t - g},${y - t / 2} L${w - t / 2 - g},${y} L${w - t - g},${y + t / 2} L${t + g},${y + t / 2} Z`;
	const vt = (x: number, y0: number, y1: number) => `M${x},${y0 + g} L${x + t / 2},${y0 + t / 2 + g} L${x + t / 2},${y1 - t / 2 - g} L${x},${y1 - g} L${x - t / 2},${y1 - t / 2 - g} L${x - t / 2},${y0 + t / 2 + g} Z`;
	return [
		hz(t / 2), // a
		vt(w - t / 2, t / 2, m), // b
		vt(w - t / 2, m, h - t / 2), // c
		hz(h - t / 2), // d
		vt(t / 2, m, h - t / 2), // e
		vt(t / 2, t / 2, m), // f
		hz(m), // g
	];
};

const Digit: React.FC<{ch: string; x: number; color: string; h?: number}> = ({ch, x, color, h = 38}) => {
	const w = h * 0.55;
	const paths = segPaths(w, h, h * 0.13);
	const on = SEG[ch] ?? SEG[' '];
	return (
		<g transform={`translate(${x},0) skewX(-6)`}>
			{paths.map((d, i) => (
				<path key={i} d={d} fill={color} opacity={on[i] ? 1 : 0.07} />
			))}
		</g>
	);
};

const SevenSeg: React.FC<{text: string; color: string; h?: number}> = ({text, color, h = 38}) => {
	// text may contain digits, spaces, '.', '+'
	const w = h * 0.55;
	const gap = h * 0.2;
	let x = 0;
	const items: React.ReactNode[] = [];
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '.') {
			items.push(<rect key={i} x={x - gap * 0.2} y={h - h * 0.17} width={h * 0.17} height={h * 0.17} fill={color} />);
			x += h * 0.2;
			continue;
		}
		if (c === '+') {
			const s = h * 0.13;
			items.push(
				<g key={i} transform={`translate(${x},0)`}>
					<rect x={w * 0.15} y={h / 2 - s / 2} width={w * 0.7} height={s} fill={color} />
					<rect x={w / 2 - s / 2} y={h / 2 - w * 0.35} width={s} height={w * 0.7} fill={color} />
				</g>,
			);
			x += w * 0.85 + gap;
			continue;
		}
		items.push(<Digit key={i} ch={c} x={x} color={color} h={h} />);
		x += w + gap;
	}
	return (
		<svg width={x} height={h} style={{overflow: 'visible', filter: `drop-shadow(0 0 6px ${color}88)`}}>
			{items}
		</svg>
	);
};

type MeterKey = (typeof TL.meter)[number];

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));

export const meterAt = (t: number) => {
	const keys = TL.meter as MeterKey[];
	let k = keys[0];
	let prev: MeterKey | null = null;
	for (const kk of keys) {
		if (kk.t <= t) {
			prev = k;
			k = kk;
		}
	}
	return {k, prev, since: t - k.t};
};

const fmtM = (v: number) => (v >= 10 ? String(Math.round(v)).padStart(3, ' ') : v >= 1 ? v.toFixed(1).padStart(4, ' ') : v.toFixed(1).padStart(4, ' '));

const colorFor = (d: number) => (d > 30 ? '#F4F6F8' : d > 4 ? '#FFA21A' : d > 1 ? '#FFA21A' : '#FF2B2B');

export const Meter: React.FC<{t: number; frame: number}> = ({t, frame}) => {
	const {k, prev, since} = meterAt(t);
	if (k.kind === 'hidden') return null;
	let label = 'PHOTOGRAPHER';
	let text = '';
	let unit = 'm';
	let color = '#F4F6F8';
	let bar = 1;
	let opacity = 1;
	if (k.kind === 'm') {
		const from = prev && prev.kind === 'm' ? (prev as {value: number}).value : (k as {value: number}).value;
		const to = (k as {value: number}).value;
		const p = ease(since / 0.55);
		// rolling: log interpolation, digits flicker through values
		const v = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * p);
		text = fmtM(p < 1 ? v : to);
		color = colorFor(v);
		bar = Math.log(1 + v) / Math.log(41);
	} else if (k.kind === 'days') {
		label = 'TAKEN IN';
		unit = 'DAYS';
		color = '#FF2B2B';
		const p = ease(since / 0.35);
		const v = Math.round(412 * p);
		text = '+' + String(v).padStart(3, '0');
		bar = 1;
	} else if (k.kind === 'count') {
		const kk = k as {from: number; to: number; until: number; t: number};
		label = 'TAKEN IN';
		unit = 'DAYS';
		const p = Math.min(1, Math.max(0, (t - kk.t) / (kk.until - kk.t)));
		const e = kk.to === 0 ? 1 - Math.pow(1 - p, 2.2) : p;
		const v = Math.round(kk.from + (kk.to - kk.from) * e);
		text = String(v).padStart(3, '0');
		color = v === 0 ? '#5CF2E6' : '#FFA21A';
		bar = v / 412;
	} else if (k.kind === 'fade') {
		label = 'TAKEN';
		unit = 'DAYS';
		text = '000';
		color = '#5CF2E6';
		bar = 0;
		opacity = Math.max(0, 1 - since / 2.5);
	}
	// punch in on "check the corner"
	let punch = 0;
	for (const pt of TL.punches) {
		const d = t - pt;
		if (d >= -0.05 && d < 1.4) punch = Math.max(punch, d < 0.15 ? d / 0.15 : Math.max(0, 1 - (d - 0.15) / 1.2));
	}
	const scale = 1 + 0.22 * punch;
	const ringT = TL.punches.map((pt) => t - pt).find((d) => d >= 0 && d < 0.9);
	return (
		<div
			style={{
				position: 'absolute',
				right: 26,
				top: 18,
				transformOrigin: 'top right',
				transform: `scale(${scale})`,
				opacity,
			}}
		>
			<div
				style={{
					position: 'relative',
					padding: '8px 14px 10px 14px',
					borderRadius: 8,
					border: `1.5px solid ${color}66`,
					background: 'rgba(6,8,11,0.72)',
					boxShadow: `0 0 ${14 + 30 * punch}px ${color}${punch > 0 ? '55' : '22'}`,
					minWidth: 214,
				}}
			>
				<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 11, letterSpacing: 2.2, color: '#9aa6b4', marginBottom: 5}}>
					{label}
				</div>
				<div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8}}>
					<SevenSeg text={text} color={color} />
					<div style={{fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: unit === 'm' ? 22 : 15, color, marginBottom: 1, minWidth: unit === 'm' ? 16 : 40}}>{unit}</div>
				</div>
				<div style={{marginTop: 7, height: 3, background: '#ffffff14', borderRadius: 2}}>
					<div style={{width: `${Math.max(0, Math.min(1, bar)) * 100}%`, height: 3, background: color, borderRadius: 2, boxShadow: `0 0 6px ${color}`}} />
				</div>
				{ringT !== undefined ? (
					<div
						style={{
							position: 'absolute',
							inset: -8 - ringT * 40,
							borderRadius: 12 + ringT * 30,
							border: `2px solid ${color}`,
							opacity: Math.max(0, 1 - ringT / 0.9),
						}}
					/>
				) : null}
			</div>
		</div>
	);
};

const Pips: React.FC<{t: number}> = ({t}) => {
	const lit = TL.pips.map((p) => t >= p);
	const camOn = t >= TL.camera_icon;
	return (
		<div style={{position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 7, alignItems: 'center'}}>
			{lit.map((on, i) => {
				const since = t - TL.pips[i];
				const pulse = since >= 0 && since < 0.6 ? 1 - since / 0.6 : 0;
				return (
					<div
						key={i}
						style={{
							width: 13,
							height: 13,
							borderRadius: 2,
							border: '1.5px solid #c9d1da',
							background: on ? '#F4F6F8' : 'transparent',
							boxShadow: pulse ? `0 0 ${12 * pulse}px #ffffffcc` : 'none',
							transform: `scale(${1 + 0.4 * pulse})`,
						}}
					/>
				);
			})}
			<svg width={22} height={16} viewBox="0 0 22 16" style={{marginLeft: 4, filter: camOn ? 'drop-shadow(0 0 5px #5CF2E6)' : 'none'}}>
				<rect x={1} y={4} width={20} height={11} rx={2} fill={camOn ? '#5CF2E6' : 'none'} stroke={camOn ? '#5CF2E6' : '#c9d1da'} strokeWidth={1.5} />
				<rect x={6} y={1} width={7} height={4} rx={1} fill={camOn ? '#5CF2E6' : 'none'} stroke={camOn ? '#5CF2E6' : '#c9d1da'} strokeWidth={1.5} />
				<circle cx={11} cy={9.5} r={3.2} fill={camOn ? '#06080B' : 'none'} stroke={camOn ? '#06080B' : '#c9d1da'} strokeWidth={1.5} />
			</svg>
		</div>
	);
};

export const HUD: React.FC<{t: number; frame: number; hideMeter?: boolean; opacity?: number}> = ({t, frame, hideMeter, opacity = 1}) => (
	<div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
		<div
			style={{
				position: 'absolute',
				top: 24,
				left: 28,
				fontFamily: 'JetBrains Mono',
				fontWeight: 500,
				fontSize: 12,
				letterSpacing: 2.6,
				color: '#8f9aa7',
			}}
		>
			BUILDING NOTICE 003 // MANAGEMENT
		</div>
		<Pips t={t} />
		{hideMeter ? null : <Meter t={t} frame={frame} />}
	</div>
);

export {SevenSeg};
