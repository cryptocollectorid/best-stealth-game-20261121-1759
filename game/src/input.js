// Keyboard and pointer input. Held keys give a movement direction; one-shot presses (start,
// pause, mute, restart) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A mouse click throws a pebble
// at the clicked spot on the floor.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas, toWorld) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;
  let throwAt = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toWorld(event.clientX, event.clientY);
    if (point) throwAt = point;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The movement direction this frame: dx/dy in -1..1 plus whether to sneak. */
    move() {
      return {
        dx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        dy: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sneak: held.sneak,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last clicked floor position, if any, since the last call. */
    takeThrow() {
      const taken = throwAt;
      throwAt = null;
      return taken;
    },
  };
}
