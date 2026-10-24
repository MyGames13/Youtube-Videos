// Loophole 001: one composition driven entirely by timeline.json.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, Audio, staticFile} from 'remotion';
import TL from './timeline.json';
import {C, clamp, lerp, easeInOut, easeOut, easeIn, smooth, inv, noise1} from './lib/anim';
import {SHOTS, FOCUS, ShotProps} from './scenes';
import {HUD} from './hud/HUD';
import {Captions, CaptionBand} from './fx/Captions';
import {Vignette, Scanlines, Grain, FxDefs} from './fx/Overlays';

type Shot = (typeof TL.shots)[number];
const W = 1280;
const H = 720;

export function marksFor(sh: Shot): Record<string, number> {
  const m: Record<string, number> = {};
  for (const l of TL.lines) {
    if (l.start >= sh.start - 1.5 && l.start < sh.end + 1.5) {
      m[l.id] = l.start - sh.start;
      m[l.id + 'e'] = l.end - sh.start;
    }
  }
  return m;
}

const ShotLayer: React.FC<{sh: Shot; t: number; style?: React.CSSProperties; freeze?: number}> = ({sh, t, style, freeze}) => {
  const Comp = SHOTS[sh.id];
  const local = freeze !== undefined ? freeze : t - sh.start;
  const props: ShotProps = {t: local, dur: sh.end - sh.start, m: marksFor(sh), abs: t};
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', ...style}}>
      {Comp ? <Comp {...props} /> : <AbsoluteFill style={{background: '#221A44', color: 'white', fontSize: 40, alignItems: 'center', justifyContent: 'center'}}>{sh.id}</AbsoluteFill>}
    </div>
  );
};

