// Captions (6.8): uppercase Montserrat 800, bottom third, hard cut, over a soft dark band.
import React from 'react';
import TL from '../timeline.json';
import {C} from '../lib/anim';
import {MONT} from './fonts';

const COL: Record<string, string> = {gold: C.gold, coral: C.coral, teal: C.teal, violet: '#A48BFF', blue: '#7FA6FF'};

export const CaptionBand: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 230,
      background: 'linear-gradient(to top, rgba(4,3,14,0.62) 0%, rgba(4,3,14,0.5) 38%, rgba(4,3,14,0.0) 100%)',
      pointerEvents: 'none',
    }}
  />
);

const Line: React.FC<{text: string; emph: [string, string] | null; color?: string; size?: number}> = ({text, emph, color = C.white, size = 34}) => {
  const words = text.split(' ');
  return (
    <div
      style={{
        fontFamily: `${MONT}, sans-serif`,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.18,
        color,
        textAlign: 'center',
        maxWidth: 1000,
        margin: '0 auto',
        letterSpacing: 0.5,
        textShadow: '0 2px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.65)',
      }}
    >
      {words.map((w, i) => (
        <span key={i} style={{color: emph && w === emph[0] ? COL[emph[1]] ?? color : color}}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );
};

export const Captions: React.FC<{t: number}> = ({t}) => {
  const cap = TL.captions.find((c) => t >= c.start && t < c.end);
  const y = TL.youngCaption;
  const showYoung = t >= y.start && t < y.end;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 74, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center'}}>
      {showYoung ? <Line text={y.text} emph={null} color={C.coral} size={28} /> : null}
      {cap ? <Line text={cap.text} emph={cap.emph as [string, string] | null} /> : null}
    </div>
  );
};
