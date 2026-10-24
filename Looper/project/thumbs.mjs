import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'path';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
for (const id of ['ThumbA', 'ThumbB']) {
  const comp = await selectComposition({serveUrl, id, browserExecutable});
  await renderStill({composition: comp, serveUrl, output: `../output/thumbnail_${id.slice(-1).toLowerCase()}.png`, frame: 0, browserExecutable, imageFormat: 'png'});
}
console.log('thumbs done');
