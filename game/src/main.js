// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between seven screens: title, play, paused, caught, level clear,
// game over and victory.
//
// ?shot=start|patrol|alert|escape stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createWorld, EVENT_ALARM_ON, EVENT_CAUGHT, EVENT_GAMEOVER, EVENT_LEVEL_DONE, EVENT_NOISE, EVENT_PICKUP, EVENT_SUSPICIOUS, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_LEVELDONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.toWorld);
const audio = createAudio();
const world = createWorld();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastStatus = world.state.status;
  let time = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.resetGame();
    lastStatus = world.state.status;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Steal every relic, then reach the exit.`);
  }

  function nextLevel() {
    world.loadLevel(world.state.levelIndex + 1);
    lastStatus = world.state.status;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Level ${world.state.levelIndex + 1}: ${world.state.level.name}.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `You win. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen === SCREEN_PLAY) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_LEVELDONE) nextLevel();
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_NOISE) audio.pebble();
    if (events & EVENT_SUSPICIOUS) audio.suspicious();
    if (events & EVENT_ALARM_ON) {
      audio.alarm();
      announce('Alarm! The guards are coming for you.');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      announce(`Caught! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
    }
    if (events & EVENT_LEVEL_DONE) audio.levelDone();
    if (events & EVENT_WIN) audio.win();
    if (events & EVENT_GAMEOVER) endGame(false);
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const move = input.move();
    const thrown = input.takeThrow();
    if (thrown && world.throwPebble(thrown.x, thrown.y)) handleEvents(EVENT_NOISE);
    const events = world.step(STEP, move);
    if (events) handleEvents(events);
    if (world.state.player.moving) audio.footstep();
    if (world.state.status !== lastStatus) {
      lastStatus = world.state.status;
      if (world.state.status === 'caught') screen = SCREEN_CAUGHT;
      else if (world.state.status === 'leveldone') screen = SCREEN_LEVELDONE;
      else if (world.state.status === 'win') endGame(true);
      else if (world.state.status === 'gameover') endGame(false);
      else if (world.state.status === 'play') screen = SCREEN_PLAY;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    time = now / 1000;
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT) {
      while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      input.takeThrow();
    }
    renderer.draw(world.state, screen, best, time);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Moonlit Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
