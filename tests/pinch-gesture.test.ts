import test from 'node:test';
import assert from 'node:assert/strict';
import {PinchGesture, type TouchPoint} from '../src/pinch-gesture.ts';

const viewport = {width: 800, height: 600};
const pair = (span: number, x = 200, y = 200): TouchPoint[] => [
  {id: 1, x: x - span / 2, y}, {id: 2, x: x + span / 2, y},
];
function armedGesture() {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'frozen destination');
  gesture.update(pair(135), 10);
  gesture.update(pair(135), 160);
  assert.equal(gesture.armed, true);
  return gesture;
}

test('starts only with two distinct contacts at least 40 CSS pixels apart', () => {
  for (const points of [[], pair(100).slice(0, 1), [...pair(100), {id: 3, x: 200, y: 200}], pair(39.99), [{id: 1, x: 0, y: 0}, {id: 1, x: 100, y: 0}]]) {
    const gesture = new PinchGesture<string>();
    assert.equal(gesture.begin(points, 0, viewport, 'target'), false);
    assert.equal(gesture.active, false);
    assert.equal(gesture.release([], 1000), null);
  }
  const gesture = new PinchGesture<string>();
  assert.equal(gesture.begin(pair(40), 0, viewport, 'target'), true);
  gesture.update(pair(64), 1);
  gesture.update(pair(64), 151);
  assert.equal(gesture.release([], 152), 'target');
});

test('requires both 1.35 span ratio and 24 CSS pixels of increase', () => {
  for (const [initial, expanded] of [[40, 63.99], [100, 134.99]]) {
    const gesture = new PinchGesture<string>();
    gesture.begin(pair(initial), 0, viewport, 'target');
    gesture.update(pair(expanded), 1);
    gesture.update(pair(expanded), 1000);
    assert.equal(gesture.release([], 1001), null);
  }
  assert.equal(armedGesture().release([], 161), 'frozen destination');
});

test('arms exactly after 150 continuous milliseconds, including timer updates with stationary points', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  const expanded = pair(135);
  gesture.update(expanded, 10);
  gesture.update(expanded, 159);
  assert.equal(gesture.armed, false);
  gesture.update(expanded, 160);
  assert.equal(gesture.armed, true);
  assert.equal(gesture.release([], 160), 'target');
});

test('lifting before the hold completes cannot navigate', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135), 10);
  gesture.update(pair(135), 159);
  assert.equal(gesture.release([], 159), null);
});

test('final release counts the eligible hold elapsed since the last timer update', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135), 10);
  gesture.update(pair(135), 154);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 160), 'target');
  assert.equal(gesture.release([], 161), null);
});

test('first staggered release finalizes a completed hold before waiting for the remaining finger', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135), 10);
  gesture.update(pair(135), 154);
  assert.equal(gesture.release([pair(135)[1]], 160), null);
  assert.equal(gesture.armed, true);
  assert.equal(gesture.release([], 1000), 'target');
});

test('a broken hold cannot be completed by the elapsed time before release', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135), 10);
  gesture.update(pair(134), 154);
  assert.equal(gesture.release([], 1000), null);
});

test('a slow spread has no maximum duration', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(120), 30_000);
  gesture.update(pair(135), 60_000);
  gesture.update(pair(135), 60_150);
  assert.equal(gesture.release([], 120_000), 'target');
});

test('falling below either arming condition restarts the continuous hold', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135), 10);
  gesture.update(pair(134), 100);
  gesture.update(pair(135), 110);
  gesture.update(pair(135), 259);
  assert.equal(gesture.armed, false);
  gesture.update(pair(135), 260);
  assert.equal(gesture.release([], 261), 'target');
});

test('armed hysteresis keeps the destination at ratio 1.15 and disarms below it', () => {
  const gesture = armedGesture();
  gesture.update(pair(115), 170);
  assert.equal(gesture.armed, true);
  gesture.update(pair(114.99), 180);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 190), null);
});

test('a disarmed gesture can re-arm after another complete hold', () => {
  const gesture = armedGesture();
  gesture.update(pair(110), 170);
  gesture.update(pair(135), 180);
  gesture.update(pair(135), 329);
  assert.equal(gesture.armed, false);
  gesture.update(pair(135), 330);
  assert.equal(gesture.release([], 331), 'frozen destination');
});

test('a second begin cannot replace the frozen destination or initial geometry', () => {
  const gesture = new PinchGesture<string>();
  const original = pair(100);
  gesture.begin(original, 0, viewport, 'original');
  original[0].x = -500;
  assert.equal(gesture.begin(pair(200), 1, viewport, 'replacement'), false);
  gesture.update(pair(135), 10);
  gesture.update(pair(135), 160);
  assert.equal(gesture.release([], 161), 'original');
});

