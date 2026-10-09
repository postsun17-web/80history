export interface TouchPoint {id: number; x: number; y: number}

/** Touch-only geometry and lifecycle; picking, native zoom and navigation belong to the controller. */
export class PinchGesture<T> {
  private phase: 'idle' | 'tracking' | 'releasing' | 'cancelled' = 'idle';
  private ids: [number, number] = [0, 0];
  private initialSpan = 0;
  private midpoint = {x: 0, y: 0};
  private expansionThreshold = 16;
  private driftLimit = 80;
  private value: T | null = null;
  private ready = false;
  private remaining: TouchPoint | null = null;

  get active(): boolean {return this.phase === 'tracking' || this.phase === 'releasing';}
  get armed(): boolean {return this.active && this.ready;}

  begin(points: TouchPoint[], _now: number, viewport: {width: number; height: number}, value: T | null): boolean {
    if (this.phase !== 'idle' || points.length !== 2 || points[0].id === points[1].id) return false;
    const span = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    this.ids = [points[0].id, points[1].id];
    this.initialSpan = Math.max(24, span);
    this.expansionThreshold = Math.max(16, Math.min(40, this.initialSpan * 0.2));
    this.midpoint = {x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2};
    this.driftLimit = Math.max(80, Math.min(viewport.width, viewport.height) * 0.25);
    this.value = value;
    this.ready = false;
    this.remaining = null;
    this.phase = 'tracking';
    return true;
  }

  /** The preview may follow the view until arming; the armed destination stays frozen. */
  updateCandidate(value: T | null): void {
    if (this.phase === 'tracking' && !this.ready) this.value = value;
  }

  update(points: TouchPoint[], _now: number): void {
    if (!this.active) return;
    if (this.phase === 'releasing') {
      const remaining = this.remaining!;
      if (points.length !== 1 || points[0].id !== remaining.id
        || Math.hypot(points[0].x - remaining.x, points[0].y - remaining.y) > 20) this.cancel();
      return;
    }
    if (points.length !== 2 || points[0].id === points[1].id
      || !points.every(point => this.ids.includes(point.id))) {
      this.cancel();
      return;
    }
    const x = (points[0].x + points[1].x) / 2;
    const y = (points[0].y + points[1].y) / 2;
    if (Math.hypot(x - this.midpoint.x, y - this.midpoint.y) > this.driftLimit) {
      this.cancel();
      return;
    }
    const span = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const expansion = span - this.initialSpan;
    if (this.ready) {
      if (expansion < this.expansionThreshold / 2) this.ready = false;
      return;
    }
    this.ready = this.value !== null && expansion >= this.expansionThreshold;
  }

  release(remaining: TouchPoint[], now: number): T | null {
    if (remaining.length === 0) {
      const result = this.armed ? this.value : null;
      this.phase = 'idle';
      this.value = null;
      this.ready = false;
      this.remaining = null;
      return result;
    }
    if (!this.active) return null;
    if (remaining.length !== 1 || !this.ids.includes(remaining[0].id)) {
      this.cancel();
      return null;
    }
    if (this.phase === 'releasing') {
      this.update(remaining, now);
    } else {
      this.remaining = {...remaining[0]};
      this.phase = 'releasing';
    }
    return null;
  }

  /** Cancellation stays latched until release([]), preventing a replacement contact from restarting it. */
  cancel(): void {
    this.phase = 'cancelled';
    this.value = null;
    this.ready = false;
    this.remaining = null;
  }
}
