// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones are painted before the walls, so a wall reads as blocking the cone;
// the night lighting is an offscreen layer with a soft hole around the player, so the
// player can always see what is safe. Flat shapes and canvas text throughout.
import { FIELD, FONT, GUARD, LIVES, PALETTE, TILE } from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELDONE = 'leveldone';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const HUD_HEIGHT = 46;

function roundRectPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const light = document.createElement('canvas');
  light.width = FIELD.width;
  light.height = FIELD.height;
  const lightContext = light.getContext('2d');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawFloor(level) {
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let tx = 0; tx <= FIELD.width / TILE; tx += 1) {
      context.moveTo(tx * TILE + 0.5, 0);
      context.lineTo(tx * TILE + 0.5, FIELD.height);
    }
    for (let ty = 0; ty <= FIELD.height / TILE; ty += 1) {
      context.moveTo(0, ty * TILE + 0.5);
      context.lineTo(FIELD.width, ty * TILE + 0.5);
    }
    context.stroke();
    // A red carpet runner down the middle hall of every level.
    context.fillStyle = 'rgba(122, 32, 40, 0.35)';
    context.fillRect(0, FIELD.height / 2 - 22, FIELD.width, 44);
    context.fillStyle = 'rgba(242, 201, 76, 0.25)';
    context.fillRect(0, FIELD.height / 2 - 24, FIELD.width, 2);
    context.fillRect(0, FIELD.height / 2 + 22, FIELD.width, 2);
  }

  function drawWalls(level) {
    for (const wall of level.solids) {
      const isCrate = level.crates.includes(wall);
      const isCase = level.cases.includes(wall);
      if (isCrate) {
        context.fillStyle = PALETTE.crate;
        context.fillRect(wall.x + 2, wall.y + 2, wall.width - 4, wall.height - 4);
        context.strokeStyle = PALETTE.crateEdge;
        context.lineWidth = 2;
        context.strokeRect(wall.x + 5, wall.y + 5, wall.width - 10, wall.height - 10);
        context.beginPath();
        context.moveTo(wall.x + 5, wall.y + 5);
        context.lineTo(wall.x + wall.width - 5, wall.y + wall.height - 5);
        context.moveTo(wall.x + wall.width - 5, wall.y + 5);
        context.lineTo(wall.x + 5, wall.y + wall.height - 5);
        context.stroke();
      } else if (isCase) {
        context.fillStyle = PALETTE.caseBase;
        context.fillRect(wall.x + 2, wall.y + 2, wall.width - 4, wall.height - 4);
        context.fillStyle = 'rgba(127, 178, 217, 0.35)';
        context.fillRect(wall.x + 7, wall.y + 7, wall.width - 14, wall.height - 14);
        context.strokeStyle = 'rgba(220, 235, 245, 0.6)';
        context.lineWidth = 1;
        context.strokeRect(wall.x + 7, wall.y + 7, wall.width - 14, wall.height - 14);
        context.fillStyle = PALETTE.relic;
        context.beginPath();
        context.arc(wall.x + wall.width / 2, wall.y + wall.height / 2, 4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = PALETTE.wall;
        context.fillRect(wall.x, wall.y, wall.width, wall.height);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(wall.x, wall.y, wall.width, 4);
        context.fillStyle = PALETTE.wallTrim;
        context.fillRect(wall.x, wall.y + wall.height - 3, wall.width, 3);
      }
    }
    for (const painting of level.paintings) {
      context.fillStyle = '#8a6d2f';
      context.fillRect(painting.x, painting.y, painting.width, painting.height);
      const hues = ['#7a4a3a', '#3a5a7a', '#4a6b3a', '#6b4a7a'];
      context.fillStyle = hues[Math.floor(painting.hue * hues.length) % hues.length];
      context.fillRect(painting.x + 3, painting.y + 3, painting.width - 6, painting.height - 6);
      context.fillStyle = 'rgba(238, 241, 245, 0.5)';
      context.fillRect(painting.x + 6, painting.y + 5, 4, 4);
    }
  }

  function drawExit(exit, time) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    context.save();
    context.shadowColor = exit.open ? PALETTE.exit : '#666';
    context.shadowBlur = exit.open ? 24 * pulse : 6;
    context.fillStyle = exit.open ? PALETTE.exit : '#3a4152';
    roundRectPath(context, exit.x - 18, exit.y - 18, 36, 36, 6);
    context.fill();
    context.restore();
    context.fillStyle = '#0b0e14';
    context.fillRect(exit.x - 18, exit.y - 4, 36, 8);
    text('EXIT', exit.x, exit.y - 26, 13, exit.open ? PALETTE.exit : PALETTE.muted, 'center');
    if (!exit.open) text('LOCKED', exit.x, exit.y + 34, 11, PALETTE.muted, 'center');
  }

  function drawRelics(relics, time) {
    for (const relic of relics) {
      if (relic.taken) continue;
      const pulse = 1 + 0.12 * Math.sin(time * 4 + relic.x);
      context.save();
      context.shadowColor = PALETTE.relic;
      context.shadowBlur = 18;
      context.translate(relic.x, relic.y);
      context.scale(pulse, pulse);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.relic;
      context.fillRect(-8, -8, 16, 16);
      context.fillStyle = '#fff3c4';
      context.fillRect(-4, -4, 8, 8);
      context.restore();
    }
  }

  function drawCones(guards) {
    for (const guard of guards) {
      const color = guard.state === GUARD_ALERT ? PALETTE.coneAlert : guard.state === GUARD_SUSPICIOUS ? PALETTE.coneSuspicious : PALETTE.cone;
      const gradient = context.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, guard.range);
      gradient.addColorStop(0, color + '3d');
      gradient.addColorStop(1, color + '05');
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.arc(guard.x, guard.y, guard.range, guard.angle - GUARD.visionHalfAngle, guard.angle + GUARD.visionHalfAngle);
      context.closePath();
      context.fill();
      context.strokeStyle = color + '44';
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawGuards(guards, time) {
    for (const guard of guards) {
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.ellipse(guard.x, guard.y + 10, 14, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = guard.state === GUARD_ALERT ? PALETTE.guardAlert : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardDark;
      context.lineWidth = 2;
      context.stroke();
      // Helmet brim and the direction the guard is facing.
      context.strokeStyle = '#dfe6f2';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
      context.stroke();
      context.fillStyle = '#dfe6f2';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 7, guard.y + Math.sin(guard.angle) * 7, 3, 0, Math.PI * 2);
      context.fill();
      // Suspicion ring over the head: the player reads how close to caught they are.
      if (guard.suspicion > 0.05) {
        context.strokeStyle = guard.suspicion >= 0.99 ? PALETTE.red : PALETTE.gold;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        context.stroke();
      }
      if (guard.state === GUARD_ALERT) text('!', guard.x, guard.y - 26, 26, PALETTE.red, 'center');
      else if (guard.state === GUARD_SUSPICIOUS) text('?', guard.x, guard.y - 26, 24, PALETTE.coneSuspicious, 'center');
    }
  }

  function drawPlayer(player, time) {
    const radius = player.sneaking ? 11 : 13;
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.beginPath();
    context.ellipse(player.x, player.y + 10, radius + 2, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.playerDark;
    context.lineWidth = 2;
    context.stroke();
    // The hood points where the thief is going.
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.moveTo(player.x + Math.cos(player.angle) * (radius + 7), player.y + Math.sin(player.angle) * (radius + 7));
    context.lineTo(player.x + Math.cos(player.angle + 2.5) * radius, player.y + Math.sin(player.angle + 2.5) * radius);
    context.lineTo(player.x + Math.cos(player.angle - 2.5) * radius, player.y + Math.sin(player.angle - 2.5) * radius);
    context.closePath();
    context.fill();
    if (player.inShadow) text('HIDDEN', player.x, player.y + 30, 11, '#7ee2a8', 'center');
  }

  function drawBushes(bushes) {
    for (const bush of bushes) {
      context.fillStyle = 'rgba(29, 58, 36, 0.55)';
      context.beginPath();
      context.arc(bush.x + 12, bush.y + 20, 13, 0, Math.PI * 2);
      context.arc(bush.x + 28, bush.y + 14, 15, 0, Math.PI * 2);
      context.arc(bush.x + 22, bush.y + 30, 12, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.bushEdge;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawNoise(noise) {
    if (!noise) return;
    const progress = 1 - noise.t / 0.7;
    context.strokeStyle = `rgba(242, 201, 76, ${0.8 * (1 - progress)})`;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(noise.x, noise.y, 10 + progress * GUARD.noiseRadius, 0, Math.PI * 2);
    context.stroke();
  }

  function drawLighting(state) {
    lightContext.setTransform(1, 0, 0, 1, 0, 0);
    lightContext.globalCompositeOperation = 'source-over';
    lightContext.clearRect(0, 0, FIELD.width, FIELD.height);
    lightContext.fillStyle = 'rgba(3, 5, 10, 0.52)';
    lightContext.fillRect(0, 0, FIELD.width, FIELD.height);
    lightContext.globalCompositeOperation = 'destination-out';
    function hole(x, y, radius, strength) {
      const g = lightContext.createRadialGradient(x, y, 4, x, y, radius);
      g.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightContext.fillStyle = g;
      lightContext.beginPath();
      lightContext.arc(x, y, radius, 0, Math.PI * 2);
      lightContext.fill();
    }
    hole(state.player.x, state.player.y, 190, 0.95);
    hole(state.exit.x, state.exit.y, 110, 0.7);
    for (const relic of state.relics) if (!relic.taken) hole(relic.x, relic.y, 70, 0.55);
    for (const guard of state.guards) hole(guard.x, guard.y, 70, 0.4);
    context.drawImage(light, 0, 0);
  }

  function drawAlarmVignette(alarm, time) {
    if (alarm <= 0.02) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const alpha = alarm * (0.18 + 0.14 * pulse);
    const gradient = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
    );
    gradient.addColorStop(0, 'rgba(229, 83, 75, 0)');
    gradient.addColorStop(1, `rgba(229, 83, 75, ${alpha})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state) {
    const level = state.level;
    const taken = state.relics.filter((r) => r.taken).length;
    const maxSuspicion = state.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
    context.fillStyle = 'rgba(11, 14, 20, 0.82)';
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, HUD_HEIGHT - 1, FIELD.width, 1);
    text(`${state.levelIndex + 1} · ${level.name}`, 16, 29, 17, PALETTE.text, 'left', 'middle');
    text(`◆ ${taken}/${state.relics.length}`, 250, 29, 17, PALETTE.gold, 'left', 'middle');
    // The alarm meter: the loudest suspicion in the room.
    text('ALARM', 400, 29, 13, PALETTE.muted, 'left', 'middle');
    context.fillStyle = '#2a3040';
    roundRectPath(context, 460, 19, 180, 12, 6);
    context.fill();
    const alarmFill = Math.max(state.alarm, maxSuspicion);
    context.fillStyle = alarmFill > 0.85 ? PALETTE.red : alarmFill > 0.5 ? PALETTE.coneSuspicious : PALETTE.gold;
    if (alarmFill > 0.01) {
      roundRectPath(context, 460, 19, 180 * alarmFill, 12, 6);
      context.fill();
    }
    let right = FIELD.width - 16;
    text(`SCORE ${state.score}`, right, 29, 15, PALETTE.text, 'right', 'middle');
    right -= 130;
    text(formatTime(state.levelTime), right, 29, 15, PALETTE.text, 'right', 'middle');
    right -= 90;
    let lives = '';
    for (let i = 0; i < LIVES; i += 1) lives += i < state.lives ? '●' : '○';
    text(`LIVES ${lives}`, right, 29, 15, state.lives === 1 ? PALETTE.red : PALETTE.text, 'right', 'middle');
    right -= 150;
    text(`PEBBLES ${'●'.repeat(state.pebbles)}${'○'.repeat(Math.max(0, 5 - state.pebbles))}`, right, 29, 15, PALETTE.text, 'right', 'middle');
    if (state.ghost && state.status === 'play') {
      text('UNSEEN', FIELD.width - 16, FIELD.height - 14, 12, '#7ee2a8', 'right', 'middle');
    }
    text('WASD / arrows move · Shift sneak · Click throws a pebble · P pause · M mute', 16, FIELD.height - 14, 12, PALETTE.muted, 'left', 'middle');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 14, 20, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRectPath(context, x, y, width, height, 12);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, FIELD.width / 2, y + 64, 42, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 112 + i * 32, 19, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.gold, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const level = state.level;
    drawFloor(level);
    drawCones(state.guards);
    drawWalls(level);
    drawExit(state.exit, time);
    drawRelics(state.relics, time);
    drawGuards(state.guards, time);
    drawPlayer(state.player, time);
    drawBushes(level.bushes);
    drawNoise(state.noise);
    drawLighting(state);
    drawAlarmVignette(state.alarm, time);
    drawHud(state);

    if (screen === SCREEN_TITLE) {
      drawPanel('MOONLIT VAULT', [
        'A stealth game in three heists. Steal every relic, reach the exit unseen.',
        'Guards patrol with vision cones — walls and crates block their sight,',
        'shadow bushes hide you, and a thrown pebble pulls them away.',
        `Best score: ${best}`,
      ], 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('CAUGHT!', [
        'A guard got close enough to grab you.',
        `Lives left: ${state.lives}`,
      ], 'Getting back on your feet…', PALETTE.red);
    } else if (screen === SCREEN_LEVELDONE) {
      const lines = [
        `${level.name} cleared in ${formatTime(state.levelTime)}.`,
        `Time bonus + level bonus: ${state.levelBonus} points.`,
        state.ghost ? 'Ghost bonus: never spotted. +400 points.' : 'Spotted at least once — no ghost bonus this level.',
        `Score: ${state.score}`,
      ];
      drawPanel('LEVEL CLEAR', lines, 'Press Space for the next level', PALETTE.green);
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED', [
        'The museum keeps its relics tonight.',
        `Score: ${state.score} · Best: ${best}`,
      ], 'Press Space to try again', PALETTE.red);
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE VAULT IS YOURS', [
        'Every relic stolen, every guard outwitted.',
        `Final score: ${state.score} · Total time: ${formatTime(state.totalTime)} · Best: ${best}`,
      ], 'Press Space to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Convert a mouse position on the page into a position on the playfield. */
    toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1));
      const y = (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1));
      if (x < 0 || y < 0 || x > FIELD.width || y > FIELD.height) return null;
      return { x, y };
    },
  };
}
