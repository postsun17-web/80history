import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import * as helper from '../tools/local-workspace.mjs';

// These tests catch copying credentials, retaining deleted source, and writing
// through a misplaced staging directory or a Windows directory junction.
async function fixture(t: TestContext) {
  const base = await mkdtemp(join(tmpdir(), 'museum-workspace-test-'));
  const sourceRoot = join(base, 'canonical');
  const workspaceRoot = join(base, 'local');
  await mkdir(sourceRoot);
  t.after(async () => {
    assert.equal(resolve(base).startsWith(resolve(tmpdir()) + '\\') || resolve(base).startsWith(resolve(tmpdir()) + '/'), true);
    await rm(base, { recursive: true, force: true });
  });
  return { base, sourceRoot, workspaceRoot, stage: join(workspaceRoot, 'source') };
}

async function put(root: string, path: string, value = path) {
  const target = join(root, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, value);
}

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}

test('workspace paths follow the canonical folder rather than the drive or working directory', () => {
  assert.equal(typeof helper.resolveWorkspaceRoot, 'function');
  const canonical = resolve('portable museum', '한글 경로', 'museum-web');
  assert.equal(helper.resolveWorkspaceRoot(canonical), join(dirname(canonical), 'museum-workspace'));
  if (process.platform === 'win32') {
    assert.equal(helper.resolveWorkspaceRoot('G:\\내 드라이브\\영락역사관\\museum-web'), 'G:\\내 드라이브\\영락역사관\\museum-workspace');
    assert.equal(helper.resolveWorkspaceRoot('F:\\새 폴더\\museum-web'), 'F:\\새 폴더\\museum-workspace');
  }
});

test('sync defaults to a sibling workspace and leaves the canonical source intact', async t => {
  const f = await fixture(t);
  assert.equal(typeof helper.resolveWorkspaceRoot, 'function');
  await put(f.sourceRoot, 'src/main.ts', 'portable source');
  const result = await helper.syncSource({ sourceRoot: f.sourceRoot });
  const expectedStage = join(f.base, 'museum-workspace', 'source');
  assert.equal(result.stage, expectedStage);
  assert.equal(await readFile(join(expectedStage, 'src/main.ts'), 'utf8'), 'portable source');
  assert.equal(await readFile(join(f.sourceRoot, 'src/main.ts'), 'utf8'), 'portable source');
});

test('sync copies explicit source paths and excludes secrets and generated files', async t => {
  const f = await fixture(t);
  await put(f.sourceRoot, 'package.json', '{"name":"test"}');
  await put(f.sourceRoot, 'src/main.ts', 'export const value = 1;');
  await put(f.sourceRoot, 'tools/check.mjs');
  for (const path of ['.env', '.git/config', 'README.md', 'public/old.txt', 'src/.env.local', 'src/node_modules/package/index.js', 'src/.cache/cache', 'tools/__pycache__/x.pyc', 'src/debug.log', 'tools/secret.pyc']) await put(f.sourceRoot, path);
  await helper.syncSource(f);
  assert.equal(await readFile(join(f.stage, 'src/main.ts'), 'utf8'), 'export const value = 1;');
  assert.equal(await readFile(join(f.stage, 'package.json'), 'utf8'), '{"name":"test"}');
  assert.equal(await exists(join(f.stage, 'tools/check.mjs')), true);
  for (const path of ['.env', '.git', 'README.md', 'public/old.txt', 'src/.env.local', 'src/node_modules', 'src/.cache', 'tools/__pycache__', 'src/debug.log', 'tools/secret.pyc']) assert.equal(await exists(join(f.stage, path)), false, path);
});

