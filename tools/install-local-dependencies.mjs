import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

const normalized = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
const inside = (root, path) => normalized(path).startsWith(normalized(root) + sep);

async function statMaybe(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function noLinks(path) {
  const absolute = resolve(path);
  const parent = dirname(absolute);
  if (parent !== absolute) await noLinks(parent);
  const stat = await statMaybe(absolute);
  if (stat?.isSymbolicLink() || (stat && normalized(await realpath(absolute)) !== normalized(absolute))) throw new Error(`Refusing dependency link/reparse path: ${absolute}`);
  return stat;
}

async function treeFiles(root, required = false) {
  const rootStat = await noLinks(root);
  if (!rootStat && !required) return [];
  if (!rootStat?.isDirectory()) throw new Error(`Dependency directory is missing or invalid: ${root}`);
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error(`Refusing dependency link/reparse path: ${path}`);
      if (stat.isDirectory()) await walk(path);
      else if (stat.isFile()) files.push({ path: relative(root, path), bytes: stat.size });
      else throw new Error(`Refusing non-file dependency entry: ${path}`);
    }
  }
  await walk(root);
  return files;
}

async function ownedStage(context) {
  const { sourceRoot, workspaceRoot, stage } = context;
  if (normalized(workspaceRoot) !== normalized(resolve(sourceRoot, '..', 'museum-workspace')) || normalized(stage) !== normalized(join(workspaceRoot, 'source'))) throw new Error('Refusing dependency installation outside the owned workspace stage.');
  if (!(await noLinks(stage))?.isDirectory()) throw new Error('Dependency stage is missing.');
  const markerPath = join(stage, '.museum-workspace.json');
  await noLinks(markerPath);
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  if (marker.schemaVersion !== 1 || marker.projectId !== 'prj_r5Q33OKub3j7U0OFzTYz06K8YAkz' || marker.orgId !== 'team_APvLc6mVLVOiWui8NxDgLzA2' || typeof marker.sourceRoot !== 'string' || normalized(marker.sourceRoot) !== normalized(sourceRoot)) throw new Error('Dependency stage ownership marker does not match the canonical source.');
  return join(stage, 'node_modules');
}

async function removeOwned(root, path) {
  // These paths are generated with mkdtemp/randomUUID by this invocation.
  // Validate the final absolute root before any recursive deletion. rm removes
  // nested links themselves; it does not recurse through their destinations.
  if (!inside(root, path)) throw new Error(`Refusing dependency cleanup outside its root: ${path}`);
  await noLinks(path);
  await rm(path, { recursive: true, force: true });
}

async function tar(args, capture = false) {
  const executable = process.platform === 'win32' ? join(process.env.SystemRoot ?? process.env.WINDIR, 'System32', 'tar.exe') : 'tar';
  return new Promise((resolveTar, reject) => {
    const child = spawn(executable, args, { stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', windowsHide: true, shell: false });
    let output = '';
    if (capture) child.stdout.on('data', bytes => {
      output += bytes.toString();
      if (output.length > 2 * 1024 * 1024) { child.kill(); reject(new Error('npm archive file listing exceeds its bound.')); }
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolveTar(output) : reject(new Error(`npm archive extraction/listing failed (${signal ?? code}).`)));
  });
}

async function temporaryNpm(context, temporary) {
  const toolchain = join(context.workspaceRoot, 'toolchain');
  if (normalized(context.npm) !== normalized(join(toolchain, 'npm', 'bin', 'npm-cli.js'))) throw new Error('Refusing npm bootstrap outside the owned toolchain.');
  const metadataPath = join(toolchain, 'npm-bootstrap.json');
  await noLinks(metadataPath);
  const metadata = await readFile(metadataPath, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') throw new Error('toolchain/npm-bootstrap.json is missing. Restore the pinned npm archive and its official SHA-512 bootstrap metadata.');
    throw error;
  });
  const packagePath = join(toolchain, 'npm', 'package.json');
  await noLinks(packagePath);
  const pinned = JSON.parse(await readFile(packagePath, 'utf8'));
  if (typeof metadata.version !== 'string' || metadata.version !== pinned.version) throw new Error('npm bootstrap version does not match the pinned toolchain package.');
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(metadata.version) || metadata.filename !== `npm-${metadata.version}.tgz` || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(metadata.integrity)) throw new Error('Invalid npm bootstrap filename or SHA-512 integrity metadata.');
  const archivePath = join(toolchain, metadata.filename);
  const archiveStat = await noLinks(archivePath);
  if (!archiveStat?.isFile() || archiveStat.size > 32 * 1024 * 1024) throw new Error('Pinned npm archive is missing or exceeds its size bound.');
  const archiveBytes = await readFile(archivePath);
  if (`sha512-${createHash('sha512').update(archiveBytes).digest('base64')}` !== metadata.integrity) throw new Error('npm archive integrity mismatch; restore the pinned official tarball.');
  const archive = join(temporary, 'npm.tgz');
  await writeFile(archive, archiveBytes, { flag: 'wx' });
  const entries = (await tar(['-tzf', archive], true)).split(/\r?\n/).filter(Boolean);
  if (!entries.length || entries.some(path => !path.startsWith('package/') || /[\\:\x00-\x1f]/.test(path) || path.split('/').some(part => part === '..'))) throw new Error('Unsafe npm archive entry.');
  const npmRoot = join(temporary, 'npm');
  await mkdir(npmRoot);
  await tar(['-xzf', archive, '-C', npmRoot, '--strip-components=1']);
  await treeFiles(npmRoot, true);
  if (JSON.parse(await readFile(join(npmRoot, 'package.json'), 'utf8')).version !== metadata.version) throw new Error('Extracted npm version does not match bootstrap metadata.');
  const cli = join(npmRoot, 'bin', 'npm-cli.js');
  if (!(await noLinks(cli))?.isFile()) throw new Error('Extracted npm CLI is missing.');
  return cli;
}

async function npmCi(context, installRoot, cache) {
  const env = Object.fromEntries(Object.entries(context.env ?? process.env).filter(([key]) => key.toLowerCase() !== 'npm_config_cache'));
  env.npm_config_cache = cache;
  await new Promise((resolveInstall, reject) => {
    const child = spawn(context.node, [context.npm, 'ci', '--prefix', installRoot, '--cache', cache, '--no-audit', '--no-fund'], { cwd: installRoot, env, stdio: 'inherit', windowsHide: true, shell: false });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolveInstall();
      else {
        const error = new Error(`npm ci failed (${signal ?? code}); existing G dependencies were preserved.`);
        error.exitCode = code ?? 1;
        reject(error);
      }
    });
  });
}

