import React from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// local copies of the open licensed variable fonts (OFL), loaded before any frame renders
export const MONT = 'Montserrat';
export const MONO = 'JetBrains Mono';
if (typeof document !== 'undefined' && !(window as any).__loopholeFonts) {
  (window as any).__loopholeFonts = true;
  const h = delayRender('fonts');
  const faces = [
    new FontFace(MONT, `url(${staticFile('fonts/Montserrat-800.woff2')}) format('woff2')`, {weight: '100 900'}),
    new FontFace(MONO, `url(${staticFile('fonts/JetBrainsMono-800.woff2')}) format('woff2')`, {weight: '100 800'}),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((loaded) => {
      loaded.forEach((f) => (document.fonts as any).add(f));
      continueRender(h);
    })
    .catch(() => continueRender(h));
}

export const Mono: React.FC<{size: number; color: string; spacing?: number; weight?: number; glow?: boolean; children: React.ReactNode}> = ({size, color, spacing = 2, weight = 500, glow, children}) => (
  <span
    style={{
      fontFamily: `${MONO}, monospace`,
      fontSize: size,
      color,
      letterSpacing: spacing,
      fontWeight: weight,
      whiteSpace: 'nowrap',
      textShadow: glow ? `0 0 14px ${color}, 0 0 4px ${color}` : '0 1px 2px rgba(0,0,0,0.6)',
    }}
  >
    {children}
  </span>
);

export const Heavy: React.FC<{size: number; color?: string; stroke?: number; glow?: string; spacing?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({size, color = '#F4F6F8', stroke = 0, glow, spacing = 0, style, children}) => (
  <span
    style={{
      fontFamily: `${MONT}, sans-serif`,
      fontWeight: 900,
      fontSize: size,
      color,
      letterSpacing: spacing,
      lineHeight: 1,
      WebkitTextStroke: stroke ? `${stroke}px #07061A` : undefined,
      paintOrder: 'stroke fill',
      textShadow: glow ? `0 0 ${size * 0.25}px ${glow}, 0 0 ${size * 0.06}px ${glow}` : undefined,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </span>
);
