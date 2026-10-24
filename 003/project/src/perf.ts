import {getInputProps} from 'remotion';

// Render quality switches (input props `perf`), so render cost can be measured and tuned.
const p = ((getInputProps() as {perf?: Record<string, number>}).perf ?? {}) as Record<string, number>;
export const PERF = {
	msaa: p.msaa ?? 0, // MSAA samples (0: the composite pass applies FXAA instead, far cheaper in SwiftShader)
	shadows: p.shadows ?? 1,
	half: p.half ?? 1, // HalfFloat render targets (HDR bloom)
	post: p.post ?? 1,
	bloom: p.bloom ?? 1,
	dpr: p.dpr ?? 1, // test only: canvas pixel ratio
	noise: p.noise ?? 1, // film grain and dither in the composite
	photo: p.photo ?? 1,
};
