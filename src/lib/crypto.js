const SALT_KEY = 'hisaab_salt';
const ENC_TEST_KEY = 'hisaab_enc_test';
const ATTEMPT_KEY = 'hisaab_attempts';
const LOCKOUT_KEY = 'hisaab_lockout';

function getSalt() {
  let saltHex = localStorage.getItem(SALT_KEY);
  if (!saltHex) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SALT_KEY, saltHex);
  }
  return new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveKey(passcode, saltOverride) {
  const enc = new TextEncoder();
  const salt = saltOverride || getSalt();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(key, data) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipher)),
  };
}

export async function decrypt(key, payload) {
  const dec = new TextDecoder();
  const iv = new Uint8Array(payload.iv);
  const data = new Uint8Array(payload.data);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return JSON.parse(dec.decode(plain));
}

export async function setPasscode(passcode) {
  const key = await deriveKey(passcode);
  const testPayload = await encrypt(key, { valid: true });
  localStorage.setItem(ENC_TEST_KEY, JSON.stringify(testPayload));
  resetAttempts();
}

export async function verifyPasscode(passcode) {
  const stored = localStorage.getItem(ENC_TEST_KEY);
  if (!stored) return false;
  try {
    const key = await deriveKey(passcode);
    const result = await decrypt(key, JSON.parse(stored));
    return result?.valid === true;
  } catch {
    return false;
  }
}

export function isPasscodeSet() {
  return localStorage.getItem(ENC_TEST_KEY) !== null;
}

// --- GAP-008: Brute-force protection ---
export function checkRateLimit() {
  const lockUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
  if (Date.now() < lockUntil) {
    const secs = Math.ceil((lockUntil - Date.now()) / 1000);
    return { allowed: false, waitSeconds: secs, attempts: getAttemptCount() };
  }
  return { allowed: true, waitSeconds: 0, attempts: getAttemptCount() };
}

function getAttemptCount() {
  return parseInt(localStorage.getItem(ATTEMPT_KEY) || '0');
}

export function recordFailedAttempt() {
  const attempts = getAttemptCount() + 1;
  localStorage.setItem(ATTEMPT_KEY, String(attempts));
  const delays = [0, 0, 0, 2000, 5000, 10000, 30000, 60000];
  const delay = delays[Math.min(attempts, delays.length - 1)];
  if (delay > 0) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + delay));
  }
  return { attempts, maxAttempts: 15 };
}

export function resetAttempts() {
  localStorage.removeItem(ATTEMPT_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

// --- GAP-007: Export uses its own salt, import doesn't overwrite app salt ---
export async function exportEncrypted(data, passphrase) {
  const exportSalt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, exportSalt);
  const payload = await encrypt(key, data);
  return JSON.stringify({ version: 1, salt: bytesToHex(exportSalt), ...payload });
}

export async function importEncrypted(jsonString, passphrase) {
  const parsed = JSON.parse(jsonString);
  const exportSalt = hexToBytes(parsed.salt);
  const key = await deriveKey(passphrase, exportSalt);
  return decrypt(key, { iv: parsed.iv, data: parsed.data });
}

// --- GAP-003: Encrypt/decrypt sensitive fields at rest ---
let _sessionKey = null;

export function setSessionKey(key) { _sessionKey = key; }
export function getSessionKey() { return _sessionKey; }

export async function encryptField(value) {
  if (!_sessionKey || value === undefined || value === null) return value;
  const payload = await encrypt(_sessionKey, value);
  return { __enc: true, ...payload };
}

export async function decryptField(value) {
  if (!_sessionKey || !value?.__enc) return value;
  try {
    return await decrypt(_sessionKey, value);
  } catch {
    return value;
  }
}
