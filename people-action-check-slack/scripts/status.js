import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const source = resolve(process.env.DATA_PATH || './data');
const backupDir = resolve(process.env.BACKUP_DIR || './backups');
if (!existsSync(source)) throw new Error(`Database is missing: ${source}`);

const db = new DatabaseSync(source, { readOnly: true });
let integrity;
try { integrity = db.prepare('PRAGMA integrity_check').get().integrity_check; }
finally { db.close(); }

const prefix = `${basename(source)}-`;
const backups = existsSync(backupDir) ? readdirSync(backupDir)
  .filter(name => name.startsWith(prefix) && name.endsWith('.sqlite'))
  .map(name => ({ name, modified: statSync(join(backupDir, name)).mtime }))
  .sort((a, b) => b.modified - a.modified) : [];

console.log(`Database integrity: ${integrity}`);
console.log(`Database path: ${source}`);
console.log(backups.length ? `Latest backup: ${backups[0].name} (${backups[0].modified.toLocaleString()})` : 'Latest backup: none');
if (integrity !== 'ok') process.exitCode = 1;
