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
  gesture.update(pair(120), 10);
  assert.equal(gesture.armed, true);
  return gesture;
}

test('requires exactly two distinct contacts but accepts narrowly spaced fingers', () => {
  for (const points of [[], pair(100).slice(0, 1), [...pair(100), {id: 3, x: 200, y: 200}], [{id: 1, x: 0, y: 0}, {id: 1, x: 100, y: 0}]]) {
    const gesture = new PinchGesture<string>();
    assert.equal(gesture.begin(points, 0, viewport, 'target'), false);
    assert.equal(gesture.active, false);
    assert.equal(gesture.release([], 1000), null);
  }
  for (const span of [0, 1, 23.99, 24, 39.99]) {
    const gesture = new PinchGesture<string>();
    assert.equal(gesture.begin(pair(span), 0, viewport, 'target'), true);
    assert.equal(gesture.active, true);
  }
});

test('narrow gaps use a 24 pixel baseline and cannot arm from contact jitter', () => {
  for (const initial of [0, 1, 20, 24]) {
    const gesture = new PinchGesture<string>();
    gesture.begin(pair(initial), 0, viewport, 'target');
    gesture.update(pair(39.99), 1);
    assert.equal(gesture.armed, false);
    gesture.update(pair(40), 2);
    assert.equal(gesture.release([], 3), 'target');
  }
});

test('expansion thresholds support short and medium spreads without over-demanding large spreads', () => {
  for (const [initial, almost, enough] of [[40, 55.99, 56], [100, 119.99, 120], [150, 179.99, 180], [300, 339.99, 340]]) {
    const gesture = new PinchGesture<string>();
    gesture.begin(pair(initial), 0, viewport, 'target');
    gesture.update(pair(almost), 1);
    assert.equal(gesture.armed, false);
    gesture.update(pair(enough), 2);
    assert.equal(gesture.armed, true);
    assert.equal(gesture.release([], 3), 'target');
  }
});

test('a short deliberate spread arms immediately without a hold', () => {
  assert.equal(armedGesture().release([], 11), 'frozen destination');
});

test('waiting without enough expansion never arms', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(119), 1);
  gesture.update(pair(119), 60_000);
  assert.equal(gesture.release([], 120_000), null);
});

test('a slow spread has no maximum duration', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(110), 30_000);
  gesture.update(pair(120), 60_000);
  assert.equal(gesture.release([], 120_000), 'target');
});

test('armed hysteresis preserves readiness at half expansion and cancels below it', () => {
  const gesture = armedGesture();
  gesture.update(pair(110), 20);
  assert.equal(gesture.armed, true);
  gesture.update(pair(109.99), 30);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 40), null);
});

test('shrinking cancels readiness but allows the same gesture to expand again', () => {
  const gesture = armedGesture();
  gesture.update(pair(109), 20);
  gesture.update(pair(120), 30);
  assert.equal(gesture.release([], 31), 'frozen destination');
});

test('a missing candidate keeps normal zoom active and can be reacquired before release', () => {
  const gesture = new PinchGesture<string>();
  assert.equal(gesture.begin(pair(100), 0, viewport, null), true);
  gesture.update(pair(120), 10);
  assert.equal(gesture.active, true);
  assert.equal(gesture.armed, false);
  gesture.updateCandidate('new direction');
  gesture.update(pair(120), 11);
  assert.equal(gesture.release([], 12), 'new direction');
});

test('a gesture with no destination cannot navigate regardless of expansion', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, null);
  gesture.update(pair(300), 1);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 2), null);
});

test('candidate changes before arming select the latest viewed destination', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'first');
  gesture.update(pair(110), 1);
  gesture.updateCandidate('second');
  gesture.update(pair(120), 2);
  assert.equal(gesture.release([], 3), 'second');
});

test('losing a candidate before arming keeps expansion as ordinary zoom', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'first');
  gesture.updateCandidate(null);
  gesture.update(pair(120), 1);
  assert.equal(gesture.release([], 2), null);
});

test('an armed destination stays frozen despite later candidate updates', () => {
  for (const replacement of ['different destination', null]) {
    const gesture = armedGesture();
    gesture.updateCandidate(replacement);
    gesture.update(pair(130), 20);
    assert.equal(gesture.release([], 30), 'frozen destination');
  }
});

test('shrinking permits reacquisition of another destination before rearming', () => {
  const gesture = armedGesture();
  gesture.update(pair(109), 20);
  gesture.updateCandidate('reacquired');
  gesture.update(pair(120), 30);
  assert.equal(gesture.release([], 40), 'reacquired');
});

test('a second begin cannot replace initial geometry or destination', () => {
  const gesture = new PinchGesture<string>();
  const original = pair(100);
  gesture.begin(original, 0, viewport, 'original');
  original[0].x = -500;
  assert.equal(gesture.begin(pair(200), 1, viewport, 'replacement'), false);
  gesture.update(pair(120), 10);
  assert.equal(gesture.release([], 11), 'original');
});

