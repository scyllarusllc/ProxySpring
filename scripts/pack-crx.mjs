#!/usr/bin/env node
// Pack dist/extension into a signed CRX3 for Verified CRX uploads.
//   node scripts/pack-crx.mjs            # uses ~/.proxyspring/crx-key.pem
//   CRX_KEY=/path/key.pem node scripts/pack-crx.mjs
// The private key must never be committed. The matching public key is scripts/crx-public.pem.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const key = resolve(process.env.CRX_KEY || join(homedir(), '.proxyspring', 'crx-key.pem'));
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const dist = join(root, 'dist', 'extension');

if (!existsSync(key)) { console.error(`Signing key not found: ${key}`); process.exit(2); }
if (!existsSync(join(dist, 'manifest.json'))) { console.error('dist/extension is missing. Run `npm run build` first.'); process.exit(2); }
if (JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).key) { console.error('manifest.json must not contain a "key" field.'); process.exit(2); }

const profile = mkdtempSync(join(tmpdir(), 'proxyspring-pack-'));
try {
  execFileSync(chrome, [`--user-data-dir=${profile}`, `--pack-extension=${dist}`, `--pack-extension-key=${key}`, '--no-message-box'], {stdio: 'pipe'});
} finally { rmSync(profile, {recursive: true, force: true}); }

const version = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).version;
const out = join(root, 'dist', `proxyspring-${version}.crx`);
renameSync(join(root, 'dist', 'extension.crx'), out);
console.log(out);
