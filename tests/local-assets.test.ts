import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import test, { type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { catalogueSha256, sha256, validateAssetPath } from '../scripts/restore-deploy-assets.mjs';
import * as helper from '../tools/local-workspace.mjs';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'museum-local-assets-'));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function put(root: string, path: string, text: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}

const asset = (path: string, text: string) => ({ path, bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) });
const archive = (filename: string, assets: ReturnType<typeof asset>[]) => ({ filename, bytes: 100, sha256: 'a'.repeat(64), assets });
const manifest = (archives: ReturnType<typeof archive>[]) => ({ schemaVersion: 1, archives });

test('parallel media verification accepts valid files without scheduling an archive restore', async t => {
  assert.equal(typeof helper.verifyLocalAssets, 'function');
  const root = await fixture(t);
  await put(root, 'media/full/a.txt', 'alpha');
  await put(root, 'media/full/empty.txt', '');
  await put(root, 'media/memorial/b.txt', 'beta');
  const input = manifest([archive('first', [asset('media/full/a.txt', 'alpha'), asset('media/full/empty.txt', '')]), archive('second', [asset('media/memorial/b.txt', 'beta')])]);
  const result = await helper.verifyLocalAssets(input, root, validateAssetPath);
  assert.equal(result.total, 3);
  assert.equal(result.verified, 3);
  assert.deepEqual(result.affectedArchives, []);
});

test('parallel media verification identifies missing and same-size tampered files by archive', async t => {
  assert.equal(typeof helper.verifyLocalAssets, 'function');
  const root = await fixture(t);
  await put(root, 'media/full/changed.txt', 'wrong');
  await put(root, 'media/v1/valid.txt', 'valid');
  const input = manifest([
    archive('missing', [asset('media/full/absent.txt', 'absent')]),
    archive('tampered', [asset('media/full/changed.txt', 'right')]),
    archive('valid', [asset('media/v1/valid.txt', 'valid')]),
  ]);
  const result = await helper.verifyLocalAssets(input, root, validateAssetPath);
  assert.equal(result.total, 3);
  assert.equal(result.verified, 1);
  assert.deepEqual(result.affectedArchives.map((item: any) => item.filename), ['missing', 'tampered']);
});

test('parallel media verification rejects unsafe paths and malformed manifests before progress', async t => {
  assert.equal(typeof helper.verifyLocalAssets, 'function');
  const root = await fixture(t);
  const invalid = [
    { schemaVersion: 2, archives: [] },
    manifest([archive('bad-path', [asset('media/full/../../outside', 'x')])]),
    manifest([archive('duplicate', [asset('media/full/a', 'x'), asset('media/full/a', 'x')])]),
    manifest([{ ...archive('oversized', [asset('media/full/a', 'x')]), bytes: 100 * 1024 * 1024 + 1 }]),
    manifest([archive('bad-size', [{ ...asset('media/full/a', 'x'), bytes: -1 }])]),
  ];
  let progress = 0;
  for (const value of invalid) await assert.rejects(helper.verifyLocalAssets(value, root, validateAssetPath, { onProgress: () => { progress++; } }), /invalid|unsafe|duplicate|bound/i);
  assert.equal(progress, 0);
});

test('bounded workers do not begin excess reads while the current batch is pending', async () => {
  assert.equal(typeof helper.mapBounded, 'function');
  let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  let active = 0;
  let maximum = 0;
  const started: number[] = [];
  const result = helper.mapBounded([0, 1, 2, 3, 4, 5], async (value: number) => {
    active++;
    maximum = Math.max(maximum, active);
    started.push(value);
    await gate;
    active--;
    return value * 2;
  }, 3);
  await setImmediate();
  assert.deepEqual(started, [0, 1, 2]);
  assert.equal(active, 3);
  release();
  assert.deepEqual(await result, [0, 2, 4, 6, 8, 10]);
  assert.equal(maximum, 3);
  await assert.rejects(helper.mapBounded([], async () => {}, 0), /concurrency/i);
});

test('bounded workers default to 32 in-flight files and refuse a higher limit', async () => {
  let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  let active = 0;
  let maximum = 0;
  const pending = helper.mapBounded(Array.from({ length: 40 }, (_, index) => index), async (value: number) => {
    active++;
    maximum = Math.max(maximum, active);
    await gate;
    active--;
    return value;
  });
  try {
    await setImmediate();
    assert.equal(active, 32);
  } finally { release(); await pending; }
  assert.equal(maximum, 32);
  await assert.rejects(helper.mapBounded([], async () => {}, 33), /concurrency/i);
});

test('weighted workers never exceed their byte budget and resume queued files after release', async () => {
  const releases: (() => void)[] = [];
  const gates = [0, 1, 2, 3].map(() => new Promise<void>(done => { releases.push(done); }));
  const started: number[] = [];
  let activeBytes = 0;
  let maximumBytes = 0;
  const sizes = [6, 4, 7, 3];
  const pending = helper.mapBounded(sizes, async (size: number, index: number) => {
    started.push(index);
    activeBytes += size;
    maximumBytes = Math.max(maximumBytes, activeBytes);
    try { await gates[index]; return size; }
    finally { activeBytes -= size; }
  }, 4, { byteBudget: 10, weight: (size: number) => size });
  try {
    await setImmediate();
    assert.deepEqual(started, [0, 1]);
    releases[0]();
    await setImmediate();
    assert.deepEqual(started, [0, 1]);
    releases[1]();
    await setImmediate();
    assert.deepEqual(started, [0, 1, 2, 3]);
    assert.equal(activeBytes, 10);
  } finally { for (const release of releases) release(); await pending; }
  assert.equal(maximumBytes, 10);
  assert.equal(activeBytes, 0);
});

