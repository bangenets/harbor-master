// Every pixel of Harbor Master, drawn on one canvas: sea and sky life, the
// quay, the four docks, the ships, the HUD and the title / pause / game-over
// screens. Nothing here loads a file — flat shapes and text only.

import {
  BOSS_TIME_S,
  COLORS,
  DOCKS,
  H,
  MAX_STRIKES,
  PIER_BOTTOM,
  PIER_TOP,
  PIER_W,
  QUAY_TOP,
  SEA_BOTTOM,
  VIP_TIME_S,
  W,
} from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'center', weight = 'bold', font = 'Trebuchet MS, Verdana, sans-serif') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function drawAnchor(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.42, s * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.3);
  ctx.lineTo(x, y + s * 0.34);
  ctx.moveTo(x - s * 0.34, y + s * 0.1);
  ctx.lineTo(x + s * 0.34, y + s * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.42, y + s * 0.1);
  ctx.quadraticCurveTo(x - s * 0.42, y + s * 0.5, x, y + s * 0.34);
  ctx.quadraticCurveTo(x + s * 0.42, y + s * 0.5, x + s * 0.42, y + s * 0.1);
  ctx.stroke();
}

function drawSea(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, SEA_BOTTOM);
  g.addColorStop(0, COLORS.seaShallow);
  g.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, SEA_BOTTOM);
  // Sun glare, top left.
  const sun = ctx.createRadialGradient(150, 60, 10, 150, 60, 260);
  sun.addColorStop(0, 'rgba(255,244,200,0.35)');
  sun.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 420, 320);
  // Slow wave lines.
  ctx.strokeStyle = COLORS.seaFoam;
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const y0 = 90 + row * 110;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const y = y0 + Math.sin(x * 0.012 + world.time * (0.7 + row * 0.15) + row * 2) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawClouds(ctx, world) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of world.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 52 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 34 * c.s, c.y + 4, 36 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - 36 * c.s, c.y + 5, 30 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGulls(ctx, world) {
  ctx.strokeStyle = 'rgba(20,50,64,0.7)';
  ctx.lineWidth = 2;
  for (const g of world.gulls) {
    const flap = Math.sin(g.ph) * 4;
    ctx.beginPath();
    ctx.moveTo(g.x - 9, g.y + flap);
    ctx.quadraticCurveTo(g.x, g.y - 3, g.x, g.y);
    ctx.quadraticCurveTo(g.x, g.y - 3, g.x + 9, g.y + flap);
    ctx.stroke();
  }
}

