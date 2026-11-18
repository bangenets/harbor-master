// Input: mouse and keyboard. Click a ship to select it, then click a dock
// (or press its number key) to send it there. Space pauses, R restarts,
// M mutes, Esc deselects.

import { toggleMute } from './audio.js';
import { unlockAudio } from './audio.js';
import { W, H } from './config.js';

function toWorld(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

function shipAt(world, x, y) {
  // Topmost first: later ships are drawn on top.
  for (let i = world.ships.length - 1; i >= 0; i--) {
    const s = world.ships[i];
    if (s.state === 'gone') continue;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < s.len * 0.62) return s;
  }
  return null;
}

export function attachInput(canvas, world) {
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    const p = toWorld(canvas, e);
    if (world.state === 'title') {
      world.start();
      return;
    }
    if (world.state === 'gameover') {
      if (world.time - world.gameOverAt > 0.8) world.start();
      return;
    }
    if (world.state === 'paused') {
      world.togglePause();
      return;
    }
    if (world.state === 'shop') {
      // Click a card to take that upgrade at once.
      for (const c of world.shopCards) {
        if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
          world.applyShopChoice(c.idx);
          return;
        }
      }
      return;
    }
    // Playing.
    const ship = shipAt(world, p.x, p.y);
    if (ship) {
      world.select(ship);
      return;
    }
    if (world.selected) {
      for (const dock of world.docks) {
        if (dock.containsPoint(p.x, p.y)) {
          world.assignSelected(dock);
          return;
        }
      }
    }
    world.select(null);
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toWorld(canvas, e);
    world.mouse = p;
    if (world.state !== 'playing') {
      canvas.style.cursor = 'default';
      return;
    }
    world.hovered = shipAt(world, p.x, p.y);
    canvas.style.cursor = world.hovered ? 'pointer' : 'default';
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (world.state === 'playing' || world.state === 'paused') world.togglePause();
      return;
    }
    if (e.code === 'KeyM') {
      toggleMute();
      return;
    }
    if (e.code === 'KeyR') {
      if (world.state === 'gameover' || world.state === 'playing' || world.state === 'paused') world.start();
      return;
    }
    if (e.code === 'Escape') {
      world.select(null);
      return;
    }
    if (e.code === 'Enter' && world.state === 'shop') {
      world.applyShopChoice(world.shopSel);
      return;
    }
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (world.state === 'shop') {
        // 1/2/3 highlight a card; Enter confirms it.
        if (n >= 1 && n <= world.shopOptions.length) world.shopSel = n - 1;
        return;
      }
      if (n >= 1 && n <= world.docks.length && world.selected) {
        world.assignSelected(world.docks[n - 1]);
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state === 'playing') world.togglePause();
  });
}
