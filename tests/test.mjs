import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
// Run: node tests/test.mjs   (Node 18+, no dependencies)
import assert from 'node:assert/strict';
import { hotp, totp, steamCode, base32Encode, base32Decode, parseOtpauth, buildOtpauth } from '../js/otp.js';
import { decodeMigration, encodeMigration } from '../js/migration.js';
import { encryptJson, decryptJson } from '../js/crypto.js';
import {
  mergeVaults, emptyVault, newAccount, addAccounts,
  deleteAccount, restoreAccount, permanentlyDeleteFromTrash, moveAccountOrder,
} from '../js/store.js';

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };

// RFC 4226 / 6238 test secrets
const SHA1_SECRET = base32Encode(new TextEncoder().encode('12345678901234567890'));
const SHA256_SECRET = base32Encode(new TextEncoder().encode('12345678901234567890123456789012'));
const SHA512_SECRET = base32Encode(new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234'));

await t('base32 roundtrip', () => {
  assert.equal(base32Encode(base32Decode('JBSWY3DPEHPK3PXP')), 'JBSWY3DPEHPK3PXP');
});

await t('HOTP RFC 4226 vectors', async () => {
  const exp = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  for (let i = 0; i < exp.length; i++) assert.equal(await hotp(SHA1_SECRET, i), exp[i]);
});

await t('TOTP RFC 6238 vectors (SHA1/256/512, 8 digits)', async () => {
  const cases = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1234567890, '89005924', '91819424', '93441116'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];
  for (const [sec, s1, s256, s512] of cases) {
    const time = sec * 1000;
    assert.equal(await totp(SHA1_SECRET, { digits: 8, algorithm: 'SHA1', time }), s1);
    assert.equal(await totp(SHA256_SECRET, { digits: 8, algorithm: 'SHA256', time }), s256);
    assert.equal(await totp(SHA512_SECRET, { digits: 8, algorithm: 'SHA512', time }), s512);
  }
});

await t('Steam code is 5 chars from Steam alphabet', async () => {
  const c = await steamCode('JBSWY3DPEHPK3PXP', { time: 1700000000000 });
  assert.match(c, /^[23456789BCDFGHJKMNPQRTVWXY]{5}$/);
});

await t('otpauth parse/build roundtrip', () => {
  const a = parseOtpauth('otpauth://totp/GitHub:me%40x.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=8&period=60&algorithm=SHA256');
  assert.deepEqual([a.issuer, a.name, a.digits, a.period, a.algorithm], ['GitHub', 'me@x.com', 8, 60, 'SHA256']);
  const b = parseOtpauth(buildOtpauth(a));
  assert.deepEqual(b, a);
});

await t('Google Authenticator migration payload decodes', () => {
  const secret = Uint8Array.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xde, 0xad, 0xbe, 0xef]);
  const te = new TextEncoder();
  const field = (n, bytes) => [(n << 3) | 2, bytes.length, ...bytes];
  const varint = (n, v) => [(n << 3) | 0, v];
  const acc = [
    ...field(1, secret), ...field(2, te.encode('Example:alice@google.com')), ...field(3, te.encode('Example')),
    ...varint(4, 1), ...varint(5, 1), ...varint(6, 2),
  ];
  const payload = [...field(1, acc), ...varint(2, 1), ...varint(3, 1), ...varint(4, 0)];
  const b64 = Buffer.from(payload).toString('base64');
  const [a] = decodeMigration(`otpauth-migration://offline?data=${encodeURIComponent(b64)}`);
  assert.equal(a.secret, base32Encode(secret));
  assert.equal(a.issuer, 'Example');
  assert.equal(a.name, 'Example:alice@google.com');
  assert.equal(a.type, 'totp');
  assert.equal(a.digits, 6);
});

await t('Google Authenticator migration encode -> decode roundtrip (multi-batch)', () => {
  const sample = [
    { issuer: 'Google', name: 'rahim@gmail.com', secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, type: 'totp', counter: 0 },
    { issuer: 'GitHub', name: 'rahim-dev', secret: 'GEZDGNBVGY3TQOJQ', algorithm: 'SHA256', digits: 8, type: 'totp', counter: 0 },
    { issuer: 'Bank', name: 'hotp-card', secret: 'MFRGGZDFMZTWQ2LK', algorithm: 'SHA1', digits: 6, type: 'hotp', counter: 42 },
  ];
  const uris = encodeMigration(sample, { batchSize: 2 });
  assert.equal(uris.length, 2);
  const decoded = uris.flatMap((u) => decodeMigration(u));
  assert.equal(decoded.length, 3);
  assert.equal(decoded[0].issuer, 'Google');
  assert.equal(decoded[1].algorithm, 'SHA256');
  assert.equal(decoded[1].digits, 8);
  assert.equal(decoded[2].type, 'hotp');
  assert.equal(decoded[2].counter, 42);
});

