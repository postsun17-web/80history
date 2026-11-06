import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import test, { type TestContext } from 'node:test';
import * as helper from '../tools/local-workspace.mjs';

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const catalogueSha256 = (bytes: Buffer) => sha256(bytes.toString('utf8').replace(/\r\n/g, '\n'));

async function fixture(t: TestContext) {
  const stage = await mkdtemp(join(tmpdir(), 'museum-dev-cache-'));
  t.after(async () => {
    assert.ok(resolve(stage).startsWith(resolve(tmpdir()) + sep));
    await rm(stage, { recursive: true, force: true });
  });
  await mkdir(join(stage, 'src/data'), { recursive: true });
  await mkdir(join(stage, 'public/media/full'), { recursive: true });
  await writeFile(join(stage, 'src/data/full-museum.json'), 'full\n');
  await writeFile(join(stage, 'src/data/memorial-museum.json'), 'memorial\n');
  await writeFile(join(stage, 'public/media/full/a.txt'), 'image');
  const manifestBytes = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    sourceDataSha256: sha256('full\n'),
    additionalCatalogues: [{ path: 'src/data/memorial-museum.json', sha256: sha256('memorial\n') }],
    archives: [{ bytes: 100, assets: [{ path: 'media/full/a.txt', bytes: 5, sha256: sha256('image') }] }],
  }));
  const stamp = { verifiedAt: '2026-10-25T00:00:00.000Z', files: 1, manifestSha256: sha256(manifestBytes) };
  return { stage, manifestBytes, stamp };
}

test('dev can reuse a successful exact-manifest stamp after validating current catalogues', async t => {
  assert.equal(typeof helper.canReuseVerifiedAssets, 'function');
  const f = await fixture(t);
  assert.equal(await helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, f.stamp, catalogueSha256), true);
  await writeFile(join(f.stage, 'src/data/full-museum.json'), 'full\r\n');
  assert.equal(await helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, f.stamp, catalogueSha256), true);
});

test('dev requires full verification for missing stale or incomplete stamps', async t => {
  assert.equal(typeof helper.canReuseVerifiedAssets, 'function');
  const f = await fixture(t);
  for (const stamp of [null, {}, { ...f.stamp, manifestSha256: 'old' }, { ...f.stamp, files: 0 }, { ...f.stamp, verifiedAt: 'invalid' }]) {
    assert.equal(await helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, stamp, catalogueSha256), false);
  }
  assert.equal(await helper.canReuseVerifiedAssets(Buffer.concat([f.manifestBytes, Buffer.from('\n')]), f.stage, f.stamp, catalogueSha256), false);
});

test('dev never reuses a matching stamp when the current catalogue content differs', async t => {
  assert.equal(typeof helper.canReuseVerifiedAssets, 'function');
  const f = await fixture(t);
  await writeFile(join(f.stage, 'src/data/memorial-museum.json'), 'changed\n');
  await assert.rejects(helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, f.stamp, catalogueSha256), /memorial catalogue/i);
});

test('dev requires full restoration if the public media root is missing', async t => {
  assert.equal(typeof helper.canReuseVerifiedAssets, 'function');
  const f = await fixture(t);
  const publicRoot = resolve(f.stage, 'public');
  assert.ok(publicRoot.startsWith(resolve(f.stage) + sep));
  await rm(publicRoot, { recursive: true });
  assert.equal(await helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, f.stamp, catalogueSha256), false);
  await mkdir(publicRoot);
  assert.equal(await helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, f.stamp, catalogueSha256), false);
});

test('dev matching-stamp reuse still rejects media directory junctions', async t => {
  assert.equal(typeof helper.canReuseVerifiedAssets, 'function');
  const f = await fixture(t);
  await symlink(join(f.stage, 'src'), join(f.stage, 'public/media/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(helper.canReuseVerifiedAssets(f.manifestBytes, f.stage, f.stamp, catalogueSha256), /link|reparse/i);
});
