import { config } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { isEmailConfigured, verifySmtp } from './services/mailer.js';

async function main() {
  await connectDB();
  const server = app.listen(config.port, () => console.log(`[api] VORTEX API listening on http://localhost:${config.port} (${config.env})`));

  // Non-blocking: a wrong SMTP setting is reported once at startup instead of on the first customer order. Never prints credentials.
  if (isEmailConfigured()) {
    verifySmtp().then((r) => console.log(r.ok ? '[mail] SMTP connection verified.' : `[mail] SMTP check failed (${r.reason}). Orders still work; emails will not be delivered until this is fixed.`));
  } else {
    console.log('[mail] SMTP is not configured: order confirmation and contact emails are disabled.');
  }
  const shutdown = (signal) => {
    console.log(`\n[api] ${signal} received, shutting down...`);
    server.close(async () => { await disconnectDB(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => { console.error('[fatal] Unhandled rejection:', err); process.exit(1); });
main().catch((err) => { console.error('[fatal] Could not start server:', err.message); process.exit(1); });