await t('AES-GCM backup roundtrip + wrong passphrase fails', async () => {
  const data = { hello: 'world', n: [1, 2, 3] };
  const env = await encryptJson(data, 'correct horse battery', 1000);
  assert.deepEqual(await decryptJson(env, 'correct horse battery'), data);
  await assert.rejects(() => decryptJson(env, 'wrong passphrase'));
});

await t('merge: newer edit wins, delete propagates, additions union, trash syncs', () => {
  const base = newAccount({ id: 'a1', issuer: 'X', name: 'n', secret: 'JBSWY3DPEHPK3PXP', updatedAt: 1000 });
  const local = { ...emptyVault(), accounts: [{ ...base, issuer: 'Renamed', updatedAt: 2000 }] };
  const remote = { ...emptyVault(), accounts: [base, newAccount({ id: 'b2', issuer: 'Y', secret: 'JBSWY3DPEHPK3PXP', updatedAt: 1500 })] };
  const m = mergeVaults(local, remote);
  assert.equal(m.accounts.find((a) => a.id === 'a1').issuer, 'Renamed');
  assert.ok(m.accounts.find((a) => a.id === 'b2'));
  const remote2 = { ...emptyVault(), accounts: [], deleted: { a1: 3000 }, trash: [{ ...base, deletedAt: 3000 }] };
  const m2 = mergeVaults(local, remote2);
  assert.equal(m2.accounts.length, 0);
  assert.equal(m2.trash.length, 1);
});

await t('store: dedupe, trash, restore, permanent delete, reorder', () => {
  const v = emptyVault();
  const r = addAccounts(v, [
    { issuer: 'A', name: 'x', secret: 'JBSWY3DPEHPK3PXP' },
    { issuer: 'A', name: 'x', secret: 'JBSWY3DPEHPK3PXP' },
    { issuer: 'B', name: 'y', secret: 'GEZDGNBVGY3TQOJQ' },
  ]);
  assert.deepEqual(r, { added: 2, skipped: 1 });
  const [first, second] = v.accounts;
  assert.equal(moveAccountOrder(v, first.id, 1), true);
  assert.ok(first.order > second.order);

  deleteAccount(v, first.id);
  assert.equal(v.accounts.length, 1);
  assert.equal(v.trash.length, 1);

  restoreAccount(v, v.trash[0]);
  assert.equal(v.accounts.length, 2);
  assert.equal(v.trash.length, 0);

  deleteAccount(v, second.id);
  permanentlyDeleteFromTrash(v, second.id);
  assert.equal(v.trash.length, 0);
  assert.ok(v.deleted[second.id]);
});

import { generatePassword, generatePassphrase, evaluateStrength } from '../js/password.js';
import { runSecurityAudit } from '../js/security-audit.js';
import { parseRecoveryText } from '../js/recovery-codes.js';

await t('password generator creates robust passwords & passphrases', () => {
  const pwd = generatePassword({ length: 20 });
  assert.equal(pwd.length, 20);
  const st = evaluateStrength(pwd);
  assert.ok(st.score >= 60);

  const phrase = generatePassphrase(4, '-');
  assert.equal(phrase.split('-').length, 4);
});

await t('security audit detects missing lock, backup, and duplicate secrets', () => {
  const vault = {
    accounts: [
      { id: '1', issuer: 'Google', secret: 'JBSWY3DPEHPK3PXP' },
      { id: '2', issuer: 'Facebook', secret: 'JBSWY3DPEHPK3PXP' }, // Duplicate secret
    ],
    trash: [],
  };
  const settings = { pinHash: '', bioCredId: '' }; // Missing lock
  const audit = runSecurityAudit(vault, settings);
  assert.ok(audit.score < 80);
  assert.ok(audit.issues.some((iss) => iss.title.includes('ডুপ্লিকেট')));
  assert.ok(audit.issues.some((iss) => iss.title.includes('লক')));
});

