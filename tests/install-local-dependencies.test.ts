import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import test, { type TestContext } from 'node:test';
import { installLocalDependencies } from '../tools/install-local-dependencies.mjs';

async function fixture(t: TestContext, behavior = '') {
  const base = await mkdtemp(join(tmpdir(), 'museum-dependency-test-'));
  t.after(async () => {
    assert.ok(resolve(base).startsWith(resolve(tmpdir()) + sep));
    await rm(base, { recursive: true, force: true });
  });
  const sourceRoot = join(base, 'museum-web');
  const workspaceRoot = join(base, 'museum-workspace');
  const stage = join(workspaceRoot, 'source');
  await mkdir(sourceRoot);
  await mkdir(stage, { recursive: true });
  const manifest = '{"name":"museum-test","private":true}';
  const lock = '{"name":"museum-test","lockfileVersion":3}';
  await writeFile(join(stage, 'package.json'), manifest);
  await writeFile(join(stage, 'package-lock.json'), lock);
  await writeFile(join(stage, '.museum-workspace.json'), JSON.stringify({ schemaVersion: 1, projectId: 'prj_r5Q33OKub3j7U0OFzTYz06K8YAkz', orgId: 'team_APvLc6mVLVOiWui8NxDgLzA2', sourceRoot }));
  const report = join(base, 'npm-report.json');
  const toolchain = join(workspaceRoot, 'toolchain');
  const npm = join(toolchain, 'npm', 'bin', 'npm-cli.js');
  const packaged = join(base, 'npm-package', 'package');
  await mkdir(join(packaged, 'bin'), { recursive: true });
  await mkdir(dirname(npm), { recursive: true });
  await writeFile(join(toolchain, 'npm', 'package.json'), '{"version":"12.2.1"}');
  await writeFile(npm, 'throw new Error("The G npm entrypoint must not execute");');
  await writeFile(join(packaged, 'package.json'), '{"version":"12.2.1","type":"module"}');
  await writeFile(join(packaged, 'bin', 'npm-cli.js'), `
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const cwd = process.cwd();
await writeFile(process.env.MUSEUM_INSTALL_TEST_REPORT, JSON.stringify({ cwd, npm: process.argv[1], cache: process.env.npm_config_cache, args: process.argv.slice(2), package: await readFile('package.json', 'utf8'), lock: await readFile('package-lock.json', 'utf8') }));
${behavior}
await mkdir('node_modules/vite/bin', { recursive: true });
await writeFile('node_modules/.package-lock.json', '{}');
await writeFile('node_modules/vite/bin/vite.js', 'complete dependency');
`);
  const archive = join(toolchain, 'npm-12.2.1.tgz');
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? process.env.WINDIR!, 'System32', 'tar.exe') : 'tar';
  execFileSync(tar, ['-czf', archive, '-C', dirname(packaged), 'package'], { windowsHide: true });
  const metadata = join(toolchain, 'npm-bootstrap.json');
  await writeFile(metadata, JSON.stringify({ version: '12.2.1', filename: 'npm-12.2.1.tgz', integrity: 'sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64') }));
  await mkdir(join(stage, 'node_modules'), { recursive: true });
  await writeFile(join(stage, 'node_modules', 'old.txt'), 'previous dependency');
  await writeFile(join(stage, 'keep.txt'), 'unrelated source');
  return { base, report, manifest, lock, metadata, archive, context: { sourceRoot, workspaceRoot, stage, node: process.execPath, npm, env: { ...process.env, npm_config_cache: join(workspaceRoot, 'old-cache'), MUSEUM_INSTALL_TEST_REPORT: report } } };
}

const missing = async (path: string) => readFile(path).then(() => false, error => error.code === 'ENOENT');

test('dependencies install in isolated OS temp and publish the complete tree without changing inputs', async t => {
  const f = await fixture(t);
  const result = await installLocalDependencies(f.context);
  const report = JSON.parse(await readFile(f.report, 'utf8'));
  assert.ok(resolve(report.cwd).startsWith(resolve(tmpdir()) + sep));
  assert.equal(report.cwd.startsWith(f.context.workspaceRoot), false);
  assert.ok(report.cache.startsWith(dirname(report.cwd) + sep));
  assert.equal(report.npm, join(dirname(report.cwd), 'npm', 'bin', 'npm-cli.js'));
  assert.deepEqual(report.args.slice(0, 1), ['ci']);
  assert.equal(report.args[report.args.indexOf('--cache') + 1], report.cache);
  assert.equal(report.package, f.manifest);
  assert.equal(report.lock, f.lock);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/vite/bin/vite.js'), 'utf8'), 'complete dependency');
  assert.equal(await missing(join(f.context.stage, 'node_modules/old.txt')), true);
  assert.equal(await readFile(join(f.context.stage, 'keep.txt'), 'utf8'), 'unrelated source');
  assert.equal(await readFile(join(f.context.stage, 'package-lock.json'), 'utf8'), f.lock);
  assert.equal(await missing(join(report.cwd, 'package.json')), true);
  assert.deepEqual((await readdir(f.context.workspaceRoot)).sort(), ['source', 'toolchain']);
  assert.equal(result.files, 2);
});

