// The world: everything the game is. It owns the ships, the docks, the
// score, the levels, the fog and the state machine (title -> playing ->
// paused -> gameover). Rendering and input live in their own files and only
// read or call into this one.

import {
  BERTH_Y,
  BOSS_LEN,
  BOSS_SCORE,
  BOSS_SPEED,
  BOSS_TIME_S,
  BOSS_WID,
  COMBO_CAP,
  COMBO_MAX_MULT,
  COMBO_STEP,
  DOCKS,
  FOG_FROM_LEVEL,
  H,
  MAX_CONCURRENT_CAP,
  MAX_CONCURRENT_START,
  MAX_STRIKES,
  RUSH_FIRST_S,
  RUSH_INTERVAL_S,
  RUSH_MAX_ACTIVE,
  RUSH_WAVE,
  SHIP_TYPES,
  SHIPS_PER_LEVEL,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_START,
  SPAWN_INTERVAL_STEP,
  UPGRADE_DEFS,
  VIP_BONUS,
  VIP_TIME_S,
  W,
} from './config.js';
import { Dock } from './docks.js';
import { Ship } from './ships.js';
import { makeRng } from './random.js';
import { sfx } from './audio.js';

export class World {
  constructor(seed = (Date.now() % 2147483647) | 0) {
    this.rng = makeRng(seed);
    this.docks = DOCKS.map((d) => new Dock(d));
    this.ships = [];
    this.state = 'title'; // title | playing | paused | gameover | shop
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.served = 0;
    this.level = 1;
    this.strikes = 0;
    // Level-up upgrades: crane/hull/tug stack to 3, anchor is once-only.
    this.upgrades = { crane: 0, hull: 0, tug: 0, anchor: false };
    this.shopOptions = []; // [{ id, name, desc, level, max }] while choosing
    this.shopSel = 0; // highlighted card in the shop (keys 1-3 / Enter)
    this.shopCards = []; // card hit rects, laid out by the renderer
    this.elapsed = 0;
    this.best = 0; // best score this page session
    this.selected = null;
    this.hovered = null;
    this.spawnTimer = 2;
    this.rushTimer = RUSH_FIRST_S;
    this.shake = 0;
    this.banner = null; // { text, sub, t }
    this.floaters = []; // { x, y, text, color, t }
    this.time = 0; // wall clock for ambient animation, always advances
    this.gameOverAt = 0;
    this.startedAt = 0;
    // Ambient life: clouds and gulls drift over the sea on every screen.
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: this.rng.range(0, W),
        y: this.rng.range(30, 170),
        s: this.rng.range(0.7, 1.5),
        v: this.rng.range(6, 14),
      });
    }
    this.gulls = [];
    for (let i = 0; i < 4; i++) {
      this.gulls.push({
        x: this.rng.range(0, W),
        y: this.rng.range(60, 220),
        v: this.rng.range(18, 30),
        ph: this.rng.range(0, 6),
      });
    }
    // Fog banks, only used from level 3 on.
    this.fog = [];
    for (let i = 0; i < 3; i++) {
      this.fog.push({ x: this.rng.range(0, W), y: this.rng.range(120, 420), r: this.rng.range(180, 280), v: this.rng.range(8, 16) });
    }
    // Title-screen demo ships, sailing east in a band above the title so
    // they never cross the text or the docks.
    this.demoShips = [];
    for (let i = 0; i < 3; i++) {
      const s = new Ship(this.rng);
      s.state = 'leaving';
      s.x = this.rng.range(-100, W);
      s.y = this.rng.range(60, 120);
      s.heading = 0; // east
      s.waypoints = [];
      this.demoShips.push(s);
    }
  }

  get comboMult() {
    // combo counts consecutive correct docks so far, so the next one pays
    // 1 + combo * 0.5 (first correct dock pays x1.0, then x1.5, x2.0...).
    return Math.min(1 + this.combo * COMBO_STEP, COMBO_MAX_MULT);
  }

  get spawnInterval() {
    return Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_START - (this.level - 1) * SPAWN_INTERVAL_STEP);
  }

  // Extra Hull upgrades raise the strike limit: 3 + hull levels.
  get maxStrikes() {
    return MAX_STRIKES + this.upgrades.hull;
  }

  get concurrentCap() {
    return Math.min(MAX_CONCURRENT_START + (this.level - 1), MAX_CONCURRENT_CAP);
  }

  activeShips() {
    return this.ships.filter((s) => s.state !== 'gone' && s.state !== 'unloading' && s.state !== 'leaving' && s.state !== 'towed');
  }

  start() {
    this.posed = false; // a real restart unfreezes a posed frame
    this.ships = [];
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.served = 0;
    this.level = 1;
    this.strikes = 0;
    this.upgrades = { crane: 0, hull: 0, tug: 0, anchor: false };
    this.shopOptions = [];
    this.shopSel = 0;
    this.shopCards = [];
    this.elapsed = 0;
    this.selected = null;
    this.spawnTimer = 1.4;
    this.rushTimer = RUSH_FIRST_S;
    this.shake = 0;
    this.floaters = [];
    this.banner = { text: 'LEVEL 1', sub: 'Guide every ship to its matching dock', t: 2.4 };
    for (const d of this.docks) {
      d.occupied = null;
      d.flash = 0;
    }
    this.state = 'playing';
    this.startedAt = this.time;
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  select(ship) {
    if (this.selected) this.selected.selected = false;
    this.selected = ship;
    if (ship) {
      ship.selected = true;
      sfx.click();
    }
  }

  // Assign the selected ship to a dock. A busy dock refuses with a flash.
  assignSelected(dock) {
    const ship = this.selected;
    if (!ship || ship.state === 'gone') return false;
    if (!['arriving', 'waiting'].includes(ship.state)) return false;
    if (!dock.free) {
      dock.flash = 0.5;
      sfx.wrong();
      return false;
    }
    ship.assign(dock);
    this.select(null);
    return true;
  }

  hasActiveVip() {
    return this.ships.some(
      (s) => s.vip && ['arriving', 'waiting', 'assigned', 'docking', 'unloading'].includes(s.state),
    );
  }

  // A VIP liner, forced: the level-2 arrival and the test hook both use it.
  spawnVipLiner() {
    if (this.hasActiveVip()) return null;
    const ship = new Ship(this.rng);
    const spec = SHIP_TYPES.liner;
    ship.type = 'liner';
    ship.len = spec.len;
    ship.wid = spec.wid;
    ship.speed = spec.speed;
    ship.baseScore = spec.score;
    ship.vip = true;
    ship.vipT = VIP_TIME_S;
    this.ships.push(ship);
    sfx.horn();
    return ship;
  }

  spawnShip(force = false) {
    const cap = force ? RUSH_MAX_ACTIVE : this.concurrentCap;
    if (this.activeShips().length >= cap) return;
    const ship = new Ship(this.rng);
    // Half of all liners from level 2 on arrive as VIPs — at most one at a
    // time, so the countdown always means something.
    if (this.level >= 2 && ship.type === 'liner' && !this.hasActiveVip() && this.rng.next() < 0.5) {
      ship.vip = true;
      ship.vipT = VIP_TIME_S;
    }
    this.ships.push(ship);
    sfx.horn();
  }

  onVipExpired(ship) {
    this.floaters.push({ x: ship.x, y: ship.y - 60, text: 'VIP SAILED AWAY', color: '#ff9a9a', t: 1.6 });
    sfx.wrong();
  }

  hasActiveBoss() {
    return this.ships.some(
      (s) => s.boss && ['arriving', 'waiting', 'assigned', 'docking', 'unloading'].includes(s.state),
    );
  }

  // The Storm Galleon: a 2x hull worth 500 points, slow, on a 45-second
  // clock. At most one at a time; its dock colour is a normal dock colour
  // so the player can always tell where it belongs.
  spawnBoss() {
    if (this.hasActiveBoss()) return null;
    const ship = new Ship(this.rng);
    ship.type = 'boss';
    ship.len = BOSS_LEN;
    ship.wid = BOSS_WID;
    ship.speed = BOSS_SPEED;
    ship.baseScore = BOSS_SCORE;
    ship.color = this.rng.pick(['#e4572e', '#2e86e4', '#2fa36b', '#eab308']);
    ship.boss = true;
    ship.bossT = BOSS_TIME_S;
    this.ships.push(ship);
    sfx.bossHorn();
    return ship;
  }

  onBossExpired(ship) {
    this.floaters.push({ x: ship.x, y: ship.y - 70, text: 'STORM GALLEON ESCAPED', color: '#ff9a9a', t: 1.6 });
    sfx.wrong();
  }

  // ---- Level-up shop ----
  // The pool is every upgrade that still has room: stacked ones below
  // their max, Golden Anchor only while it is not owned yet.
  buildShopOptions() {
    const pool = UPGRADE_DEFS.filter((d) => {
      if (d.id === 'anchor') return !this.upgrades.anchor;
      return this.upgrades[d.id] < d.max;
    }).map((d) => ({
      id: d.id,
      name: d.name,
      desc: d.desc,
      level: d.id === 'anchor' ? (this.upgrades.anchor ? 1 : 0) : this.upgrades[d.id],
      max: d.max,
    }));
    // Shuffle with the world rng, take three.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  openShop(options) {
    this.shopOptions = options;
    this.shopSel = 0;
    this.shopCards = [];
    this.state = 'shop';
    sfx.levelUp();
  }

  applyShopChoice(i) {
    const opt = this.shopOptions[i];
    if (!opt) return;
    if (opt.id === 'anchor') this.upgrades.anchor = true;
    else this.upgrades[opt.id] = Math.min(opt.max, this.upgrades[opt.id] + 1);
    const n = opt.id === 'anchor' ? 1 : this.upgrades[opt.id];
    this.banner = {
      text: `${opt.name} ${opt.max > 1 ? `Lv ${n}` : 'TAKEN'}`,
      sub: opt.id === 'tug' ? 'A tugboat will guide a ship for you' : 'Upgrade applied — back to work',
      t: 2.2,
    };
    sfx.chime();
    this.closeShop();
  }

  closeShop() {
    this.shopOptions = [];
    this.shopCards = [];
    this.state = 'playing';
    // Tugboats work on every resume: each tug level auto-guides one ship
    // to its matching dock, free of charge.
    if (this.upgrades.tug > 0) this.autoTug();
    // A boss waiting out the shop gets its warning back on screen.
    if (this.hasActiveBoss()) {
      this.banner = { text: 'STORM GALLEON!', sub: 'Dock the boss in time — 500 points', t: 2.4 };
    }
  }

  autoTug() {
    let left = this.upgrades.tug;
    for (const s of this.ships) {
      if (left <= 0) break;
      if (!['arriving', 'waiting'].includes(s.state)) continue;
      const dock = this.docks.find((d) => d.color === s.color);
      if (!dock || !dock.free) continue;
      if (this.selected === s) this.select(null);
      s.assign(dock);
      left--;
      this.floaters.push({ x: s.x, y: s.y - 60, text: 'TUGBOAT!', color: '#f5c542', t: 1.4 });
    }
  }

  onUnloadComplete(ship) {
    const dock = ship.dock;
    const match = ship.isMatch();
    const mult = match ? this.comboMult : 1;
    // A VIP liner pays its base times the combo plus a flat bonus — but
    // only at the right dock. A VIP at the wrong dock is just an expensive
    // mistake.
    const points = match
      ? Math.round(ship.baseScore * mult) + (ship.vip ? VIP_BONUS : 0)
      : Math.floor(ship.baseScore / 2);
    this.score += points;
    this.served++;
    if (match) {
      this.combo = Math.min(this.combo + 1, COMBO_CAP);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      sfx.chime();
    } else {
      // Golden Anchor holds the combo through a wrong dock.
      if (!this.upgrades.anchor) this.combo = 0;
      sfx.wrong();
    }
    this.floaters.push({
      x: dock.x,
      y: BERTH_Y - 70,
      text: match
        ? ship.boss
          ? `+${points} BOSS!`
          : ship.vip
            ? `+${points} VIP!`
            : `+${points}`
        : this.upgrades.anchor
          ? `+${points} WRONG BERTH · ANCHOR HELD`
          : `+${points} WRONG BERTH`,
      color: match ? '#f5c542' : '#ff9a9a',
      t: 1.4,
    });
    if (dock) dock.occupied = null;
    ship.depart(this);
    const newLevel = 1 + Math.floor(this.served / SHIPS_PER_LEVEL);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.banner = {
        text: `LEVEL ${this.level}`,
        sub: this.level >= FOG_FROM_LEVEL ? 'Fog is rolling in — watch the traffic' : 'Traffic is picking up',
        t: 2.4,
      };
      sfx.levelUp();
      // Level 2 opens with a guaranteed VIP liner, so every player meets
      // the mechanic early instead of waiting on a rare spawn.
      if (newLevel === 2) {
        this.spawnVipLiner();
        this.banner.sub = 'A VIP liner is inbound — dock it in 30 seconds';
      }
      // Every 5th level brings the Storm Galleon.
      if (newLevel % 5 === 0) this.spawnBoss();
      // Then the shop: one free upgrade, picked before play resumes.
      const options = this.buildShopOptions();
      if (options.length > 0) this.openShop(options);
    }
  }

  checkCollisions(dt) {
    const list = this.ships.filter((s) => s.collidable);
    const touching = new Set();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < (a.radius + b.radius) * 0.62) {
          // Overlap is not an instant strike: the grace period lets a
          // give-way drift separate the ships, and shows the player the
          // danger (red flash) before it costs a strike.
          touching.add(a);
          touching.add(b);
          a.bumpT += dt;
          b.bumpT += dt;
          a.flash = Math.max(a.flash, 0.2);
          b.flash = Math.max(b.flash, 0.2);
          if (a.bumpT > 0.8 || b.bumpT > 0.8) {
            this.collide(a, b);
            return; // one collision per tick is enough; the rest is next tick's
          }
        }
      }
    }
    for (const s of list) {
      if (!touching.has(s)) s.bumpT = 0;
    }
    // Near-miss warnings: ships close enough to worry about.
    for (const s of list) s.warn = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius + 34) {
          a.warn = true;
          b.warn = true;
        }
      }
    }
  }

  collide(a, b) {
    this.strikes++;
    this.combo = 0;
    this.shake = 0.4;
    sfx.alarm();
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    this.floaters.push({ x: mx, y: my - 30, text: 'COLLISION!', color: '#ff6b6b', t: 1.6 });
    if (this.selected === a || this.selected === b) this.select(null);
    a.flash = 1;
    b.flash = 1;
    a.towAway();
    b.towAway();
    if (this.strikes >= this.maxStrikes) this.gameOver();
  }

  gameOver() {
    this.state = 'gameover';
    this.gameOverAt = this.time;
    this.best = Math.max(this.best, this.score);
    this.select(null);
  }

  update(dt) {
    this.time += dt;
    // Ambient life always moves, whatever the screen.
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > W + 160) c.x = -160;
    }
    for (const g of this.gulls) {
      g.x += g.v * dt;
      g.ph += dt * 6;
      if (g.x > W + 30) {
        g.x = -30;
        g.y = this.rng.range(60, 220);
      }
    }
    if (this.level >= FOG_FROM_LEVEL) {
      for (const f of this.fog) {
        f.x += f.v * dt;
        if (f.x - f.r > W) f.x = -f.r;
      }
    }
    // A posed screenshot frame stays exactly as posed: the sea stays alive,
    // but ships, timers and floaters do not advance.
    if (this.posed) return;
    for (const d of this.docks) d.update(dt);
    for (const f of this.floaters) f.t -= dt;
    this.floaters = this.floaters.filter((f) => f.t > 0);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.shake > 0) this.shake -= dt;

    if (this.state === 'title') {
      for (const s of this.demoShips) {
        s.x += s.speed * 0.5 * dt;
        if (s.x > W + 130) {
          s.x = -130;
          s.y = this.rng.range(60, 120);
        }
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.elapsed += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnShip();
      this.spawnTimer = this.spawnInterval * this.rng.range(0.85, 1.15);
    }
    // Rush hour: a wave of three ships at once, on a steady clock.
    this.rushTimer -= dt;
    if (this.rushTimer <= 0) {
      this.rushTimer = RUSH_INTERVAL_S;
      this.banner = { text: 'RUSH HOUR', sub: 'Three ships inbound — clear the lanes', t: 2.4 };
      for (let i = 0; i < RUSH_WAVE; i++) this.spawnShip(true);
    }
    for (const s of this.ships) s.update(dt, this);
    this.ships = this.ships.filter((s) => s.state !== 'gone');
    this.checkCollisions(dt);
  }

  // ---- Screenshot poses: states real play can reach, built directly. ----
  // A busy mid-game frame: one ship unloading, one on approach, one
  // waiting, one arriving; score, combo and a strike already on the board.
  posePlay() {
    this.start();
    this.banner = null; // start() posts LEVEL 1; the pose is already level 2
    this.posed = true;
    this.score = 420;
    this.combo = 2;
    this.bestCombo = 3;
    this.served = 7;
    this.level = 2;
    this.strikes = 1;
    this.elapsed = 74;
    this.spawnTimer = 99;
    const mk = (type, color, x, y, heading, state) => {
      const s = new Ship(this.rng);
      s.type = type;
      const spec = { cargo: [96, 36, 44, 100], tanker: [112, 40, 34, 150], ferry: [84, 38, 52, 120], liner: [122, 44, 30, 200] }[type];
      s.len = spec[0];
      s.wid = spec[1];
      s.speed = spec[2];
      s.baseScore = spec[3];
      s.color = color;
      s.x = x;
      s.y = y;
      s.heading = heading;
      s.state = state;
      return s;
    };
    // Green cargo unloading at the green dock (half done).
    const docked = mk('cargo', '#2fa36b', 760, BERTH_Y, Math.PI / 2, 'unloading');
    docked.dock = this.docks[2];
    docked.unloadTotal = 4;
    docked.unloadT = 2;
    this.docks[2].occupied = docked;
    // Red tanker steering to the red dock's approach.
    const inbound = mk('tanker', '#e4572e', 330, 250, Math.PI / 2 + 0.25, 'assigned');
    inbound.dock = this.docks[0];
    inbound.waypoints = [{ x: 200, y: 372 }, { x: 200, y: BERTH_Y }];
    inbound.selected = true;
    this.selected = inbound;
    // Blue ferry holding near the top, yellow liner arriving.
    const waiting = mk('ferry', '#2e86e4', 900, 290, Math.PI / 2, 'waiting');
    waiting.holdX = 900;
    waiting.holdY = 290;
    const arriving = mk('liner', '#eab308', 620, 90, Math.PI / 2 + 0.1, 'arriving');
    arriving.target = { x: 620, y: 300 };
    // The Storm Galleon on the left, so the boss is visible in the play
    // frame too — 40 s on its clock, heading for the red dock.
    const boss = new Ship(this.rng);
    boss.type = 'boss';
    boss.len = BOSS_LEN;
    boss.wid = BOSS_WID;
    boss.speed = BOSS_SPEED;
    boss.baseScore = BOSS_SCORE;
    boss.color = '#e4572e';
    boss.boss = true;
    boss.bossT = 40;
    boss.x = 140;
    boss.y = 270;
    boss.heading = Math.PI / 2 + 0.1;
    boss.state = 'arriving';
    boss.target = { x: 140, y: 300 };
    this.ships = [docked, inbound, waiting, arriving, boss];
    this.floaters.push({ x: 760, y: BERTH_Y - 70, text: '+150', color: '#f5c542', t: 1.4 });
  }

  // The end frame: three strikes, final score, one ship sailing away.
  poseEnd() {
    this.start();
    this.banner = null;
    this.posed = true;
    this.score = 1240;
    this.combo = 0;
    this.bestCombo = 4;
    this.served = 14;
    this.level = 4;
    this.strikes = 3;
    this.elapsed = 214;
    this.best = 1240;
    this.spawnTimer = 99;
    const s = new Ship(this.rng);
    s.type = 'ferry';
    s.len = 84;
    s.wid = 38;
    s.speed = 52;
    s.baseScore = 120;
    s.color = '#2e86e4';
    s.x = 1080; // beside the panel, not behind it
    s.y = 240;
    s.heading = -Math.PI / 2;
    s.state = 'leaving';
    s.waypoints = [{ x: 1080, y: -90 }];
    this.ships = [s];
    this.state = 'gameover';
    this.gameOverAt = this.time;
  }

  // The fog frame: level 3, five ships, a VIP liner on its countdown.
  poseFog() {
    this.start();
    this.banner = null;
    this.posed = true;
    this.score = 880;
    this.combo = 3;
    this.bestCombo = 5;
    this.served = 13;
    this.level = 3;
    this.strikes = 1;
    this.elapsed = 152;
    this.spawnTimer = 99;
    this.rushTimer = 99;
    const mk = (type, color, x, y, heading, state) => {
      const s = new Ship(this.rng);
      s.type = type;
      const spec = { cargo: [96, 36, 44, 100], tanker: [112, 40, 34, 150], ferry: [84, 38, 52, 120], liner: [122, 44, 30, 200] }[type];
      s.len = spec[0];
      s.wid = spec[1];
      s.speed = spec[2];
      s.baseScore = spec[3];
      s.color = color;
      s.x = x;
      s.y = y;
      s.heading = heading;
      s.state = state;
      return s;
    };
    // Blue cargo unloading at the blue dock (half done).
    const docked = mk('cargo', '#2e86e4', 480, BERTH_Y, Math.PI / 2, 'unloading');
    docked.dock = this.docks[1];
    docked.unloadTotal = 4;
    docked.unloadT = 2;
    this.docks[1].occupied = docked;
    // VIP liner steering to the red dock, 18 seconds on its countdown.
    const vip = mk('liner', '#e4572e', 350, 220, Math.PI / 2 + 0.3, 'assigned');
    vip.vip = true;
    vip.vipT = 18;
    vip.dock = this.docks[0];
    vip.waypoints = [{ x: 200, y: 372 }, { x: 200, y: BERTH_Y }];
    // Yellow tanker on its way to the yellow dock.
    const inbound = mk('tanker', '#eab308', 950, 200, Math.PI / 2 - 0.2, 'assigned');
    inbound.dock = this.docks[3];
    inbound.waypoints = [{ x: 1040, y: 372 }, { x: 1040, y: BERTH_Y }];
    // Green ferry holding, red liner arriving.
    const waiting = mk('ferry', '#2fa36b', 900, 310, Math.PI / 2, 'waiting');
    waiting.holdX = 900;
    waiting.holdY = 310;
    const arriving = mk('liner', '#e4572e', 150, 100, Math.PI / 2 + 0.1, 'arriving');
    arriving.target = { x: 150, y: 300 };
    this.ships = [docked, vip, inbound, waiting, arriving];
    this.floaters.push({ x: 480, y: BERTH_Y - 70, text: '+120', color: '#f5c542', t: 1.4 });
  }

  // The shop frame: level 2 just reached, three upgrade cards on offer.
  poseShop() {
    this.start();
    this.banner = null;
    this.posed = true;
    this.score = 640;
    this.combo = 2;
    this.bestCombo = 3;
    this.served = 6;
    this.level = 2;
    this.strikes = 0;
    this.elapsed = 96;
    this.spawnTimer = 99;
    this.rushTimer = 99;
    const mk = (type, color, x, y, heading, state) => {
      const s = new Ship(this.rng);
      s.type = type;
      const spec = { cargo: [96, 36, 44, 100], tanker: [112, 40, 34, 150], ferry: [84, 38, 52, 120], liner: [122, 44, 30, 200] }[type];
      s.len = spec[0];
      s.wid = spec[1];
      s.speed = spec[2];
      s.baseScore = spec[3];
      s.color = color;
      s.x = x;
      s.y = y;
      s.heading = heading;
      s.state = state;
      return s;
    };
    const waiting = mk('ferry', '#2e86e4', 900, 290, Math.PI / 2, 'waiting');
    waiting.holdX = 900;
    waiting.holdY = 290;
    const arriving = mk('cargo', '#eab308', 300, 120, Math.PI / 2 + 0.1, 'arriving');
    arriving.target = { x: 300, y: 300 };
    this.ships = [waiting, arriving];
    this.shopOptions = [
      { id: 'crane', name: 'CRANE SPEED', desc: ['Unload 25% faster', 'per level'], level: 0, max: 3 },
      { id: 'hull', name: 'EXTRA HULL', desc: ['+1 strike buffer', 'per level'], level: 0, max: 3 },
      { id: 'tug', name: 'TUGBOAT', desc: ['Auto-guides 1 ship', 'per level'], level: 0, max: 3 },
    ];
    this.shopSel = 0;
    this.state = 'shop';
  }

  // The boss frame: level 5, the Storm Galleon steering to its dock with
  // 32 seconds on the clock, two normal ships around it.
  poseBoss() {
    this.start();
    this.banner = null;
    this.posed = true;
    this.score = 2140;
    this.combo = 4;
    this.bestCombo = 5;
    this.served = 24;
    this.level = 5;
    this.strikes = 1;
    this.elapsed = 380;
    this.spawnTimer = 99;
    this.rushTimer = 99;
    const mk = (type, color, x, y, heading, state) => {
      const s = new Ship(this.rng);
      s.type = type;
      const spec = { cargo: [96, 36, 44, 100], tanker: [112, 40, 34, 150], ferry: [84, 38, 52, 120], liner: [122, 44, 30, 200] }[type];
      s.len = spec[0];
      s.wid = spec[1];
      s.speed = spec[2];
      s.baseScore = spec[3];
      s.color = color;
      s.x = x;
      s.y = y;
      s.heading = heading;
      s.state = state;
      return s;
    };
    // The boss: purple hull, red dock colour, 32 s left, heading for red.
    const boss = new Ship(this.rng);
    boss.type = 'boss';
    boss.len = BOSS_LEN;
    boss.wid = BOSS_WID;
    boss.speed = BOSS_SPEED;
    boss.baseScore = BOSS_SCORE;
    boss.color = '#e4572e';
    boss.boss = true;
    boss.bossT = 32;
    boss.x = 640;
    boss.y = 210;
    boss.heading = Math.PI / 2 + 0.15;
    boss.state = 'assigned';
    boss.dock = this.docks[0];
    boss.waypoints = [{ x: 200, y: 372 }, { x: 200, y: BERTH_Y }];
    // Blue ferry waiting, yellow tanker arriving.
    const waiting = mk('ferry', '#2e86e4', 980, 300, Math.PI / 2, 'waiting');
    waiting.holdX = 980;
    waiting.holdY = 300;
    const arriving = mk('tanker', '#eab308', 1050, 110, Math.PI / 2 + 0.1, 'arriving');
    arriving.target = { x: 1050, y: 300 };
    this.ships = [boss, waiting, arriving];
    this.floaters.push({ x: 640, y: 420, text: 'STORM GALLEON!', color: '#c084fc', t: 1.4 });
  }
}
