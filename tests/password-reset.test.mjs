import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import ts from "typescript";

const require = createRequire(import.meta.url);
const origin = "https://polo.example.test";
const restaurantId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const oldPassword = "Old fixture password 123";
const newPassword = "New fixture password 456";

// Execute the real handlers, auth, validation, bcrypt and JWT code. Only storage
// and Next's request cookie jar are replaced; no production database is used.
function loadTs(path, dependencies = {}, env = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  runInNewContext(outputText, {
    module, exports: module.exports,
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    process: { env: { NODE_ENV: "test", AUTH_SECRET: "password-reset-tests-only-secret-2026", ADMIN_EMAIL: "admin@example.test", ...env } },
    console, TextEncoder, TextDecoder, Buffer, URL,
  }, { filename });
  return module.exports;
}

async function fixture() {
  const hash = await bcrypt.hash(oldPassword, 4);
  const accounts = new Map([restaurantId, otherId].map((id) => [id, {
    id, restaurant_id: id, email: `${id}@example.test`, password_hash: hash,
    signup_status: "active", is_enabled: true,
  }]));
  const writes = [];
  const deliveries = [];
  let allowRequests = true;
  const cookies = new Map();
  const db = { query: async (sql, params) => {
    if (/^UPDATE users SET password_hash/.test(sql)) {
      const [passwordHash, id, previousHash] = params;
      const account = accounts.get(id);
      if (!account || (previousHash !== undefined && previousHash !== account.password_hash)) return { rowCount: 0, rows: [] };
      account.password_hash = passwordHash;
      writes.push({ id, passwordHash });
      return { rowCount: 1, rows: [{ id: account.id }] };
    }
    if (sql.includes("SELECT u.*")) {
      const account = [...accounts.values()].find((item) => item.email === params[0]);
      return { rows: account ? [account] : [] };
    }
    if (sql.includes("FROM users WHERE email")) {
      const account = [...accounts.values()].find((item) => item.email === params[0]);
      return { rows: account ? [{ ...account }] : [] };
    }
    if (sql.includes("FROM users WHERE id")) {
      const account = accounts.get(params[0]);
      return { rows: account ? [{ ...account }] : [] };
    }
    assert.ok(sql.includes("JOIN users"), "Unexpected database operation");
    const account = accounts.get(params[0]);
    return { rows: account?.email === params[1] ? [account] : [] };
  } };
  const auth = loadTs("lib/auth.ts", {
    "@/lib/db": db,
    "next/headers": { cookies: async () => ({
      get: (key) => cookies.has(key) ? { value: cookies.get(key) } : undefined,
      set: (key, value) => cookies.set(key, value),
      delete: (key) => cookies.delete(key),
    }) },
  });
  const validation = loadTs("lib/validation.ts");
  const api = loadTs("lib/api.ts");
  const reset = loadTs("app/api/admin/restaurants/[id]/password/route.ts", {
    "@/lib/auth": auth, "@/lib/db": db, "@/lib/api": api, "@/lib/validation": validation,
  }).POST;
  const login = loadTs("app/api/auth/login/route.ts", {
    "@/lib/auth": auth, "@/lib/db": db, "@/lib/api": api,
    "@/lib/rate-limit": { requestIp: () => "fixture", consumeRateLimit: async () => ({ allowed: true }) },
  }).POST;
  const rateLimit = { requestIp: () => "fixture", consumeRateLimit: async () => ({ allowed: allowRequests, retryAfter: 60 }) };
  const forgot = loadTs("app/api/auth/password/forgot/route.ts", {
    "@/lib/auth": auth, "@/lib/db": db, "@/lib/api": api, "@/lib/rate-limit": rateLimit,
    "@/lib/password-recovery-mail": { sendPasswordRecovery: async (email, token) => { deliveries.push({ email, token }); } },
  }).POST;
  const recover = loadTs("app/api/auth/password/reset/route.ts", {
    "@/lib/auth": auth, "@/lib/db": db, "@/lib/api": api, "@/lib/rate-limit": rateLimit, "@/lib/validation": validation,
  }).POST;
  const request = (body, requestOrigin = origin) => new Request(`${origin}/api/admin/restaurants/${restaurantId}/password`, {
    method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const context = (id = restaurantId) => ({ params: Promise.resolve({ id }) });
  const signIn = (id = restaurantId, extra = {}) => {
    const account = accounts.get(id);
    return auth.createSession({ role: "restaurant", restaurantId: id, email: account.email, credentialTag: auth.credentialTag(account.password_hash), ...extra });
  };
  const signInAdmin = () => auth.createSession({ role: "admin", email: "admin@example.test" });
  return { accounts, writes, cookies, auth, reset, login, request, context, signIn, signInAdmin, forgot, recover, deliveries, limitRequests: () => { allowRequests = false; } };
}

test("password reset rejects anonymous users, local owners and cross-site requests", async () => {
  const f = await fixture();
  assert.equal((await f.reset(f.request({ password: newPassword }), f.context())).status, 401);
  await f.signIn();
  assert.equal((await f.reset(f.request({ password: newPassword }), f.context())).status, 401);
  await f.signInAdmin();
  assert.equal((await f.reset(f.request({ password: newPassword }, "https://other.example.test"), f.context())).status, 403);
  assert.equal(f.writes.length, 0);
});

test("password reset validates password strength, byte limit, payload size and account ID", async () => {
  const f = await fixture();
  await f.signInAdmin();
  for (const password of ["short", "x".repeat(73), "🔒".repeat(20), "x".repeat(5000)]) {
    const response = await f.reset(f.request({ password }), f.context());
    assert.ok([400, 413].includes(response.status));
  }
  assert.equal((await f.reset(f.request({ password: newPassword }), f.context("invalid"))).status, 400);
  assert.equal((await f.reset(f.request({ password: newPassword }), f.context("33333333-3333-4333-8333-333333333333"))).status, 404);
  assert.equal(f.writes.length, 0);
});

test("admin reset updates only the selected account and invalidates its old sessions", async () => {
  const f = await fixture();
  await f.signIn();
  const oldCookie = f.cookies.get("mesa_session");
  assert.ok(await f.auth.requireSession("restaurant"));
  await f.signIn(otherId);
  const otherCookie = f.cookies.get("mesa_session");
  const otherHash = f.accounts.get(otherId).password_hash;
  await f.signInAdmin();
  const response = await f.reset(f.request({ password: newPassword }), f.context());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const savedHash = f.accounts.get(restaurantId).password_hash;
  assert.notEqual(savedHash, newPassword);
  assert.ok(await bcrypt.compare(newPassword, savedHash));
  assert.equal(await bcrypt.compare(oldPassword, savedHash), false);
  assert.equal(f.accounts.get(otherId).password_hash, otherHash);
  assert.equal(f.writes.length, 1);
  f.cookies.set("mesa_session", oldCookie);
  assert.equal(await f.auth.requireSession("restaurant"), null);
  f.cookies.set("mesa_session", otherCookie);
  assert.ok(await f.auth.requireSession("restaurant"));

  const email = f.accounts.get(restaurantId).email;
  assert.equal((await f.login(f.request({ email, password: oldPassword }))).status, 401);
  assert.equal((await f.login(f.request({ email, password: newPassword }))).status, 200);
  const session = await f.auth.requireSession("restaurant");
  assert.equal(session?.restaurantId, restaurantId);
});

test("resetting a pending account does not activate or enable it", async () => {
  const f = await fixture();
  const account = f.accounts.get(restaurantId);
  account.signup_status = "pending";
  account.is_enabled = false;
  await f.signInAdmin();
  assert.equal((await f.reset(f.request({ password: newPassword }), f.context())).status, 200);
  assert.equal(account.signup_status, "pending");
  assert.equal(account.is_enabled, false);
  assert.equal((await f.login(f.request({ email: account.email, password: newPassword }))).status, 403);
});

test("recovery requests email only the matching local and return the same generic response", async () => {
  const f = await fixture();
  await f.signIn();
  const account = f.accounts.get(restaurantId);
  const before = account.password_hash;
  const known = await f.forgot(f.request({ email: ` ${account.email.toUpperCase()} ` }));
  const unknown = await f.forgot(f.request({ email: "missing@example.test" }));
  const admin = await f.forgot(f.request({ email: "admin@example.test" }));
  assert.equal(known.status, 202);
  const body = await known.text();
  assert.equal(await unknown.text(), body);
  assert.equal(await admin.text(), body);
  assert.equal(f.deliveries.length, 1);
  assert.equal(f.deliveries[0].email, account.email);
  assert.equal(body.includes(f.deliveries[0].token), false);
  const claims = await f.auth.readPasswordResetToken(f.deliveries[0].token);
  assert.equal(claims.userId, restaurantId);
  assert.equal(account.password_hash, before);
  assert.equal(f.writes.length, 0);
  assert.ok(await f.auth.requireSession("restaurant"));
});

test("email recovery changes the password once, invalidates other links and ends old sessions", async () => {
  const f = await fixture();
  const account = f.accounts.get(restaurantId);
  const otherHash = f.accounts.get(otherId).password_hash;
  await f.signIn();
  const oldCookie = f.cookies.get("mesa_session");
  const token = await f.auth.createPasswordResetToken(account);
  const secondToken = await f.auth.createPasswordResetToken(account);
  const result = await f.recover(f.request({ token, password: newPassword }));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(await bcrypt.compare(newPassword, account.password_hash), true);
  assert.equal(f.accounts.get(otherId).password_hash, otherHash);
  f.cookies.set("mesa_session", oldCookie);
  assert.equal(await f.auth.requireSession("restaurant"), null);
  assert.equal((await f.recover(f.request({ token, password: oldPassword }))).status, 400);
  assert.equal((await f.recover(f.request({ token: secondToken, password: oldPassword }))).status, 400);
  assert.equal(f.writes.length, 1);
  assert.equal((await f.login(f.request({ email: account.email, password: oldPassword }))).status, 401);
  assert.equal((await f.login(f.request({ email: account.email, password: newPassword }))).status, 200);
});

test("concurrent uses of a recovery token allow only one password change", async () => {
  const f = await fixture();
  const token = await f.auth.createPasswordResetToken(f.accounts.get(restaurantId));
  const results = await Promise.all([
    f.recover(f.request({ token, password: newPassword })),
    f.recover(f.request({ token, password: oldPassword })),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
  assert.equal(f.writes.length, 1);
});

test("expired, tampered and session tokens cannot reset passwords", async () => {
  const f = await fixture();
  const account = f.accounts.get(restaurantId);
  const expired = await new SignJWT({ purpose: "password-reset", credentialTag: f.auth.credentialTag(account.password_hash) })
    .setProtectedHeader({ alg: "HS256" }).setSubject(restaurantId).setIssuer("polo").setAudience("password-reset")
    .setIssuedAt().setExpirationTime(1).sign(new TextEncoder().encode("password-reset-tests-only-secret-2026"));
  const token = await f.auth.createPasswordResetToken(account);
  await f.signIn();
  for (const invalid of [expired, token + "tampered", f.cookies.get("mesa_session")]) {
    assert.equal((await f.recover(f.request({ token: invalid, password: newPassword }))).status, 400);
  }
  await f.signInAdmin();
  assert.equal((await f.reset(f.request({ password: newPassword }), f.context())).status, 200);
  assert.equal((await f.recover(f.request({ token, password: oldPassword }))).status, 400);
  assert.equal(f.writes.length, 1);
});

test("recovery endpoints enforce origin, validation and rate limits", async () => {
  const f = await fixture();
  const email = f.accounts.get(restaurantId).email;
  const token = await f.auth.createPasswordResetToken(f.accounts.get(restaurantId));
  assert.equal((await f.forgot(f.request({ email }, "https://other.example.test"))).status, 403);
  assert.equal((await f.recover(f.request({ token, password: newPassword }, "https://other.example.test"))).status, 403);
  assert.equal((await f.forgot(f.request({ email: "invalid" }))).status, 400);
  assert.equal((await f.recover(f.request({ token, password: "short" }))).status, 400);
  f.limitRequests();
  const blocked = await f.forgot(f.request({ email }));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.equal((await f.recover(f.request({ token, password: newPassword }))).status, 429);
  assert.equal(f.deliveries.length, 0);
  assert.equal(f.writes.length, 0);
});

test("recovery email uses the configured public domain and never sends a password", async () => {
  let sent;
  const mail = loadTs("lib/password-recovery-mail.ts", { nodemailer: { createTransport: (options) => {
    assert.equal(options.host, "smtp.hostinger.com");
    assert.equal(options.secure, true);
    return { sendMail: async (message) => { sent = message; } };
  } } }, { SMTP_USER: "polo@example.test", SMTP_PASSWORD: "fake-smtp-password", NEXT_PUBLIC_SITE_URL: origin });
  await mail.sendPasswordRecovery("owner@example.test", "fixture-token");
  assert.equal(sent.to, "owner@example.test");
  assert.ok(sent.text.includes(`${origin}/recuperar?token=fixture-token`));
  assert.ok(sent.text.includes("30 minutos"));
  assert.equal(sent.text.includes("fake-smtp-password"), false);
});
