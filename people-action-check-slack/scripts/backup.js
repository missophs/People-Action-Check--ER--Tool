import { DatabaseSync, backup } from 'node:sqlite';
import { chmodSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const source = resolve(arg('data', process.env.DATA_PATH || './data'));
const targetDir = resolve(arg('dir', process.env.BACKUP_DIR || './backups'));
const retain = Math.max(1, Number.parseInt(arg('retain', process.env.BACKUP_RETAIN || '14'), 10) || 14);

if (!existsSync(source)) throw new Error(`Database not found: ${source}`);
mkdirSync(targetDir, { recursive: true, mode: 0o700 });
chmodSync(targetDir, 0o700);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const prefix = `${basename(source)}-`;
const destination = join(targetDir, `${prefix}${stamp}.sqlite`);
const db = new DatabaseSync(source, { readOnly: true });

try {
  await backup(db, destination);
} finally {
  db.close();
}

chmodSync(destination, 0o600);
const verify = new DatabaseSync(destination, { readOnly: true });
try {
  const result = verify.prepare('PRAGMA integrity_check').get();
  if (result.integrity_check !== 'ok') throw new Error(`Backup integrity check failed: ${result.integrity_check}`);
} finally {
  verify.close();
}

const files = readdirSync(targetDir)
  .filter(name => name.startsWith(prefix) && name.endsWith('.sqlite'))
  .map(name => ({ name, path: join(targetDir, name), modified: statSync(join(targetDir, name)).mtimeMs }))
  .sort((a, b) => b.modified - a.modified);

for (const old of files.slice(retain)) unlinkSync(old.path);
console.log(`Verified backup created: ${destination}`);
console.log(`Retaining ${Math.min(files.length, retain)} backup(s) in ${targetDir}`);
