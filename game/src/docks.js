// A dock: one pier jutting into the sea, with a berth at its head where a
// ship slides in bow-first. Each dock has one cargo colour; a ship of the
// same colour unloads fast and pays full points.

import { APPROACH_Y, BERTH_Y, PIER_BOTTOM, PIER_TOP, PIER_W } from './config.js';

export class Dock {
  constructor(def) {
    this.id = def.id;
    this.key = def.key;
    this.color = def.color;
    this.name = def.name;
    this.x = def.x;
    this.occupied = null; // the ship currently unloading, or null
    this.flash = 0; // red pulse when an assignment is refused
  }

  get free() {
    return this.occupied === null;
  }

  berthPoint() {
    return { x: this.x, y: BERTH_Y };
  }

  approachPoint() {
    return { x: this.x, y: APPROACH_Y };
  }

  // Clickable area: the pier itself plus the berth pocket above it.
  containsPoint(px, py) {
    const left = this.x - PIER_W / 2 - 26;
    const right = this.x + PIER_W / 2 + 26;
    return px >= left && px <= right && py >= PIER_TOP - 70 && py <= PIER_BOTTOM;
  }

  update(dt) {
    if (this.flash > 0) this.flash -= dt;
  }
}
