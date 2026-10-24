// The flat 2D panels: memories, comic call, blackboard, film strip, kinetic cards, branches.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, V3, lerp, inv, clamp, easeOut, easeInOut, smooth, pop, noise1, hash} from '../lib/anim';
import {stand, sit, walk, mixPose, Pose, HIP_Y, SEG} from '../lib/rig';
import {Stick2D, NameTag} from './Stick2D';
import {Panel, Slam, Pop, XPunch, ClockFace, PhoneFlat, Bubble, Rain, Stars} from './Panel';
import {MONT, MONO, Heavy, Mono} from '../fx/fonts';
import {LoopRing, Digits} from '../hud/HUD';
import type {ShotProps} from '../scenes';

const g = (m: Record<string, number>, k: string, d = 0) => (m[k] !== undefined ? m[k] : d);

// ---------- Act 1: the call, eleven years ago ----------
export const MemCall: React.FC<ShotProps> = ({t, dur, m}) => {
  const tHouse = g(m, 'b1.6', 5.5) - 0.12;
  const ring = t >= g(m, 'b1.4', 2.3) - 0.1;
  const flipAt = g(m, 'b1.5', 3.6) + 1.0;
  const flip = smooth(inv(flipAt, flipAt + 0.45, t));
  if (t >= tHouse) {
    const k = t - tHouse;
    const off = k > 0.55;
    const dawn = smooth(inv(0.6, 2.2, k));
    return (
      <Panel bg={off ? '#151b3a' : '#0e1030'} bg2={`rgb(${lerp(20, 70, dawn)},${lerp(18, 60, dawn)},${lerp(48, 96, dawn)})`} t={k} dur={dur - tHouse} push={0.06} cy={420}>
        <Stars t={t} n={50} drift={1} />
        <circle cx={1040} cy={lerp(160, 120, dawn)} r={44} fill="#e9e6ff" opacity={0.25 * (1 - dawn) + 0.05} />
        <rect x={0} y={560} width={1280} height={160} fill="#0b0a22" />
        <g transform="translate(470 300)">
          <polygon points="0,140 170,20 340,140" fill="#2a2150" stroke="#F4F6F8" strokeWidth={4} />
          <rect x={30} y={140} width={280} height={160} fill="#221a44" stroke="#F4F6F8" strokeWidth={4} />
          <rect x={210} y={60} width={34} height={60} fill="#221a44" stroke="#F4F6F8" strokeWidth={4} />
          <rect x={70} y={180} width={80} height={70} fill={off ? '#1a1740' : C.gold} stroke="#F4F6F8" strokeWidth={4} />
          {!off ? <rect x={40} y={150} width={140} height={130} fill={C.gold} opacity={0.18} /> : null}
          <line x1={110} y1={180} x2={110} y2={250} stroke="#F4F6F8" strokeWidth={3} />
          <rect x={200} y={210} width={60} height={90} fill="#3a2e6e" stroke="#F4F6F8" strokeWidth={4} />
        </g>
        <g opacity={0.6}>
          {Array.from({length: 6}).map((_, i) => (
            <circle key={i} cx={(i * 230 + k * 20) % 1280} cy={600 + (i % 2) * 30} r={60 + (i % 3) * 20} fill="#151236" />
          ))}
        </g>
      </Panel>
    );
  }
  // inside the flat, 9:14 at night
  const typing = Math.sin(t * 26) * 0.012;
  let pose: Pose = sit(t);
  const reach = t < flipAt ? smooth(inv(flipAt - 0.5, flipAt, t)) : 1 - smooth(inv(flipAt + 0.5, flipAt + 0.9, t));
  pose = {...pose, handR: [-0.1, 0.83 + typing, 0.52], handL: [0.1, lerp(0.83 - typing, 0.8, reach), lerp(0.52, 0.86, reach)], headPitch: lerp(0.15, 0.05, reach), lean: 0.12, mouth: 0};
  const zoom = smooth(inv(g(m, 'b1.4', 2.3) - 0.2, g(m, 'b1.4', 2.3) + 1.2, t));
  return (
    <Panel bg="#101a40" bg2="#1c1446" t={t} dur={dur} push={0.04} cx={lerp(640, 760, zoom)} cy={lerp(360, 430, zoom)}>
      <g transform={`translate(${-zoom * 80} ${-zoom * 40 - 70}) scale(${1 + zoom * 0.18})`}>
        {/* window with night city */}
        <rect x={120} y={90} width={360} height={260} fill="#0a0d2a" stroke="#F4F6F8" strokeWidth={5} />
        {Array.from({length: 9}).map((_, i) => (
          <rect key={i} x={140 + i * 38} y={350 - 60 - (i % 4) * 35} width={30} height={60 + (i % 4) * 35} fill="#1a1d48" />
        ))}
        {Array.from({length: 14}).map((_, i) => (
          <rect key={i} x={148 + (i * 23) % 320} y={300 - (i % 5) * 22} width={6} height={8} fill={C.gold} opacity={0.5 + 0.5 * Math.sin(i + t)} />
        ))}
        <line x1={300} y1={90} x2={300} y2={350} stroke="#F4F6F8" strokeWidth={4} />
        <ClockFace x={620} y={170} r={52} h={9} m={14} s={Math.floor(t)} />
        {/* desk and laptop */}
        <rect x={640} y={505} width={520} height={18} fill="#3d3270" stroke="#F4F6F8" strokeWidth={3} />
        <rect x={660} y={523} width={14} height={140} fill="#3d3270" />
        <rect x={1120} y={523} width={14} height={140} fill="#3d3270" />
        <polygon points="880,505 1060,505 1040,500 900,500" fill="#9aa3c8" />
        <polygon points="900,500 1040,500 1060,370 920,370" fill="#1b2a52" stroke="#9aa3c8" strokeWidth={4} />
        <polygon points="912,490 1032,490 1048,382 928,382" fill={C.cyan} opacity={0.75 + 0.1 * Math.sin(t * 3)} />
        <ellipse cx={980} cy={430} rx={170} ry={120} fill={C.cyan} opacity={0.08} />
        {/* phone on the desk */}
        <g transform={`translate(780 ${495 - flip * 0})`}>
          <g transform={`scale(1 ${lerp(1, -1, flip) * 0.35 + (flip > 0.5 ? -0.0 : 0)})`}>
            <PhoneFlat x={0} y={0} w={46} state={flip > 0.5 ? 'down' : ring ? 'ring' : 'off'} t={t} />
          </g>
        </g>
        {/* chair */}
        <rect x={560} y={560} width={120} height={14} fill="#5a3a26" />
        <rect x={562} y={440} width={14} height={130} fill="#5a3a26" />
        <rect x={570} y={574} width={10} height={90} fill="#5a3a26" />
        <rect x={664} y={574} width={10} height={90} fill="#5a3a26" />
        <Stick2D pose={pose} x={615} y={662} s={175} view="side" wear="young" />
      </g>
      <g opacity={clamp(t * 3)}>
        <rect x={40} y={36} width={320} height={44} rx={8} fill="#07061A" opacity={0.75} />
        <text x={58} y={66} fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={20} fill={C.teal} letterSpacing={3}>
          11 YEARS AGO
        </text>
        <text x={258} y={66} fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={20} fill={C.gold} letterSpacing={2}>
          9:14
        </text>
      </g>
    </Panel>
  );
};

