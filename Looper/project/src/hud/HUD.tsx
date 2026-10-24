// HUD (section 6.8): label, Loop Ring with act pips, ATTEMPT and CHANGES readouts.
import React from 'react';
import {C, clamp, inv, easeOut, pop, smooth, noise1} from '../lib/anim';
import TL from '../timeline.json';
import {Mono} from '../fx/fonts';

const SEGS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};
// seven segment digit, h = digit height in px
export const Digit: React.FC<{d: string; h: number; color: string; dim?: string}> = ({d, h, color, dim = 'rgba(255,255,255,0.06)'}) => {
  const w = h * 0.56;
  const t = h * 0.11;
  const on = SEGS[d] ?? '';
  const seg = (k: string, x: number, y: number, horiz: boolean) => {
    const len = horiz ? w - t * 1.2 : h / 2 - t * 1.1;
    const pts = horiz
      ? `${x + t * 0.6},${y} ${x + t * 0.6 + t / 2},${y - t / 2} ${x + t * 0.6 + len - t / 2},${y - t / 2} ${x + t * 0.6 + len},${y} ${x + t * 0.6 + len - t / 2},${y + t / 2} ${x + t * 0.6 + t / 2},${y + t / 2}`
      : `${x},${y + t * 0.55} ${x + t / 2},${y + t * 0.55 + t / 2} ${x + t / 2},${y + t * 0.55 + len - t / 2} ${x},${y + t * 0.55 + len} ${x - t / 2},${y + t * 0.55 + len - t / 2} ${x - t / 2},${y + t * 0.55 + t / 2}`;
    return <polygon key={k} points={pts} fill={on.includes(k) ? color : dim} />;
  };
  return (
    <svg width={w + t} height={h + t} viewBox={`${-t / 2} ${-t / 2} ${w + t} ${h + t}`} style={{display: 'block', filter: `drop-shadow(0 0 ${h * 0.12}px ${color}88)`}}>
      {seg('a', 0, 0, true)}
      {seg('g', 0, h / 2, true)}
      {seg('d', 0, h, true)}
      {seg('f', t / 2, 0, false)}
      {seg('b', w - t / 2, 0, false)}
      {seg('e', t / 2, h / 2, false)}
      {seg('c', w - t / 2, h / 2, false)}
    </svg>
  );
};
export const Digits: React.FC<{value: string; h: number; color: string}> = ({value, h, color}) => (
  <div style={{display: 'flex', gap: h * 0.12}}>
    {value.split('').map((d, i) => (
      <Digit key={i} d={d} h={h} color={color} />
    ))}
  </div>
);

export function attemptAt(t: number): number {
  const k = TL.hud.attempts as [number, number][];
  if (t < k[0][0]) return 1;
  const [ra, rb] = TL.hud.race;
  if (t >= ra && t < rb) {
    const x = inv(ra, rb, t);
    return Math.round(5 + (214 - 5) * (1 - Math.pow(1 - x, 1.7)));
  }
  let v = 1;
  for (const [tt, val] of k) if (t >= tt) v = val;
  return v;
}

