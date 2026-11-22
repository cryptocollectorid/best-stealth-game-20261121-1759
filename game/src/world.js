// The game's rules and state, with no drawing and no browser in it: the player, the guards,
// the relics, the exit, the alarm, the score and the lives. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import { FIELD, GHOST_BONUS, GUARD, LIVES, PLAYER, RELIC_POINTS, TILE } from './config.js';
import { createGuard, guardSeesPlayer, hearNoise, updateGuard } from './guards.js';
import { moveCircle } from './geometry.js';
import { LEVEL_COUNT, parseLevel } from './levels.js';

export const EVENT_PICKUP = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL_DONE = 4;
export const EVENT_WIN = 8;
export const EVENT_GAMEOVER = 16;
export const EVENT_ALARM_ON = 32;
export const EVENT_SUSPICIOUS = 64;
export const EVENT_NOISE = 128;

function inRect(x, y, rect, margin) {
  return x >= rect.x - margin && x <= rect.x + rect.width + margin && y >= rect.y - margin && y <= rect.y + rect.height + margin;
}

export function createWorld() {
  const player = { x: 0, y: 0, angle: 0, moving: false, sneaking: false, inShadow: false };
  const state = {
    level: null,
    levelIndex: 0,
    player,
    guards: [],
    relics: [],
    exit: { x: 0, y: 0, open: false },
    pebbles: PLAYER.pebblesPerLevel,
    lives: LIVES,
    score: 0,
    totalTime: 0,
    levelTime: 0,
    alarm: 0,
    alarmSeenTimer: 0,
    ghost: true,
    status: 'play',
    statusTimer: 0,
    noise: null,
    levelBonus: 0,
  };

  function loadLevel(index) {
    const level = parseLevel(index);
    state.level = level;
    state.levelIndex = index;
    state.guards = level.guards.map((def, i) => createGuard(def, i));
    state.relics = level.relics;
    state.exit = { x: level.exit.x, y: level.exit.y, open: false };
    player.x = level.playerStart.x;
    player.y = level.playerStart.y;
    player.angle = 0;
    player.moving = false;
    player.sneaking = false;
    player.inShadow = false;
    state.pebbles = PLAYER.pebblesPerLevel;
    state.levelTime = 0;
    state.alarm = 0;
    state.alarmSeenTimer = 0;
    state.ghost = true;
    state.status = 'play';
    state.statusTimer = 0;
    state.noise = null;
    state.levelBonus = 0;
  }

  function resetGame() {
    state.score = 0;
    state.lives = LIVES;
    state.totalTime = 0;
    loadLevel(0);
  }

  function respawn() {
    const level = state.level;
    state.guards = level.guards.map((def, i) => createGuard(def, i));
    player.x = level.playerStart.x;
    player.y = level.playerStart.y;
    player.angle = 0;
    player.moving = false;
    state.alarm = 0;
    state.alarmSeenTimer = 0;
    state.status = 'play';
    state.statusTimer = 0;
    state.noise = null;
  }

  /** Throw a pebble at (x, y): the clatter pulls nearby guards over to look. */
  function throwPebble(x, y) {
    if (state.status !== 'play' || state.pebbles <= 0) return false;
    const dist = Math.hypot(x - player.x, y - player.y);
    if (dist > PLAYER.throwRange) return false;
    state.pebbles -= 1;
    state.noise = { x, y, t: 0.7 };
    for (const guard of state.guards) hearNoise(guard, { x, y }, GUARD.noiseRadius);
    return true;
  }

  /**
   * One fixed step. `input` is { dx, dy, sneak } with dx/dy in -1..1. Returns event flags.
   * The caller steps the world only while the status is 'play' or 'caught'.
   */
  function step(dt, input) {
    let events = 0;
    if (state.status === 'caught') {
      state.statusTimer -= dt;
      if (state.statusTimer <= 0) {
        if (state.lives <= 0) {
          state.status = 'gameover';
          events |= EVENT_GAMEOVER;
        } else {
          respawn();
        }
      }
      return events;
    }
    if (state.status !== 'play') return events;

    state.totalTime += dt;
    state.levelTime += dt;
    if (state.noise) {
      state.noise.t -= dt;
      if (state.noise.t <= 0) state.noise = null;
    }

    // The player: sneak is slower and quieter, and the walls slide you along.
    const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(input.dx, input.dy);
    const nx = len > 0 ? input.dx / len : 0;
    const ny = len > 0 ? input.dy / len : 0;
    player.moving = len > 0;
    player.sneaking = input.sneak && len > 0;
    if (len > 0) player.angle = Math.atan2(ny, nx);
    const moved = moveCircle(player.x, player.y, PLAYER.radius, nx * speed * dt, ny * speed * dt, state.level.solids);
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, moved.x));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, moved.y));
    player.inShadow = state.level.bushes.some((b) => inRect(player.x, player.y, b, -4));

    // Relics: walk over one to pocket it.
    for (const relic of state.relics) {
      if (!relic.taken && Math.hypot(relic.x - player.x, relic.y - player.y) < 26) {
        relic.taken = true;
        state.score += RELIC_POINTS;
        events |= EVENT_PICKUP;
      }
    }
    if (!state.exit.open && state.relics.every((r) => r.taken)) state.exit.open = true;

    // The exit, once all relics are pocketed.
    if (state.exit.open && Math.hypot(state.exit.x - player.x, state.exit.y - player.y) < 30) {
      const timeBonus = Math.max(0, Math.round(400 - state.levelTime * 2));
      state.levelBonus = timeBonus + (state.ghost ? GHOST_BONUS : 0);
      state.score += state.levelBonus;
      if (state.levelIndex + 1 >= LEVEL_COUNT) {
        state.status = 'win';
        events |= EVENT_WIN;
      } else {
        state.status = 'leveldone';
        events |= EVENT_LEVEL_DONE;
      }
      return events;
    }

    // The guards: what each one sees, and whether the alarm is still on.
    let anySeen = false;
    let anySuspicious = false;
    const alarmOn = state.alarm > 0.5;
    for (const guard of state.guards) {
      const seen = guardSeesPlayer(guard, player, state.level.blockers);
      if (seen) anySeen = true;
      if (guard.suspicion >= 0.55) anySuspicious = true;
      if (updateGuard(guard, dt, seen, alarmOn, player, state.level.solids)) {
        state.lives -= 1;
        state.status = 'caught';
        state.statusTimer = 1.6;
        events |= EVENT_CAUGHT;
        return events;
      }
    }
    if (anySuspicious) events |= EVENT_SUSPICIOUS;

    if (state.guards.some((g) => g.suspicion >= 1) && state.alarm < 1) {
      state.alarm = 1;
      state.ghost = false;
      state.alarmSeenTimer = 0;
      events |= EVENT_ALARM_ON;
    }
    if (state.alarm > 0) {
      if (anySeen) state.alarmSeenTimer = 0;
      else {
        state.alarmSeenTimer += dt;
        if (state.alarmSeenTimer > GUARD.alarmCooldown) {
          state.alarm = Math.max(0, state.alarm - dt * 0.3);
        }
      }
    }
    return events;
  }

  resetGame();
  return { state, loadLevel, resetGame, step, throwPebble };
}
