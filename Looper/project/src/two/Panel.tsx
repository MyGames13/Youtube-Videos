// Shared 2D panel helpers: a slow camera, comic border, flat props.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, lerp, inv, easeOut, pop, clamp} from '../lib/anim';
import {MONT, MONO} from '../fx/fonts';

export const Panel: React.FC<{bg: string; t: number; dur: number; push?: number; cx?: number; cy?: number; border?: boolean; tilt?: number; children: React.ReactNode; bg2?: string}> = ({bg, bg2, t, dur, push = 0.05, cx = 640, cy = 360, border = true, tilt = -0.6, children}) => {
  const s = 1 + push * clamp(t / Math.max(dur, 0.1));
  return (
    <AbsoluteFill style={{background: C.base}}>
      <div style={{position: 'absolute', inset: border ? 22 : 0, borderRadius: border ? 22 : 0, overflow: 'hidden', transform: `rotate(${border ? tilt : 0}deg)`, boxShadow: border ? '0 0 0 5px rgba(244,246,248,0.85), 0 0 50px rgba(123,92,255,0.35)' : undefined, background: bg2 ? `linear-gradient(180deg, ${bg} 0%, ${bg2} 100%)` : bg}}>
        <svg viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{display: 'block'}}>
          <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>{children}</g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// kinetic word: slams in with overshoot
export const Slam: React.FC<{t: number; at: number; x: number; y: number; size: number; color?: string; text: string; out?: number; anchor?: 'middle' | 'start' | 'end'; glow?: string; rot?: number; font?: 'heavy' | 'mono'}> = ({t, at, x, y, size, color = C.white, text, out, anchor = 'middle', glow, rot = 0, font = 'heavy'}) => {
  if (t < at || (out !== undefined && t > out)) return null;
  const k = inv(at, at + 0.22, t);
  const sc = lerp(1.6, 1, easeOut(k)) * (k < 1 ? 1 : 1 + 0.015 * Math.sin((t - at) * 3));
  const o = clamp(k * 3);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc})`} opacity={o} style={glow ? {filter: `drop-shadow(0 0 ${size * 0.18}px ${glow})`} : undefined}>
      <text x={0} y={size * 0.35} textAnchor={anchor} fontFamily={font === 'mono' ? `${MONO}, monospace` : `${MONT}, sans-serif`} fontWeight={900} fontSize={size} fill={color} letterSpacing={font === 'mono' ? 3 : 1} stroke="#07061A" strokeWidth={size * 0.04} paintOrder="stroke">
        {text}
      </text>
    </g>
  );
};

// pop in scale for an element group
export const Pop: React.FC<{t: number; at: number; x: number; y: number; children: React.ReactNode; out?: number}> = ({t, at, x, y, children, out}) => {
  if (t < at) return null;
  const o = out !== undefined ? 1 - clamp((t - out) / 0.2) : 1;
  if (o <= 0) return null;
  const s = 0.9 + 0.1 * pop(inv(at, at + 0.24, t));
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`} opacity={clamp((t - at) * 8) * o}>
      {children}
    </g>
  );
};