function drawQuay(ctx) {
  ctx.fillStyle = COLORS.quay;
  ctx.fillRect(0, QUAY_TOP, W, H - QUAY_TOP);
  ctx.fillStyle = COLORS.quayEdge;
  ctx.fillRect(0, QUAY_TOP, W, 6);
  // Bollards along the quay edge.
  ctx.fillStyle = '#5d4830';
  for (let x = 40; x < W; x += 120) {
    ctx.beginPath();
    ctx.arc(x, QUAY_TOP + 14, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Crates and a warehouse between the docks, purely decorative.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(330, 648, 44, 44);
  ctx.fillRect(378, 660, 32, 32);
  ctx.fillStyle = '#a8874f';
  ctx.fillRect(330, 648, 44, 6);
  ctx.fillStyle = '#7d8a94';
  ctx.fillRect(880, 632, 90, 60);
  ctx.fillStyle = '#5f6d77';
  ctx.beginPath();
  ctx.moveTo(880, 632);
  ctx.lineTo(925, 606);
  ctx.lineTo(970, 632);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8e2d2';
  ctx.fillRect(912, 656, 26, 36);
}

function drawDocks(ctx, world) {
  for (const dock of world.docks) {
    const left = dock.x - PIER_W / 2;
    // Berth guide: dashed pocket where an assigned ship will slide in.
    const assigned = world.ships.find((s) => s.dock === dock && (s.state === 'assigned' || s.state === 'docking'));
    if (assigned) {
      ctx.save();
      ctx.strokeStyle = dock.color;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(world.time * 5);
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2.5;
      rr(ctx, dock.x - 66, 386, 132, 92, 10);
      ctx.stroke();
      ctx.restore();
    }
    // Pier: wooden walkway from the quay into the sea.
    ctx.fillStyle = COLORS.pierWood;
    ctx.fillRect(left, PIER_TOP, PIER_W, PIER_BOTTOM - PIER_TOP);
    ctx.fillStyle = COLORS.pierWoodDark;
    for (let y = PIER_TOP + 14; y < PIER_BOTTOM; y += 18) {
      ctx.fillRect(left, y, PIER_W, 2);
    }
    ctx.strokeStyle = COLORS.pierEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(left, PIER_TOP, PIER_W, PIER_BOTTOM - PIER_TOP);
    // Coloured awning at the pier head: dock number, name and flag.
    ctx.fillStyle = dock.color;
    rr(ctx, left - 8, PIER_TOP - 34, PIER_W + 16, 40, 8);
    ctx.fill();
    text(ctx, `${dock.key} · ${dock.name}`, dock.x, PIER_TOP - 14, 15, '#ffffff');
    ctx.strokeStyle = '#123240';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dock.x + PIER_W / 2 - 6, PIER_TOP - 34);
    ctx.lineTo(dock.x + PIER_W / 2 - 6, PIER_TOP - 62);
    ctx.stroke();
    ctx.fillStyle = dock.color;
    ctx.beginPath();
    ctx.moveTo(dock.x + PIER_W / 2 - 6, PIER_TOP - 62);
    ctx.lineTo(dock.x + PIER_W / 2 + 18, PIER_TOP - 55);
    ctx.lineTo(dock.x + PIER_W / 2 - 6, PIER_TOP - 48);
    ctx.closePath();
    ctx.fill();
    // Unload progress, floating above the docked ship (the ship's top is
    // at BERTH_Y - len/2, so the bar sits clear of it).
    if (dock.occupied) {
      const s = dock.occupied;
      const p = 1 - s.unloadT / s.unloadTotal;
      const bw = 110;
      const bx = dock.x - bw / 2;
      const by = PIER_TOP - 126;
      ctx.fillStyle = 'rgba(6,32,44,0.75)';
      rr(ctx, bx - 6, by - 6, bw + 12, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#23414e';
      rr(ctx, bx, by, bw, 10, 5);
      ctx.fill();
      ctx.fillStyle = s.isMatch() ? COLORS.ok : COLORS.gold;
      rr(ctx, bx, by, Math.max(10, bw * p), 10, 5);
      ctx.fill();
      text(ctx, s.isMatch() ? 'UNLOADING' : 'WRONG BERTH — SLOW', dock.x, by + 22, 11, '#ffffff');
    }
    if (dock.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, dock.flash * 2);
      ctx.fillStyle = COLORS.danger;
      rr(ctx, left - 8, PIER_TOP - 34, PIER_W + 16, PIER_BOTTOM - PIER_TOP + 34, 8);
      ctx.fill();
      ctx.restore();
      text(ctx, 'DOCK BUSY', dock.x, PIER_TOP - 52, 14, '#ffffff');
    }
  }
}

function drawShipBody(ctx, s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.heading);
  const L = s.len;
  const Wid = s.wid;
  // Hull: white deck (purple for the boss), dark outline, coloured
  // stripe, pointed bow. The boss keeps its dock colour in the stripe so
  // the player can always tell where it belongs.
  ctx.fillStyle = s.boss ? '#7e22ce' : '#f2f5ef';
  ctx.strokeStyle = s.boss ? '#f5c542' : '#123240';
  ctx.lineWidth = s.boss ? 4 : 2;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -Wid / 2);
  ctx.lineTo(L / 2 - 14, -Wid / 2);
  ctx.quadraticCurveTo(L / 2 + 6, 0, L / 2 - 14, Wid / 2);
  ctx.lineTo(-L / 2, Wid / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = s.color;
  ctx.fillRect(-L / 2 + 4, -Wid / 2 + 3, L - 22, s.boss ? 9 : 5);
  ctx.fillRect(-L / 2 + 4, Wid / 2 - (s.boss ? 12 : 8), L - 22, s.boss ? 9 : 5);
  // Gold trim along the boss hull.
  if (s.boss) {
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(-L / 2 + 8, -Wid / 2 + 14, L - 34, Wid - 28);
  }
  // Bridge at the stern.
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#123240';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-L / 2 + 4, -Wid / 2 + 7, 14, Wid - 14);
  ctx.strokeRect(-L / 2 + 4, -Wid / 2 + 7, 14, Wid - 14);
  ctx.fillStyle = '#123240';
  ctx.fillRect(-L / 2 + 6, -Wid / 2 + 9, 10, 3);
  // Cargo by type.
  if (s.type === 'boss') {
    // Storm Galleon: three gold-topped funnels and a storm flag.
    ctx.fillStyle = '#f5c542';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-L / 2 + 40 + i * 30, -Wid / 2 + 12, 16, Wid - 24);
      ctx.fillStyle = '#7e22ce';
      ctx.fillRect(-L / 2 + 40 + i * 30, -Wid / 2 + 12, 16, 6);
      ctx.fillStyle = '#f5c542';
    }
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(L / 2 - 30, -Wid / 2 + 8);
    ctx.lineTo(L / 2 - 6, -Wid / 2 + 16);
    ctx.lineTo(L / 2 - 30, -Wid / 2 + 24);
    ctx.closePath();
    ctx.fill();
  } else if (s.type === 'cargo') {
    const cols = ['#e4572e', '#2e86e4', '#2fa36b', '#eab308'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = cols[(i + s.id) % 4];
      ctx.fillRect(-L / 2 + 24 + i * 20, -Wid / 2 + 8, 17, Wid - 16);
      ctx.strokeStyle = 'rgba(18,50,64,0.5)';
      ctx.strokeRect(-L / 2 + 24 + i * 20, -Wid / 2 + 8, 17, Wid - 16);
    }
  } else if (s.type === 'tanker') {
    ctx.fillStyle = '#dfe7ea';
    ctx.strokeStyle = '#7d8a94';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-L / 2 + 32 + i * 24, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (s.type === 'ferry') {
    ctx.fillStyle = '#123240';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-L / 2 + 24 + i * 11, -Wid / 2 + 9, 6, 6);
      ctx.fillRect(-L / 2 + 24 + i * 11, Wid / 2 - 15, 6, 6);
    }
  } else if (s.type === 'liner') {
    ctx.fillStyle = s.color;
    ctx.fillRect(-L / 2 + 30, -Wid / 2 + 6, 8, 12);
    ctx.fillRect(-L / 2 + 46, -Wid / 2 + 6, 8, 12);
    ctx.fillStyle = '#123240';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-L / 2 + 62 + i * 11, -Wid / 2 + 9, 6, 6);
      ctx.fillRect(-L / 2 + 62 + i * 11, Wid / 2 - 15, 6, 6);
    }
  }
  ctx.restore();
}

