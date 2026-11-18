// A ship: one hull sailing the harbour. It steers toward waypoints with a
// limited turn rate (ships turn slowly), and its state machine walks it from
// arrival, through holding, docking and unloading, to departure. A ship that
// collides is towed away and never collides again.

import {
  APPROACH_Y,
  BERTH_Y,
  HOLD_Y,
  SHIP_TYPES,
  TURN_RATE,
  UNLOAD_MATCH_S,
  UNLOAD_WRONG_S,
  W,
} from './config.js';

let nextId = 1;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Ship {
  constructor(rng) {
    this.id = nextId++;
    this.type = rng.weighted(
      Object.entries(SHIP_TYPES).map(([name, t]) => [name, t.weight]),
    );
    const spec = SHIP_TYPES[this.type];
    this.len = spec.len;
    this.wid = spec.wid;
    this.speed = spec.speed * rng.range(0.9, 1.1);
    this.baseScore = spec.score;
    this.color = rng.pick(['#e4572e', '#2e86e4', '#2fa36b', '#eab308']);
    this.x = rng.range(70, W - 70);
    this.y = -60;
    this.heading = Math.PI / 2; // sailing south, into the harbour
    this.state = 'arriving';
    this.holdX = this.x;
    this.holdY = HOLD_Y + rng.range(-20, 50);
    this.driftPhase = rng.range(0, Math.PI * 2);
    this.target = { x: this.holdX, y: this.holdY };
    this.waypoints = [];
    this.dock = null;
    this.unloadT = 0;
    this.unloadTotal = 1;
    this.selected = false;
    this.flash = 0; // red warning flash (near miss / collision)
    this.warn = false; // another ship is close by
    this.bumpT = 0; // seconds spent overlapping another ship (grace period)
    this.vip = false; // a VIP liner: gold trim, countdown, +300 if docked in time
    this.vipT = 0; // seconds left on the VIP countdown
    this.boss = false; // the Storm Galleon: 2x size, 45 s clock, 500 points
    this.bossT = 0; // seconds left on the boss countdown
    this.wake = []; // past stern positions, for the trail
    this.wakeTimer = 0;
  }

  get radius() {
    return this.len * 0.42;
  }

  get collidable() {
    return ['arriving', 'waiting', 'assigned', 'docking'].includes(this.state);
  }

  get moving() {
    return ['arriving', 'assigned', 'docking', 'leaving', 'towed'].includes(this.state);
  }

  isMatch() {
    return this.dock !== null && this.color === this.dock.color;
  }

  // Steer toward a point. Returns true when arrived (within arriveDist).
  steerTo(tx, ty, dt, arriveDist = 10) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= arriveDist) return true;
    const desired = Math.atan2(dy, dx);
    const diff = wrapAngle(desired - this.heading);
    const turn = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
    this.heading += turn;
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
    return false;
  }

  assign(dock) {
    this.dock = dock;
    this.state = 'assigned';
    this.waypoints = [
      { x: dock.x, y: APPROACH_Y },
      { x: dock.x, y: BERTH_Y },
    ];
  }

  update(dt, world) {
    if (this.flash > 0) this.flash -= dt;
    // A VIP liner's countdown only runs before it docks; once it is
    // unloading, the bonus is safe. Out of time, it sails away — no strike,
    // just a lost bonus.
    if (this.vip && ['arriving', 'waiting', 'assigned', 'docking'].includes(this.state)) {
      this.vipT -= dt;
      if (this.vipT <= 0) {
        world.onVipExpired(this);
        this.towAway();
        return;
      }
    }
    // The boss works the same way, on its own 45-second clock: out of time
    // it sails off with no strike, just a lost 500 points.
    if (this.boss && ['arriving', 'waiting', 'assigned', 'docking'].includes(this.state)) {
      this.bossT -= dt;
      if (this.bossT <= 0) {
        world.onBossExpired(this);
        this.towAway();
        return;
      }
    }
    // Wake trail: a breadcrumb every 90 ms while moving.
    if (this.moving) {
      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.09;
        const bx = this.x - Math.cos(this.heading) * this.len * 0.5;
        const by = this.y - Math.sin(this.heading) * this.len * 0.5;
        this.wake.push({ x: bx, y: by, a: 0.5 });
        if (this.wake.length > 14) this.wake.shift();
      }
    }
    for (const w of this.wake) w.a -= dt * 0.45;
    this.wake = this.wake.filter((w) => w.a > 0);

    switch (this.state) {
      case 'arriving': {
        if (this.steerTo(this.target.x, this.target.y, dt, 12)) {
          this.state = 'waiting';
        }
        break;
      }
      case 'waiting': {
        // Drift around the holding point, and give way: a ship on its way to
        // a dock pushes waiting ships aside, so a crossing never has to be
        // a collision the player could not have prevented.
        this.driftPhase += dt * 0.5;
        let ax = (this.holdX - this.x) * 0.4 + Math.sin(this.driftPhase) * 6;
        let ay = (this.holdY - this.y) * 0.4 + Math.cos(this.driftPhase * 0.7) * 4;
        for (const o of world.ships) {
          if (o === this || !['assigned', 'docking'].includes(o.state)) continue;
          const dx = this.x - o.x;
          const dy = this.y - o.y;
          const d = Math.hypot(dx, dy);
          if (d < 120 && d > 0.01) {
            const push = ((120 - d) / 120) * 70;
            ax += (dx / d) * push;
            ay += (dy / d) * push;
          }
        }
        this.x += ax * dt;
        this.y += ay * dt;
        this.x = Math.max(50, Math.min(W - 50, this.x));
        this.y = Math.max(110, Math.min(440, this.y));
        break;
      }
      case 'assigned': {
        const wp = this.waypoints[0];
        if (!wp) break;
        if (this.steerTo(wp.x, wp.y, dt, 10)) {
          this.waypoints.shift();
          if (this.waypoints.length === 0) this.state = 'docking';
        }
        break;
      }
      case 'docking': {
        // Final slow slide into the berth, bow first.
        const saved = this.speed;
        this.speed *= 0.45;
        if (this.steerTo(this.dock.x, BERTH_Y, dt, 4)) {
          this.state = 'unloading';
          // Crane Speed upgrades cut every unload by 25% per level.
          const crane = Math.pow(0.75, world.upgrades ? world.upgrades.crane : 0);
          this.unloadTotal = (this.isMatch() ? UNLOAD_MATCH_S : UNLOAD_WRONG_S) * crane;
          this.unloadT = this.unloadTotal;
          this.dock.occupied = this;
        }
        this.speed = saved;
        break;
      }
      case 'unloading': {
        this.unloadT -= dt;
        if (this.unloadT <= 0) world.onUnloadComplete(this);
        break;
      }
      case 'leaving': {
        const wp = this.waypoints[0];
        if (!wp) {
          this.state = 'gone';
          break;
        }
        if (this.steerTo(wp.x, wp.y, dt, 12)) this.waypoints.shift();
        break;
      }
      case 'towed': {
        const wp = this.waypoints[0];
        if (wp && this.steerTo(wp.x, wp.y, dt, 12)) this.state = 'gone';
        break;
      }
      default:
        break;
    }
  }

  // Send the ship home after unloading.
  depart(world) {
    this.state = 'leaving';
    const side = this.dock.id % 2 === 0 ? -1 : 1;
    this.waypoints = [
      { x: this.dock.x, y: APPROACH_Y - 60 },
      { x: this.dock.x + side * 150, y: 150 },
      { x: this.dock.x + side * 150, y: -90 },
    ];
    this.dock = null; // the caller frees the dock (dock.occupied = null)
  }

  // Send the ship off after a collision.
  towAway() {
    this.state = 'towed';
    this.waypoints = [{ x: this.x, y: -90 }];
    this.dock = null;
    this.selected = false;
  }
}
