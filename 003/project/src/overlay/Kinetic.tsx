import React from 'react';
import {clamp01, pop} from '../shots/types';

// Kinetic type: one big word or phrase, pop in with overshoot, hard cut out,
// optional glitch on entry (slice displacement and RGB split, 4 to 8 frames).

export type KItem = {
	text: string;
	t0: number;
	t1: number;
	size?: number;
	color?: string;
	y?: number; // px from top for the centre line
	weight?: number;
	font?: string;
	glitch?: boolean;
	sub?: string; // small mono line above
	subColor?: string;
	ls?: number;
};

const rnd = (i: number) => {
	const x = Math.sin(i * 91.7) * 43758.5453;
	return x - Math.floor(x);
};

export const Kinetic: React.FC<{t: number; items: KItem[]; frame: number}> = ({t, items, frame}) => {
	return (
		<>
			{items
				.filter((k) => t >= k.t0 && t < k.t1)
				.map((k, i) => {
					const since = t - k.t0;
					const s = pop(since);
					const g = k.glitch && since < 0.2 ? 1 - since / 0.2 : 0;
					const color = k.color ?? '#F4F6F8';
					const style: React.CSSProperties = {
						fontFamily: k.font ?? 'Montserrat',
						fontWeight: k.weight ?? 800,
						fontSize: k.size ?? 92,
						letterSpacing: k.ls ?? 1,
						color,
						lineHeight: 1.0,
						whiteSpace: 'pre',
						textAlign: 'center',
						textShadow: `0 0 26px ${color}55, 0 3px 6px rgba(0,0,0,0.8)`,
					};
					const slices = g > 0 ? [0, 1, 2, 3, 4, 5] : [];
					return (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: 0,
								right: 0,
								top: (k.y ?? 330) - (k.size ?? 92) / 2,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								transform: `scale(${s})`,
							}}
						>
							{k.sub ? (
								<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 15, letterSpacing: 4, color: k.subColor ?? '#8f9aa7', marginBottom: 14}}>{k.sub}</div>
							) : null}
							<div style={{position: 'relative'}}>
								{g > 0 ? (
									<>
										<div style={{...style, position: 'absolute', left: -5 * g, top: 0, color: '#ff2b2b', opacity: 0.7, textShadow: 'none', mixBlendMode: 'screen'}}>{k.text}</div>
										<div style={{...style, position: 'absolute', left: 5 * g, top: 0, color: '#5CF2E6', opacity: 0.7, textShadow: 'none', mixBlendMode: 'screen'}}>{k.text}</div>
									</>
								) : null}
								{g > 0 ? (
									slices.map((j) => {
										const top = j / slices.length;
										const bot = (j + 1) / slices.length;
										const dx = (rnd(frame * 7 + j) - 0.5) * 2 * (6 + 8 * rnd(j + frame)) * g;
										return (
											<div
												key={j}
												style={{
													...style,
													position: j === 0 ? 'relative' : 'absolute',
													left: dx,
													top: 0,
													clipPath: `inset(${top * 100}% 0 ${(1 - bot) * 100}% 0)`,
												}}
											>
												{k.text}
											</div>
										);
									})
								) : (
									<div style={style}>{k.text}</div>
								)}
							</div>
						</div>
					);
				})}
		</>
	);
};

// Section title card, our own design: thin frame, mono header, big title, amber rule
export const TitleCard: React.FC<{t: number; t0: number; t1: number; n: number; title: string; frame: number}> = ({t, t0, t1, n, title, frame}) => {
	if (t < t0 || t >= t1) return null;
	const since = t - t0;
	const s = pop(since);
	const rule = clamp01((since - 0.15) / 0.5);
	const g = since < 0.15 ? 1 - since / 0.15 : 0;
	const jitter = g > 0 ? (rnd(frame) - 0.5) * 14 * g : 0;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
			<div
				style={{
					transform: `translateX(${jitter}px) scale(${s})`,
					border: '2px solid rgba(244,246,248,0.85)',
					borderRadius: 10,
					padding: '22px 46px 26px 46px',
					background: 'rgba(6,8,11,0.82)',
					boxShadow: '0 0 40px rgba(0,0,0,0.6)',
					textAlign: 'center',
					minWidth: 520,
				}}
			>
				<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 14, letterSpacing: 5, color: '#9aa6b4'}}>
					THING {n} OF 4
				</div>
				<div style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: 46, letterSpacing: 1, color: '#F4F6F8', marginTop: 10, whiteSpace: 'nowrap'}}>{title}</div>
				<div style={{height: 3, marginTop: 14, background: '#FFA21A', width: `${rule * 100}%`, marginLeft: 'auto', marginRight: 'auto', boxShadow: '0 0 10px #FFA21A'}} />
				<div style={{display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14}}>
					{[1, 2, 3, 4].map((i) => (
						<div key={i} style={{width: 9, height: 9, borderRadius: 2, border: '1.5px solid #c9d1da', background: i <= n ? '#F4F6F8' : 'transparent'}} />
					))}
				</div>
			</div>
		</div>
	);
};

export const EndCard: React.FC<{t: number; t0: number}> = ({t, t0}) => {
	if (t < t0) return null;
	const since = t - t0;
	const a = clamp01(since / 0.2);
	const blink = Math.floor(since * 2) % 2 === 0;
	return (
		<div style={{position: 'absolute', inset: 0, background: '#06080B', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: a}}>
			<div style={{textAlign: 'center'}}>
				<div style={{fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 30, letterSpacing: 6, color: '#F4F6F8'}}>
					NOTICE 004 <span style={{color: '#5a6573'}}>//</span> PENDING{blink ? <span style={{color: '#FFA21A'}}> _</span> : <span style={{opacity: 0}}> _</span>}
				</div>
				<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 13, letterSpacing: 4, color: '#6b7684', marginTop: 16}}>MANAGEMENT REGRETS</div>
			</div>
		</div>
	);
};