test('failed npm ci preserves existing dependencies and removes its temporary install', async t => {
  const f = await fixture(t, 'process.exit(7);');
  await assert.rejects(installLocalDependencies(f.context), (error: any) => error.exitCode === 7 && /npm ci/.test(error.message));
  const report = JSON.parse(await readFile(f.report, 'utf8'));
  assert.equal(await missing(join(report.cwd, 'package.json')), true);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/old.txt'), 'utf8'), 'previous dependency');
  assert.deepEqual((await readdir(f.context.workspaceRoot)).sort(), ['source', 'toolchain']);
});

test('failed publication copy preserves old dependencies and removes only its incomplete candidate', async t => {
  const f = await fixture(t);
  let copied = 0;
  await assert.rejects(installLocalDependencies(f.context, { copyDependencyFile: async (from: string, to: string) => {
    if (++copied === 2) throw new Error('simulated Drive copy failure');
    await copyFile(from, to);
  } }), /simulated Drive copy failure/);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/old.txt'), 'utf8'), 'previous dependency');
  assert.equal(await readFile(join(f.context.stage, 'keep.txt'), 'utf8'), 'unrelated source');
  assert.deepEqual((await readdir(f.context.workspaceRoot)).sort(), ['source', 'toolchain']);
  const report = JSON.parse(await readFile(f.report, 'utf8'));
  assert.equal(await missing(join(report.cwd, 'package.json')), true);
});

test('wrong ownership marker is rejected before invoking npm or replacing dependencies', async t => {
  const f = await fixture(t);
  const path = join(f.context.stage, '.museum-workspace.json');
  const marker = JSON.parse(await readFile(path, 'utf8'));
  marker.sourceRoot = join(f.base, 'another-source');
  await writeFile(path, JSON.stringify(marker));
  await assert.rejects(installLocalDependencies(f.context), /marker|ownership/i);
  assert.equal(await missing(f.report), true);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/old.txt'), 'utf8'), 'previous dependency');
});

test('node_modules junction is rejected without modifying the linked directory', async t => {
  const f = await fixture(t);
  const outside = join(f.base, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'keep.txt'), 'keep outside');
  await rm(join(f.context.stage, 'node_modules'), { recursive: true });
  await symlink(outside, join(f.context.stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installLocalDependencies(f.context), /link|reparse/i);
  assert.equal(await missing(f.report), true);
  assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'keep outside');
});

test('an installed junction is rejected and temporary cleanup preserves its external destination', async t => {
  const f = await fixture(t, `
const { symlink } = await import('node:fs/promises');
await mkdir('node_modules', { recursive: true });
await symlink(process.env.MUSEUM_INSTALL_OUTSIDE, 'node_modules/linked', process.platform === 'win32' ? 'junction' : 'dir');
`);
  const outside = join(f.base, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'keep.txt'), 'keep outside');
  const context = { ...f.context, env: { ...f.context.env, MUSEUM_INSTALL_OUTSIDE: outside } };
  await assert.rejects(installLocalDependencies(context), /link|reparse/i);
  const report = JSON.parse(await readFile(f.report, 'utf8'));
  assert.equal(await missing(join(report.cwd, 'package.json')), true);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/old.txt'), 'utf8'), 'previous dependency');
  assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'keep outside');
});

test('tampered npm archive is rejected by integrity before tar extraction or npm execution', async t => {
  const f = await fixture(t);
  await writeFile(f.archive, 'not a valid tar archive');
  await assert.rejects(installLocalDependencies(f.context), /npm archive integrity mismatch/i);
  assert.equal(await missing(f.report), true);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/old.txt'), 'utf8'), 'previous dependency');
});

test('npm bootstrap metadata is required and must match the pinned toolchain version', async t => {
  const f = await fixture(t);
  const metadata = JSON.parse(await readFile(f.metadata, 'utf8'));
  await writeFile(f.metadata, JSON.stringify({ ...metadata, version: '12.2.2', filename: 'npm-12.2.2.tgz' }));
  await assert.rejects(installLocalDependencies(f.context), /npm bootstrap.*version/i);
  await rm(f.metadata);
  await assert.rejects(installLocalDependencies(f.context), /npm-bootstrap\.json.*missing/i);
  assert.equal(await missing(f.report), true);
  assert.equal(await readFile(join(f.context.stage, 'node_modules/old.txt'), 'utf8'), 'previous dependency');
});