type R = {x: number; y: number; w: number; h: number};
const FULL: R = {x: 0, y: 0, w: W, h: H};
const lerpR = (a: R, b: R, t: number): R => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t)});
const DEF_FOCUS: R = {x: 440, y: 230, w: 400, h: 225};
// transform that maps rect F (in layer space) to rect R (screen)
const mapRect = (F: R, Rr: R): React.CSSProperties => {
  const s = Rr.w / F.w;
  const sy = Rr.h / F.h;
  return {transformOrigin: '0 0', transform: `translate(${Rr.x - F.x * s}px, ${Rr.y - F.y * sy}px) scale(${s}, ${sy})`};
};
const clipR = (Rr: R, round = 18): string => `inset(${Rr.y}px ${W - Rr.x - Rr.w}px ${H - Rr.y - Rr.h}px ${Rr.x}px round ${round}px)`;

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / TL.fps;
  const shots = TL.shots;
  let idx = shots.findIndex((s) => t >= s.start && t < s.end);
  if (idx < 0) idx = shots.length - 1;
  const cur = shots[idx];
  const next = shots[idx + 1];
  const prev = shots[idx - 1];

  // which boundary are we near?
  let A: Shot | null = null;
  let B: Shot | null = null;
  let p = 0;
  if (next && next.trans !== 'cut' && t >= next.start - next.tdur / 2) {
    A = cur;
    B = next;
    p = (t - (next.start - next.tdur / 2)) / next.tdur;
  } else if (prev && cur.trans !== 'cut' && t < cur.start + cur.tdur / 2) {
    A = prev;
    B = cur;
    p = (t - (cur.start - cur.tdur / 2)) / cur.tdur;
  }
  p = clamp(p);

  let layers: React.ReactNode;
  let flash = 0;
  let flashColor = C.gold;
  let glitch = 0;
  let ripple = 0;
  let ring: {r: number} | null = null;
  let iris = 0;
  let bandFlash = 0;

  if (A && B) {
    const kind = B.trans;
    const F: R = (FOCUS[A.id] as R) ?? DEF_FOCUS;
    if (kind === 'dive' || kind === 'rect' || kind === 'coat') {
      const e = kind === 'rect' ? easeInOut(p) : easeIn(p) * 0.35 + easeInOut(p) * 0.65;
      const Rr = lerpR(F, FULL, e);
      layers = (
        <>
          <ShotLayer sh={A} t={t} style={{...mapRect(F, Rr), filter: `brightness(${1 + e * 0.4})`}} />
          <ShotLayer sh={B} t={t} style={{clipPath: clipR(Rr, 18 * (1 - e)), transform: `scale(${1.12 - 0.12 * e})`, boxShadow: '0 0 40px rgba(255,255,255,0.4)'}} />
        </>
      );
      flash = kind === 'coat' ? Math.sin(p * Math.PI) * 0.35 : Math.sin(p * Math.PI) * 0.12;
      flashColor = kind === 'coat' ? C.blue : '#ffffff';
    } else if (kind === 'diveout') {
      const G: R = (FOCUS[B.id + ':in'] as R) ?? DEF_FOCUS;
      const e = easeInOut(p);
      const Rr = lerpR(FULL, G, e);
      layers = (
        <>
          <ShotLayer sh={B} t={t} style={{...mapRect(G, lerpR(FULL, G, 0)), ...mapRect(G, lerpR({x: -G.x * (W / G.w), y: -G.y * (H / G.h), w: W * (W / G.w), h: H * (H / G.h)}, G, e)), ...{}}} />
          <ShotLayer sh={A} t={t} style={{...mapRect(FULL, Rr), boxShadow: '0 0 30px rgba(0,0,0,0.6)'}} />
        </>
      );
      // B: from zoomed (G fills screen) to normal
      const zoom = lerp(W / G.w, 1, e);
      const cx = G.x + G.w / 2;
      const cy = G.y + G.h / 2;
      layers = (
        <>
          <ShotLayer sh={B} t={t} style={{transformOrigin: `${cx}px ${cy}px`, transform: `translate(${(W / 2 - cx) * (1 - e)}px, ${(H / 2 - cy) * (1 - e)}px) scale(${zoom})`}} />
          <ShotLayer sh={A} t={t} style={{...mapRect(FULL, Rr), borderRadius: 12 * e, overflow: 'hidden', opacity: 1 - smooth(inv(0.82, 1, p))}} />
        </>
      );
    } else if (kind === 'layer' || kind === 'split') {
      const bands = kind === 'split' ? 1 : 3;
      const els = [];
      for (let i = 0; i < bands; i++) {
        const d = i * 0.12;
        const e = easeInOut(clamp((p - d) / (1 - 0.24)));
        const y0 = (H / bands) * i;
        els.push(
          <div key={i} style={{position: 'absolute', left: 0, top: y0, width: W, height: H / bands + 1, overflow: 'hidden', transform: `translateX(${(1 - e) * W}px)`}}>
            <div style={{position: 'absolute', left: 0, top: -y0, width: W, height: H}}>
              <ShotLayer sh={B} t={t} />
            </div>
          </div>,
        );
      }
      layers = (
        <>
          <ShotLayer sh={A} t={t} style={{transform: `translateX(${-easeInOut(p) * W * 0.25}px)`, filter: `brightness(${1 - p * 0.5})`}} />
          {els}
        </>
      );
    } else if (kind === 'flatten') {
      const a = easeIn(clamp(p * 2));
      const b = easeOut(clamp(p * 2 - 1));
      layers =
        p < 0.5 ? (
          <ShotLayer sh={A} t={t} style={{transform: `scaleY(${1 - a * 0.985}) scaleX(${1 + a * 0.08})`, filter: `brightness(${1 + a * 1.2})`}} />
        ) : (
          <ShotLayer sh={B} t={t} style={{transform: `scaleY(${0.015 + b * 0.985}) scaleX(${1.08 - b * 0.08})`, filter: `brightness(${2.2 - b * 1.2})`}} />
        );
      bandFlash = Math.max(0, 1 - Math.abs(p - 0.5) * 6);
    } else if (kind === 'loop') {
      const e = easeInOut(p);
      const r = e * 820;
      ring = {r};
      ripple = Math.sin(p * Math.PI);
      layers = (
        <>
          <ShotLayer sh={A} t={t} style={{transform: `scale(${1 + e * 0.08}) rotate(${e * 4}deg)`, filter: `url(#fx-ripple) hue-rotate(${e * 40}deg)`}} />
          <ShotLayer sh={B} t={t} style={{clipPath: `circle(${r}px at 640px 360px)`, transform: `scale(${1.14 - e * 0.14}) rotate(${(1 - e) * -6}deg)`, filter: p < 0.9 ? 'url(#fx-ripple)' : undefined}} />
        </>
      );
    } else if (kind === 'eye') {
      const E = (FOCUS[A.id + ':eye'] as R) ?? {x: 640, y: 300, w: 0, h: 0};
      if (p < 0.5) {
        const a = easeIn(p * 2);
        layers = <ShotLayer sh={A} t={t} style={{transformOrigin: `${E.x}px ${E.y}px`, transform: `scale(${1 + a * 5})`, clipPath: `circle(${lerp(900, 0, a)}px at ${E.x}px ${E.y}px)`}} />;
      } else {
        const b = easeOut(p * 2 - 1);
        layers = <ShotLayer sh={B} t={t} style={{clipPath: `ellipse(${b * 900}px ${b * 560}px at 640px 380px)`, transform: `scale(${1.08 - b * 0.08})`}} />;
      }
      iris = 1;
    } else if (kind === 'detach') {
      if (p < 0.5) {
        const a = easeIn(p * 2);
        layers = <ShotLayer sh={A} t={t} style={{transform: `scale(${1 - a * 0.1}) translateY(${a * 20}px)`, filter: `blur(${a * 6}px)`}} />;
      } else {
        const b = easeOut(p * 2 - 1);
        layers = <ShotLayer sh={B} t={t} style={{transform: `scale(${1.3 - b * 0.3})`, filter: `blur(${(1 - b) * 6}px)`}} />;
      }
      flash = Math.max(0, 1 - Math.abs(p - 0.5) * 4) * 0.5;
      flashColor = '#000000';
    } else if (kind === 'flash') {
      layers = p < 0.5 ? <ShotLayer sh={A} t={t} style={{transform: `scale(${1 + p * 0.1})`}} /> : <ShotLayer sh={B} t={t} style={{transform: `scale(${1.06 - (p - 0.5) * 0.12})`}} />;
      flash = Math.max(0, 1 - Math.abs(p - 0.5) * 2.4);
      flashColor = C.gold;
    } else if (kind === 'impact') {
      const freezeAt = B.start - B.tdur / 2 - A.start;
      if (p < 0.5) {
        layers = <ShotLayer sh={A} t={t} freeze={freezeAt} style={{transform: `scale(${1.04})`, filter: p > 0.25 ? 'invert(1) hue-rotate(180deg)' : undefined}} />;
      } else {
        const sh = (1 - (p - 0.5) * 2) * 12;
        layers = <ShotLayer sh={B} t={t} style={{transform: `translate(${noise1(t * 80, 4) * sh}px, ${noise1(t * 80, 9) * sh}px)`}} />;
      }
      glitch = Math.max(0, 1 - Math.abs(p - 0.5) * 3);
    } else if (kind === 'glitch') {
      layers = p < 0.5 ? <ShotLayer sh={A} t={t} /> : <ShotLayer sh={B} t={t} />;
      glitch = Math.max(0, 1 - Math.abs(p - 0.5) * 2);
    } else {
      layers = <ShotLayer sh={p < 0.5 ? A : B} t={t} />;
    }
  } else {
    layers = <ShotLayer sh={cur} t={t} />;
  }

  // reveal glitches from cues
  for (const c of TL.sfx) {
    if (c.kind === 'glitch' && t >= c.t - 0.02 && t < c.t + 0.22) glitch = Math.max(glitch, 1 - (t - c.t) / 0.24);
  }
  const showHudCaps = t < TL.hud.off;

  return (
    <AbsoluteFill style={{background: C.base, overflow: 'hidden'}}>
      <FxDefs frame={frame} glitch={glitch} ripple={ripple} />
      <div style={{position: 'absolute', inset: 0, filter: glitch > 0.05 ? 'url(#fx-glitch)' : undefined}}>{layers}</div>
      {ring ? (
        <div style={{position: 'absolute', left: 640 - ring.r, top: 360 - ring.r, width: ring.r * 2, height: ring.r * 2, borderRadius: '50%', border: `6px solid ${C.violet}`, boxShadow: `0 0 40px ${C.violet}, inset 0 0 40px ${C.violet}`, pointerEvents: 'none'}} />
      ) : null}
      {bandFlash > 0 ? <div style={{position: 'absolute', left: 0, right: 0, top: 357, height: 6, background: 'white', opacity: bandFlash, boxShadow: '0 0 30px white'}} /> : null}
      {flash > 0 ? <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%, ${flashColor} 0%, ${flashColor}cc 40%, ${flashColor}00 100%)`, opacity: flash, mixBlendMode: flashColor === '#000000' ? 'multiply' : 'screen'}} /> : null}
      {iris ? null : null}
      <Vignette />
      <Scanlines />
      <Grain frame={frame} />
      {showHudCaps ? <CaptionBand /> : null}
      <HUD t={t} />
      {showHudCaps ? <Captions t={t} /> : null}
    </AbsoluteFill>
  );
};
