// Standalone Windows process smoke test using its own isolated mutex name.
// It copies the real wrapper and Node into a portable sibling-folder fixture,
// then substitutes a harmless Node task so no real museum operation is performed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.platform, 'win32', 'This smoke test exercises the Windows named mutex.');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = await mkdtemp(join(tmpdir(), 'museum-lock-smoke-'));
const fixtureSource = join(base, '한글 경로', 'museum-web');
const fixtureToolchain = join(dirname(fixtureSource), 'museum-workspace', 'toolchain');
const wrapper = join(fixtureSource, 'museum.ps1');
const originalMutexName = 'Global\\YoungnakMuseumWorkspace-prj_r5Q33OKub3j7U0OFzTYz06K8YAkz';
const mutexName = `Local\\YoungnakMuseumSmoke-${basename(base)}`;
const powershell = join(process.env.WINDIR, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const quote = value => `'${value.replaceAll("'", "''")}'`;
const processes = [];

function launch(script) {
  const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: base, windowsHide: true, shell: false, env: { ...process.env, UV_THREADPOOL_SIZE: '3', MUSEUM_LOCK_SMOKE_DIR: base } });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const done = new Promise((resolveDone, reject) => {
    child.on('error', reject);
    child.on('exit', code => resolveDone({ code, output }));
  });
  processes.push(child);
  return { child, done };
}

async function completed(task) {
  return Promise.race([task.done, delay(15000).then(() => { throw new Error('Smoke subprocess timed out.'); })]);
}

async function signaled(name) {
  for (let tries = 0; tries < 150; tries++) {
    if (await readFile(join(base, name), 'utf8').catch(() => '') === 'ready') return;
    await delay(100);
  }
  throw new Error(`Smoke signal timed out: ${name}`);
}

try {
  await mkdir(join(fixtureSource, 'tools'), { recursive: true });
  await mkdir(fixtureToolchain, { recursive: true });
  await copyFile(process.execPath, join(fixtureToolchain, 'node.exe'));
  const wrapperSource = await readFile(join(repo, 'museum.ps1'), 'utf8');
  assert.ok(wrapperSource.includes(originalMutexName));
  await writeFile(wrapper, wrapperSource.replace(originalMutexName, mutexName));
  await writeFile(join(fixtureSource, 'tools', 'local-workspace.mjs'), `
import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.env.MUSEUM_LOCK_SMOKE_DIR;
const command = process.argv[2];
if (process.env.UV_THREADPOOL_SIZE !== '32') throw new Error('Expected a 32-thread I/O pool in the Node child.');
if (command === 'dev') {
  await writeFile(join(root, 'running'), 'ready');
  setInterval(async () => { try { await access(join(root, 'release')); process.exit(0); } catch {} }, 100);
} else if (command === 'build') process.exit(7);
else console.log('HELP_OK');
`);
  const portable = await completed(launch(`& ${quote(wrapper)} help`));
  assert.equal(portable.code, 0, portable.output);
  assert.match(portable.output, /HELP_OK/);
  console.log('PASS: the wrapper finds its sibling runtime from an unrelated working directory with spaces and Korean path names.');

  const restored = await completed(launch(`$env:UV_THREADPOOL_SIZE = '7'; & ${quote(wrapper)} help; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if ($env:UV_THREADPOOL_SIZE -ne '7') { throw 'Existing thread-pool environment was not restored.' }; Remove-Item Env:\\UV_THREADPOOL_SIZE; & ${quote(wrapper)} help; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (Test-Path Env:\\UV_THREADPOOL_SIZE) { throw 'Absent thread-pool environment was not restored.' }; Write-Output 'ENV_RESTORED'`));
  assert.equal(restored.code, 0, restored.output);
  assert.match(restored.output, /ENV_RESTORED/);
  console.log('PASS: Node receives UV_THREADPOOL_SIZE=32 and both previous/unset parent values are restored.');

  const holder = launch(`& ${quote(wrapper)} dev`);
  await signaled('running');
  const busy = await completed(launch(`$env:UV_THREADPOOL_SIZE = '9'; & ${quote(wrapper)} help; $result = $LASTEXITCODE; if ($env:UV_THREADPOOL_SIZE -ne '9') { throw 'Busy command changed the thread-pool environment.' }; exit $result`));
  assert.notEqual(busy.code, 0, 'A second wrapper process must be rejected while the first Node child is running.');
  assert.match(busy.output, /already running/i);
  assert.match(busy.output, /Ctrl\+C/i);
  console.log('PASS: a second process cannot enter while the Node child holds the command lock.');

  await writeFile(join(base, 'release'), 'release');
  assert.equal((await completed(holder)).code, 0);
  const afterSuccess = await completed(launch(`& ${quote(wrapper)} help`));
  assert.equal(afterSuccess.code, 0, afterSuccess.output);
  assert.match(afterSuccess.output, /HELP_OK/);
  console.log('PASS: a finished command releases the lock.');

  const failure = await completed(launch(`$env:UV_THREADPOOL_SIZE = '11'; & ${quote(wrapper)} build; $result = $LASTEXITCODE; if ($env:UV_THREADPOOL_SIZE -ne '11') { throw 'Failed command changed the thread-pool environment.' }; exit $result`));
  assert.equal(failure.code, 7, `The child failure code must be preserved. ${failure.output}`);
  const afterFailure = await completed(launch(`& ${quote(wrapper)} help`));
  assert.equal(afterFailure.code, 0, afterFailure.output);
  console.log('PASS: a failed command preserves its exit code and releases the lock.');

  // Keep a non-owning handle alive so the abandoned kernel object survives
  // its owner's process exit and the wrapper must handle AbandonedMutexException.
  // This tests mutex ownership recovery, not child-process tree cleanup.
  const observer = launch(`$mutex = New-Object System.Threading.Mutex($false, ${quote(mutexName)}); [IO.File]::WriteAllText(${quote(join(base, 'observer'))}, 'ready'); Start-Sleep -Seconds 30; $mutex.Dispose()`);
  await signaled('observer');
  const abandoned = await completed(launch(`$mutex = New-Object System.Threading.Mutex($false, ${quote(mutexName)}); if (-not $mutex.WaitOne(0)) { exit 9 }; [Environment]::Exit(0)`));
  assert.equal(abandoned.code, 0, abandoned.output);
  const recovered = await completed(launch(`& ${quote(wrapper)} help`));
  assert.equal(recovered.code, 0, recovered.output);
  assert.match(recovered.output, /HELP_OK/);
  observer.child.kill();
  await observer.done;
  console.log('PASS: an abandoned process lock is recovered without deleting a PID or lock file.');

  const direct = await completed(launch(`Remove-Item Env:\\MUSEUM_WORKSPACE_WRAPPER -ErrorAction SilentlyContinue; & ${quote(process.execPath)} ${quote(join(repo, 'tools', 'local-workspace.mjs'))} help; exit $LASTEXITCODE`));
  assert.notEqual(direct.code, 0, 'The direct Node CLI must direct users to the locking PowerShell entrypoint.');
  assert.match(direct.output, /museum\.ps1/);
  console.log('PASS: unsupported direct Node CLI invocation is rejected before workspace access.');
} finally {
  await writeFile(join(base, 'release'), 'release').catch(() => {});
  await delay(300);
  for (const child of processes) if (child.exitCode === null) child.kill();
  assert.ok(resolve(base).startsWith(resolve(tmpdir()) + sep));
  await rm(base, { recursive: true, force: true });
}
