// Installed providers are administrator-controlled CommonJS bundles.
const { Console } = require('node:console');
global.console = new Console(process.stderr);
const [file, id, type, season, episode] = process.argv.slice(2);
(async () => {
  const provider = require(file);
  const rows = await provider.getStreams(id, type, season ? Number(season) : null, episode ? Number(episode) : null);
  process.stdout.write(JSON.stringify(Array.isArray(rows) ? rows.slice(0, 100) : []));
})().catch(() => { process.exitCode = 1; });
