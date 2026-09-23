// Vercel CLI currently puts os.hostname() in its OAuth HTTP User-Agent.
// Non-ASCII Windows machine names are invalid HTTP headers. Limit this fix to
// the CLI process; do not change the user's Windows computer name.
const os = require('node:os');
const { syncBuiltinESMExports } = require('node:module');
const hostname = os.hostname();
os.hostname = () => hostname.replace(/[^\x20-\x7e]/g, '-');
syncBuiltinESMExports();
