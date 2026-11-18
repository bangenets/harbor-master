// Screenshot poses: ?shot=start | play | end builds a frame real play can
// reach, using the game's own state (no fake pixels — the renderer draws
// every shot). ?seed=N reseeds the ambient life for a stable frame.

import { makeRng } from './random.js';

export function applyShot(world) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot') || 'title';
  const seed = params.get('seed');
  if (seed !== null) world.rng = makeRng(parseInt(seed, 10) || 1);
  if (shot === 'play') world.posePlay();
  else if (shot === 'end') world.poseEnd();
  else if (shot === 'fog') world.poseFog();
  else if (shot === 'shop') world.poseShop();
  else if (shot === 'boss') world.poseBoss();
  window.__shot = shot;
}
