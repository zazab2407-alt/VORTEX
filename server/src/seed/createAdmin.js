// Creates (or promotes) an admin account, or resets an existing admin's password.
//   npm run create-admin -- --email you@shop.com --name "Your Name"          (asks for the password)
//   npm run create-admin -- --email you@shop.com --reset-password            (asks for a NEW password, twice; signs out every old session)
//   ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run create-admin   (non-interactive, e.g. deploy scripts)
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin -- --reset-password   (non-interactive reset)
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { MIN_ADMIN_PASSWORD, applyAdmin } from './adminAccount.js';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const flag = (name) => process.argv.includes(`--${name}`);

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const out = new Writable({ write(chunk, _enc, cb) { if (!hidden) process.stdout.write(chunk); cb(); } });
    const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
    process.stdout.write(question);
    rl.question('', (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

async function main() {
  const { connectDB, disconnectDB } = await import('../config/db.js');
  const { User } = await import('../models/index.js');
  const interactive = process.stdin.isTTY;
  const resetPassword = flag('reset-password');
  // A password on the command line ends up in shell history and process lists, so it is not accepted for a reset
  if (resetPassword && arg('password') !== undefined) throw new Error('Do not pass --password with --reset-password. Type it at the prompt (or set ADMIN_PASSWORD).');

  let email = (arg('email') ?? process.env.ADMIN_EMAIL ?? (interactive ? await ask('Admin email: ') : '')).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid --email is required');

  await connectDB();
  try {
    const existing = await User.findOne({ email }).select('role');
    if (existing?.role === 'admin' && !resetPassword) {
      console.log(`${email} is already an admin. Nothing changed. To set a new password, run again with --reset-password.`);
      return;
    }
    if (resetPassword && !existing) throw new Error(`No account exists for ${email}, so there is no password to reset. Run without --reset-password to create it.`);

    const name = existing ? undefined : (arg('name') ?? process.env.ADMIN_NAME ?? (interactive ? await ask('Name: ') : 'Store Admin')).trim() || 'Store Admin';
    let password;
    if (resetPassword) {
      password = process.env.ADMIN_PASSWORD;
      if (password === undefined) {
        if (!interactive) throw new Error('Run in a terminal, or set ADMIN_PASSWORD, to provide the new password');
        password = await ask(`New password (min ${MIN_ADMIN_PASSWORD} characters): `, { hidden: true });
        if (password !== await ask('Confirm new password: ', { hidden: true })) throw new Error('The two passwords do not match. Nothing changed.');
      }
    } else if (!existing) {
      password = arg('password') ?? process.env.ADMIN_PASSWORD ?? (interactive ? await ask(`Password (min ${MIN_ADMIN_PASSWORD} characters): `, { hidden: true }) : '');
      if (!password) throw new Error(`Admin password must be at least ${MIN_ADMIN_PASSWORD} characters (set --password, ADMIN_PASSWORD, or run in a terminal)`);
    }

    const result = await applyAdmin(User, { email, name, password, resetPassword });
    if (result.action === 'created') console.log(`Admin account created for ${email}. You can log in at /login.`);
    else if (result.action === 'password-reset') console.log(`Password reset for admin ${email}. All previous sessions were signed out. You can log in at /login.`);
    else if (result.passwordReset) console.log(`Existing account ${email} promoted to admin and its password reset. All previous sessions were signed out.`);
    else console.log(`Existing account ${email} promoted to admin. Its password was not changed.`);
    if (result.inactive) console.warn(`Warning: ${email} is deactivated, so it still cannot log in. This script does not reactivate admin accounts.`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => { console.error(`Could not create admin: ${err.message}`); process.exit(1); });
