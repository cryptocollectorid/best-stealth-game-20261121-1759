// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const TILE = 40;
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 96,
  /** Pixels a pebble can be thrown. */
  throwRange: 340,
  pebblesPerLevel: 5,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  chaseSpeed: 152,
  investigateSpeed: 108,
  /** How far a guard can see, in pixels. */
  visionRange: 235,
  /** Half of the vision cone's angle, in radians. */
  visionHalfAngle: 0.66,
  /** Seconds a guard waits at each patrol waypoint. */
  waypointPause: 1.4,
  /** Suspicion 0..1: at this much a guard gets curious and investigates. */
  suspiciousAt: 0.55,
  /** Suspicion 0..1: at this much the alarm goes off and every guard chases. */
  alarmAt: 1,
  /** How fast suspicion grows when the player is dead centre of the cone, per second. */
  suspicionRate: 1.7,
  /** How fast suspicion fades when the player is unseen, per second. */
  suspicionDecay: 0.55,
  /** Sneaking multiplies the suspicion rate by this much. */
  sneakFactor: 0.42,
  /** Hiding in a shadow bush multiplies the suspicion rate by this much. */
  shadowFactor: 0.25,
  /** Standing still multiplies the suspicion rate by this much. */
  stillFactor: 0.8,
  /** Seconds a guard searches the last known spot before giving up. */
  searchTime: 2.5,
  /** Seconds with no guard seeing the player before the alarm cools down. */
  alarmCooldown: 4,
  /** How far a pebble's clatter carries, in pixels. */
  noiseRadius: 185,
};

export const LIVES = 3;
export const RELIC_POINTS = 250;
export const GHOST_BONUS = 400;

export const PALETTE = {
  backdrop: '#0b0e14',
  floorA: '#181c28',
  floorB: '#1b202e',
  floorLine: '#232839',
  wall: '#2e3547',
  wallTop: '#4a5570',
  wallTrim: '#8a6d2f',
  crate: '#6b4a2a',
  crateEdge: '#8a6238',
  caseBase: '#232838',
  caseGlass: '#7fb2d9',
  bush: '#1d3a24',
  bushEdge: '#2c5a35',
  exit: '#37d67a',
  exitGlow: '#1d7a45',
  relic: '#f2c94c',
  relicGlow: '#a67c00',
  player: '#2dd4bf',
  playerDark: '#0f766e',
  guard: '#5b7bc0',
  guardDark: '#2c3f6e',
  guardAlert: '#e5534b',
  cone: '#f2d06b',
  coneSuspicious: '#f2994a',
  coneAlert: '#eb5757',
  panel: '#1c2230',
  panelEdge: '#39415a',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#37d67a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'moonlit-vault.best';
