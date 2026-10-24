import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {ThumbA, ThumbB} from './Thumbs';
import TL from './timeline.json';
export const Root: React.FC = () => (
  <>
    <Composition id="Loophole001" component={Main} durationInFrames={TL.frames} fps={30} width={1280} height={720} />
    <Composition id="ThumbA" component={ThumbA} durationInFrames={1} fps={30} width={1280} height={720} />
    <Composition id="ThumbB" component={ThumbB} durationInFrames={1} fps={30} width={1280} height={720} />
  </>
);
