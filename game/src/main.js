// Harbor Master — entry point. One fixed 1280x720 world, a requestAnimationFrame
// loop with a clamped delta, and the screenshot pose applied on boot (?shot=).

import { World } from './world.js';
import { render } from './render.js';
import { attachInput } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const world = new World();

attachInput(canvas, world);
applyShot(world);
window.__world = world; // for debugging from the console

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  world.update(dt);
  render(ctx, world);
  if (!window.__ready) window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
