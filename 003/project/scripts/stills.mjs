// Render every Nth frame of a range in one browser session, for contact sheets.
// usage: node scripts/stills.mjs <from> <to> <every> <outDir> [scale]
import {bundle} from '@remotion/bundler';
import {renderFrames, selectComposition} from '@remotion/renderer';
import path from 'path';
const [from, to, every, outDir, scale] = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => undefined});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = {gl: 'swangle'};
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'Notice003', browserExecutable, chromiumOptions});
await renderFrames({
	composition,
	serveUrl,
	inputProps: {},
	outputDir: path.resolve(outDir),
	imageFormat: 'jpeg',
	jpegQuality: 88,
	frameRange: [Number(from), Number(to)],
	everyNthFrame: Number(every),
	concurrency: 2,
	browserExecutable,
	chromiumOptions,
	scale: scale ? Number(scale) : 1,
	onStart: () => undefined,
	onFrameUpdate: () => undefined,
});
console.log('done');
