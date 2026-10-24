// Bundle src/events.ts and write audio/events.json for the sound build.
import {build} from 'esbuild';
import {writeFileSync} from 'fs';
import {createRequire} from 'module';
const out = '/tmp/notice003-events.cjs';
await build({entryPoints: ['src/events.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error'});
const require = createRequire(import.meta.url);
const ev = require(out).exportEvents();
writeFileSync('audio/events.json', JSON.stringify(ev, null, 1));
for (const s of ev.shots) console.log(s.id.padEnd(14), s.start.toFixed(2).padStart(7), (s.end - s.start).toFixed(2).padStart(6), s.trans);