test('sync removes deleted source files and keeps local dependencies media and output', async t => {
  const f = await fixture(t);
  await put(f.sourceRoot, 'src/old.ts');
  await helper.syncSource(f);
  for (const path of ['public/media/full/keep.jpg', 'node_modules/keep.js', 'dist/keep.js', '.vercel/project.json']) await put(f.stage, path, 'keep');
  await rm(join(f.sourceRoot, 'src/old.ts'));
  await put(f.sourceRoot, 'src/new.ts', 'new source');
  await helper.syncSource(f);
  assert.equal(await exists(join(f.stage, 'src/old.ts')), false);
  assert.equal(await readFile(join(f.stage, 'src/new.ts'), 'utf8'), 'new source');
  for (const path of ['public/media/full/keep.jpg', 'node_modules/keep.js', 'dist/keep.js', '.vercel/project.json']) assert.equal(await readFile(join(f.stage, path), 'utf8'), 'keep');
});

test('sync publishes a replacement file without rewriting references to the previous file', async t => {
  const f = await fixture(t);
  await put(f.sourceRoot, 'src/main.ts', 'old complete source');
  await helper.syncSource(f);
  const previous = join(f.base, 'previous-source.ts');
  await link(join(f.stage, 'src/main.ts'), previous);
  await put(f.sourceRoot, 'src/main.ts', 'new complete source');
  await helper.syncSource(f);
  assert.equal(await readFile(join(f.stage, 'src/main.ts'), 'utf8'), 'new complete source');
  assert.equal(await readFile(previous, 'utf8'), 'old complete source');
  assert.deepEqual(await readdir(join(f.workspaceRoot, 'sync-tmp')), []);
});

test('sync refuses an unmarked populated stage and a marker for another project', async t => {
  const f = await fixture(t);
  await put(f.sourceRoot, 'src/new.ts');
  await put(f.stage, 'src/important.ts', 'user data');
  await assert.rejects(helper.syncSource(f), /marker|unmarked/i);
  assert.equal(await readFile(join(f.stage, 'src/important.ts'), 'utf8'), 'user data');
  await rm(join(f.stage, 'src'), { recursive: true });
  await helper.syncSource(f);
  const markerPath = join(f.stage, '.museum-workspace.json');
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  marker.projectId = 'another-project';
  await writeFile(markerPath, JSON.stringify(marker));
  await assert.rejects(helper.syncSource(f), /marker|project/i);
});

test('sync refuses overlapping canonical and local roots', async t => {
  const f = await fixture(t);
  await assert.rejects(helper.syncSource({ sourceRoot: f.sourceRoot, workspaceRoot: f.sourceRoot }), /overlap|separate/i);
  await assert.rejects(helper.syncSource({ sourceRoot: f.sourceRoot, workspaceRoot: f.base }), /overlap|separate/i);
});

test('managed paths reject traversal absolute paths alternate separators and reserved folders', () => {
  for (const path of ['../outside', 'src/../../outside', '/src/main.ts', 'C:/outside', 'src\\..\\outside', 'src//main.ts', 'src/./main.ts', 'public/media/full/file.jpg', 'src/.env.local', 'src/a:stream']) {
    assert.throws(() => helper.resolveManagedPath(resolve('test-stage'), path), /unsafe|managed|excluded/i, path);
  }
});

test('source junction rejection happens before any target file is overwritten', async t => {
  const f = await fixture(t);
  await put(f.sourceRoot, 'src/main.ts', 'original');
  await helper.syncSource(f);
  await put(f.sourceRoot, 'src/main.ts', 'changed');
  const outside = join(f.base, 'outside');
  await put(outside, 'private.txt', 'private');
  await symlink(outside, join(f.sourceRoot, 'src/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(helper.syncSource(f), /link|reparse/i);
  assert.equal(await readFile(join(f.stage, 'src/main.ts'), 'utf8'), 'original');
  assert.equal(await exists(join(f.stage, 'src/linked/private.txt')), false);
});

test('destination junction rejection preserves files outside the stage', async t => {
  const f = await fixture(t);
  await put(f.sourceRoot, 'src/main.ts');
  await helper.syncSource(f);
  const outside = join(f.base, 'outside');
  await put(outside, 'keep.txt', 'do not remove');
  await symlink(outside, join(f.stage, 'tools'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(helper.syncSource(f), /link|reparse/i);
  assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'do not remove');
});
