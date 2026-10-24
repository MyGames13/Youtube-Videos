import {ShotFn} from './types';
import {HOOK} from './hook';
import {THING1} from './thing1';
import {THING2} from './thing2';
import {THING3} from './thing3';
import {THING4} from './thing4';
import {REVEAL} from './reveal';
import {ESCAPE} from './escape';
import {TURN} from './turn';

export const SHOT_FNS: Record<string, ShotFn> = {
	...HOOK,
	...THING1,
	...THING2,
	...THING3,
	...THING4,
	...REVEAL,
	...ESCAPE,
	...TURN,
};
