import React from 'react';
import {Composition} from 'remotion';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/caveat/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import {GLTest} from './GLTest';
import {BlendTest} from './tests/BlendTest';
import {PropSheet} from './tests/PropSheet';
import {Notice003} from './Notice003';
import {Thumbnail} from './Thumbnail';
import timeline from './timeline.json';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition id="GLTest" component={GLTest} durationInFrames={60} fps={30} width={1280} height={720} />
			<Composition id="BlendTest" component={BlendTest} durationInFrames={120} fps={30} width={1280} height={720} />
			<Composition id="Notice003" component={Notice003} durationInFrames={timeline.frames} fps={30} width={1280} height={720} />
			<Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={30} width={1280} height={720} />
			<Composition id="PropSheet" component={PropSheet} durationInFrames={24} fps={30} width={1280} height={720} />
		</>
	);
};
