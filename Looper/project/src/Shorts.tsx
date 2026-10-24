// Vertical shorts (section 11.3): the same picture recomposed for 720x1280,
// HUD moved to the top safe area, bigger captions, and a cliff card pointing to the full video.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, Sequence} from 'remotion';
import TL from './timeline.json';
import {C, inv, easeOut, clamp} from './lib/anim';
import {Main} from './Main';
import {LoopRing, Digits, attemptAt} from './hud/HUD';
import {MONT, MONO} from './fx/fonts';

const COL: Record<string, string> = {gold: C.gold, coral: C.coral, teal: C.teal, violet: '#A48BFF', blue: '#7FA6FF'};

const VCaption: React.FC<{t: number}> = ({t}) => {
  const cap = TL.captions.find((c) => t >= c.start && t < c.end);
  if (!cap) return null;
  const emph = cap.emph as [string, string] | null;
  return (
    <div style={{position: 'absolute', left: 40, right: 40, top: 1010, textAlign: 'center', fontFamily: `${MONT}, sans-serif`, fontWeight: 800, fontSize: 50, lineHeight: 1.15, color: C.white, textShadow: '0 3px 0 rgba(0,0,0,0.6), 0 0 22px rgba(0,0,0,0.7)'}}>
      {cap.text.split(' ').map((w, i) => (
        <span key={i} style={{color: emph && w === emph[0] ? COL[emph[1]] ?? C.white : C.white}}>
          {w}{' '}
        </span>
      ))}
    </div>
  );
};

const VHud: React.FC<{t: number}> = ({t}) => {
  const att = attemptAt(t);
  const showCounters = t >= TL.hud.wake && t < TL.hud.quiet[0];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 26}}>
      <LoopRing t={t} size={70} acts={TL.hud.acts.filter((a: number) => t >= a).length} dot={clamp(t / TL.duration)} closed={t > TL.hud.loopClosed ? 1 : 0} />
      {showCounters ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{fontFamily: `${MONO}, monospace`, fontSize: 14, color: '#c9cdf0', letterSpacing: 3}}>ATTEMPT</span>
            <Digits value={String(att).padStart(3, '0')} h={30} color={att >= 215 ? C.cyan : C.white} />
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{fontFamily: `${MONO}, monospace`, fontSize: 14, color: '#c9cdf0', letterSpacing: 3}}>CHANGES</span>
            <Digits value="0" h={30} color={C.teal} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const Short: React.FC<{from: number; to: number; card: [string, string]}> = ({from, to, card}) => {
  const f = useCurrentFrame();
  const t = from + f / 30;
  const cardAt = to;
  const inCard = t >= cardAt;
  const k = easeOut(inv(cardAt, cardAt + 0.5, t));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, #1d1550 0%, #07061A 70%)', overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center', fontFamily: `${MONT}, sans-serif`, fontWeight: 900, fontSize: 44, lineHeight: 1.05}}>
        <span style={{color: C.white}}>TIME TRAVEL IS </span>
        <span style={{color: C.gold, textShadow: `0 0 24px ${C.gold}88`}}>USELESS</span>
      </div>
      <VHud t={t} />
      {!inCard ? (
        <div style={{position: 'absolute', left: 360 - 640, top: 300, width: 1280, height: 720, transform: 'scale(1.25)', transformOrigin: '640px 0px', overflow: 'hidden'}}>
          <Sequence from={-Math.round(from * 30)} layout="none">
            <Main overlays={false} />
          </Sequence>
        </div>
      ) : (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 30, opacity: k}}>
          <LoopRing t={t} size={220} acts={7} dot={t * 0.3} closed={1} />
          <div style={{fontFamily: `${MONT}, sans-serif`, fontWeight: 900, fontSize: 64, color: C.white, textAlign: 'center', padding: '0 50px', lineHeight: 1.1}}>{card[0]}</div>
          <div style={{fontFamily: `${MONO}, monospace`, fontWeight: 800, fontSize: 30, color: C.teal, letterSpacing: 4, textAlign: 'center'}}>{card[1]}</div>
        </AbsoluteFill>
      )}
      {!inCard ? <div style={{position: 'absolute', left: 0, right: 0, top: 960, height: 320, background: 'linear-gradient(to top, rgba(7,6,26,1) 30%, rgba(7,6,26,0))'}} /> : null}
      {!inCard ? <VCaption t={t} /> : null}
    </AbsoluteFill>
  );
};