/** npm's concurrent tar writes fail on some DriveFS volumes. Install on the OS
 * temporary disk, then publish closed files sequentially to the G workspace.
 * The caller writes its dependency stamp only after this function succeeds. */
export async function installLocalDependencies(context, { copyDependencyFile = (from, to) => copyFile(from, to, constants.COPYFILE_EXCL) } = {}) {
  const target = await ownedStage(context);
  await treeFiles(target);
  const inputs = new Map();
  for (const name of ['package.json', 'package-lock.json']) {
    await noLinks(join(context.stage, name));
    inputs.set(name, await readFile(join(context.stage, name)));
  }
  const temporaryParent = resolve(tmpdir());
  await noLinks(temporaryParent);
  const temporary = await mkdtemp(join(temporaryParent, 'museum-dependencies-'));
  const installRoot = join(temporary, 'install');
  const candidate = join(context.workspaceRoot, `.dependencies-new-${randomUUID()}`);
  const backup = join(context.workspaceRoot, `.dependencies-old-${randomUUID()}`);
  let candidateCreated = false;
  let backupMoved = false;
  let published = false;
  try {
    await mkdir(installRoot);
    for (const name of inputs.keys()) await copyFile(join(context.stage, name), join(installRoot, name), constants.COPYFILE_EXCL);
    const npm = await temporaryNpm(context, temporary);
    console.log('Installing locked dependencies with verified temporary npm before copying them to the G workspace.');
    await npmCi({ ...context, npm }, installRoot, join(temporary, 'npm-cache'));
    const installed = join(installRoot, 'node_modules');
    const files = await treeFiles(installed, true);
    if (!files.some(file => file.path === '.package-lock.json') || !files.some(file => file.path === join('vite', 'bin', 'vite.js'))) throw new Error('npm ci did not produce the required locked Vite dependencies.');
    await noLinks(candidate);
    await mkdir(candidate);
    candidateCreated = true;
    for (const file of files) {
      const destination = join(candidate, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await copyDependencyFile(join(installed, file.path), destination);
      const copied = await lstat(destination);
      if (!copied.isFile() || copied.size !== file.bytes) throw new Error(`Incomplete dependency copy: ${file.path}`);
    }
    await ownedStage(context);
    await treeFiles(target);
    for (const [name, bytes] of inputs) if (!bytes.equals(await readFile(join(context.stage, name)))) throw new Error('Dependency inputs changed during installation; retry after source synchronization.');
    if (await statMaybe(target)) {
      await noLinks(backup);
      await rename(target, backup);
      backupMoved = true;
    }
    try {
      await rename(candidate, target);
      candidateCreated = false;
      published = true;
    } catch (error) {
      if (backupMoved) {
        try { await rename(backup, target); backupMoved = false; }
        catch (rollbackError) { throw new AggregateError([error, rollbackError], `Dependency publication and rollback failed; previous dependencies remain at ${backup}.`); }
      }
      throw error;
    }
    if (backupMoved) {
      await removeOwned(context.workspaceRoot, backup);
      backupMoved = false;
    }
    console.log(`Copied ${files.length} dependency files to ${target}.`);
    return { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
  } finally {
    try {
      if (candidateCreated) await removeOwned(context.workspaceRoot, candidate);
      // An unpublished backup is retained if rollback failed, never deleted.
      if (published && backupMoved) console.error(`Previous dependencies retained for cleanup: ${backup}`);
    } finally {
      await removeOwned(temporaryParent, temporary);
    }
  }
}