await t('smart recovery codes parser extracts codes from GitHub and Google text', () => {
  const githubSnippet = `
    Download your recovery codes
    You can use recovery codes as a second factor to authenticate...
    • 0ed6f-6d077    • c8edc-934ad
    • 68b0b-4490b    • 62be6-05f8e
    • 12962-7b376    • 90122-d83b8
    • 1dea5-9eda1    • 935ce-6ae25
    • 6fd19-856d7    • d1638-1d0e1
    • 11f7f-81a0b    • 8717d-72fd2
    • 650d2-cea94    • c5877-1932e
    • 12c5a-0e96a    • bb72b-87098
  `;
  const codes = parseRecoveryText(githubSnippet);
  assert.equal(codes.length, 16);
  assert.ok(codes.includes('0ed6f-6d077'));
  assert.ok(codes.includes('bb72b-87098'));

  const googleSnippet = `
    Google Backup Codes:
    1234 5678
    8765 4321
  `;
  const gCodes = parseRecoveryText(googleSnippet);
  assert.equal(gCodes.length, 2);
  assert.ok(gCodes.includes('1234 5678'));
  assert.ok(gCodes.includes('8765 4321'));
});

import { readFileSync } from 'node:fs';
import * as drive from '../js/drive.js';

await t('recovery codes survive AES-GCM encrypted backup roundtrip and store merge', async () => {
  const acc = newAccount({
    issuer: 'GitHub',
    name: 'mdsafiislam894-star',
    secret: 'JL44E5ALF4MJEJQ0',
    recoveryCodes: [
      { id: 'c1', code: '0ed6f-6d077', used: true, usedAt: 1700000000000 },
      { id: 'c2', code: 'c8edc-934ad', used: false, usedAt: null },
    ],
  });
  const vault = { ...emptyVault(), accounts: [acc] };
  const passphrase = 'MySecretPassphrase123!';
  const enc = await encryptJson(vault, passphrase);
  const dec = await decryptJson(enc, passphrase);

  assert.equal(dec.accounts.length, 1);
  assert.equal(dec.accounts[0].recoveryCodes.length, 2);
  assert.equal(dec.accounts[0].recoveryCodes[0].used, true);
  assert.equal(dec.accounts[0].recoveryCodes[1].code, 'c8edc-934ad');
});

await t('drive module exports valid client ID, permanent extension ID and redirect URI', () => {
  assert.ok(drive.isConfigured());
  assert.ok(drive.getClientId().includes('.apps.googleusercontent.com'));
  assert.equal(drive.EXTENSION_ID, 'kkbnfefhgpmcbkelfbchfffdagmifddl');
  assert.equal(drive.EXTENSION_REDIRECT_URI, 'https://kkbnfefhgpmcbkelfbchfffdagmifddl.chromiumapp.org/');
});

await t('extension manifest.json is valid Manifest V3 with identity and external connect', () => {
  const raw = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.key, 'Fixed public key is set');
  assert.ok(manifest.permissions.includes('identity'), 'identity permission present');
  assert.ok(manifest.permissions.includes('tabs'), 'tabs permission present');
  assert.ok(manifest.externally_connectable.matches.length > 0, 'externally_connectable defined');
});

import { THEMES } from '../js/dialogs-advanced.js';

await t('all 8 brand-new luxury themes (Forest, Sea, Sakura, Vampire, Halloween, etc.) are registered', () => {
  assert.equal(THEMES.length, 8);
  const ids = THEMES.map(t => t.id);
  assert.ok(ids.includes('green-forest'), 'Green Forest exists');
  assert.ok(ids.includes('blue-sea'), 'Blue Sea exists');
  assert.ok(ids.includes('sakura-blossom'), 'Sakura exists');
  assert.ok(ids.includes('vampire-blood'), 'Vampire Blood Red exists');
  assert.ok(ids.includes('halloween-orange'), 'Halloween Orange exists');
  assert.ok(ids.includes('cyber-matrix'), 'Cyber Matrix exists');
  assert.ok(ids.includes('celestial-nebula'), 'Celestial Nebula exists');
  assert.ok(ids.includes('crystal-pearl'), 'Crystal Pearl exists');
  for (const th of THEMES) {
    assert.ok(th.name && th.tagline && th.accent && th.previewGrad, `Theme ${th.id} has complete metadata`);
  }
});

console.log(`\n${passed} tests passed`);
