import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, readdir, readFile, writeFile, copyFile, rename, unlink, rmdir, realpath, open } from 'node:fs/promises';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installLocalDependencies } from './install-local-dependencies.mjs';

export const PROJECT = Object.freeze({ projectId: 'prj_r5Q33OKub3j7U0OFzTYz06K8YAkz', orgId: 'team_APvLc6mVLVOiWui8NxDgLzA2', projectName: 'youngnak-museum-poc' });
export const resolveWorkspaceRoot = sourceRoot => resolve(sourceRoot, '..', 'museum-workspace');
const ROOT_FILES = new Set(['package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'vercel.json', 'deployment-assets.json', '.vercelignore', '.gitignore']);
const SOURCE_DIRS = new Set(['src', 'scripts', 'tests', 'tools']);
const LOCAL_DIRS = new Set(['public', 'node_modules', '.vercel', 'dist']);
const MARKER = '.museum-workspace.json';
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.cache', '.scratch', '__pycache__', 'dist', 'coverage', 'artifacts', 'logs']);
const normalized = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
const inside = (root, path) => normalized(path) === normalized(root) || normalized(path).startsWith(normalized(root) + sep);
const excluded = name => /^\.env/i.test(name) || /\.(?:pyc|log)$/i.test(name) || EXCLUDED_DIRS.has(name.toLowerCase());

async function statMaybe(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function noLinks(path) {
  const absolute = resolve(path);
  const parent = dirname(absolute);
  if (parent !== absolute) await noLinks(parent);
  const stat = await statMaybe(absolute);
  if (stat?.isSymbolicLink()) throw new Error(`Refusing symbolic link or reparse point: ${absolute}`);
  if (stat && normalized(await realpath(absolute)) !== normalized(absolute)) throw new Error(`Refusing redirected link/reparse path: ${absolute}`);
  return stat;
}

function scopedPath(root, path, allowExcluded = false) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || /[\\:\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part))) throw new Error(`Unsafe managed path: ${path}`);
  const parts = path.split('/');
  if (!(parts.length === 1 && ROOT_FILES.has(path)) && !SOURCE_DIRS.has(parts[0])) throw new Error(`Not a managed source path: ${path}`);
  if (!allowExcluded && parts.some(excluded)) throw new Error(`Excluded source path: ${path}`);
  const target = resolve(root, ...parts);
  if (!inside(root, target) || normalized(root) === normalized(target)) throw new Error(`Unsafe managed target: ${path}`);
  return target;
}

export const resolveManagedPath = (root, path) => scopedPath(root, path);