export const MemFuneral: React.FC<ShotProps> = ({t, dur, m}) => {
  const say = g(m, 'b1.8', 2.4);
  const who = g(m, 'b1.9', 5.6);
  const p: Pose = {...stand(t), handR: [-0.22, 1.25, 0.15], handL: [0.16, 0.86, 0.05], headPitch: 0.05, mouth: t > say && t < who ? (Math.sin(t * 14) > 0 ? 0.0 : -0.4) : 0};
  return (
    <Panel bg="#1b1a3a" bg2="#2a2a48" t={t} dur={dur} push={0.06} cx={520} cy={340}>
      {/* grey violet rain, a garden gate, umbrellas */}
      <rect x={0} y={520} width={1280} height={200} fill="#16152e" />
      {Array.from({length: 12}).map((_, i) => (
        <rect key={i} x={80 + i * 45} y={420} width={10} height={110} fill="#3a3866" />
      ))}
      <rect x={80} y={430} width={540} height={10} fill="#3a3866" />
      <rect x={80} y={480} width={540} height={10} fill="#3a3866" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${880 + i * 120} ${380 + (i % 2) * 20})`} opacity={0.6}>
          <path d="M -70 0 Q 0 -70 70 0 Z" fill="#2a2850" stroke="#5d5a8a" strokeWidth={3} />
          <line x1={0} y1={0} x2={0} y2={150} stroke="#5d5a8a" strokeWidth={4} />
          <circle cx={0} cy={40} r={22} fill="#3c3a5a" />
          <line x1={0} y1={62} x2={0} y2={150} stroke="#3c3a5a" strokeWidth={8} />
        </g>
      ))}
      <g transform="translate(330 250)">
        <path d="M -110 0 Q 0 -110 110 0 Z" fill={C.mustard} stroke="#F4F6F8" strokeWidth={4} opacity={0.9} />
        <line x1={0} y1={0} x2={-30} y2={150} stroke="#F4F6F8" strokeWidth={5} />
      </g>
      <Stick2D pose={p} x={330} y={575} s={160} wear="neighbor" />
      <Rain t={t} n={90} />
      {t > say - 0.2 ? (
        <Pop t={t} at={say - 0.2} x={700} y={250}>
          <Bubble x={560} y={110} w={420} h={250} tail={[420, 400]}>
            <rect x={600} y={140} width={340} height={180} rx={14} fill="#2a1d10" />
            <rect x={600} y={140} width={340} height={180} rx={14} fill={C.gold} opacity={0.35} />
            <line x1={770} y1={140} x2={770} y2={320} stroke="#2a1d10" strokeWidth={6} />
            <line x1={600} y1={230} x2={940} y2={230} stroke="#2a1d10" strokeWidth={6} />
            <Stick2D pose={sit(t)} x={680} y={318} s={70} wear="gran" view="side" />
            <Stick2D pose={sit(t)} x={860} y={318} s={70} view="side" flip silhouette />
          </Bubble>
        </Pop>
      ) : null}
      {t > who ? <Slam t={t} at={who} x={860} y={200} size={120} color={C.white} text="?" glow={C.coral} /> : null}
    </Panel>
  );
};

// ---------- the thesis slam ----------
export const Useless: React.FC<ShotProps> = ({t, m}) => {
  const at = g(m, 'b1.11', 0.85);
  return (
    <AbsoluteFill style={{background: '#030208'}}>
      <svg viewBox="0 0 1280 720" width="100%" height="100%">
        {t < at ? <rect width={1280} height={720} fill="#07061A" opacity={1} /> : null}
        <Slam t={t} at={at} x={640} y={250} size={46} color="#c9cdf0" text="TIME TRAVEL IS" font="mono" />
        <Slam t={t} at={at + 0.42} x={640} y={350} size={170} color={C.gold} text="USELESS" glow={C.gold} />
        {t > at + 0.42 ? <line x1={300} y1={455} x2={300 + 680 * easeOut(inv(at + 0.5, at + 1.2, t))} y2={455} stroke={C.gold} strokeWidth={6} opacity={0.7} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

export const RingPromise: React.FC<ShotProps> = ({t, dur}) => {
  const draw = easeOut(inv(0.05, 1.0, t));
  const fly = easeInOut(inv(dur - 0.75, dur, t));
  const size = lerp(420, 82, fly);
  const x = lerp(640, 640, fly);
  const y = lerp(330, 53, fly);
  const sec = Math.max(0, 180 - Math.floor(t * 2.4));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 46%, #1b1446 0%, #07061A 70%)'}}>
      <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2}}>
        <LoopRing t={t} size={size} acts={Math.min(7, Math.floor(t * 4))} dot={t / 3.5} closed={0} drawn={draw} icon={fly > 0.8} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', opacity: 1 - fly}}>
        <Heavy size={64} color={C.white} glow={C.violet}>
          {`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`}
        </Heavy>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Act 2: taxi map, the call, rule ----------
export const Taxi: React.FC<ShotProps> = ({t, dur, m}) => {
  const lap = g(m, 'b2.4', 2.0);
  // route: around a loop, back to start
  const path = (u: number): [number, number] => {
    const pts: [number, number][] = [[260, 560], [260, 220], [700, 220], [700, 460], [470, 460], [470, 560], [260, 560]];
    const L: number[] = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const d = (u % 1) * L[L.length - 1];
    for (let i = 1; i < pts.length; i++)
      if (d <= L[i]) {
        const k = (d - L[i - 1]) / (L[i] - L[i - 1]);
        return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)];
      }
    return pts[0];
  };
  const u = easeInOut(clamp(t / (lap + 1.3))) * 1.0;
  const [x, y] = path(u);
  const [x2, y2] = path(u + 0.004);
  const ang = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
  return (
    <Panel bg="#141036" t={t} dur={dur} push={0.07} border={false} cy={300}>
      <g transform="translate(0 -70)">
      {Array.from({length: 7}).map((_, i) => (
        <g key={i}>
          <rect x={120 + i * 150} y={0} width={34} height={720} fill="#2a2458" />
          <rect x={0} y={90 + i * 120} width={1280} height={34} fill="#2a2458" />
        </g>
      ))}
      {Array.from({length: 36}).map((_, i) => (
        <rect key={i} x={160 + (i % 7) * 150} y={128 + Math.floor(i / 7) * 120} width={104} height={80} rx={8} fill={['#1f1a4a', '#241d55', '#1c1744'][i % 3]} />
      ))}
      <path d="M 260 560 L 260 220 L 700 220 L 700 460 L 470 460 L 470 560 Z" fill="none" stroke={C.teal} strokeWidth={8} strokeDasharray="22 16" opacity={0.85} strokeDashoffset={-t * 60} />
      {/* destination pin */}
      <g transform={`translate(${1010 + Math.sin(t * 2) * 4} ${200 + Math.sin(t * 3) * 3})`}>
        <path d="M 0 0 C -36 -50 -36 -90 0 -90 C 36 -90 36 -50 0 0 Z" fill={C.coral} stroke="#F4F6F8" strokeWidth={4} />
        <circle cx={0} cy={-62} r={12} fill="#F4F6F8" />
        <NameTag x={0} y={10} text="GRAN'S" color={C.gold} />
      </g>
      {/* taxi */}
      <g transform={`translate(${x} ${y}) rotate(${ang})`}>
        <rect x={-38} y={-22} width={76} height={44} rx={12} fill={C.gold} stroke="#07061A" strokeWidth={4} />
        <rect x={-10} y={-18} width={26} height={36} rx={5} fill="#1b2a52" />
        <rect x={-6} y={-6} width={14} height={12} rx={3} fill="#F4F6F8" />
        <circle cx={40} cy={-14} r={5} fill="#fff7c0" />
        <circle cx={40} cy={14} r={5} fill="#fff7c0" />
      </g>
      {t > lap ? <Slam t={t} at={lap + 0.25} x={640} y={205} size={34} color={C.coral} text="SHORTCUT: 0 MINUTES SAVED" font="mono" /> : null}
      <XPunch t={t} at={dur - 0.55} x={x} y={y} size={150} />
      </g>
    </Panel>
  );
};

export const CallPanel: React.FC<ShotProps> = ({t, dur, m}) => {
  const hang = g(m, 'b2.5e', 2.6) + 0.1;
  const honest = g(m, 'b2.6', 3.0) + 1.0;
  const youPose: Pose = {...stand(t), handR: [-0.2, 1.6, 0.05], poleR: [-1, -0.6, 0], handL: [0.2, 0.95, 0.15], mouth: t < hang ? (Math.sin(t * 16) > 0 ? 0 : -0.5) : 0, headPitch: 0.02};
  const down = smooth(inv(hang, hang + 0.35, t));
  const youngPose: Pose = {...stand(t), handL: [lerp(0.2, 0.18, down), lerp(1.6, 0.95, down), lerp(0.05, 0.15, down)], poleL: [1, -0.6, 0], handR: [-0.18, 0.9, 0.1], mouth: down > 0.5 ? 0 : -0.6, lean: 0.06};
  const shrug = t > honest ? smooth(inv(honest, honest + 0.3, t)) * (1 - smooth(inv(honest + 0.9, honest + 1.3, t))) : 0;
  const yp2 = {...youPose, handL: [0.3, 1.2 + shrug * 0.1, 0.1] as V3, handR: t > hang ? ([-0.3, 1.2 + shrug * 0.1, 0.1] as V3) : youPose.handR, mouth: t > honest ? 0.6 : youPose.mouth};
  return (
    <AbsoluteFill style={{background: C.base}}>
      <svg viewBox="0 0 1280 720" width="100%" height="100%">
        <g transform={`rotate(-1.2 320 360)`}>
          <rect x={30} y={40} width={590} height={640} rx={20} fill="#16204a" stroke="#F4F6F8" strokeWidth={5} />
          <rect x={30} y={40} width={590} height={640} rx={20} fill={C.teal} opacity={0.06} />
          <Stick2D pose={t > hang ? yp2 : youPose} x={300} y={620} s={230} wear="you" />
          {t < hang + 0.2 ? (
            <PhoneFlat x={300 - 0.2 * 230 + 12} y={620 - 1.6 * 230 - 14} w={28} state="call" t={t} label="ME" rot={-8} />
          ) : null}
          <Pop t={t} at={0.45} x={330} y={150} out={hang}>
            <Bubble x={100} y={80} w={440} h={110} tail={[250, 230]}>
              <text x={320} y={148} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontWeight={900} fontSize={38} fill="#07061A">
                GO TO HER. NOW.
              </text>
            </Bubble>
          </Pop>
        </g>
        <g transform={`rotate(1.2 960 360)`}>
          <rect x={660} y={40} width={590} height={640} rx={20} fill="#0f2a3a" stroke="#F4F6F8" strokeWidth={5} />
          <rect x={660} y={40} width={590} height={640} rx={20} fill={C.cyan} opacity={0.07} />
          <Stick2D pose={youngPose} x={950} y={620} s={230} wear="young" />
          {down < 0.95 ? <PhoneFlat x={lerp(950 + 0.2 * 230 - 12, 950 + 0.18 * 230, down)} y={lerp(620 - 1.6 * 230 - 14, 620 - 0.95 * 230, down)} w={28} state="call" t={t} label="??" rot={8} /> : null}
          <Pop t={t} at={g(m, 'b2.5e', 2.6) - 0.9} x={960} y={150} out={hang + 0.9}>
            <Bubble x={760} y={70} w={400} h={120} tail={[900, 230]} color="#ffe1e6">
              <text x={960} y={124} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontWeight={900} fontSize={30} fill={C.coral}>
                WHO IS THIS?
              </text>
              <text x={960} y={164} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontWeight={900} fontSize={30} fill={C.coral}>
                IS THIS A PRANK?
              </text>
            </Bubble>
          </Pop>
          {t > hang && t < hang + 0.7 ? <Slam t={t} at={hang} x={1080} y={300} size={44} color={C.white} text="CLICK" font="mono" rot={8} /> : null}
        </g>
        <XPunch t={t} at={dur - 0.6} x={640} y={340} size={220} />
      </svg>
    </AbsoluteFill>
  );
};

export const RuleFreeze: React.FC<ShotProps> = ({t, m}) => {
  const rule = g(m, 'b2.9', 1.2);
  const s = 1 + 0.04 * t;
  const k = smooth(inv(rule, rule + 0.25, t));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, #1e1650 0%, #07061A 75%)'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${s})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 26, transform: `translateY(${-k * 40}px) scale(${1 - k * 0.25})`}}>
          <Mono size={30} color="#c9cdf0" spacing={6}>
            ATTEMPT
          </Mono>
          <Digits value="214" h={120} color={C.white} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 26, transform: `translateY(${-k * 40}px) scale(${1 - k * 0.25})`}}>
          <Mono size={30} color={C.coral} spacing={6}>
            CHANGES
          </Mono>
          <Digits value="0" h={120} color={Math.floor(t * 6) % 2 ? C.coral : C.teal} />
        </div>
      </div>
      <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <Slam t={t} at={rule} x={640} y={520} size={130} color={C.coral} text="A RULE" glow={C.coral} rot={-3} />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- Act 3: Novikov and the film ----------
export const Novikov: React.FC<ShotProps> = ({t, dur}) => {
  const draw = easeInOut(inv(0.5, 2.2, t));
  const r = 120;
  const circ = 2 * Math.PI * r;
  const p: Pose = {...stand(t), handR: [-0.3, lerp(1.1, 1.45, smooth(inv(0.4, 0.9, t))), 0.3], poleR: [-1, -0.5, 0], lean: 0.05, mouth: 0.5};
  const bulb = t > 2.4;
  return (
    <Panel bg="#13263a" bg2="#0f1c30" t={t} dur={dur} push={0.05}>
      <rect x={140} y={70} width={1000} height={470} rx={16} fill="#1b3a3a" stroke="#6d5a3a" strokeWidth={14} />
      <rect x={140} y={70} width={1000} height={470} rx={16} fill="#2d6a5a" opacity={0.18} />
      <circle cx={720} cy={300} r={r} fill="none" stroke="#eef6f0" strokeWidth={7} strokeDasharray={`${circ * draw} ${circ}`} strokeLinecap="round" transform="rotate(-90 720 300)" opacity={0.9} />
      {draw > 0.95 ? <polygon points="720,172 744,186 720,200" fill="#eef6f0" transform="rotate(10 720 186)" /> : null}
      <text x={430} y={150} fontFamily="Georgia, serif" fontStyle="italic" fontSize={34} fill="#eef6f0" opacity={clamp((t - 1) * 2) * 0.8}>
        1980s
      </text>
      <text x={860} y={470} fontFamily="Georgia, serif" fontStyle="italic" fontSize={30} fill="#eef6f0" opacity={clamp((t - 1.8) * 2) * 0.7}>
        past = future?
      </text>
      <Stick2D pose={p} x={330} y={555} s={165} wear="scientist" label="IGOR NOVIKOV" accent={C.teal} />
      {bulb ? (
        <Pop t={t} at={2.4} x={300} y={250}>
          <circle cx={300} cy={250} r={34} fill={C.gold} />
          <circle cx={300} cy={250} r={70} fill={C.gold} opacity={0.2} />
          <rect x={288} y={282} width={24} height={18} fill="#9aa3c8" />
        </Pop>
      ) : null}
    </Panel>
  );
};

export const Film: React.FC<ShotProps> = ({t, dur, m}) => {
  const editAt = g(m, 'b3.3', 2.6) + 0.9;
  const scroll = t * 120;
  const frames = ['PYRAMIDS', 'SHIP', 'TOWER', 'KITCHEN', 'MOON', 'STATION', 'CITY'];
  const cut = smooth(inv(editAt, editAt + 0.35, t));
  const bounce = t > editAt + 0.35 ? Math.sin((t - editAt - 0.35) * 18) * Math.exp(-(t - editAt - 0.35) * 5) * 30 : 0;
  return (
    <Panel bg="#160f35" t={t} dur={dur} push={0.04} border={false}>
      <g transform={`translate(${-scroll % 300} 0)`}>
        <rect x={-300} y={190} width={2200} height={330} fill="#0b0a1a" />
        {Array.from({length: 40}).map((_, i) => (
          <rect key={i} x={-300 + i * 60} y={205} width={30} height={20} rx={4} fill="#2a2458" />
        ))}
        {Array.from({length: 40}).map((_, i) => (
          <rect key={i} x={-300 + i * 60} y={485} width={30} height={20} rx={4} fill="#2a2458" />
        ))}
        {Array.from({length: 8}).map((_, i) => {
          const name = frames[(i + Math.floor(scroll / 300)) % frames.length];
          const x = -300 + i * 300 + 20;
          const kitchen = name === 'KITCHEN';
          return (
            <g key={i}>
              <rect x={x} y={240} width={260} height={230} rx={8} fill={kitchen ? '#3a2a12' : '#1f1a4a'} stroke="#F4F6F8" strokeWidth={3} />
              {kitchen ? <rect x={x} y={240} width={260} height={230} rx={8} fill={C.gold} opacity={0.25} /> : null}
              <text x={x + 130} y={460} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontSize={14} fill="#9aa0c8" letterSpacing={3}>
                {name}
              </text>
              {name === 'PYRAMIDS' ? <polygon points={`${x + 50},420 ${x + 130},300 ${x + 210},420`} fill={C.gold} opacity={0.8} /> : null}
              {name === 'SHIP' ? <path d={`M ${x + 50} 400 L ${x + 210} 400 L ${x + 180} 430 L ${x + 80} 430 Z M ${x + 130} 400 L ${x + 130} 300 L ${x + 190} 390 Z`} fill="#9fb4ff" /> : null}
              {name === 'TOWER' ? <rect x={x + 105} y={290} width={50} height={140} fill="#9aa3c8" /> : null}
              {name === 'MOON' ? <circle cx={x + 130} cy={350} r={55} fill="#e9e6ff" /> : null}
              {name === 'STATION' ? <rect x={x + 40} y={360} width={180} height={60} rx={10} fill={C.teal} opacity={0.7} /> : null}
              {name === 'CITY' ? <g fill="#5d5a8a">{[0, 1, 2, 3].map((k) => <rect key={k} x={x + 40 + k * 46} y={430 - 40 - k * 25} width={36} height={40 + k * 25} />)}</g> : null}
              {kitchen ? (
                <>
                  <Stick2D pose={sit(t)} x={x + 80} y={430} s={60} wear="gran" view="side" />
                  <Stick2D pose={sit(t)} x={x + 180} y={430} s={60} wear="you" view="side" flip glow={t > 1.2 ? C.blue : undefined} />
                </>
              ) : (
                <Stick2D pose={stand(t + i)} x={x + 205} y={430} s={45} wear="you" glow={t > g(m, 'b3.3', 2.6) ? C.blue : undefined} />
              )}
            </g>
          );
        })}
      </g>
      {/* scissors try to cut, and bounce */}
      {t > editAt - 0.5 ? (
        <g transform={`translate(${lerp(1400, 700, smooth(inv(editAt - 0.5, editAt, t))) + bounce} 355) rotate(${-cut * 20})`}>
          <circle cx={60} cy={-40} r={28} fill="none" stroke="#F4F6F8" strokeWidth={9} />
          <circle cx={60} cy={40} r={28} fill="none" stroke="#F4F6F8" strokeWidth={9} />
          <polygon points="36,-30 -120,-4 -120,4 36,-10" fill="#c9cdf0" transform={`rotate(${-cut * 8})`} />
          <polygon points="36,30 -120,4 -120,-4 36,10" fill="#c9cdf0" transform={`rotate(${cut * 8})`} />
        </g>
      ) : null}
      <Slam t={t} at={editAt + 0.35} x={640} y={610} size={76} color={C.coral} text="NO EDITS" glow={C.coral} rot={-4} />
    </Panel>
  );
};

// ---------- Act 4: kinetic and diagrams ----------
export const Real: React.FC<ShotProps> = ({t, m}) => {
  const k = g(m, 'b4.5', 0.1) + 1.05;
  const wob = t > k ? Math.sin((t - k) * 10) * 10 * Math.exp(-(t - k) * 2) : 0;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, #22184f 0%, #07061A 70%)'}}>
      <svg viewBox="0 0 1280 720" width="100%" height="100%">
        <Slam t={t} at={0.05} x={640} y={270} size={84} color={C.white} text="IS ANY OF THIS REAL?" />
        <Slam t={t} at={k} x={640} y={420} size={110} color={C.teal} text="KIND OF." glow={C.teal} rot={wob} />
      </svg>
    </AbsoluteFill>
  );
};

export const PaperPanel: React.FC<ShotProps> = ({t, dur, m}) => {
  const back = g(m, 'b5.1', 0.1) + 1.0;
  const stamp = g(m, 'b5.2', 2.6) + 0.5;
  const fwd = easeOut(inv(0.15, 0.9, t));
  const bk = easeOut(inv(back, back + 0.8, t));
  return (
    <Panel bg="#120f30" t={t} dur={dur} push={0.05}>
      <rect x={0} y={0} width={1280} height={720} fill="url(#gridp)" opacity={0.5} />
      <defs>
        <pattern id="gridp" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2a2458" strokeWidth="1.5" />
        </pattern>
      </defs>
      <circle cx={640} cy={250} r={16} fill={C.white} />
      <text x={640} y={215} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={20} fill={C.white} letterSpacing={4}>
        NOW
      </text>
      <line x1={660} y1={250} x2={660 + 440 * fwd} y2={250} stroke={C.teal} strokeWidth={14} strokeLinecap="round" />
      {fwd > 0.95 ? <polygon points="1100,225 1150,250 1100,275" fill={C.teal} /> : null}
      <Slam t={t} at={0.5} x={900} y={180} size={40} color={C.teal} text="FORWARD: EASY" font="mono" />
      <line x1={620} y1={250} x2={620 - 440 * bk} y2={250} stroke="#9aa0c8" strokeWidth={10} strokeDasharray="18 14" strokeLinecap="round" />
      {bk > 0.95 ? <polygon points="180,228 136,250 180,272" fill="#9aa0c8" /> : null}
      <Slam t={t} at={back + 0.2} x={380} y={180} size={36} color="#c9cdf0" text="BACKWARD: ON PAPER" font="mono" />
      {/* paper sketches */}
      <Pop t={t} at={back + 0.5} x={300} y={420}>
        <rect x={180} y={330} width={250} height={190} rx={8} fill="#F2EAD8" transform="rotate(-4 305 425)" />
        <path d={Array.from({length: 60}).map((_, i) => { const a = i * 0.32; const r = 6 + i * 1.3; return `${i ? 'L' : 'M'} ${305 + Math.cos(a) * r} ${415 + Math.sin(a) * r * 0.8}`; }).join(' ')} fill="none" stroke="#3b2a1a" strokeWidth={3} />
        <text x={305} y={505} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={16} fill="#3b2a1a">
          GODEL 1949
        </text>
      </Pop>
      <Pop t={t} at={back + 0.8} x={560} y={430}>
        <rect x={450} y={340} width={240} height={190} rx={8} fill="#F2EAD8" transform="rotate(3 570 435)" />
        <path d="M 480 380 Q 570 440 660 380 M 480 490 Q 570 430 660 490" fill="none" stroke="#3b2a1a" strokeWidth={4} />
        <ellipse cx={570} cy={435} rx={20} ry={44} fill="none" stroke="#3b2a1a" strokeWidth={3} />
        <text x={570} y={520} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={15} fill="#3b2a1a">
          EXOTIC MATTER?
        </text>
      </Pop>
      {t > stamp ? (
        <g transform={`translate(860 470) rotate(-8) scale(${lerp(1.6, 1, easeOut(inv(stamp, stamp + 0.15, t)))})`} opacity={clamp((t - stamp) * 8)}>
          <rect x={-250} y={-60} width={500} height={120} rx={12} fill="none" stroke={C.coral} strokeWidth={8} />
          <text x={0} y={-8} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontWeight={900} fontSize={40} fill={C.coral}>
            NO TIME MACHINE
          </text>
          <text x={0} y={38} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontWeight={900} fontSize={34} fill={C.coral}>
            HAS EVER BEEN BUILT
          </text>
        </g>
      ) : null}
    </Panel>
  );
};

// ---------- Act 5: Deutsch's branches ----------
export const Branches: React.FC<ShotProps> = ({t, dur, m}) => {
  const split = g(m, 'b6a.2', 1.6) + 0.7;
  const save = g(m, 'b6a.4', 7.0);
  const notYours = save + 1.3;
  const sp = easeInOut(inv(split, split + 1.2, t));
  const zoom = easeInOut(inv(notYours, notYours + 1.6, t));
  const cy = lerp(360, 560, zoom);
  const cx = lerp(640, 1005, zoom);
  const p: Pose = {...stand(t), handR: [-0.3, 1.3, 0.3], poleR: [-1, -0.4, 0], mouth: 0.3};
  return (
    <Panel bg="#0e0b28" bg2="#16113a" t={t} dur={dur} push={0} border={false}>
      <g transform={`translate(640 360) scale(${1 + zoom * 0.8}) translate(${-cx} ${-cy})`}>
        <Stars t={t} n={60} drift={2} />
        <path d={`M 80 360 L 560 360`} stroke={C.white} strokeWidth={10} strokeLinecap="round" />
        <path d={`M 560 360 C 700 360 760 ${360 - 170 * sp} 1200 ${360 - 170 * sp}`} stroke={C.teal} strokeWidth={10} fill="none" strokeLinecap="round" opacity={sp > 0.02 ? 1 : 0} style={{filter: `drop-shadow(0 0 10px ${C.teal})`}} />
        <path d={`M 560 360 C 700 360 760 ${360 + 150 * sp} 1200 ${360 + 150 * sp}`} stroke={C.violet} strokeWidth={10} fill="none" strokeLinecap="round" opacity={sp > 0.02 ? 1 : 0} style={{filter: `drop-shadow(0 0 10px ${C.violet})`}} />
        <circle cx={560} cy={360} r={18} fill={C.white} />
        <Stick2D pose={p} x={230} y={340} s={110} wear="scientist" label="DAVID DEUTSCH" accent={C.violet} />
        {t > g(m, 'b6a.3', 4.0) ? (
          <Pop t={t} at={g(m, 'b6a.3', 4.0)} x={1000} y={150}>
            <rect x={860} y={60} width={290} height={150} rx={14} fill="#123a3a" stroke={C.teal} strokeWidth={4} />
            <Stick2D pose={{...stand(t), mouth: 1}} x={950} y={190} s={62} wear="plain" accent="#9b6bff" glasses />
            <Stick2D pose={{...stand(t), handL: [0.25, 1.2, 0.1]}} x={1060} y={190} s={62} wear="you" />
            <text x={1005} y={90} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={15} fill={C.teal} letterSpacing={2}>
              NEW TIMELINE
            </text>
          </Pop>
        ) : null}
        {t > save + 0.4 ? (
          <Pop t={t} at={save + 0.4} x={1000} y={560}>
            <rect x={840} y={460} width={330} height={190} rx={14} fill="#2a1d10" stroke={C.gold} strokeWidth={4} />
            <rect x={840} y={460} width={330} height={190} rx={14} fill={C.gold} opacity={0.18} />
            <ClockFace x={1110} y={505} r={26} h={9} m={14} />
            <rect x={880} y={590} width={250} height={12} fill="#6a4a2a" />
            <Stick2D pose={sit(t)} x={930} y={640} s={70} wear="gran" view="side" />
            <g opacity={0.9}>
              <rect x={1040} y={560} width={50} height={8} fill="#5a3a26" />
              <rect x={1086} y={500} width={8} height={70} fill="#5a3a26" />
              <rect x={1044} y={568} width={6} height={70} fill="#5a3a26" />
              <rect x={1082} y={568} width={6} height={70} fill="#5a3a26" />
            </g>
            <text x={1005} y={490} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={15} fill={C.gold} letterSpacing={2}>
              YOURS
            </text>
          </Pop>
        ) : null}
      </g>
    </Panel>
  );
};

// ---------- Act 7: now ----------
export const NowRing: React.FC<ShotProps> = ({t, dur, m}) => {
  const out = easeInOut(inv(0, dur * 0.8, t));
  const size = lerp(560, 300, out);
  const past = g(m, 'b8.7', 3.4);
  const rings = smooth(inv(past, past + 1.2, t));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 46%, #1d1550 0%, #07061A 75%)'}}>
      {[...Array(6)].map((_, i) => {
        const a = (i / 6) * Math.PI * 2 + t * 0.1;
        const r = 330 * rings;
        const s = 150;
        return (
          <div key={i} style={{position: 'absolute', left: 640 + Math.cos(a) * r - s / 2, top: 330 + Math.sin(a) * r * 0.55 - s / 2, opacity: rings * 0.55}}>
            <LoopRing t={t + i} size={s} acts={7} dot={(t * 0.2 + i / 6) % 1} closed={0} />
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 640 - size / 2, top: 330 - size / 2}}>
        <LoopRing t={t} size={size} acts={7} dot={0.92 + t * 0.005} closed={1} />
      </div>
      <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        {(() => {
          const a = (0.92 + t * 0.005) * Math.PI * 2 - Math.PI / 2;
          const r = size * 0.4;
          const x = 640 + Math.cos(a) * r;
          const y = 330 + Math.sin(a) * r;
          return (
            <g>
              <circle cx={x} cy={y} r={14 + Math.sin(t * 5) * 3} fill={C.teal} opacity={0.6} />
              <text x={x - 26} y={y - 22} textAnchor="end" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={24} fill={C.teal} letterSpacing={4}>
                NOW
              </text>
            </g>
          );
        })()}
      </svg>
    </AbsoluteFill>
  );
};

export const Black: React.FC<ShotProps> = () => <AbsoluteFill style={{background: '#020106'}} />;

export const EndCard: React.FC<ShotProps> = ({t}) => {
  const k = easeOut(inv(0, 0.6, t));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, #1a1446 0%, #050412 70%)', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${0.9 + 0.1 * k})`, opacity: k, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
        <LoopRing t={t} size={180} acts={7} dot={t * 0.3} closed={1} drawn={1} />
        <Heavy size={64} color={C.white} spacing={14} glow={C.violet}>
          LOOPHOLE
        </Heavy>
        <Mono size={16} color="#9aa0c8" spacing={6}>
          VIDEO 001 // TIMELINE LOG
        </Mono>
      </div>
    </AbsoluteFill>
  );
};
export {HIP_Y, SEG, walk, mixPose, pop, noise1, hash, easeOut};
