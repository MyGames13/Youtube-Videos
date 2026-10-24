import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'path';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = {gl: 'swangle'};
for (const [id, f] of [['ShortHook', 330], ['ShortHook', 1150], ['ShortReveal', 400], ['ShortReveal', 900]]) {
  const comp = await selectComposition({serveUrl, id, browserExecutable, chromiumOptions});
  await renderStill({composition: comp, serveUrl, output: `scratch/v_${id}_${f}.png`, frame: f, browserExecutable, chromiumOptions, imageFormat: 'png'});
}
console.log('ok');