test('a failed weighted worker stops new work and waits for in-flight cleanup before rejecting', async () => {
  const releases: (() => void)[] = [];
  const gates = [0, 1].map(() => new Promise<void>(done => { releases.push(done); }));
  const started: number[] = [];
  const cleaned: number[] = [];
  let settled = false;
  const pending = helper.mapBounded([6, 4, 5], async (_size: number, index: number) => {
    started.push(index);
    try {
      await gates[index];
      if (index === 0) throw new Error('read failed');
    } finally { cleaned.push(index); }
  }, 2, { byteBudget: 10, weight: (size: number) => size });
  const observed = pending.then(() => { settled = true; return null; }, (error: Error) => { settled = true; return error; });
  try {
    await setImmediate();
    releases[0]();
    await setImmediate();
    assert.equal(settled, false);
    assert.deepEqual(started, [0, 1]);
  } finally { for (const release of releases) release(); }
  assert.match((await observed)?.message ?? '', /read failed/);
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(cleaned.sort(), [0, 1]);
});

test('invalid weighted budgets and oversize jobs fail before starting any reads', async () => {
  let started = 0;
  const worker = async () => { started++; };
  for (const options of [
    { byteBudget: 0, weight: () => 0 },
    { byteBudget: 128 * 1024 * 1024 + 1, weight: () => 1 },
    { byteBudget: 10, weight: () => 11 },
    { byteBudget: 10, weight: () => -1 },
  ]) await assert.rejects(helper.mapBounded([1], worker, 2, options), /budget|weight|bound/i);
  assert.deepEqual(await helper.mapBounded([], worker), []);
  assert.equal(started, 0);
});

test('fixed-size hashing handles partial reads and never grows its buffer for a changed file', async () => {
  assert.equal(typeof helper.hashExpectedFile, 'function');
  const content = Buffer.from('right');
  const capacities: number[] = [];
  const file = {
    async read(buffer: Buffer, offset: number, length: number, position: number) {
      capacities.push(buffer.length);
      const bytesRead = Math.min(2, length, content.length - position);
      content.copy(buffer, offset, position, position + bytesRead);
      return { bytesRead };
    },
    async stat() { return { isFile: () => true, size: content.length }; },
  };
  assert.equal(await helper.hashExpectedFile(file, content.length), sha256(content));
  assert.ok(capacities.length > 1);
  assert.ok(capacities.every(size => size === content.length));
  file.stat = async () => ({ isFile: () => true, size: 1024 * 1024 * 1024 });
  assert.equal(await helper.hashExpectedFile(file, content.length), null);
  assert.ok(capacities.every(size => size === content.length));
  const empty = { async read() { throw new Error('Empty files must not allocate or read bytes.'); }, async stat() { return { isFile: () => true, size: 0 }; } };
  assert.equal(await helper.hashExpectedFile(empty, 0), sha256(Buffer.alloc(0)));
  const short = { ...file, async read() { return { bytesRead: 0 }; } };
  assert.equal(await helper.hashExpectedFile(short, content.length), null);
  await assert.rejects(helper.hashExpectedFile(file, 100 * 1024 * 1024 + 1), /bound|size/i);
});

test('media verification applies manifest byte weights and reports each thousand files', async t => {
  const root = await fixture(t);
  await put(root, 'media/full/large.txt', '12345');
  let progress = 0;
  await assert.rejects(helper.verifyLocalAssets(manifest([archive('too-large', [asset('media/full/large.txt', '12345')])]), root, validateAssetPath, { byteBudget: 4, onProgress: () => { progress++; } }), /budget|weight|bound/i);
  assert.equal(progress, 0);
  const assets = Array.from({ length: 1001 }, (_, index) => asset(`media/full/${index}.txt`, 'x'));
  await helper.mapBounded(assets, async (item: ReturnType<typeof asset>) => put(root, item.path, 'x'), 8);
  const milestones: number[] = [];
  const result = await helper.verifyLocalAssets(manifest([archive('many-small', assets)]), root, validateAssetPath, { byteBudget: 16, onProgress: ({ checked }: { checked: number }) => { milestones.push(checked); } });
  assert.equal(result.verified, 1001);
  assert.deepEqual(milestones, [1000, 1001]);
});

test('local catalogue verification keeps both museum hashes and rejects unexpected catalogue paths', async t => {
  assert.equal(typeof helper.verifyCatalogueFiles, 'function');
  const root = await fixture(t);
  await put(root, 'src/data/full-museum.json', 'full\r\n');
  await put(root, 'src/data/memorial-museum.json', 'memorial\n');
  const input = { sourceDataSha256: catalogueSha256(Buffer.from('full\n')), additionalCatalogues: [{ path: 'src/data/memorial-museum.json', sha256: catalogueSha256(Buffer.from('memorial\n')) }] };
  await helper.verifyCatalogueFiles(input, root, catalogueSha256);
  await put(root, 'src/data/memorial-museum.json', 'modified\n');
  await assert.rejects(helper.verifyCatalogueFiles(input, root, catalogueSha256), /memorial catalogue/i);
  await assert.rejects(helper.verifyCatalogueFiles({ ...input, sourceDataSha256: 'wrong' }, root, catalogueSha256), /museum catalogue/i);
  await assert.rejects(helper.verifyCatalogueFiles({ ...input, additionalCatalogues: [{ path: '../outside', sha256: 'x' }] }, root, catalogueSha256), /memorial catalogue/i);
});