test('midpoint drift allows 80 pixels or a quarter of the shorter viewport side', () => {
  for (const [size, limit] of [[{width: 300, height: 1000}, 80], [{width: 390, height: 844}, 97.5], [{width: 844, height: 390}, 97.5], [{width: 1200, height: 800}, 200]] as const) {
    const gesture = new PinchGesture<string>();
    gesture.begin(pair(100), 0, size, 'target');
    gesture.update(pair(120, 200 + limit), 1);
    assert.equal(gesture.armed, true);
    gesture.update(pair(120, 200 + limit + 0.01), 2);
    assert.equal(gesture.active, false);
    assert.equal(gesture.release([], 3), null);
  }
});

test('an asymmetric spread with one stationary finger is accepted', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, {width: 390, height: 844}, 'target');
  gesture.update([{id: 1, x: 150, y: 200}, {id: 2, x: 300, y: 210}], 1);
  assert.equal(gesture.release([], 2), 'target');
});

test('midpoint drift measures total diagonal distance, not each axis separately', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, {width: 300, height: 800}, 'target');
  gesture.update(pair(120, 260, 260), 1);
  assert.equal(gesture.active, false);
  assert.equal(gesture.release([], 1000), null);
});

test('touch list order does not change contact identity', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(120).reverse(), 10);
  assert.equal(gesture.release([], 11), 'target');
});

test('third or replacement contacts cancel and latch until every contact lifts', () => {
  for (const points of [[...pair(120), {id: 3, x: 200, y: 200}], [{id: 3, x: 140, y: 200}, pair(120)[1]]]) {
    const gesture = armedGesture();
    gesture.update(points, 20);
    assert.equal(gesture.active, false);
    assert.equal(gesture.armed, false);
    gesture.updateCandidate('accidental');
    assert.equal(gesture.begin(pair(100), 30, viewport, 'accidental'), false);
    assert.equal(gesture.release([], 40), null);
    assert.equal(gesture.begin(pair(100), 41, viewport, 'fresh'), true);
  }
});

test('explicit cancellation removes readiness and requires an empty contact cycle', () => {
  const gesture = armedGesture();
  gesture.cancel();
  gesture.updateCandidate('accidental');
  gesture.update(pair(120), 20);
  assert.equal(gesture.active, false);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.begin(pair(100), 21, viewport, 'accidental'), false);
  assert.equal(gesture.release([], 22), null);
  assert.equal(gesture.begin(pair(100), 23, viewport, 'fresh'), true);
});

test('staggered release waits for the final finger and commits only once', () => {
  const gesture = armedGesture();
  const remaining = [pair(120)[1]];
  assert.equal(gesture.release(remaining, 20), null);
  assert.equal(gesture.active, true);
  assert.equal(gesture.armed, true);
  gesture.updateCandidate('cannot replace on release');
  gesture.update(remaining, 1000);
  assert.equal(gesture.release([], 1001), 'frozen destination');
  assert.equal(gesture.active, false);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 1002), null);
});

test('remaining-finger movement at 20 pixels is allowed but movement above 20 cancels', () => {
  const allowed = armedGesture();
  allowed.release([pair(120)[1]], 20);
  allowed.update([{id: 2, x: 280, y: 200}], 30);
  assert.equal(allowed.release([], 40), 'frozen destination');

  const dragged = armedGesture();
  dragged.release([pair(120)[1]], 20);
  dragged.update([{id: 2, x: 280.01, y: 200}], 30);
  assert.equal(dragged.active, false);
  assert.equal(dragged.release([], 40), null);
});

test('remaining-finger drag uses total diagonal displacement, not movement per event', () => {
  const gesture = armedGesture();
  gesture.release([pair(120)[0]], 20);
  gesture.update([{id: 1, x: 148, y: 208}], 30);
  gesture.update([{id: 1, x: 156, y: 216}], 40);
  assert.equal(gesture.release([], 50), null);
});

test('remaining-finger replacement or an added second finger cancels staged release', () => {
  for (const points of [[{id: 3, x: 260, y: 200}], pair(120)]) {
    const gesture = armedGesture();
    gesture.release([pair(120)[1]], 20);
    assert.equal(gesture.begin(pair(100), 21, viewport, 'accidental'), false);
    gesture.update(points, 30);
    assert.equal(gesture.release([], 40), null);
  }
});

test('an unarmed staged release cannot become armed while the final finger waits', () => {
  const gesture = new PinchGesture<string>();
  gesture.begin(pair(100), 0, viewport, 'target');
  gesture.update(pair(119), 10);
  gesture.release([pair(119)[1]], 20);
  gesture.updateCandidate('another');
  gesture.update([pair(119)[1]], 1000);
  assert.equal(gesture.armed, false);
  assert.equal(gesture.release([], 1001), null);
});

test('release rejects replacement contacts even without an intervening move event', () => {
  const gesture = armedGesture();
  gesture.release([{id: 3, x: 260, y: 200}], 20);
  assert.equal(gesture.release([], 30), null);
});

test('repeated staged release cannot reset the drag origin', () => {
  const gesture = armedGesture();
  gesture.release([pair(120)[1]], 20);
  gesture.release([{id: 2, x: 275, y: 200}], 30);
  gesture.update([{id: 2, x: 285, y: 200}], 40);
  assert.equal(gesture.release([], 50), null);
});
