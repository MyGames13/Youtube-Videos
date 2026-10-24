import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SHOT_TIMES} from './events';
import {defaultFx} from './post/PostFX';
import {globalFx} from './fx';
import {Stage} from './world/Stage';
import {PhotoTexContext} from './world/photoTex';
import {RenderToTexture, useRenderTarget} from './world/Photo';
import {PHOTO_CAM, PhotoWorld} from './world/PhotoWorld';
import {HUD} from './overlay/HUD';
import {CaptionBand, Captions} from './overlay/Captions';
import {EndCard} from './overlay/Kinetic';
import {SHOT_FNS} from './shots';
import {photoCamAt} from './shots/story';
import {Ctx, Out, BOARD_CAM} from './shots/types';
import {Board, bg, text, mono} from './world/Board';

const placeholder = (id: string, c: Ctx): Out => ({
	cam: BOARD_CAM,
	m: 0,
	world: (
		<Board
			draw={(ctx, w, h) => {
				bg(ctx, w, h);
				text(ctx, id, w / 2, h / 2 - 20, {size: 48, color: '#5a6573'});
				mono(ctx, `${c.lt.toFixed(2)} / ${c.dur.toFixed(2)}`, w / 2, h / 2 + 40, 18, '#5a6573', 'center');
			}}
		/>
	),
});

// the photograph is a still: it only needs redrawing when what is in it changes
// (a frozen photo ignores time; a live one, inside the escape, changes every frame)
const photoKey = (s: NonNullable<Out['photo']>, hide?: boolean) => JSON.stringify({...s, t: s.frozen ? 0 : s.t, hide: !!hide});

export const Notice003: React.FC<{fromShot?: string}> = () => {
	const frame = useCurrentFrame();
	const t = frame / 30;
	const rt = useRenderTarget();
	const shot = SHOT_TIMES.find((s) => t >= s.start && t < s.end) ?? SHOT_TIMES[SHOT_TIMES.length - 1];
	const c: Ctx = {t, lt: t - shot.start, dur: shot.end - shot.start, p: (t - shot.start) / (shot.end - shot.start), frame, start: shot.start, end: shot.end};
	const fn = SHOT_FNS[shot.id];
	const out = fn ? fn(c) : placeholder(shot.id, c);
	const fx = {...defaultFx(frame), ...globalFx(t, frame), ...(out.fx ?? {})};
	return (
		<AbsoluteFill style={{background: '#06080B'}}>
			<Stage cam={out.cam} m={out.m} fx={fx} shake={out.shake}>
				{out.photo ? (
					<RenderToTexture rt={rt} cam={out.photoCam ?? photoCamAt(t)} m={0} cacheKey={photoKey(out.photo, out.photoOpts?.hideSubject)}>
						<PhotoWorld s={out.photo} hideSubject={out.photoOpts?.hideSubject} />
					</RenderToTexture>
				) : null}
				<PhotoTexContext.Provider value={rt.texture}>{out.world}</PhotoTexContext.Provider>
			</Stage>
			{out.overlay}
			{out.captions?.hide ? null : (
				<>
					<CaptionBand />
					<Captions t={t} lift={out.captions?.lift} />
				</>
			)}
			{out.hud?.hide ? null : <HUD t={t} frame={frame} opacity={out.hud?.opacity} hideMeter={out.hud?.hideMeter} />}
			<EndCard t={t} t0={SHOT_TIMES[SHOT_TIMES.length - 1].start} />
		</AbsoluteFill>
	);
};
