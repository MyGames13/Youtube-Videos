import React from 'react';
import {Workshop} from './Workshop';
import * as P from '../two/Panels';
import {Station} from './Station';
import {Billiard} from './Billiard';
import {Footprints} from './Footprints';
import {Space} from './Space';
import {Party} from './Party';
import {Kitchen} from './Kitchen';

export type ShotProps = {t: number; dur: number; m: Record<string, number>; abs: number};
type F = React.FC<ShotProps>;
const ws = (v: any): F => (p) => React.createElement(Workshop, {t: p.t, v, dur: p.dur, m: p.m});

export const SHOTS: Record<string, F> = {
  ws_hook: ws('hook'),
  mem_call: P.MemCall,
  mem_funeral: P.MemFuneral,
  ws_charge: ws('charge'),
  useless: P.Useless,
  ring_promise: P.RingPromise,
  station_cancel: (p) => React.createElement(Station, {...p, v: 'cancel'}),
  zip_fp: (p) => React.createElement(Station, {...p, v: 'zip'}),
  taxi: P.Taxi,
  call_panel: P.CallPanel,
  race: (p) => React.createElement(Station, {...p, v: 'race'}),
  rule_freeze: P.RuleFreeze,
  novikov: P.Novikov,
  film: P.Film,
  billiard_a: (p) => React.createElement(Billiard, {...p, v: 'a'}),
  billiard_b: (p) => React.createElement(Billiard, {...p, v: 'b'}),
  footprints: Footprints,
  real: P.Real,
  space: Space,
  paper: P.PaperPanel,
  party: Party,
  branches: P.Branches,
  floor: ws('floor'),
  crown_fp: ws('crown'),
  stand: ws('stand'),
  door_fp: (p) => React.createElement(Kitchen, {...p, v: 'door'}),
  kitchen_reveal: (p) => React.createElement(Kitchen, {...p, v: 'reveal'}),
  split: (p) => React.createElement(Kitchen, {...p, v: 'split'}),
  kitchen_sees: (p) => React.createElement(Kitchen, {...p, v: 'sees'}),
  cup_fp: (p) => React.createElement(Kitchen, {...p, v: 'cup'}),
  kitchen_wide: (p) => React.createElement(Kitchen, {...p, v: 'wide'}),
  neighbor: (p) => React.createElement(Kitchen, {...p, v: 'neighbor'}),
  loop_closed: (p) => React.createElement(Kitchen, {...p, v: 'closed'}),
  now_ring: P.NowRing,
  present: ws('present'),
  black: P.Black,
  endcard: P.EndCard,
};

// focus rects for dives (outgoing shot: where the camera dives) and dive outs (incoming: where the old shot lands)
export const FOCUS: Record<string, {x: number; y: number; w: number; h: number}> = {
  ws_hook: {x: 640, y: 196, w: 72, h: 84},
  'ws_charge:in': {x: 625, y: 150, w: 260, h: 150},
  mem_call: {x: 400, y: 200, w: 480, h: 270},
  call_panel: {x: 660, y: 40, w: 590, h: 640},
  race: {x: 440, y: 250, w: 400, h: 225},
  film: {x: 560, y: 240, w: 260, h: 230},
  paper: {x: 450, y: 340, w: 240, h: 190},
  'floor:in': {x: 760, y: 300, w: 160, h: 90},
  'station_cancel:eye': {x: 640, y: 300, w: 0, h: 0},
  'floor:eye': {x: 640, y: 300, w: 0, h: 0},
  'kitchen_sees:eye': {x: 640, y: 300, w: 0, h: 0},
  kitchen_sees: {x: 560, y: 260, w: 160, h: 90},
  kitchen_wide: {x: 560, y: 260, w: 160, h: 90},
  neighbor: {x: 600, y: 300, w: 80, h: 45},
  zip_fp: {x: 440, y: 250, w: 400, h: 225},
};