test('midpoint drift allows the exact viewport-derived boundary and cancels beyond it', () => {
  for (const [size, limit] of [[{width: 300, height: 1000}, 40], [{width: 1200, height: 800}, 80]] as const) {
    const gesture = new PinchGesture<string>();
    gesture.begin(pair(100), 0, size, 'target');
    gesture.update(pair(135, 200 + limit), 1);
    gesture.update(pair(135, 200 + limit), 151);
    assert.equal(gesture.armed, true);
    gesture.update(pair(135, 200 + limit + 0.01), 152);
    assert.equal(gesture.active, false);
    assert.equal(gesture.release([], 153), null);
  }
});

test('midpoint drift measures diagonal distance from the original midpoint', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, {width: 300, height: 800}, 'target');
  gesture.update(pair(135, 230, 230), 1);
  assert.equal(gesture.active, false);
  assert.equal(gesture.release([], 1000), null);
});

test('touch list order does not change contact identity', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135).reverse(), 10);
  gesture.update(pair(135), 160);
  assert.equal(gesture.release([], 161), 'target');
});

test('third or replacement contacts cancel and latch until every contact lifts', () => {
  for (const points of [[...pair(135), {id: 3, x: 200, y: 200}], [{id: 3, x: 132.5, y: 200}, pair(135)[1]]]) {
    const gesture = armedGesture();
    gesture.update(points, 170);
    assert.equal(gesture.active, false);
    assert.equal(gesture.armed, false);
    assert.equal(gesture.begin(pair(100), 180, viewport, 'accidental'), false);
    assert.equal(gesture.release([], 200), null);
    assert.equal(gesture.begin(pair(100), 201, viewport, 'fresh'), true);
  }
});

test('explicit cancellation removes readiness and requires an empty contact cycle', () => {
  const gesture = armedGesture();
  gesture.cancel();
  gesture.update(pair(135), 200);
  assert.equal(gesture.active, false);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.begin(pair(100), 201, viewport, 'accidental'), false);
  assert.equal(gesture.release([], 202), null);
  assert.equal(gesture.begin(pair(100), 203, viewport, 'fresh'), true);
});

test('staggered release waits for the final finger and commits only once', () => {
  const gesture = armedGesture();
  const remaining = [pair(135)[1]];
  assert.equal(gesture.release(remaining, 170), null);
  assert.equal(gesture.active, true);
  assert.equal(gesture.armed, true);
  gesture.update(remaining, 1000);
  assert.equal(gesture.release([], 1001), 'frozen destination');
  assert.equal(gesture.active, false);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 1002), null);
});

test('remaining-finger movement at 8 pixels is allowed but movement above 8 cancels', () => {
  const allowed = armedGesture();
  allowed.release([pair(135)[1]], 170);
  allowed.update([{id: 2, x: 275.5, y: 200}], 180);
  assert.equal(allowed.release([], 190), 'frozen destination');

  const dragged = armedGesture();
  dragged.release([pair(135)[1]], 170);
  dragged.update([{id: 2, x: 275.51, y: 200}], 180);
  assert.equal(dragged.active, false);
  assert.equal(dragged.release([], 190), null);
});

test('remaining-finger drag uses total diagonal displacement, not movement per event', () => {
  const gesture = armedGesture();
  gesture.release([pair(135)[0]], 170);
  gesture.update([{id: 1, x: 135.5, y: 203}], 180);
  gesture.update([{id: 1, x: 138.5, y: 206}], 190);
  assert.equal(gesture.release([], 200), null);
});

test('remaining-finger replacement or an added second finger cancels staged release', () => {
  for (const points of [[{id: 3, x: 267.5, y: 200}], pair(135)]) {
    const gesture = armedGesture();
    gesture.release([pair(135)[1]], 170);
    assert.equal(gesture.begin(pair(100), 171, viewport, 'accidental'), false);
    gesture.update(points, 180);
    assert.equal(gesture.release([], 190), null);
  }
});

test('an unarmed staged release cannot become armed while the final finger waits', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(135), 10);
  gesture.release([pair(135)[1]], 100);
  gesture.update([pair(135)[1]], 1000);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 1001), null);
});

test('release rejects replacement contacts even without an intervening move event', () => {
  const gesture = armedGesture();
  gesture.release([{id: 3, x: 267.5, y: 200}], 170);
  assert.equal(gesture.release([], 180), null);
});

test('repeated staged release cannot reset the drag origin', () => {
  const gesture = armedGesture();
  gesture.release([pair(135)[1]], 170);
  gesture.release([{id: 2, x: 272.5, y: 200}], 180);
  gesture.update([{id: 2, x: 277.5, y: 200}], 190);
  assert.equal(gesture.release([], 200), null);
});
