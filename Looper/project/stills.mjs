// Render chosen timestamps (seconds) to PNGs with one bundle. Usage: node stills.mjs out_prefix t1 t2 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'path';
const [prefix, ...times] = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), webpackOverride: (c) => c});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = {gl: 'swangle'};
const comp = await selectComposition({serveUrl, id: 'Loophole001', browserExecutable, chromiumOptions});
for (const t of times) {
  const frame = Math.min(comp.durationInFrames - 1, Math.round(parseFloat(t) * 30));
  await renderStill({composition: comp, serveUrl, output: `${prefix}_${t}.png`, frame, browserExecutable, chromiumOptions, imageFormat: 'png'});
  process.stdout.write(`${t} `);
}
console.log('done');
