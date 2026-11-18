// Harbor Master — tuning and look, in one place.
// Canvas is a fixed 1280x720 world; the page scales it to the window.

export const W = 1280;
export const H = 720;

export const SEA_BOTTOM = 600; // y where the quay starts
export const QUAY_TOP = 600;

// Palette: one calm harbour day. Sea deep teal, quay warm sand, docks in
// four loud cargo colours so a ship's colour always reads at a glance.
export const COLORS = {
  seaDeep: '#0d4a5c',
  seaShallow: '#17708a',
  seaFoam: 'rgba(255,255,255,0.16)',
  quay: '#e6d9b8',
  quayEdge: '#b8a67e',
  quayDark: '#c9b78d',
  pierWood: '#8a6b46',
  pierWoodDark: '#6f5638',
  pierEdge: '#5d4830',
  hudBg: 'rgba(6,32,44,0.82)',
  hudText: '#eaf6f8',
  hudDim: '#9fc3cd',
  gold: '#f5c542',
  white: '#ffffff',
  ink: '#123240',
  danger: '#e5484d',
  ok: '#37b24d',
};

// The four docks. A ship's cargo colour always matches exactly one dock.
export const DOCKS = [
  { id: 0, key: '1', color: '#e4572e', name: 'RED', x: 200 },
  { id: 1, key: '2', color: '#2e86e4', name: 'BLUE', x: 480 },
  { id: 2, key: '3', color: '#2fa36b', name: 'GREEN', x: 760 },
  { id: 3, key: '4', color: '#eab308', name: 'YELLOW', x: 1040 },
];
export const PIER_W = 96; // pier width
export const PIER_TOP = 470; // pier head (top edge, in the water)
export const PIER_BOTTOM = 600; // pier foot meets the quay
export const BERTH_Y = 428; // ship centre when docked (bow at the pier head)
export const APPROACH_Y = 372; // waypoint just above the berth
export const HOLD_Y = 300; // unassigned ships hold around this line

// Ship types. len/width in px, speed in px/s, score is the base reward.
export const SHIP_TYPES = {
  cargo: { len: 96, wid: 36, speed: 44, score: 100, weight: 5 },
  tanker: { len: 112, wid: 40, speed: 34, score: 150, weight: 3 },
  ferry: { len: 84, wid: 38, speed: 52, score: 120, weight: 3 },
  liner: { len: 122, wid: 44, speed: 30, score: 200, weight: 1 },
};

export const TURN_RATE = 1.7; // rad/s — ships turn slowly, like ships
export const SPAWN_INTERVAL_START = 4.6; // seconds between arrivals
export const SPAWN_INTERVAL_MIN = 2.0;
export const SPAWN_INTERVAL_STEP = 0.35; // shaved off per level
export const SHIPS_PER_LEVEL = 6; // unloads that raise the level
export const MAX_CONCURRENT_START = 3;
export const MAX_CONCURRENT_CAP = 6;
export const UNLOAD_MATCH_S = 4.0; // seconds to unload at the right dock
export const UNLOAD_WRONG_S = 8.0; // ...at the wrong dock
export const MAX_STRIKES = 3;
export const FOG_FROM_LEVEL = 3;
export const VIP_BONUS = 300; // flat bonus for docking a VIP liner in time
export const VIP_TIME_S = 30; // seconds a VIP liner waits before sailing off
export const RUSH_FIRST_S = 45; // first rush hour, seconds into the game
export const RUSH_INTERVAL_S = 60; // seconds between rush hours
export const RUSH_WAVE = 3; // ships in a rush-hour wave
export const RUSH_MAX_ACTIVE = 8; // absolute ceiling, even during a rush
export const COMBO_CAP = 5; // consecutive correct docks counted
export const COMBO_STEP = 0.5; // +0.5x per combo step, capped at x3
export const COMBO_MAX_MULT = 3.0;

// Boss ship: the Storm Galleon, one per every 5th level. Big, slow, 45 s
// on the clock, 500 points if docked in time — sails away free if not.
export const BOSS_TIME_S = 45;
export const BOSS_SCORE = 500;
export const BOSS_LEN = 244; // ~2x a liner
export const BOSS_WID = 88;
export const BOSS_SPEED = 22;

// Level-up shop: one free upgrade per level. Each pick stacks up to its
// max; Golden Anchor is once-only and permanent.
export const UPGRADE_DEFS = [
  { id: 'crane', name: 'CRANE SPEED', desc: ['Unload 25% faster', 'per level'], max: 3 },
  { id: 'hull', name: 'EXTRA HULL', desc: ['+1 strike buffer', 'per level'], max: 3 },
  { id: 'tug', name: 'TUGBOAT', desc: ['Auto-guides 1 ship', 'per level'], max: 3 },
  { id: 'anchor', name: 'GOLDEN ANCHOR', desc: ['Combo survives a', 'wrong dock — once'], max: 1 },
];
