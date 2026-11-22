// The screenshot scenes behind ?shot=start|patrol|alert|escape. The title scene plays the
// real rules forward from a fresh world, so the frame is what a short game really looks
// like; the other three pose the world by hand — guard positions, suspicion and relics —
// so each shot shows exactly the moment it names, with the same seed always giving the
// same frame.
import { STEP } from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './guards.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function idle(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, { dx: 0, dy: 0, sneak: false });
  }
}

function placeGuard(world, index, x, y, angle, state, suspicion) {
  const guard = world.state.guards[index];
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.state = state;
  guard.suspicion = suspicion;
  guard.pause = 0;
  guard.lookTimer = 0;
  guard.investigate = null;
}

function placePlayer(world, x, y, angle, sneaking) {
  const player = world.state.player;
  player.x = x;
  player.y = y;
  player.angle = angle;
  player.sneaking = sneaking;
  player.moving = false;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score
 * to show. Any unknown name stages the title scene.
 */
export function stageShot(name, world) {
  world.loadLevel(0);
  if (name === 'patrol') {
    // Mid-heist: one relic pocketed, the thief crouched between two patrols, a guard's
    // cone sweeping just past the crate that hides them.
    world.state.relics[0].taken = true;
    world.state.score = 250;
    placeGuard(world, 0, 700, 100, 0, 'patrol', 0.1);
    placeGuard(world, 1, 920, 260, Math.PI, 'patrol', 0.05);
    placeGuard(world, 2, 300, 500, 0, 'patrol', 0.2);
    placePlayer(world, 620, 170, Math.PI * 0.75, true);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alert') {
    // The near miss: a guard has the thief dead in its cone, suspicion almost full, the
    // alarm meter climbing and a second guard turning to look.
    world.state.relics[0].taken = true;
    world.state.score = 250;
    world.state.alarm = 0.85;
    placeGuard(world, 0, 500, 110, 0.35, GUARD_ALERT, 1);
    world.state.guards[0].chaseTarget = { x: 640, y: 140 };
    placeGuard(world, 1, 920, 260, Math.PI * 0.85, GUARD_SUSPICIOUS, 0.7);
    placeGuard(world, 2, 300, 500, 0.3, 'patrol', 0.1);
    placePlayer(world, 640, 140, Math.PI * 0.5, false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'escape') {
    // The getaway: every relic pocketed, the exit glowing green, the thief one step from
    // the door with a patrol passing behind.
    for (const relic of world.state.relics) relic.taken = true;
    world.state.exit.open = true;
    world.state.score = 1000;
    placeGuard(world, 0, 700, 100, 0, 'patrol', 0);
    placeGuard(world, 1, 900, 340, Math.PI, 'patrol', 0);
    placeGuard(world, 2, 640, 540, Math.PI, 'patrol', 0.15);
    placePlayer(world, 1150, 540, 0, true);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  idle(world, 3);
  return { screen: SCREEN_TITLE, best: 1250 };
}
