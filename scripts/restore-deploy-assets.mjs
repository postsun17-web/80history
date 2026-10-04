import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const catalogueSha256 = bytes => sha256(Buffer.from(Buffer.from(bytes).toString('utf8').replace(/\r\n/g, '\n')));
export function validateAssetPath(path) {
  if (typeof path !== 'string' || !/^media\/(?:full|v1)\//.test(path) || /[\\\x00-\x1f]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error(`Unsafe asset path: ${path}`);
  }
  return path;
}
export async function restoreArchive(bytes, archive, publicRoot) {
  if (bytes.length !== archive.bytes || sha256(bytes) !== archive.sha256) throw new Error('Archive integrity mismatch');
  const allowed = new Map(archive.assets.map(a => [validateAssetPath(a.path), a]));
  if (allowed.size !== archive.assets.length) throw new Error('Duplicate manifest path');
  const seen = new Set();
  const files = unzipSync(bytes, {filter(entry) {
    validateAssetPath(entry.name);
    const asset = allowed.get(entry.name);
    if (!asset || seen.has(entry.name) || entry.originalSize !== asset.bytes) throw new Error(`Unexpected ZIP entry: ${entry.name}`);
    seen.add(entry.name);
    return true;
  }});
  if (seen.size !== allowed.size) throw new Error('Archive is missing required assets');
  // Validate the entire archive before writing any file from it.
  for (const [path, asset] of allowed) {
    if (!files[path] || files[path].length !== asset.bytes || sha256(files[path]) !== asset.sha256) throw new Error(`Asset integrity mismatch: ${path}`);
  }
  for (const [path] of allowed) {
    const target = resolve(publicRoot, path);
    await mkdir(dirname(target), {recursive: true});
    await writeFile(target, files[path]);
  }
  return allowed.size;
}
async function alreadyRestored(archive, root) {
  for (const asset of archive.assets) {
    validateAssetPath(asset.path);
    try {
      const bytes = await readFile(resolve(root, asset.path));
      if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) return false;
    } catch { return false; }
  }
  return true;
}
export async function restoreDeployment(manifest, root, localArchives) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.archives) || !manifest.archives.length) throw new Error('Invalid asset manifest');
  let total = 0;
  for (const archive of manifest.archives) {
    if (archive.bytes > 100 * 1024 * 1024) throw new Error('Archive exceeds memory bound');
    if (await alreadyRestored(archive, root)) { total += archive.assets.length; continue; }
    let bytes;
    if (localArchives) {
      if (!/^assets-[a-f0-9]{20}\.zip$/.test(archive.filename)) throw new Error('Invalid archive name');
      bytes = await readFile(resolve(localArchives, archive.filename));
    } else {
      const url = new URL(archive.url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')) throw new Error('Untrusted asset host');
      const response = await fetch(url, {signal: AbortSignal.timeout(180000)});
      if (!response.ok) throw new Error(`Asset download failed: ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    total += await restoreArchive(bytes, archive, root);
    console.log(`Restored ${archive.filename}: ${archive.assets.length} files`);
  }
  console.log(`Verified ${total} museum assets`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const manifest = JSON.parse(await readFile('deployment-assets.json', 'utf8'));
  if (catalogueSha256(await readFile('src/data/full-museum.json')) !== manifest.sourceDataSha256) throw new Error('Asset manifest belongs to a different museum catalogue');
  await restoreDeployment(manifest, resolve('public'), process.env.MUSEUM_LOCAL_ARCHIVES);
}
