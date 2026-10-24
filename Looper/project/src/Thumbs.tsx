// Thumbnails (section 11.1): two variants, 1280x720, same flat bold grammar.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C} from './lib/anim';
import {stand, Pose} from './lib/rig';
import {Stick2D} from './two/Stick2D';
import {MONT, MONO} from './fx/fonts';

const Bg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 62%, #2a1a6a 0%, #150f3a 38%, #07061A 72%)'}}>
    <AbsoluteFill style={{background: 'radial-gradient(circle at 78% 85%, rgba(30,230,200,0.18) 0%, rgba(30,230,200,0) 40%)'}} />
    {children}
  </AbsoluteFill>
);

const Title: React.FC<{a: string; b: string; bColor: string}> = ({a, b, bColor}) => (
  <div style={{position: 'absolute', top: 26, left: 0, right: 0, textAlign: 'center', fontFamily: `${MONT}, sans-serif`, fontWeight: 900, fontSize: 132, lineHeight: 1, letterSpacing: -1}}>
    <span style={{color: '#F4F6F8', WebkitTextStroke: '10px #07061A', paintOrder: 'stroke fill', textShadow: '0 6px 0 #07061A'}}>{a} </span>
    <span style={{color: bColor, WebkitTextStroke: '10px #07061A', paintOrder: 'stroke fill', textShadow: `0 6px 0 #07061A, 0 0 40px ${bColor}88`}}>{b}</span>
  </div>
);

const Tag: React.FC<{x: number; y: number; text: string; color: string; size?: number}> = ({x, y, text, color, size = 46}) => (
  <div style={{position: 'absolute', left: x, top: y, padding: '10px 26px', borderRadius: 999, background: '#07061A', border: `5px solid ${color}`, boxShadow: `0 0 30px ${color}88`, fontFamily: `${MONO}, monospace`, fontWeight: 800, fontSize: size, color: '#F4F6F8', letterSpacing: 3, whiteSpace: 'nowrap'}}>
    {text}
  </div>
);

export const ThumbA: React.FC = () => {
  const giver: Pose = {...stand(0), handR: [-0.05, 1.28, 0.3], handL: [0.15, 0.95, 0.1], poleR: [-0.6, -0.6, -0.4], lean: 0.08, mouth: 0.4, blink: 0};
  const back: Pose = {...stand(0.5), headPitch: 0.25, handR: [-0.15, 1.2, 0.3], handL: [0.15, 1.2, 0.3], blink: 0};
  return (
    <Bg>
      <svg viewBox="0 0 1280 720" width="1280" height="720" style={{position: 'absolute', inset: 0}}>
        <defs>
          <filter id="rglow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="ringIn" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7B5CFF" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#7B5CFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={640} cy={445} r={240} fill="url(#ringIn)" />
        <circle cx={640} cy={445} r={235} fill="none" stroke={C.violet} strokeWidth={26} filter="url(#rglow)" />
        <circle cx={640} cy={445} r={235} fill="none" stroke="#c9b8ff" strokeWidth={6} />
        {Array.from({length: 7}).map((_, i) => {
          const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={640 + Math.cos(a) * 235} cy={445 + Math.sin(a) * 235} r={15} fill={C.teal} stroke="white" strokeWidth={4} />;
        })}
        <g style={{filter: 'drop-shadow(0 0 14px rgba(47,107,255,0.9))'}}>
          <Stick2D pose={giver} x={545} y={640} s={190} view="side" wear="you" />
        </g>
        <g style={{filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.35))'}}>
          <Stick2D pose={back} x={760} y={640} s={190} view="side" wear="young" />
        </g>
        {/* the brass chronometer held out */}
        <g transform="translate(652 398)" style={{filter: 'drop-shadow(0 0 18px #FFC24A)'}}>
          <circle r={30} fill="#E8A93A" stroke="#7a4a10" strokeWidth={4} />
          <circle r={22} fill="#FFF4DA" />
          <line x1={0} y1={0} x2={0} y2={-15} stroke="#101018" strokeWidth={3.5} strokeLinecap="round" />
          <line x1={0} y1={0} x2={10} y2={4} stroke="#101018" strokeWidth={3.5} strokeLinecap="round" />
          <rect x={-5} y={-42} width={10} height={12} fill="#E8A93A" />
          <circle cx={0} cy={-48} r={7} fill="none" stroke="#E8A93A" strokeWidth={3} />
        </g>
      </svg>
      <Title a="IT'S" b="USELESS" bColor={C.gold} />
      <Tag x={70} y={560} text="ATTEMPT 214" color={C.teal} />
      <Tag x={905} y={560} text="CHANGES 0" color={C.coral} />
    </Bg>
  );
};

export const ThumbB: React.FC = () => (
  <Bg>
    <svg viewBox="0 0 1280 720" width="1280" height="720" style={{position: 'absolute', inset: 0}}>
      <defs>
        <filter id="gglow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="16" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* the flat 2D outline left behind as the phone pops out into depth */}
      <rect x={470} y={205} width={250} height={470} rx={40} fill="none" stroke="#c9cdf0" strokeWidth={5} strokeDasharray="18 14" opacity={0.6} />
      <g transform="translate(600 450) rotate(-8) skewY(4)">
        <rect x={-118} y={-232} width={250} height={470} rx={40} fill="#0d0c1e" transform="translate(16 14)" />
        <rect x={-125} y={-235} width={250} height={470} rx={40} fill="#15152a" stroke={C.gold} strokeWidth={9} filter="url(#gglow)" />
        <rect x={-105} y={-212} width={210} height={424} rx={26} fill="#2b1030" />
        <text x={0} y={-130} textAnchor="middle" fontFamily={`${MONO}, monospace`} fontWeight={800} fontSize={26} fill={C.coral} letterSpacing={2}>
          MISSED CALL
        </text>
        <text x={0} y={-50} textAnchor="middle" fontFamily={`${MONT}, sans-serif`} fontWeight={900} fontSize={70} fill="#F4F6F8">
          GRAN
        </text>
        <circle cx={0} cy={60} r={56} fill="none" stroke={C.coral} strokeWidth={6} />
        <path d="M -24 50 q 24 -30 48 0 l -10 18 q -14 -10 -28 0 z" fill={C.coral} />
      </g>
      {/* your hand in a cobalt sleeve reaching for it */}
      <line x1={1290} y1={760} x2={830} y2={470} stroke={C.blue} strokeWidth={66} strokeLinecap="round" style={{filter: 'drop-shadow(0 0 18px rgba(47,107,255,0.9))'}} />
      <line x1={1290} y1={760} x2={830} y2={470} stroke="#2457D6" strokeWidth={10} strokeLinecap="round" opacity={0.6} />
      <circle cx={812} cy={458} r={38} fill="#F4F6F8" />
      <line x1={800} y1={440} x2={765} y2={420} stroke="#F4F6F8" strokeWidth={16} strokeLinecap="round" />
    </svg>
    <Title a="YOU CAN'T" b="FIX IT" bColor={C.coral} />
    <Tag x={120} y={430} text="9:14" color={C.gold} size={64} />
  </Bg>
);