export const XPunch: React.FC<{t: number; at: number; x?: number; y?: number; size?: number}> = ({t, at, x = 640, y = 330, size = 200}) => {
  if (t < at || t > at + 0.6) return null;
  const k = inv(at, at + 0.12, t);
  const s = lerp(1.8, 1, easeOut(k));
  const o = 1 - inv(at + 0.35, at + 0.6, t);
  const d = size / 2;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${-8 + k * 8})`} opacity={o} style={{filter: `drop-shadow(0 0 18px ${C.coral})`}}>
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={C.coral} strokeWidth={size * 0.16} strokeLinecap="round" />
      <line x1={d} y1={-d} x2={-d} y2={d} stroke={C.coral} strokeWidth={size * 0.16} strokeLinecap="round" />
    </g>
  );
};

export const ClockFace: React.FC<{x: number; y: number; r: number; h: number; m: number; s?: number; color?: string; face?: string}> = ({x, y, r, h, m, s, color = '#101018', face = '#FFF4DA'}) => {
  const ma = (m / 60) * 360;
  const ha = ((h % 12) / 12) * 360 + m * 0.5;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r * 1.1} fill="#3a2a1a" />
      <circle r={r} fill={face} />
      {Array.from({length: 12}).map((_, i) => (
        <line key={i} x1={0} y1={-r * 0.82} x2={0} y2={-r * (i % 3 === 0 ? 0.66 : 0.74)} stroke={color} strokeWidth={r * 0.06} transform={`rotate(${i * 30})`} />
      ))}
      <line x1={0} y1={0} x2={0} y2={-r * 0.5} stroke={color} strokeWidth={r * 0.1} strokeLinecap="round" transform={`rotate(${ha})`} />
      <line x1={0} y1={0} x2={0} y2={-r * 0.75} stroke={color} strokeWidth={r * 0.07} strokeLinecap="round" transform={`rotate(${ma})`} />
      {s !== undefined ? <line x1={0} y1={r * 0.15} x2={0} y2={-r * 0.8} stroke={C.coral} strokeWidth={r * 0.03} transform={`rotate(${s * 6})`} /> : null}
      <circle r={r * 0.07} fill={color} />
    </g>
  );
};

export const PhoneFlat: React.FC<{x: number; y: number; w: number; state: 'off' | 'ring' | 'down' | 'missed' | 'call'; t: number; label?: string; rot?: number}> = ({x, y, w, state, t, label = 'GRAN', rot = 0}) => {
  const h = w * 2;
  const buzz = state === 'ring' ? Math.sin(t * 70) * w * 0.04 : 0;
  return (
    <g transform={`translate(${x + buzz} ${y}) rotate(${rot})`}>
      {state === 'ring' || state === 'call' ? <circle r={w * 1.4} fill={C.teal} opacity={0.12 + 0.06 * Math.sin(t * 8)} /> : null}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.16} fill={state === 'down' ? '#2a2a3a' : '#15152a'} stroke="#F4F6F8" strokeWidth={w * 0.05} />
      {state === 'ring' || state === 'call' || state === 'missed' ? (
        <>
          <rect x={-w * 0.42} y={-h * 0.44} width={w * 0.84} height={h * 0.88} rx={w * 0.1} fill={state === 'missed' ? '#2b1030' : '#123a4a'} />
          <text x={0} y={-h * 0.16} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontSize={w * 0.13} fill="#bfefff" fontWeight={800}>
            {state === 'missed' ? 'MISSED' : state === 'call' ? 'CALLING' : 'INCOMING'}
          </text>
          <text x={0} y={h * 0.02} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontSize={w * 0.24} fill="#F4F6F8" fontWeight={900}>
            {label}
          </text>
          {state !== 'missed' ? (
            <>
              <circle cx={-w * 0.2} cy={h * 0.3} r={w * 0.1} fill="#e5484d" />
              <circle cx={w * 0.2} cy={h * 0.3} r={w * 0.1} fill="#2ec27e" />
            </>
          ) : null}
        </>
      ) : null}
      {state === 'ring'
        ? [0, 1].map((i) => (
            <g key={i} opacity={0.8}>
              <path d={`M ${w * 0.7 + i * w * 0.18} ${-h * 0.2} q ${w * 0.15} ${h * 0.2} 0 ${h * 0.4}`} fill="none" stroke={C.teal} strokeWidth={w * 0.05} strokeLinecap="round" />
              <path d={`M ${-w * 0.7 - i * w * 0.18} ${-h * 0.2} q ${-w * 0.15} ${h * 0.2} 0 ${h * 0.4}`} fill="none" stroke={C.teal} strokeWidth={w * 0.05} strokeLinecap="round" />
            </g>
          ))
        : null}
    </g>
  );
};

export const Bubble: React.FC<{x: number; y: number; w: number; h: number; tail: [number, number]; color?: string; stroke?: string; children: React.ReactNode}> = ({x, y, w, h, tail, color = '#F4F6F8', stroke = '#07061A', children}) => (
  <g>
    <path d={`M ${x + w * 0.3} ${y + h} L ${tail[0]} ${tail[1]} L ${x + w * 0.5} ${y + h} Z`} fill={color} stroke={stroke} strokeWidth={3} />
    <rect x={x} y={y} width={w} height={h} rx={h * 0.35} fill={color} stroke={stroke} strokeWidth={3} />
    <rect x={x + w * 0.28} y={y + h - 4} width={w * 0.25} height={8} fill={color} />
    {children}
  </g>
);

export const Rain: React.FC<{t: number; n?: number; color?: string}> = ({t, n = 80, color = '#9fb2ff'}) => (
  <g opacity={0.5}>
    {Array.from({length: n}).map((_, i) => {
      const x = ((i * 137.5) % 1300) - 10;
      const sp = 900 + (i % 7) * 60;
      const y = ((t * sp + i * 97) % 800) - 40;
      return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 26} stroke={color} strokeWidth={2} strokeLinecap="round" />;
    })}
  </g>
);

export const Stars: React.FC<{t: number; n?: number; drift?: number}> = ({t, n = 90, drift = 4}) => (
  <g>
    {Array.from({length: n}).map((_, i) => {
      const x = (i * 211.7) % 1280;
      const y = (i * 97.3) % 720;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i));
      return <circle key={i} cx={(x + t * drift * ((i % 3) + 1)) % 1280} cy={y} r={(i % 4) * 0.4 + 0.6} fill="#e8ecff" opacity={tw * 0.8} />;
    })}
  </g>
);