function drawShips(ctx, world) {
  const ships = [...world.ships, ...(world.state === 'title' ? world.demoShips : [])];
  ships.sort((a, b) => a.y - b.y);
  for (const s of ships) {
    // Wake: a fading trail behind the stern.
    if (s.wake.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.wake.forEach((w, i) => {
        if (i === 0) ctx.moveTo(w.x, w.y);
        else ctx.lineTo(w.x, w.y);
      });
      ctx.stroke();
    }
    if (s.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.flash);
      ctx.fillStyle = COLORS.danger;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawShipBody(ctx, s);
    if (s.vip && ['arriving', 'waiting', 'assigned'].includes(s.state)) {
      // Gold ring, VIP label and the countdown bar above the ship.
      ctx.save();
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const bw = 56;
      const bx = s.x - bw / 2;
      const by = s.y - s.len * 0.42 - 32;
      ctx.fillStyle = 'rgba(6,32,44,0.8)';
      rr(ctx, bx - 4, by - 4, bw + 8, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#3a2f00';
      rr(ctx, bx, by, bw, 6, 3);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      rr(ctx, bx, by, Math.max(6, bw * (s.vipT / VIP_TIME_S)), 6, 3);
      ctx.fill();
      text(ctx, `VIP ${Math.ceil(s.vipT)}s`, s.x, by - 12, 13, COLORS.gold);
    }
    if (s.boss && ['arriving', 'waiting', 'assigned', 'docking'].includes(s.state)) {
      // Purple ring, BOSS label and the 45-second countdown bar.
      ctx.save();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const bw = 110;
      const bx = s.x - bw / 2;
      const by = s.y - s.len * 0.42 - 38;
      ctx.fillStyle = 'rgba(6,32,44,0.85)';
      rr(ctx, bx - 6, by - 6, bw + 12, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#2a0a45';
      rr(ctx, bx, by, bw, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#c084fc';
      rr(ctx, bx, by, Math.max(8, bw * (s.bossT / BOSS_TIME_S)), 8, 4);
      ctx.fill();
      text(ctx, `BOSS ${Math.ceil(s.bossT)}s`, s.x, by - 14, 17, COLORS.gold);
    }
    if (s.warn && s.collidable) {
      const pulse = 1 + 0.15 * Math.sin(world.time * 10);
      text(ctx, '!', s.x, s.y - s.len * 0.42 - 12, Math.round(22 * pulse), COLORS.danger);
    }
    if (s.selected) {
      const pulse = 1 + 0.08 * Math.sin(world.time * 6);
      ctx.save();
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, (s.radius + 10) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // A dashed thread from the selected ship to the mouse: where it goes.
      if (world.mouse && world.state === 'playing') {
        ctx.save();
        ctx.strokeStyle = 'rgba(245,197,66,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(world.mouse.x, world.mouse.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawFloaters(ctx, world) {
  for (const f of world.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.t);
    text(ctx, f.text, f.x, f.y - (1.4 - f.t) * 30, 22, f.color);
    ctx.restore();
  }
}

function drawFog(ctx, world) {
  if (world.level < 3 || world.state !== 'playing') return;
  for (const f of world.fog) {
    const g = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, f.r);
    g.addColorStop(0, 'rgba(240,246,247,0.20)');
    g.addColorStop(1, 'rgba(240,246,247,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
  }
}

function drawHUD(ctx, world) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, W, 46);
  text(ctx, `SCORE  ${world.score}`, 16, 24, 24, COLORS.hudText, 'left');
  if (world.combo >= 2) {
    text(ctx, `COMBO x${world.comboMult.toFixed(1)}`, 230, 24, 18, COLORS.gold, 'left');
  }
  let center = `LEVEL ${world.level}   ·   SHIPS ${world.served}`;
  const owned = [];
  if (world.upgrades.crane > 0) owned.push(`CRANE x${world.upgrades.crane}`);
  if (world.upgrades.hull > 0) owned.push(`HULL x${world.upgrades.hull}`);
  if (world.upgrades.tug > 0) owned.push(`TUG x${world.upgrades.tug}`);
  if (world.upgrades.anchor) owned.push('ANCHOR');
  if (owned.length > 0) center += `   ·   ${owned.join('  ')}`;
  text(ctx, center, W / 2, 24, 18, COLORS.hudDim);
  const rx = W - 16;
  for (let i = 0; i < world.maxStrikes; i++) {
    const lost = i < world.strikes;
    drawAnchor(ctx, rx - 170 - i * 30, 24, 13, lost ? '#5a3a3a' : '#ff8a8a');
  }
  text(ctx, fmtTime(world.elapsed), rx - 110, 24, 18, COLORS.hudText, 'left');
  text(ctx, 'M ♪', rx - 52, 24, 16, COLORS.hudDim, 'left');
  // Context hint, low on the sea so it never covers a berth.
  if (world.state === 'playing') {
    let hint = null;
    if (world.selected) hint = `Ship selected — click dock ${world.selected.color === '#e4572e' ? '1 RED' : world.selected.color === '#2e86e4' ? '2 BLUE' : world.selected.color === '#2fa36b' ? '3 GREEN' : '4 YELLOW'} (or press 1–4)`;
    else if (world.elapsed < 25) hint = 'Click a ship, then click its matching coloured dock';
    if (hint) {
      ctx.fillStyle = 'rgba(6,32,44,0.65)';
      ctx.font = 'bold 15px Trebuchet MS, Verdana, sans-serif';
      const tw = ctx.measureText(hint).width;
      rr(ctx, W / 2 - tw / 2 - 14, 556, tw + 28, 28, 14);
      ctx.fill();
      text(ctx, hint, W / 2, 571, 15, '#eaf6f8');
    }
  }
}

function drawBanner(ctx, world) {
  if (!world.banner) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, world.banner.t);
  text(ctx, world.banner.text, W / 2, 200, 54, COLORS.gold);
  text(ctx, world.banner.sub, W / 2, 240, 20, '#ffffff');
  ctx.restore();
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(6,26,36,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(ctx, world) {
  overlay(ctx, 0.45);
  text(ctx, 'HARBOR MASTER', W / 2, 190, 82, '#ffffff');
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(W / 2 - 190, 232, 380, 5);
  text(ctx, 'A harbour traffic game — every ship wants its own dock', W / 2, 272, 22, '#d7ecef');
  const lines = [
    'Click a ship to select it, then click its matching coloured dock (keys 1–4 work too).',
    'Right dock: fast unload, full points, combo grows. Wrong dock: slow, half points.',
    'VIP liners pay +300 if docked in 30 seconds — and watch for rush hour.',
    'Every level: pick a free upgrade. Every 5th level: the Storm Galleon boss — 500 points.',
    'Ships that bump into each other cost a strike. Three strikes and the harbour closes.',
  ];
  lines.forEach((l, i) => text(ctx, l, W / 2, 322 + i * 30, 18, '#eaf6f8'));
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'CLICK TO START', W / 2, 470, 30, COLORS.gold);
  ctx.restore();
  text(ctx, 'Space pause  ·  R restart  ·  M mute', W / 2, 520, 15, COLORS.hudDim);
}

function drawPaused(ctx) {
  overlay(ctx, 0.55);
  text(ctx, 'PAUSED', W / 2, 330, 54, '#ffffff');
  text(ctx, 'Space or click to resume', W / 2, 380, 20, COLORS.hudDim);
}

function drawGameOver(ctx, world) {
  overlay(ctx, 0.6);
  ctx.fillStyle = 'rgba(6,32,44,0.92)';
  rr(ctx, W / 2 - 260, 150, 520, 400, 18);
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  rr(ctx, W / 2 - 260, 150, 520, 400, 18);
  ctx.stroke();
  text(ctx, 'HARBOR CLOSED', W / 2, 200, 44, '#ffffff');
  text(ctx, `FINAL SCORE  ${world.score}`, W / 2, 262, 30, COLORS.gold);
  if (world.score > 0 && world.score >= world.best) {
    text(ctx, 'NEW BEST!', W / 2, 296, 18, COLORS.ok);
  }
  text(ctx, `Ships served   ${world.served}`, W / 2, 340, 20, COLORS.hudText);
  text(ctx, `Best combo   x${(1 + (world.bestCombo - 1) * 0.5).toFixed(1)}   ·   Level reached   ${world.level}`, W / 2, 374, 20, COLORS.hudText);
  text(ctx, `Time on duty   ${fmtTime(world.elapsed)}`, W / 2, 408, 20, COLORS.hudText);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  text(ctx, 'Click or press R to play again', W / 2, 492, 22, COLORS.gold);
  ctx.restore();
}

function drawShop(ctx, world) {
  overlay(ctx, 0.55);
  // Panel.
  const px = 150;
  const py = 110;
  const pw = 980;
  const ph = 500;
  ctx.fillStyle = 'rgba(6,32,44,0.94)';
  rr(ctx, px, py, pw, ph, 18);
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  rr(ctx, px, py, pw, ph, 18);
  ctx.stroke();
  text(ctx, 'LEVEL UP — CHOOSE AN UPGRADE', W / 2, py + 52, 34, COLORS.gold);
  text(ctx, `Level ${world.level} reached — one upgrade is free. Pick wisely.`, W / 2, py + 96, 18, COLORS.hudText);
  // Three cards in a row.
  const cw = 280;
  const ch = 290;
  const gap = 30;
  const total = cw * 3 + gap * 2;
  const x0 = W / 2 - total / 2;
  const y0 = py + 130;
  world.shopCards = [];
  world.shopOptions.forEach((opt, i) => {
    const x = x0 + i * (cw + gap);
    const y = y0;
    const sel = i === world.shopSel;
    world.shopCards.push({ x, y, w: cw, h: ch, idx: i });
    ctx.fillStyle = sel ? 'rgba(245,197,66,0.16)' : 'rgba(255,255,255,0.06)';
    rr(ctx, x, y, cw, ch, 14);
    ctx.fill();
    ctx.strokeStyle = sel ? COLORS.gold : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = sel ? 4 : 2;
    rr(ctx, x, y, cw, ch, 14);
    ctx.stroke();
    // Key number in a corner chip.
    ctx.fillStyle = sel ? COLORS.gold : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x + 28, y + 28, 17, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `${i + 1}`, x + 28, y + 29, 18, '#123240');
    text(ctx, opt.name, x + cw / 2, y + 74, 22, '#ffffff');
    opt.desc.forEach((line, j) => text(ctx, line, x + cw / 2, y + 116 + j * 26, 16, COLORS.hudDim));
    // Level pips: filled dots for levels owned, empty for the rest.
    const pips = [];
    for (let p = 0; p < opt.max; p++) pips.push(p < opt.level ? '●' : '○');
    text(ctx, pips.join(' '), x + cw / 2, y + 200, 20, COLORS.gold);
    text(ctx, opt.max > 1 ? `Lv ${opt.level}/${opt.max}` : opt.level > 0 ? 'OWNED' : 'NEW', x + cw / 2, y + 234, 15, COLORS.hudDim);
    if (sel) {
      const pulse = 0.65 + 0.35 * Math.sin(world.time * 4);
      ctx.save();
      ctx.globalAlpha = pulse;
      text(ctx, 'PRESS ENTER', x + cw / 2, y + ch - 22, 14, COLORS.gold);
      ctx.restore();
    }
  });
  text(ctx, 'Click a card, or press 1 / 2 / 3 then Enter', W / 2, py + ph - 28, 16, COLORS.hudDim);
}

export function render(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    const m = world.shake * 14;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  drawSea(ctx, world);
  drawClouds(ctx, world);
  drawGulls(ctx, world);
  drawQuay(ctx);
  drawDocks(ctx, world);
  drawShips(ctx, world);
  drawFloaters(ctx, world);
  drawFog(ctx, world);
  if (world.state !== 'title') drawHUD(ctx, world);
  drawBanner(ctx, world);
  if (world.state === 'title') drawTitle(ctx, world);
  else if (world.state === 'paused') drawPaused(ctx);
  else if (world.state === 'gameover') drawGameOver(ctx, world);
  else if (world.state === 'shop') drawShop(ctx, world);
  ctx.restore();
}
