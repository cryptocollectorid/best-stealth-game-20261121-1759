// The three levels, drawn as maps. One character per tile (40 px):
//   # wall        C crate (solid, blocks sight)   D display case (solid, blocks sight)
//   B shadow bush (walkable, hides you)           R relic to steal
//   P player start                                E exit
//   . floor
// Guard patrols are loops of tile coordinates; every leg is axis-aligned and runs over open
// floor, so a guard never has to squeeze around a corner it cannot see.
import { FIELD, TILE } from './config.js';
import { createRandom } from './random.js';

const LEVELS = [
  {
    name: 'The Gallery',
    subtitle: 'Three guards, three relics. Learn the patrols.',
    guardSpeed: 1,
    guardRange: 235,
    map: [
      '################################',
      '#P...................R.........#',
      '#..............................#',
      '#...C......DC.....B............#',
      '#..............................#',
      '#.........#####......####......#',
      '#..............................#',
      '#...R.......C.....D........R...#',
      '#..............................#',
      '#......####........####........#',
      '#..............................#',
      '#..C.B.........D..........C....#',
      '#..............................#',
      '#..........R.......C..........E#',
      '#..............................#',
      '#..........D.......B...........#',
      '#..............................#',
      '################################',
    ],
    patrols: [
      [[6, 2], [20, 2], [20, 4], [6, 4]],
      [[11, 6], [25, 6], [25, 8], [11, 8]],
      [[4, 12], [18, 12], [18, 14], [4, 14]],
    ],
  },
  {
    name: 'The Vault Hall',
    subtitle: 'Four guards, faster eyes. The vault is upstairs.',
    guardSpeed: 1.12,
    guardRange: 245,
    map: [
      '################################',
      '#..........C.......R.......E...#',
      '#..............................#',
      '#...D......####.....####.......#',
      '#..............................#',
      '#.......B...............C......#',
      '#..............................#',
      '#.........D......R.......C.....#',
      '#..............................#',
      '#......#####........####.......#',
      '#..............................#',
      '#..C........B.......D..........#',
      '#..............................#',
      '#.......####......####.........#',
      '#..............................#',
      '#..R..........C......B.........#',
      '#P.............................#',
      '################################',
    ],
    patrols: [
      [[5, 2], [16, 2], [16, 4], [5, 4]],
      [[19, 5], [24, 5], [24, 7], [19, 7]],
      [[6, 10], [15, 10], [15, 12], [6, 12]],
      [[20, 12], [28, 12], [28, 15], [20, 15]],
    ],
  },
  {
    name: 'The Rooftop',
    subtitle: 'Five guards under the moon. Take everything and vanish.',
    guardSpeed: 1.25,
    guardRange: 255,
    map: [
      '################################',
      '#P......C.......B......R.......#',
      '#..............................#',
      '#..D.......####........C.......#',
      '#..............................#',
      '#......R......D......B.........#',
      '#..............................#',
      '#...####.......####............#',
      '#..............................#',
      '#.......C.......B.......D......#',
      '#..............................#',
      '#..B.......####.......C........#',
      '#..............................#',
      '#......D.......R.......####....#',
      '#..............................#',
      '#...C.......B.......D..........#',
      '#.............................E#',
      '################################',
    ],
    patrols: [
      [[5, 2], [17, 2], [17, 4], [5, 4]],
      [[20, 2], [28, 2], [28, 4], [20, 4]],
      [[5, 8], [15, 8], [15, 10], [5, 10]],
      [[19, 8], [28, 8], [28, 10], [19, 10]],
      [[9, 12], [23, 12], [23, 14], [9, 14]],
    ],
  },
];

function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function tileRect(tx, ty) {
  return { x: tx * TILE, y: ty * TILE, width: TILE, height: TILE };
}

/**
 * Turn one level's map into the pieces the world and the renderer need. Paintings are
 * decorative frames hung on wall tiles that face open floor, placed by a seeded draw so the
 * same level always looks the same.
 */
export function parseLevel(index) {
  const def = LEVELS[index];
  const rows = def.map;
  const solids = [];
  const blockers = [];
  const crates = [];
  const cases = [];
  const bushes = [];
  const relics = [];
  const paintings = [];
  let playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
  let exit = { x: FIELD.width - TILE * 1.5, y: FIELD.height - TILE * 1.5 };
  const random = createRandom(1000 + index * 77);

  for (let ty = 0; ty < rows.length; ty += 1) {
    const row = rows[ty];
    for (let tx = 0; tx < row.length; tx += 1) {
      const ch = row[tx];
      const rect = tileRect(tx, ty);
      if (ch === '#') {
        solids.push(rect);
        blockers.push(rect);
        if (ty + 1 < rows.length && rows[ty + 1][tx] === '.' && random() < 0.45) {
          paintings.push({ x: tx * TILE + 8, y: ty * TILE + 6, width: 24, height: 26, hue: random() });
        }
      } else if (ch === 'C') {
        solids.push(rect);
        blockers.push(rect);
        crates.push(rect);
      } else if (ch === 'D') {
        solids.push(rect);
        blockers.push(rect);
        cases.push(rect);
      } else if (ch === 'B') {
        bushes.push(rect);
      } else if (ch === 'R') {
        relics.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, taken: false });
      } else if (ch === 'P') {
        playerStart = tileCentre(tx, ty);
      } else if (ch === 'E') {
        exit = tileCentre(tx, ty);
      }
    }
  }

  const guards = def.patrols.map((loop) => ({
    waypoints: loop.map(([tx, ty]) => tileCentre(tx, ty)),
    speed: def.guardSpeed,
    range: def.guardRange,
  }));

  return {
    index,
    name: def.name,
    subtitle: def.subtitle,
    solids,
    blockers,
    crates,
    cases,
    bushes,
    relics,
    paintings,
    playerStart,
    exit,
    guards,
  };
}

export const LEVEL_COUNT = LEVELS.length;
