// Flat 2D stickman drawn from the SAME rig joints as the 3D figure (lib/rig.ts).
import React from 'react';
import {Joints, Pose, solve, SEG, V} from '../lib/rig';
import {C, V3} from '../lib/anim';

export type Wear2D = 'you' | 'young' | 'gran' | 'neighbor' | 'plain' | 'scientist' | 'cosmo';

type Props = {
  pose?: Pose;
  joints?: Joints;
  x: number; // floor point on screen
  y: number;
  s: number; // pixels per metre
  view?: 'front' | 'side' | 'back';
  flip?: boolean;
  wear?: Wear2D;
  accent?: string;
  glasses?: boolean;
  label?: string;
  opacity?: number;
  glow?: string;
  silhouette?: boolean; // the mystery figure in the neighbour's bubble
};

export const Stick2D: React.FC<Props> = ({pose, joints, x, y, s, view = 'front', flip, wear = 'plain', accent = C.teal, glasses, label, opacity = 1, glow, silhouette}) => {
  const j = joints ?? solve(pose!);
  const f = flip ? -1 : 1;
  const P = (p: V3): [number, number] => {
    const h = view === 'side' ? p[2] : view === 'back' ? -p[0] : p[0];
    return [x + h * s * f, y - p[1] * s];
  };
  const sw = Math.max(4.5, Math.min(12, s * SEG.head * 0.17));
  const white = silhouette ? '#3c3a5a' : C.white;
  const line = (a: V3, b: V3, col = white, w = sw) => {
    const [x1, y1] = P(a);
    const [x2, y2] = P(b);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={w} strokeLinecap="round" />;
  };
  const poly = (pts: V3[], col: string) => <polygon points={pts.map((p) => P(p).join(',')).join(' ')} fill={col} stroke={col} strokeWidth={sw * 0.6} strokeLinejoin="round" />;
  const [hx, hy] = P(j.head);
  const hr = (SEG.head / 2) * s;
  const cloth =
    silhouette ? '#2a2846' : wear === 'you' ? C.blue : wear === 'gran' ? C.granCoral : wear === 'young' ? C.hoodie : wear === 'cosmo' ? '#E8ECF4' : wear === 'scientist' ? '#E9E4D6' : accent;
  const mid: V3 = V.mul(V.add(j.kneeL, j.kneeR), 0.5);
  const coatEnd: V3 = V.add(j.hip, V.mul(V.norm(V.sub(mid, j.hip)), Math.min(V.len(V.sub(mid, j.hip)) + 0.08, 0.6)));
  const w2 = (k: number): V3 => [k, 0, 0];
  const faceDir = view === 'side' ? 1 : 0;
  const eyeY = hy - hr * 0.08 - Math.sin(j.headPitch) * hr * 0.2;
  const blink = j.blink > 0.5;
  return (
    <g opacity={opacity} style={glow ? {filter: `drop-shadow(0 0 ${sw * 1.6}px ${glow})`} : undefined}>
      {/* legs */}
      {line(j.hipL, j.kneeL)}
      {line(j.kneeL, j.footL)}
      {line(j.footL, j.toeL)}
      {line(j.hipR, j.kneeR)}
      {line(j.kneeR, j.footR)}
      {line(j.footR, j.toeR)}
      {/* clothing body (flat colour strokes, skeleton unchanged) */}
      {wear === 'you' || silhouette
        ? poly([V.add(j.neck, w2(0.07)), V.add(j.neck, w2(-0.07)), V.add(coatEnd, w2(-0.17)), V.add(coatEnd, w2(0.17))], cloth)
        : null}
      {wear === 'gran' ? poly([V.add(j.neck, w2(0.07)), V.add(j.neck, w2(-0.07)), V.add(j.hip, [-0.13, -0.12, 0]), V.add(j.hip, [0.13, -0.12, 0])], cloth) : null}
      {wear === 'young' ? poly([V.add(j.neck, w2(0.08)), V.add(j.neck, w2(-0.08)), V.add(j.hip, w2(-0.1)), V.add(j.hip, w2(0.1))], cloth) : null}
      {wear === 'scientist' ? poly([V.add(j.neck, w2(0.07)), V.add(j.neck, w2(-0.07)), V.add(coatEnd, w2(-0.15)), V.add(coatEnd, w2(0.15))], cloth) : null}
      {wear === 'cosmo' ? poly([V.add(j.neck, w2(0.1)), V.add(j.neck, w2(-0.1)), V.add(j.hip, w2(-0.12)), V.add(j.hip, w2(0.12))], cloth) : null}
      {line(j.hip, j.neck)}
      {/* arms with sleeves */}
      {line(j.shoulderL, j.elbowL)}
      {line(j.elbowL, j.handL)}
      {line(j.shoulderR, j.elbowR)}
      {line(j.elbowR, j.handR)}
      {wear === 'you' || wear === 'gran' || wear === 'young' || wear === 'cosmo' || wear === 'scientist' || silhouette ? (
        <>
          {line(j.shoulderL, j.elbowL, cloth, sw * 2.1)}
          {line(j.elbowL, V.add(j.handL, V.mul(V.norm(V.sub(j.elbowL, j.handL)), 0.07)), cloth, sw * 2.0)}
          {line(j.shoulderR, j.elbowR, cloth, sw * 2.1)}
          {line(j.elbowR, V.add(j.handR, V.mul(V.norm(V.sub(j.elbowR, j.handR)), 0.07)), cloth, sw * 2.0)}
        </>
      ) : null}
      {wear === 'neighbor' ? line(V.add(j.neck, [-0.08, 0.0, 0]), V.add(j.neck, [0.08, 0.0, 0]), C.mustard, sw * 2.2) : null}
      {wear === 'neighbor' ? line(V.add(j.neck, [0.04, 0, 0]), V.add(j.neck, [0.07, -0.22, 0]), C.mustard, sw * 1.6) : null}
      {wear === 'young' ? <circle cx={hx - f * hr * 0.1} cy={hy + hr * 0.35} r={hr * 0.95} fill="none" stroke={C.hoodie} strokeWidth={sw * 1.6} strokeDasharray={`${hr * 3.2} ${hr * 10}`} transform={`rotate(110 ${hx} ${hy})`} /> : null}
      {wear === 'you' && !silhouette ? line(V.add(j.neck, w2(0.075)), V.add(j.neck, [-0.075, 0.07, 0]), '#2457D6', sw * 1.5) : null}
      {/* hands (round end caps) */}
      <circle cx={P(j.handL)[0]} cy={P(j.handL)[1]} r={sw * 0.95} fill={white} />
      <circle cx={P(j.handR)[0]} cy={P(j.handR)[1]} r={sw * 0.95} fill={white} />
      {/* head */}
      {wear === 'gran' ? <circle cx={hx - f * hr * 0.15 * faceDir} cy={hy - hr * 1.05} r={hr * 0.38} fill={white} /> : null}
      {wear === 'cosmo' ? <circle cx={hx} cy={hy} r={hr * 1.35} fill="rgba(160,220,255,0.18)" stroke="#E8ECF4" strokeWidth={sw * 0.9} /> : null}
      <circle cx={hx} cy={hy} r={hr} fill={white} />
      {view !== 'back' && !silhouette ? (
        <g>
          {view === 'side' ? (
            <circle cx={hx + f * hr * 0.5} cy={eyeY} r={sw * 0.42} fill="#101018" />
          ) : (
            <>
              {blink ? (
                <>
                  <line x1={hx - hr * 0.42} y1={eyeY} x2={hx - hr * 0.22} y2={eyeY} stroke="#101018" strokeWidth={sw * 0.35} />
                  <line x1={hx + hr * 0.22} y1={eyeY} x2={hx + hr * 0.42} y2={eyeY} stroke="#101018" strokeWidth={sw * 0.35} />
                </>
              ) : (
                <>
                  <circle cx={hx - hr * 0.32} cy={eyeY} r={sw * 0.42} fill="#101018" />
                  <circle cx={hx + hr * 0.32} cy={eyeY} r={sw * 0.42} fill="#101018" />
                </>
              )}
            </>
          )}
          {(glasses || wear === 'gran' || wear === 'neighbor' || wear === 'scientist') && view !== 'side' ? (
            <>
              <circle cx={hx - hr * 0.32} cy={eyeY} r={hr * 0.22} fill="none" stroke="#101018" strokeWidth={sw * 0.3} />
              <circle cx={hx + hr * 0.32} cy={eyeY} r={hr * 0.22} fill="none" stroke="#101018" strokeWidth={sw * 0.3} />
              <line x1={hx - hr * 0.1} y1={eyeY} x2={hx + hr * 0.1} y2={eyeY} stroke="#101018" strokeWidth={sw * 0.3} />
            </>
          ) : null}
          {(glasses || wear === 'gran' || wear === 'neighbor' || wear === 'scientist') && view === 'side' ? (
            <circle cx={hx + f * hr * 0.5} cy={eyeY} r={hr * 0.22} fill="none" stroke="#101018" strokeWidth={sw * 0.3} />
          ) : null}
          {/* mouth */}
          {j.mouth > 0.3 ? (
            <path d={`M ${hx - hr * 0.22 + (view === 'side' ? f * hr * 0.35 : 0)} ${hy + hr * 0.3} Q ${hx + (view === 'side' ? f * hr * 0.45 : 0)} ${hy + hr * 0.48} ${hx + hr * 0.22 + (view === 'side' ? f * hr * 0.35 : 0)} ${hy + hr * 0.3}`} fill="none" stroke="#101018" strokeWidth={sw * 0.35} strokeLinecap="round" />
          ) : j.mouth < -0.3 ? (
            <path d={`M ${hx - hr * 0.2} ${hy + hr * 0.45} Q ${hx} ${hy + hr * 0.3} ${hx + hr * 0.2} ${hy + hr * 0.45}`} fill="none" stroke="#101018" strokeWidth={sw * 0.35} strokeLinecap="round" />
          ) : (
            <line x1={hx - hr * 0.18 + (view === 'side' ? f * hr * 0.4 : 0)} y1={hy + hr * 0.38} x2={hx + hr * 0.18 + (view === 'side' ? f * hr * 0.4 : 0)} y2={hy + hr * 0.38} stroke="#101018" strokeWidth={sw * 0.35} strokeLinecap="round" />
          )}
        </g>
      ) : null}
      {silhouette ? (
        <text x={hx} y={hy + hr * 0.42} textAnchor="middle" fontFamily="Montserrat, sans-serif" fontWeight={900} fontSize={hr * 1.3} fill={C.white}>
          ?
        </text>
      ) : null}
      {label ? <NameTag x={hx} y={y + sw * 4} text={label} color={accent} /> : null}
    </g>
  );
};

export const NameTag: React.FC<{x: number; y: number; text: string; color?: string}> = ({x, y, text, color = C.teal}) => {
  const w = text.length * 11 + 26;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={28} rx={14} fill="#0B0A1E" stroke={color} strokeWidth={2} />
      <text x={x} y={y + 19} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={800} fontSize={14} letterSpacing={2} fill={C.white}>
        {text}
      </text>
    </g>
  );
};
