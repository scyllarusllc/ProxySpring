#!/usr/bin/env node
// Upload / publish the extension through the Chrome Web Store API v2.
//
//   node scripts/webstore.mjs status
//   node scripts/webstore.mjs upload            # pack a signed CRX (Verified CRX uploads) and upload it (draft only)
//   node scripts/webstore.mjs upload --publish  # upload, then submit for review
//   node scripts/webstore.mjs publish           # submit the already-uploaded draft for review
//   node scripts/webstore.mjs upload --file path/to/file.crx   # or a .zip if Verified CRX uploads is off
//   node scripts/webstore.mjs upload --zip                     # force an unsigned zip
//
// Required environment (never commit these):
//   CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN
// Optional:
//   CWS_PUBLISHER_ID (default below), CWS_EXTENSION_ID (default below)
//
// The API handles the package and publishing only. Store listing text and
// screenshots (store-assets/screenshots) can NOT be changed through the API;
// upload those by hand in the developer dashboard.

import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLISHER = process.env.CWS_PUBLISHER_ID || '99cb75f6-8f3f-44bd-98b4-93efb800261d';
const ITEM = process.env.CWS_EXTENSION_ID || 'pgghheegbabncmaogpmigcglbobfmjmg';
const BASE = `https://chromewebstore.googleapis.com`;
const NAME = `publishers/${PUBLISHER}/items/${ITEM}`;

function need(name) {
  const value = process.env[name];
  if (!value) { console.error(`Missing environment variable ${name}. See the header of scripts/webstore.mjs.`); process.exit(2); }
  return value;
}

async function accessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: need('CWS_CLIENT_ID'),
      client_secret: need('CWS_CLIENT_SECRET'),
      refresh_token: need('CWS_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`Token request failed: ${response.status} ${body.error_description || body.error || ''}`);
  return body.access_token;
}

async function call(token, method, url, init = {}) {
  const response = await fetch(url, {method, ...init, headers: {Authorization: `Bearer ${token}`, ...(init.headers || {})}});
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = {raw: text}; }
  if (!response.ok) throw new Error(`${method} ${url} -> ${response.status}\n${JSON.stringify(body, null, 2)}`);
  return body;
}

function buildCrx() {
  const out = execFileSync('node', [join(root, 'scripts', 'pack-crx.mjs')], {encoding: 'utf8'}).trim().split('\n').pop();
  const version = /proxyspring-(.+)\.crx$/.exec(out)?.[1] ?? '?';
  return {path: out, version, type: 'application/octet-stream'};
}

function buildZip() {
  const dist = join(root, 'dist', 'extension');
  if (!existsSync(join(dist, 'manifest.json'))) throw new Error('dist/extension is missing. Run `npm run build` first.');
  const version = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')).version;
  const out = join(root, 'dist', `proxyspring-${version}.zip`);
  execFileSync('rm', ['-f', out]);
  execFileSync('zip', ['-qr', out, '.', '-x', '*.DS_Store'], {cwd: dist});
  return {path: out, version, type: 'application/zip'};
}

async function waitForUpload(token) {
  for (let i = 0; i < 30; i++) {
    const status = await call(token, 'GET', `${BASE}/v2/${NAME}:fetchStatus`);
    const state = status.lastAsyncUploadState;
    if (state && state !== 'IN_PROGRESS') return status;
    await new Promise(resolveWait => setTimeout(resolveWait, 2000));
  }
  throw new Error('Timed out waiting for the upload to finish. Run `status` later.');
}

async function main() {
  const [command = 'status', ...rest] = process.argv.slice(2);
  const flag = name => rest.includes(name);
  const token = await accessToken();

  if (command === 'status') {
    console.log(JSON.stringify(await call(token, 'GET', `${BASE}/v2/${NAME}:fetchStatus`), null, 2));
    return;
  }

  if (command === 'upload') {
    const fileIndex = rest.indexOf('--file');
    let zip;
    if (fileIndex >= 0) {
      const given = resolve(rest[fileIndex + 1] || '');
      if (!existsSync(given)) throw new Error(`File not found: ${given}`);
      zip = {path: given, version: '(given)', type: given.endsWith('.crx') ? 'application/octet-stream' : 'application/zip'};
    } else zip = flag('--zip') ? buildZip() : buildCrx();
    console.log(`Uploading ${zip.path} (${(statSync(zip.path).size / 1024).toFixed(0)} KB, version ${zip.version})…`);
    const upload = await call(token, 'POST', `${BASE}/upload/v2/${NAME}:upload`, {
      headers: {'Content-Type': zip.type},
      body: readFileSync(zip.path),
    });
    let result = upload;
    if (upload.uploadState === 'IN_PROGRESS') result = await waitForUpload(token);
    console.log(JSON.stringify(result, null, 2));
    const state = result.uploadState || result.lastAsyncUploadState;
    if (state && state !== 'SUCCEEDED') throw new Error(`Upload did not succeed (state ${state}).`);
    if (!flag('--publish')) { console.log('Uploaded as draft. Run `publish` (or upload --publish) to submit for review.'); return; }
  }

  if (command === 'publish' || (command === 'upload' && flag('--publish'))) {
    console.log('Submitting for review…');
    console.log(JSON.stringify(await call(token, 'POST', `${BASE}/v2/${NAME}:publish`, {headers: {'Content-Type': 'application/json'}, body: '{}'}), null, 2));
    return;
  }

  if (command !== 'upload') { console.error('Usage: webstore.mjs status | upload [--zip file] [--publish] | publish'); process.exit(2); }
}

main().catch(error => { console.error(error.message || error); process.exit(1); });
