import { createApp } from './app';
import { config } from './config';
import { pool } from './db';
import { migrate } from './migrate';

async function main() {
  await migrate(); // idempotent, so a fresh checkout "just works"
  const server = createApp().listen(config.port, () => console.log(`MiniLedger API listening on :${config.port}`));
  const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => { console.error(err); process.exit(1); });
