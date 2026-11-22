// One guard: a patrol loop, a pair of eyes, and a memory. The state machine is small on
// purpose — patrol, suspicious, alert, search — and every transition is driven by what the
// guard can actually see or hear, so a player who learns the patrols can beat it.
import { GUARD } from './config.js';
import { angleDiff, lineOfSight, moveCircle, pointInCone } from './geometry.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';

export function createGuard(def, index) {
  const first = def.waypoints[0];
  return {
    index,
    waypoints: def.waypoints,
    waypoint: 1,
    x: first.x,
    y: first.y,
    angle: 0,
    speed: def.speed,
    range: def.range,
    state: GUARD_PATROL,
    suspicion: 0,
    pause: 0,
    lookTimer: 0,
    searchTimer: 0,
    investigate: null,
    lastSeen: null,
    chaseTarget: null,
  };
}

/** Can this guard see the player right now, from where it stands? */
export function guardSeesPlayer(guard, player, blockers) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > guard.range) return false;
  if (dist < 20) return lineOfSight(guard.x, guard.y, player.x, player.y, blockers);
  if (angleDiff(Math.atan2(dy, dx), guard.angle) > GUARD.visionHalfAngle) return false;
  return lineOfSight(guard.x, guard.y, player.x, player.y, blockers);
}

/** How fast suspicion grows while the guard watches the player (per second). */
export function suspicionRate(guard, player, dist, inShadow) {
  const closeness = 1 - (dist / guard.range) * 0.7;
  let rate = GUARD.suspicionRate * Math.max(0.25, closeness);
  if (player.sneaking) rate *= GUARD.sneakFactor;
  if (inShadow) rate *= GUARD.shadowFactor;
  if (!player.moving) rate *= GUARD.stillFactor;
  return rate;
}

function stepToward(guard, tx, ty, speed, dt, solids) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const moved = moveCircle(guard.x, guard.y, 14, (dx / dist) * step, (dy / dist) * step, solids);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 2;
}

function nextWaypoint(guard) {
  guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
}

function nearestWaypoint(guard) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < guard.waypoints.length; i += 1) {
    const d = Math.hypot(guard.waypoints[i].x - guard.x, guard.waypoints[i].y - guard.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Advance one guard a fixed step. `seen` says whether it can see the player this step,
 * `alarm` whether the global alarm is on, `player` where the player is. Returns true when
 * the guard just caught the player.
 */
export function updateGuard(guard, dt, seen, alarm, player, solids) {
  // Suspicion moves first: it is what drives every state change below.
  if (seen) {
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    guard.suspicion = Math.min(1, guard.suspicion + suspicionRate(guard, player, dist, player.inShadow) * dt);
    guard.lastSeen = { x: player.x, y: player.y };
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
  }

  if (alarm && guard.state !== GUARD_ALERT) {
    guard.state = GUARD_ALERT;
    guard.chaseTarget = { x: player.x, y: player.y };
  }

  if (guard.state === GUARD_ALERT) {
    if (!alarm) {
      // The alarm cooled down while this guard was chasing: search the last spot, then patrol.
      guard.state = GUARD_SEARCH;
      guard.searchTimer = GUARD.searchTime;
      return false;
    }
    if (seen) guard.chaseTarget = { x: player.x, y: player.y };
    else if (guard.chaseTarget) {
      // The trail went cold: keep going to the last known spot, then start searching.
      if (stepToward(guard, guard.chaseTarget.x, guard.chaseTarget.y, GUARD.chaseSpeed * guard.speed, dt, solids)) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = GUARD.searchTime;
      }
    }
    if (seen) stepToward(guard, player.x, player.y, GUARD.chaseSpeed * guard.speed, dt, solids);
    if (Math.hypot(player.x - guard.x, player.y - guard.y) < 26) return true;
    return false;
  }

  if (guard.state === GUARD_SUSPICIOUS) {
    if (guard.suspicion >= GUARD.alarmAt) {
      guard.state = GUARD_ALERT;
      return false;
    }
    if (guard.investigate) {
      if (stepToward(guard, guard.investigate.x, guard.investigate.y, GUARD.investigateSpeed * guard.speed, dt, solids)) {
        guard.investigate = null;
        guard.lookTimer = 2.2;
      }
    } else if (guard.lookTimer > 0) {
      guard.lookTimer -= dt;
      guard.angle += dt * 1.6;
      if (guard.lookTimer <= 0) {
        guard.state = GUARD_PATROL;
        guard.waypoint = nearestWaypoint(guard);
      }
    }
    if (guard.suspicion < 0.15) {
      guard.state = GUARD_PATROL;
      guard.waypoint = nearestWaypoint(guard);
    }
    return false;
  }

  if (guard.state === GUARD_SEARCH) {
    guard.searchTimer -= dt;
    guard.angle += dt * 2.2;
    if (guard.searchTimer <= 0) {
      guard.state = GUARD_PATROL;
      guard.waypoint = nearestWaypoint(guard);
    }
    return false;
  }

  // Patrol: walk the loop, pausing at each waypoint to look around.
  if (guard.suspicion >= GUARD.suspiciousAt) {
    guard.state = GUARD_SUSPICIOUS;
    guard.investigate = guard.lastSeen ? { ...guard.lastSeen } : null;
    guard.lookTimer = 0;
    return false;
  }
  if (guard.pause > 0) {
    guard.pause -= dt;
    guard.angle += dt * 0.9;
    return false;
  }
  const target = guard.waypoints[guard.waypoint];
  if (stepToward(guard, target.x, target.y, GUARD.patrolSpeed * guard.speed, dt, solids)) {
    nextWaypoint(guard);
    guard.pause = GUARD.waypointPause;
  }
  return false;
}

/** Send a guard to look at a noise: a pebble's clatter, heard from `point`. */
export function hearNoise(guard, point, radius) {
  if (guard.state === GUARD_ALERT) return;
  const dist = Math.hypot(point.x - guard.x, point.y - guard.y);
  if (dist > radius) return;
  guard.state = GUARD_SUSPICIOUS;
  guard.investigate = { x: point.x, y: point.y };
  guard.lookTimer = 0;
  guard.suspicion = Math.max(guard.suspicion, 0.6);
}