async function scanManaged(root, source) {
  const files = new Map();
  const directories = new Set();
  async function visit(path) {
    const full = scopedPath(root, path, !source);
    const stat = await statMaybe(full);
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link or reparse point: ${full}`);
    if (stat.isFile()) { files.set(path, stat); return; }
    if (!stat.isDirectory() || ROOT_FILES.has(path)) throw new Error(`Expected ordinary source file or directory: ${full}`);
    directories.add(path);
    for (const name of await readdir(full)) {
      if (source && excluded(name)) continue;
      await visit(`${path}/${name}`);
    }
  }
  for (const path of [...ROOT_FILES, ...SOURCE_DIRS]) await visit(path);
  return { files, directories };
}

async function verifyMarker(stage, sourceRoot, initialize) {
  const markerPath = join(stage, MARKER);
  const stat = await noLinks(markerPath);
  if (!stat) {
    if (!initialize) throw new Error('Workspace marker is missing; run sync first.');
    const entries = await readdir(stage);
    if (entries.some(name => !LOCAL_DIRS.has(name))) throw new Error(`Refusing unmarked populated stage: ${stage}`);
    await writeFile(markerPath, JSON.stringify({ schemaVersion: 1, projectId: PROJECT.projectId, orgId: PROJECT.orgId, sourceRoot: resolve(sourceRoot) }, null, 2) + '\n', { flag: 'wx' });
    return;
  }
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  if (marker.schemaVersion !== 1 || marker.projectId !== PROJECT.projectId || marker.orgId !== PROJECT.orgId || typeof marker.sourceRoot !== 'string' || normalized(marker.sourceRoot) !== normalized(sourceRoot)) throw new Error('Workspace marker belongs to a different project or canonical source.');
}

/** Only this project's explicit source paths are managed. No recursive delete is used. */
async function publishSourceFile(from, to, workspaceRoot) {
  // Keep incomplete copies outside the stage so Vite cannot attach a watcher
  // until the closed file is atomically renamed onto the same-volume target.
  const temporaryRoot = join(workspaceRoot, 'sync-tmp');
  await noLinks(temporaryRoot);
  await mkdir(temporaryRoot, { recursive: true });
  const temporary = join(temporaryRoot, `source-${randomUUID()}.tmp`);
  try {
    await copyFile(from, temporary, constants.COPYFILE_EXCL);
    await noLinks(temporary);
    await noLinks(to);
    await rename(temporary, to);
  } finally {
    if (await statMaybe(temporary)) {
      if (!inside(temporaryRoot, temporary) || normalized(temporaryRoot) === normalized(temporary)) throw new Error('Unsafe source-copy cleanup path');
      await noLinks(temporary);
      await unlink(temporary);
    }
  }
}

export async function syncSource({ sourceRoot, workspaceRoot = resolveWorkspaceRoot(sourceRoot), cache = new Map() }) {
  sourceRoot = resolve(sourceRoot);
  workspaceRoot = resolve(workspaceRoot);
  const stage = join(workspaceRoot, 'source');
  if (inside(sourceRoot, workspaceRoot) || inside(workspaceRoot, sourceRoot)) throw new Error('Canonical source and local workspace must be separate, non-overlapping directories.');
  if (!(await noLinks(sourceRoot))?.isDirectory()) throw new Error(`Canonical source is missing: ${sourceRoot}`);
  await noLinks(stage);
  // Preflight both trees before overwriting or deleting any source file.
  const source = await scanManaged(sourceRoot, true);
  const target = await scanManaged(stage, false);
  await mkdir(stage, { recursive: true });
  for (const name of LOCAL_DIRS) await noLinks(join(stage, name));
  await verifyMarker(stage, sourceRoot, true);
  let copied = 0;
  let removed = 0;
  for (const path of target.files.keys()) {
    if (source.files.has(path)) continue;
    const full = scopedPath(stage, path, true);
    await noLinks(full);
    await unlink(full);
    cache.delete(path);
    removed++;
  }
  for (const path of [...target.directories].sort((a, b) => b.length - a.length)) {
    if (source.directories.has(path)) continue;
    const full = scopedPath(stage, path, true);
    await noLinks(full);
    await rmdir(full);
  }
  for (const [path, sourceStat] of source.files) {
    const from = resolveManagedPath(sourceRoot, path);
    const to = resolveManagedPath(stage, path);
    const targetStat = await statMaybe(to);
    const signature = `${sourceStat.size}:${sourceStat.mtimeMs}:${sourceStat.ctimeMs}:${targetStat?.size}:${targetStat?.mtimeMs}:${targetStat?.ctimeMs}`;
    if (cache.get(path) === signature) continue;
    const bytes = await readFile(from);
    const current = targetStat?.isFile() ? await readFile(to) : null;
    if (!current?.equals(bytes)) {
      await noLinks(from);
      await noLinks(to);
      await mkdir(dirname(to), { recursive: true });
      await publishSourceFile(from, to, workspaceRoot);
      copied++;
    }
    const written = await lstat(to);
    cache.set(path, `${sourceStat.size}:${sourceStat.mtimeMs}:${sourceStat.ctimeMs}:${written.size}:${written.mtimeMs}:${written.ctimeMs}`);
  }
  return { stage, copied, removed, files: source.files.size };
}

function runtime(sourceRoot) {
  const workspaceRoot = resolveWorkspaceRoot(sourceRoot);
  const toolchain = join(workspaceRoot, 'toolchain');
  const node = join(toolchain, 'node.exe');
  return { sourceRoot, workspaceRoot, stage: join(workspaceRoot, 'source'), node, npm: join(toolchain, 'npm', 'bin', 'npm-cli.js'), vercel: join(toolchain, 'cli', 'node_modules', 'vercel', 'dist', 'index.js'), env: { ...process.env, PATH: toolchain + delimiter + process.env.PATH, npm_config_cache: join(workspaceRoot, 'npm-cache'), VERCEL_PROJECT_ID: PROJECT.projectId, VERCEL_ORG_ID: PROJECT.orgId } };
}

function run(context, script, args, { capture = false } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(context.node, [script, ...args], { cwd: context.stage, env: context.env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true, shell: false });
    let output = '';
    if (capture) for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { if (output.length < 16000) output += data.toString(); });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0 || capture) resolveRun({ code: code ?? 1, signal, output });
      else reject(new Error(`Command failed (${signal ?? code}): ${script} ${args.join(' ')}`));
    });
  });
}

async function ensureProject(context) {
  await verifyMarker(context.stage, context.sourceRoot, false);
  const path = join(context.stage, '.vercel', 'project.json');
  const stat = await noLinks(path);
  if (stat) {
    const project = JSON.parse(await readFile(path, 'utf8'));
    if (project.projectId !== PROJECT.projectId || project.orgId !== PROJECT.orgId) throw new Error('Refusing a Vercel project/team mismatch.');
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(PROJECT, null, 2) + '\n', { flag: 'wx' });
  }
}

async function dependencyKey(context) {
  const hash = createHash('sha256');
  for (const name of ['package.json', 'package-lock.json']) hash.update(await readFile(join(context.stage, name)));
  hash.update(process.version);
  hash.update(await readFile(join(context.workspaceRoot, 'toolchain', 'npm', 'package.json')));
  return hash.digest('hex');
}

async function dependencies(context) {
  const key = await dependencyKey(context);
  const stamp = join(context.workspaceRoot, 'dependencies.sha256');
  const installed = (await readFile(stamp, 'utf8').catch(() => '')).trim() === key && await statMaybe(join(context.stage, 'node_modules', '.package-lock.json')) && await statMaybe(join(context.stage, 'node_modules', 'vite', 'bin', 'vite.js'));
  if (installed) { console.log('Locked dependencies are already installed.'); return; }
  await noLinks(join(context.stage, 'node_modules'));
  await installLocalDependencies(context);
  await writeFile(stamp, key + '\n');
}

async function noTreeLinks(root) {
  const stat = await noLinks(root);
  if (!stat) return;
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`Refusing media link/reparse point: ${join(path, entry.name)}`);
      if (entry.isDirectory()) await walk(join(path, entry.name));
    }
  }
  await walk(root);
}

const MAX_ASSET_BUFFER_BYTES = 128 * 1024 * 1024;

export async function mapBounded(items, worker, concurrency = 32, { byteBudget = MAX_ASSET_BUFFER_BYTES, weight = () => 0 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Invalid concurrency: use 1 through 32 workers.');
  if (!Number.isSafeInteger(byteBudget) || byteBudget < 1 || byteBudget > MAX_ASSET_BUFFER_BYTES) throw new Error('Invalid byte budget: maximum is 128 MiB.');
  const weights = items.map((item, index) => weight(item, index));
  if (weights.some(bytes => !Number.isSafeInteger(bytes) || bytes < 0 || bytes > byteBudget)) throw new Error('Invalid item weight or item exceeds the byte budget.');
  const results = new Array(items.length);
  let cursor = 0;
  let active = 0;
  let activeBytes = 0;
  let failed = false;
  let failure;
  return new Promise((resolveAll, rejectAll) => {
    function schedule() {
      // Keep each reservation until the entire worker (including finally/close)
      // has settled. After a failure, drain active work without starting more.
      if (failed) { if (active === 0) rejectAll(failure); return; }
      while (cursor < items.length && active < concurrency && activeBytes + weights[cursor] <= byteBudget) {
        const index = cursor++;
        active++;
        activeBytes += weights[index];
        Promise.resolve().then(() => worker(items[index], index)).then(
          result => { results[index] = result; },
          error => { if (!failed) { failed = true; failure = error; } },
        ).finally(() => {
          active--;
          activeBytes -= weights[index];
          schedule();
        });
      }
      if (cursor === items.length && active === 0) resolveAll(results);
    }
    schedule();
  });
}

export async function hashExpectedFile(file, expectedBytes) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0 || expectedBytes > 100 * 1024 * 1024) throw new Error('Invalid asset size or memory bound.');
  // Allocate exactly the manifest's reservation. Unlike readFile(), the buffer
  // cannot expand if another process grows the file after the initial stat.
  const bytes = Buffer.allocUnsafe(expectedBytes);
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
    if (bytesRead === 0) return null;
    offset += bytesRead;
  }
  const finalStat = await file.stat();
  if (!finalStat.isFile() || finalStat.size !== expectedBytes) return null;
  return createHash('sha256').update(bytes).digest('hex');
}

export async function verifyCatalogueFiles(manifest, stage, catalogueSha256) {
  if (catalogueSha256(await readFile(join(stage, 'src/data/full-museum.json'))) !== manifest.sourceDataSha256) throw new Error('Asset manifest belongs to a different museum catalogue');
  for (const catalogue of manifest.additionalCatalogues || []) {
    if (catalogue.path !== 'src/data/memorial-museum.json' || catalogueSha256(await readFile(join(stage, catalogue.path))) !== catalogue.sha256) throw new Error('Asset manifest belongs to a different memorial catalogue');
  }
}

export async function canReuseVerifiedAssets(manifestBytes, stage, stamp, catalogueSha256) {
  const manifest = JSON.parse(manifestBytes);
  await verifyCatalogueFiles(manifest, stage, catalogueSha256);
  if (!stamp || stamp.manifestSha256 !== createHash('sha256').update(manifestBytes).digest('hex') || !Number.isFinite(Date.parse(stamp.verifiedAt))) return false;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.archives) || !manifest.archives.length || manifest.archives.some(archive => !Array.isArray(archive.assets))) return false;
  const files = manifest.archives.reduce((sum, archive) => sum + archive.assets.length, 0);
  if (files === 0 || stamp.files !== files) return false;
  const publicRoot = join(stage, 'public');
  if (!(await noLinks(publicRoot))?.isDirectory() || !(await noLinks(join(publicRoot, 'media')))?.isDirectory()) return false;
  await noTreeLinks(publicRoot);
  return true;
}

export async function verifyLocalAssets(manifest, publicRoot, validateAssetPath, { concurrency = 32, byteBudget = MAX_ASSET_BUFFER_BYTES, onProgress = () => {} } = {}) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.archives) || !manifest.archives.length) throw new Error('Invalid asset manifest');
  const limit = 100 * 1024 * 1024;
  const tasks = [];
  const seen = new Set();
  // Validate the complete manifest before starting any asset reads.
  for (const archive of manifest.archives) {
    if (!Number.isSafeInteger(archive.bytes) || archive.bytes < 0 || archive.bytes > limit) throw new Error('Archive exceeds memory bound or has invalid size');
    if (!Array.isArray(archive.assets) || !archive.assets.length) throw new Error('Invalid archive assets');
    for (const asset of archive.assets) {
      const path = validateAssetPath(asset.path);
      if (path.includes(':') || !inside(publicRoot, resolve(publicRoot, path))) throw new Error(`Unsafe asset path: ${path}`);
      if (seen.has(path)) throw new Error(`Duplicate manifest path: ${path}`);
      seen.add(path);
      if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || asset.bytes > limit || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error(`Invalid asset metadata or memory bound: ${path}`);
      tasks.push({ archive, asset, path: resolve(publicRoot, path) });
    }
  }
  await noTreeLinks(publicRoot);
  const affected = new Set();
  let checked = 0;
  let verified = 0;
  await mapBounded(tasks, async ({ archive, asset, path }) => {
    let valid = false;
    let file;
    try {
      file = await open(path, 'r');
      const stat = await file.stat();
      // The scheduler has reserved asset.bytes before opening this file.
      // At most 32 file jobs and 128 MiB of manifest-sized buffers are active.
      if (stat.isFile() && stat.size === asset.bytes) {
        valid = await hashExpectedFile(file, asset.bytes) === asset.sha256;
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    } finally {
      if (file) await file.close();
    }
    if (valid) verified++;
    else affected.add(archive);
    checked++;
    if (checked % 1000 === 0 || checked === tasks.length) onProgress({ checked, total: tasks.length, verified });
  }, concurrency, { byteBudget, weight: ({ asset }) => asset.bytes });
  return { total: tasks.length, verified, affectedArchives: manifest.archives.filter(archive => affected.has(archive)) };
}

async function restoreAssets(context, { reuseVerified = false } = {}) {
  const restore = await import(pathToFileURL(join(context.stage, 'scripts', 'restore-deploy-assets.mjs')).href);
  const manifestBytes = await readFile(join(context.stage, 'deployment-assets.json'));
  const manifest = JSON.parse(manifestBytes);
  const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
  if (reuseVerified) {
    const stamp = await readFile(join(context.workspaceRoot, 'assets-verified.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (await canReuseVerifiedAssets(manifestBytes, context.stage, stamp, restore.catalogueSha256)) {
      console.log(`Reusing ${stamp.files} museum assets verified at ${stamp.verifiedAt}; manifest and current catalogues match. setup/build recheck every file.`);
      return;
    }
  } else {
    await verifyCatalogueFiles(manifest, context.stage, restore.catalogueSha256);
  }
  const publicRoot = join(context.stage, 'public');
  console.log('Verifying museum media against the manifest with up to 32 workers and a 128 MiB in-flight buffer budget.');
  const result = await verifyLocalAssets(manifest, publicRoot, restore.validateAssetPath, { onProgress: ({ checked, total, verified }) => console.log(`Checked ${checked}/${total} museum files (${verified} verified).`) });
  if (result.affectedArchives.length) {
    const archives = join(context.workspaceRoot, 'archives');
    const hasLocal = (await Promise.all(result.affectedArchives.map(archive => /^assets-[a-f0-9]{20}\.zip$/.test(archive.filename) ? statMaybe(join(archives, archive.filename)) : false))).every(Boolean);
    console.log(`Restoring ${result.affectedArchives.length} affected archives${hasLocal ? ' from local ZIP files' : ' from manifest URLs'}.`);
    // The unchanged production restorer validates archive/entry hashes and
    // trusted download hosts. Valid archives are not re-read serially here.
    await restore.restoreDeployment({ ...manifest, archives: result.affectedArchives }, publicRoot, hasLocal ? archives : undefined);
  }
  console.log(`Verified ${result.total} museum assets`);
  await writeFile(join(context.workspaceRoot, 'assets-verified.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), files: result.total, manifestSha256 }, null, 2) + '\n');
}

async function build(context) {
  await restoreAssets(context);
  await run(context, join(context.stage, 'node_modules', 'typescript', 'bin', 'tsc'), ['--noEmit']);
  console.log('Building compiled files without duplicating public media. Use museum.ps1 preview to view this compact local build.');
  await run(context, join(context.stage, 'tools', 'local-build.mjs'), ['build']);
}

async function serve(context, command, args) {
  if (command === 'preview') await build(context);
  else await restoreAssets(context, { reuseVerified: true });
  let syncing = false;
  let failed = false;
  const cache = new Map();
  const serverArgs = command === 'preview'
    ? [join(context.stage, 'tools', 'local-build.mjs'), 'preview', ...args]
    : [join(context.stage, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', ...args];
  const child = spawn(context.node, serverArgs, { cwd: context.stage, env: context.env, stdio: 'inherit', windowsHide: true, shell: false });
  const timer = command === 'dev' ? setInterval(async () => {
    if (syncing || failed) return;
    syncing = true;
    try {
      const result = await syncSource({ ...context, cache });
      if (result.copied || result.removed) console.log(`Source sync: ${result.copied} copied, ${result.removed} removed.`);
    } catch (error) { failed = true; console.error(`Source sync stopped: ${error.message}`); child.kill(); }
    finally { syncing = false; }
  }, 1500) : null;
  console.log(command === 'dev' ? `Watching canonical edits: ${context.sourceRoot}\nStop with Ctrl+C. Restart dev after dependency or build-config changes.` : 'Preview serves the verified build. Rerun preview to rebuild after edits. Stop with Ctrl+C.');
  const stop = () => child.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    await new Promise((resolveServe, reject) => { child.on('error', reject); child.on('exit', (code, signal) => code === 0 || signal === 'SIGINT' || signal === 'SIGTERM' ? resolveServe() : reject(new Error(`Server exited (${signal ?? code}).`))); });
    if (failed) throw new Error('Development server stopped because source synchronization failed.');
  } finally {
    if (timer) clearInterval(timer);
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

async function check(context) {
  console.log(`Canonical source: ${context.sourceRoot}\nLocal stage: ${context.stage}\nNode: ${process.version}`);
  for (const [label, script] of [['npm', context.npm], ['Vercel CLI', context.vercel]]) {
    if (!await statMaybe(script)) { console.log(`${label}: missing`); continue; }
    if (label === 'npm') {
      // Even npm --version loads many modules on a cold streamed drive.
      const installed = JSON.parse(await readFile(join(context.workspaceRoot, 'toolchain', 'npm', 'package.json'), 'utf8'));
      console.log(`npm (installed package): ${installed.version}`);
      continue;
    }
    const result = await run(context, script, ['--version'], { capture: true });
    console.log(`${label}: ${result.code === 0 ? result.output.trim() : 'version check failed'}`);
  }
  await ensureProject(context);
  console.log(`Target project: ${PROJECT.projectName} (${PROJECT.projectId})\nTarget team: ${PROJECT.orgId}`);
  const stamp = await readFile(join(context.workspaceRoot, 'dependencies.sha256'), 'utf8').catch(() => '');
  console.log(`Locked dependencies: ${stamp.trim() === await dependencyKey(context) && await statMaybe(join(context.stage, 'node_modules', '.package-lock.json')) ? 'ready' : 'run setup'}`);
  const assets = await readFile(join(context.workspaceRoot, 'assets-verified.json'), 'utf8').then(JSON.parse).catch(() => null);
  console.log(assets ? `Media: last verified ${assets.files} files at ${assets.verifiedAt}; build rechecks hashes.` : 'Media: no recorded verification; run setup or build.');
  if (!await statMaybe(context.vercel)) { console.log('Vercel login: unknown; CLI is missing.'); return; }
  const auth = await run(context, context.vercel, ['whoami'], { capture: true });
  if (auth.code !== 0) { console.log('Vercel login: not ready. CLI sign-in is missing/expired or the network check failed. Run login to sign in. No deployment was attempted.'); return; }
  console.log('Vercel login: CLI session verified.');
  const project = await run(context, context.vercel, ['project', 'inspect', PROJECT.projectName, '--scope', PROJECT.orgId], { capture: true });
  console.log(project.code === 0 ? 'Vercel project access: verified. Deployment still requires an explicit deploy command.' : 'Vercel project access: not verified; check team access or network connectivity.');
}

export async function main(args = process.argv.slice(2)) {
  const [command = 'help', ...extra] = args;
  const commands = ['help', 'sync', 'setup', 'test', 'build', 'dev', 'preview', 'check', 'login', 'deploy-preview', 'deploy-production'];
  if (!commands.includes(command)) throw new Error(`Unknown command: ${command}`);
  if (extra.length && (!['dev', 'preview'].includes(command) || extra.length !== 2 || extra[0] !== '--port' || !/^\d+$/.test(extra[1]) || Number(extra[1]) < 1024 || Number(extra[1]) > 65535)) throw new Error('Only dev/preview accept arguments: --port <1024-65535>.');
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (command === 'help') { console.log(`Usage: .\\museum.ps1 <${commands.join('|')}>\nOptional for dev/preview: --port 5173\nEdit this repository: ${sourceRoot}. Execution and media live in its sibling ${resolveWorkspaceRoot(sourceRoot)}.\nOnly deploy-preview and deploy-production publish a deployment. login only signs in.`); return; }
  const context = runtime(sourceRoot);
  const synced = await syncSource(context);
  console.log(`Source sync: ${synced.copied} copied, ${synced.removed} removed (${synced.files} managed files).`);
  await ensureProject(context);
  if (command === 'sync') return;
  if (command === 'check') return check(context);
  if (command === 'login') return run(context, context.vercel, ['login']);
  await dependencies(context);
  // Run the same package.json test command directly: loading npm itself from a
  // cold DriveFS cache needlessly reads thousands of extra tooling files.
  if (command === 'test') return run(context, '--experimental-strip-types', ['--test', 'tests/*.test.ts']);
  if (command === 'setup') return restoreAssets(context);
  if (command === 'build') return build(context);
  if (command === 'dev' || command === 'preview') return serve(context, command, extra);
  // These are the only branches that can publish. Validate the fixed target
  // again immediately before invoking the CLI; no caller flags are forwarded.
  await run(context, '--experimental-strip-types', ['--test', 'tests/*.test.ts']);
  await build(context);
  await ensureProject(context);
  const auth = await run(context, context.vercel, ['whoami'], { capture: true });
  if (auth.code !== 0) throw new Error('Vercel CLI login could not be verified. Run museum.ps1 login before deploying.');
  await run(context, context.vercel, ['project', 'inspect', PROJECT.projectName, '--scope', PROJECT.orgId]);
  await run(context, context.vercel, ['deploy', '--yes', '--scope', PROJECT.orgId, ...(command === 'deploy-production' ? ['--prod'] : [])]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // This marker prevents accidental bypass of the documented mutex wrapper.
  // It is a usage guard, not a security boundary against intentional callers.
  if (process.env.MUSEUM_WORKSPACE_WRAPPER !== 'Global\\YoungnakMuseumWorkspace-prj_r5Q33OKub3j7U0OFzTYz06K8YAkz') {
    console.error('Run .\\museum.ps1 <command>. Direct Node execution of local-workspace.mjs is unsupported because it bypasses the command lock.');
    process.exitCode = 1;
  } else {
    main().catch(error => { console.error(`Museum workspace: ${error.message}`); process.exitCode = 1; });
  }
}
