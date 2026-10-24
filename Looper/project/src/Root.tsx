import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {ThumbA, ThumbB} from './Thumbs';
import {Short} from './Shorts';
import TL from './timeline.json';
export const Root: React.FC = () => (
  <>
    <Composition id="Loophole001" component={Main} durationInFrames={TL.frames} fps={30} width={1280} height={720} />
    <Composition id="ThumbA" component={ThumbA} durationInFrames={1} fps={30} width={1280} height={720} />
    <Composition id="ThumbB" component={ThumbB} durationInFrames={1} fps={30} width={1280} height={720} />
    <Composition id="ShortHook" component={Short} durationInFrames={1195} fps={30} width={720} height={1280} defaultProps={{from: 0, to: 37.24, card: ['WHY IS IT USELESS?', 'FULL VIDEO ON THE CHANNEL'] as [string, string]}} />
    <Composition id="ShortReveal" component={Short} durationInFrames={1134} fps={30} width={720} height={1280} defaultProps={{from: 127.38, to: 162.58, card: ['HOW DID YOU GET THERE?', 'FULL VIDEO ON THE CHANNEL'] as [string, string]}} />
  </>
);
