import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test, { type TestContext } from 'node:test';
import * as compact from '../tools/local-build.mjs';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'museum-compact-build-'));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'public', 'media', 'full'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>');
  await writeFile(join(root, 'src', 'main.ts'), 'import "./style.css"; document.querySelector("#app").textContent = "compiled museum fixture";');
  await writeFile(join(root, 'src', 'style.css'), 'body { color: #135; }');
  await writeFile(join(root, '.env.local'), 'PRIVATE_TEST_VALUE=never-serve-this');
  await writeFile(join(root, 'public', 'media', 'full', 'sample.mp4'), '0123456789-media');
  await writeFile(join(root, 'public', 'media', 'full', 'exhibit.html'), '<!doctype html><p>archived exhibit</p>');
  await writeFile(join(root, 'public', 'media', 'full', 'exhibit.css'), 'p { color: #246; }');
  await writeFile(join(root, 'public', 'media', 'full', 'exhibit.js'), 'window.archivedExhibit = true;');
  return root;
}

test('compact build emits compiled files while keeping one copy of public media', async t => {
  assert.equal(typeof compact.buildCompact, 'function');
  const root = await fixture(t);
  await compact.buildCompact(root);
  const index = await readFile(join(root, 'dist', 'index.html'), 'utf8');
  assert.match(index, /\/assets\/index-[^" ]+\.js/);
  assert.equal((await readdir(join(root, 'dist', 'assets'))).filter(name => name.endsWith('.js')).length, 1);
  await assert.rejects(access(join(root, 'dist', 'media')), { code: 'ENOENT' });
  assert.equal(await readFile(join(root, 'public', 'media', 'full', 'sample.mp4'), 'utf8'), '0123456789-media');
});

test('compact preview serves exact compiled bytes and ranged media without exposing source', async t => {
  assert.equal(typeof compact.previewCompact, 'function');
  const root = await fixture(t);
  await compact.buildCompact(root);
  const server = await compact.previewCompact(root, { port: 0 });
  t.after(() => server.close());
  const address = server.httpServer.address();
  assert.equal(typeof address, 'object');
  assert.ok(address && 'port' in address);
  const origin = `http://127.0.0.1:${address.port}`;
  const index = await readFile(join(root, 'dist', 'index.html'), 'utf8');
  for (const path of ['/', '/index.html', '/hkjmuseum.html?scene=entry']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), index, path);
  }
  const bundlePath = index.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
  assert.ok(bundlePath);
  const response = await fetch(origin + bundlePath);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), await readFile(join(root, 'dist', bundlePath), 'utf8'));
  const stylePath = index.match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];
  assert.ok(stylePath);
  const style = await fetch(origin + stylePath);
  assert.equal(style.status, 200);
  assert.match(style.headers.get('content-type') ?? '', /text\/css/);
  assert.equal(await style.text(), await readFile(join(root, 'dist', stylePath), 'utf8'));
  const media = await fetch(origin + '/media/full/sample.mp4');
  assert.equal(media.status, 200);
  assert.equal(await media.text(), '0123456789-media');
  for (const [file, type] of [['exhibit.html', 'text/html'], ['exhibit.css', 'text/css'], ['exhibit.js', 'text/javascript']]) {
    const document = await fetch(origin + '/media/full/' + file + '?import');
    assert.equal(document.status, 200, file);
    assert.match(document.headers.get('content-type') ?? '', new RegExp(type));
    assert.equal(await document.text(), await readFile(join(root, 'public', 'media', 'full', file), 'utf8'), file);
  }
  const range = await fetch(origin + '/media/full/sample.mp4', { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 2-5/16');
  assert.equal(await range.text(), '2345');
  const head = await fetch(origin + '/media/full/sample.mp4', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '16');
  assert.equal(await head.text(), '');
  for (const path of ['/src/main.ts', '/.env.local', '/@fs/' + root.replaceAll('\\', '/') + '/.env.local', '/media/..%2f..%2f.env.local', '/media/full/missing.jpg']) {
    const denied = await fetch(origin + path);
    assert.equal(denied.status, 404, path);
    assert.doesNotMatch(await denied.text(), /never-serve-this|compiled museum fixture/, path);
  }
});
