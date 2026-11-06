// Local compact builds share public assets with preview instead of duplicating them.
// Vercel still uses the unchanged package.json build:vercel command.
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildCompact(root) {
  const { build } = await import('vite');
  await build({ root: resolve(root), build: { copyPublicDir: false } });
}

export async function previewCompact(root, { port = 4173 } = {}) {
  const { createServer } = await import('vite');
  root = resolve(root);
  const output = join(root, 'dist');
  const media = join(root, 'public');
  await access(join(output, 'index.html'));
  await access(media);
  const server = await createServer({
    configFile: false,
    // Vite's public middleware serves all media unchanged, including the
    // archived HTML/CSS exhibits, video ranges and HEAD requests.
    root: output,
    publicDir: media,
    envDir: media,
    cacheDir: join(root, '.cache', 'compact-preview'),
    appType: 'custom',
    mode: 'production',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1', port, strictPort: true,
      watch: null, hmr: false,
      fs: { strict: true, allow: [output, media] },
    },
    plugins: [{
      name: 'museum-compiled-preview',
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          let url;
          let path;
          try {
            url = new URL(req.url, 'http://127.0.0.1');
            path = decodeURIComponent(url.pathname);
          } catch { res.statusCode = 404; res.end(); return; }
          // This is a static preview: no development endpoints, source files,
          // alternate file streams or import-transform query parameters.
          if (!['GET', 'HEAD'].includes(req.method) || /[\\:\x00-\x1f]/.test(path) || path.split('/').some(part => part.startsWith('.'))) {
            res.statusCode = 404; res.end(); return;
          }
          if (path.startsWith('/media/')) { req.url = url.pathname; next(); return; }
          if (['/', '/index.html', '/hkjmuseum.html'].includes(path)) path = '/index.html';
          else if (!path.startsWith('/assets/')) { res.statusCode = 404; res.end(); return; }
          // Send the small compiled output directly, before Vite can transform
          // it or inject a development client. Media streaming stays in Vite.
          const target = join(output, ...path.split('/').filter(Boolean));
          void readFile(target).then(bytes => {
            const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
            res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
            res.setHeader('Content-Length', bytes.length);
            res.setHeader('Cache-Control', 'no-store');
            res.end(req.method === 'HEAD' ? undefined : bytes);
          }).catch(error => {
            res.statusCode = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 500;
            res.end();
          });
        });
      },
    }],
  });
  try { await server.listen(); }
  catch (error) { await server.close(); throw error; }
  return server;
}

async function main(args) {
  const [command, ...extra] = args;
  if (!['build', 'preview'].includes(command) || (extra.length && (command !== 'preview' || extra.length !== 2 || extra[0] !== '--port' || !/^\d+$/.test(extra[1]) || Number(extra[1]) < 1024 || Number(extra[1]) > 65535))) {
    throw new Error('Use museum.ps1 build or museum.ps1 preview [--port 1024-65535].');
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (command === 'build') return buildCompact(root);
  const server = await previewCompact(root, extra.length ? { port: Number(extra[1]) } : {});
  server.printUrls();
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await server.close();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.MUSEUM_WORKSPACE_WRAPPER !== 'Global\\YoungnakMuseumWorkspace-prj_r5Q33OKub3j7U0OFzTYz06K8YAkz') {
    console.error('Run museum.ps1 so asset verification and the command lock are applied.');
    process.exitCode = 1;
  } else {
    main(process.argv.slice(2)).catch(error => { console.error(`Museum local build: ${error.message}`); process.exitCode = 1; });
  }
}
