// Film finish: vignette, scanlines, low frequency grain, glitch filter definitions.
import React from 'react';
import {hash} from '../lib/anim';

export const Vignette: React.FC<{amount?: number}> = ({amount = 0.2}) => (
  <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(3,2,12,${amount + 0.25}) 100%)`}} />
);

export const Scanlines: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.02, background: 'repeating-linear-gradient(to bottom, #fff 0px, #fff 1px, transparent 1px, transparent 3px)'}} />
);

// grain: low frequency noise that changes every 2 frames, about 3 percent
export const Grain: React.FC<{frame: number}> = ({frame}) => {
  const seed = Math.floor(frame / 2) % 97;
  return (
    <svg width="1280" height="720" style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.035, mixBlendMode: 'overlay'}}>
      <filter id={`grain${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1280" height="720" filter={`url(#grain${seed})`} />
    </svg>
  );
};

// SVG filters used via CSS filter: url(#...) on scene layers
export const FxDefs: React.FC<{frame: number; glitch: number; ripple: number}> = ({frame, glitch, ripple}) => {
  const seed = Math.floor(hash(frame) * 1000);
  const disp = 6 + glitch * 10;
  const split = 3 + glitch * 3;
  return (
    <svg width="0" height="0" style={{position: 'absolute'}}>
      <defs>
        <filter id="fx-glitch" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0001 0.06" numOctaves="1" seed={seed} result="n" />
          <feComponentTransfer in="n" result="steps">
            <feFuncR type="discrete" tableValues="0 0.5 0.5 1 0.5 0 0.5" />
            <feFuncG type="discrete" tableValues="0.5" />
          </feComponentTransfer>
          <feDisplacementMap in="SourceGraphic" in2="steps" scale={disp * 2} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={split} result="ro" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx={-split} result="bo" />
          <feBlend in="ro" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="bo" mode="screen" />
        </filter>
        <filter id="fx-ripple" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="turbulence" baseFrequency="0.012" numOctaves="2" seed={(frame % 50) + 3} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={ripple * 38} xChannelSelector="R" yChannelSelector="B" />
        </filter>
      </defs>
    </svg>
  );
};