// the Loop Ring, reusable at any size
export const LoopRing: React.FC<{t: number; size: number; acts: number; dot: number; closed: number; glow?: number; drawn?: number; icon?: boolean}> = ({t, size, acts, dot, closed, glow = 1, drawn = 1, icon = true}) => {
  const r = size * 0.4;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const a = dot * Math.PI * 2 - Math.PI / 2;
  return (
    <svg width={size} height={size} style={{overflow: 'visible'}}>
      <defs>
        <filter id={`rg${size}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={size * 0.03} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#rg${size})`} opacity={glow}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(123,92,255,0.25)" strokeWidth={size * 0.035} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={C.violet} strokeWidth={size * 0.035} strokeDasharray={`${circ * drawn} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} strokeLinecap="round" />
        {closed > 0 ? (
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={C.gold} strokeWidth={size * 0.05} strokeDasharray={`${circ * closed} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} strokeLinecap="round" />
        ) : null}
        {Array.from({length: 7}).map((_, i) => {
          const pa = (i / 7) * Math.PI * 2 - Math.PI / 2;
          const on = i < acts;
          return (
            <circle key={i} cx={cx + Math.cos(pa) * r} cy={cx + Math.sin(pa) * r} r={size * (on ? 0.055 : 0.04)} fill={on ? (closed > 0.99 ? C.gold : C.teal) : '#1a1640'} stroke={on ? 'white' : C.violet} strokeWidth={size * 0.012} />
          );
        })}
        <circle cx={cx + Math.cos(a) * r} cy={cx + Math.sin(a) * r} r={size * 0.05} fill="white" />
        {/* chronometer icon */}
        {icon ? <>
        <circle cx={cx} cy={cx} r={r * 0.42} fill={closed > 0.99 ? C.gold : 'rgba(217,164,65,0.18)'} stroke={C.brass} strokeWidth={size * 0.025} />
        <rect x={cx - size * 0.02} y={cx - r * 0.42 - size * 0.07} width={size * 0.04} height={size * 0.06} fill={C.brass} />
        <line x1={cx} y1={cx} x2={cx + Math.cos(t * 2) * r * 0.3} y2={cx + Math.sin(t * 2) * r * 0.3} stroke={closed > 0.99 ? '#3a2400' : C.brass} strokeWidth={size * 0.02} strokeLinecap="round" />
        </> : null}
      </g>
    </svg>
  );
};

export const HUD: React.FC<{t: number}> = ({t}) => {
  const H = TL.hud;
  if (t < H.teaser || t >= H.off) return null;
  const wake = smooth(inv(H.wake, H.wake + 0.35, t));
  const quietA = H.quiet[0];
  const quietB = H.quiet[1];
  const quiet = t >= quietA && t < quietB ? 1 - smooth(inv(quietA, quietA + 0.6, t)) * 0.92 : 1;
  const acts = H.acts.filter((a: number) => t >= a).length;
  const dot = clamp(t / TL.duration);
  const closed = smooth(inv(H.loopClosed, H.loopClosed + 1.4, t));
  const teaserOnly = t < H.wake;
  if (teaserOnly) {
    // the big ring in the promise shot flies here at the end of that shot
    return null;
  }
  const att = attemptAt(t);
  const is215 = att >= 215;
  const failK = H.fails.reduce((m: number, f: number) => (t >= f && t < f + 0.45 ? Math.max(m, 1 - (t - f) / 0.45) : m), 0);
  const raceFlash = t >= H.race[0] && t < H.race[1] ? (Math.floor(t * 12) % 2 === 0 ? 0.6 : 0) : 0;
  const coral = Math.max(failK, raceFlash);
  const shake = coral > 0 ? noise1(t * 60, 2) * 3 * coral : 0;
  const slam = H.attempts.reduce((m: number, a: number[]) => (t >= a[0] && t < a[0] + 0.25 ? 1 - (t - a[0]) / 0.25 : m), 0);
  const lc = smooth(inv(H.loopClosed, H.loopClosed + 0.5, t));
  const op = wake * quiet;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 120, opacity: Math.max(op, lc), background: 'linear-gradient(to bottom, rgba(4,3,14,0.55) 0%, rgba(4,3,14,0.3) 55%, rgba(4,3,14,0) 100%)'}} />
      <div style={{position: 'absolute', left: 34, top: 26, opacity: op * 0.9}}>
        <Mono size={13} color="#9aa0c8" spacing={4}>
          LOOPHOLE // TIMELINE LOG
        </Mono>
      </div>
      <div style={{position: 'absolute', left: 640 - 41, top: 12, opacity: Math.max(op, lc)}}>
        <LoopRing t={t} size={82} acts={acts} dot={dot} closed={closed} />
      </div>
      <div style={{position: 'absolute', right: 34, top: 20, opacity: op * (1 - lc), transform: `translateX(${shake}px)`, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, transform: `scale(${1 + slam * 0.12})`, transformOrigin: 'right center'}}>
          <Mono size={14} color="#c9cdf0" spacing={3}>
            ATTEMPT
          </Mono>
          <Digits value={String(Math.min(att, 999)).padStart(3, '0')} h={32} color={is215 ? C.cyan : C.white} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <Mono size={14} color={coral > 0.2 ? C.coral : '#c9cdf0'} spacing={3}>
            CHANGES
          </Mono>
          <Digits value="0" h={32} color={coral > 0.2 ? C.coral : C.teal} />
        </div>
      </div>
      {lc > 0 ? (
        <div style={{position: 'absolute', right: 34, top: 34, opacity: lc * (t < H.off - 0.3 ? 1 : 0), transform: `scale(${0.9 + pop(inv(H.loopClosed, H.loopClosed + 0.3, t)) * 0.1})`, transformOrigin: 'right center'}}>
          <Mono size={30} color={C.gold} spacing={5} weight={800} glow>
            LOOP CLOSED
          </Mono>
        </div>
      ) : null}
    </div>
  );
};
export const easeOutHud = easeOut;
