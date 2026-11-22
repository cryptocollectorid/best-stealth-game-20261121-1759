// Plain geometry: angles, segment tests and line of sight. No drawing and no browser here,
// so the same code runs in the game and in a Node smoke test.

/** Smallest absolute difference between two angles, in radians. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** True when (x, y) lies inside the cone from (ox, oy) facing `angle`. */
export function pointInCone(x, y, ox, oy, angle, range, halfAngle) {
  const dx = x - ox;
  const dy = y - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  return angleDiff(Math.atan2(dy, dx), angle) <= halfAngle;
}

function segmentHitsRect(x1, y1, x2, y2, rect) {
  // Quick reject: both ends on one side of the rect.
  if (Math.max(x1, x2) < rect.x || Math.min(x1, x2) > rect.x + rect.width) return false;
  if (Math.max(y1, y2) < rect.y || Math.min(y1, y2) > rect.y + rect.height) return false;
  // An end inside the rect counts as a hit.
  if (x1 >= rect.x && x1 <= rect.x + rect.width && y1 >= rect.y && y1 <= rect.y + rect.height) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.width && y2 >= rect.y && y2 <= rect.y + rect.height) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Test the four edges with the segment's parametric form.
  const edges = [
    [rect.x, rect.y, rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
    [rect.x, rect.y + rect.height, rect.x, rect.y],
  ];
  for (const [ax, ay, bx, by] of edges) {
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dx * ey - dy * ex;
    if (denom === 0) continue;
    const t = ((ax - x1) * ey - (ay - y1) * ex) / denom;
    const u = ((ax - x1) * dy - (ay - y1) * dx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/**
 * True when nothing solid stands between the two points. `blockers` is a list of
 * {x, y, width, height} rectangles: walls, crates and display cases. Bushes never block sight.
 */
export function lineOfSight(x1, y1, x2, y2, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, blockers[i])) return false;
  }
  return true;
}

/** Move a circle against solid rectangles, sliding along them, one axis at a time. */
export function moveCircle(x, y, radius, dx, dy, solids) {
  let nx = x + dx;
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (nx + radius > s.x && nx - radius < s.x + s.width && y + radius > s.y && y - radius < s.y + s.height) {
      nx = dx > 0 ? s.x - radius : s.x + s.width + radius;
    }
  }
  let ny = y + dy;
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (nx + radius > s.x && nx - radius < s.x + s.width && ny + radius > s.y && ny - radius < s.y + s.height) {
      ny = dy > 0 ? s.y - radius : s.y + s.height + radius;
    }
  }
  return { x: nx, y: ny };
}
