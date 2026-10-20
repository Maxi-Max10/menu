import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { limitedBody, MAX_PROOF_BYTES, proofMime } from "../lib/payment-proof.ts";

const require = createRequire(import.meta.url);
const id = "11111111-1111-4111-8111-111111111111";
const restaurantId = "22222222-2222-4222-8222-222222222222";
const origin = "https://polo.example.test";

function loadTs(path, dependencies = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  runInNewContext(outputText, { module, exports: module.exports,
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    process, console, Buffer, URL, Date, File, Request, FormData }, { filename });
  return module.exports;
}

test("accepts only supported file signatures", () => {
  assert.equal(proofMime(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0])), "image/jpeg");
  assert.equal(proofMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(proofMime(Uint8Array.from([37, 80, 68, 70, 45])), "application/pdf");
  assert.equal(proofMime(Uint8Array.from([60, 104, 116, 109, 108])), null);
});

function fixture({ stale = false } = {}) {
  const period = new Date("2026-09-19T03:00:00Z");
  const account = { paid_until: stale ? new Date("2026-10-19T03:00:00Z") : period, plan: "basic", signup_status: "active" };
  const proof = { period_due_at: period, status: "pending", plan: "basic" };
  let paymentCount = 0;
  const db = { transaction: async (fn) => fn({ query: async (sql) => {
    if (sql.includes("SELECT restaurant_id FROM payment_proofs")) return { rows: [{ restaurant_id: restaurantId }] };
    if (sql.includes("SELECT paid_until, plan, signup_status")) return { rows: [account] };
    if (sql.includes("SELECT period_due_at, status")) return { rows: [proof] };
    if (sql.startsWith("UPDATE restaurants")) { account.paid_until = new Date("2026-10-19T03:00:00Z"); return { rowCount: 1 }; }
    if (sql.startsWith("INSERT INTO payments")) { paymentCount++; return { rowCount: 1 }; }
    if (sql.startsWith("UPDATE payment_proofs")) { proof.status = sql.includes("approved") ? "approved" : "rejected"; return { rowCount: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  } }) };
  const handler = loadTs("app/api/admin/payment-proofs/[id]/route.ts", {
    "@/lib/auth": { requireSession: async () => true },
    "@/lib/api": loadTs("lib/api.ts"),
    "@/lib/billing": { nextPeriodEnd: () => new Date("2026-10-19T03:00:00Z") },
    "@/lib/db": db,
    "@/lib/types": { PLANS: { basic: { price: 10000 } } },
  }).PATCH;
  const review = (action = "approve") => handler(new Request(`${origin}/api/admin/payment-proofs/${id}`, {
    method: "PATCH", headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: JSON.stringify({ action }),
  }), { params: Promise.resolve({ id }) });
  return { review, proof, getPaymentCount: () => paymentCount };
}

test("approval records the payment once and a repeat is rejected", async () => {
  const f = fixture();
  assert.equal((await f.review()).status, 200);
  assert.equal(f.proof.status, "approved");
  assert.equal((await f.review()).status, 409);
  assert.equal(f.getPaymentCount(), 1);
});

test("stale proof cannot credit a different period", async () => {
  const f = fixture({ stale: true });
  assert.equal((await f.review()).status, 409);
  assert.equal(f.proof.status, "pending");
  assert.equal(f.getPaymentCount(), 0);
});

test("rejecting a proof never credits the account", async () => {
  const f = fixture();
  assert.equal((await f.review("reject")).status, 200);
  assert.equal(f.proof.status, "rejected");
  assert.equal(f.getPaymentCount(), 0);
});

test("a local uploads one proof for its due period without crediting itself", async () => {
  let saved = false;
  const db = { transaction: async (fn) => fn({ query: async (sql, params) => {
    if (sql.includes("FROM restaurants WHERE")) return { rows: [{ paid_until: new Date("2026-09-19T03:00:00Z"), signup_status: "active", plan: "basic" }] };
    if (sql.includes("INSERT INTO payment_proofs")) {
      assert.equal(params[1], restaurantId);
      assert.equal(params[3], "basic");
      assert.equal(params[5], "application/pdf");
      if (saved) return { rowCount: 0 };
      saved = true;
      return { rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  } }) };
  const handler = loadTs("app/api/payment-proof/route.ts", {
    "@/lib/auth": { requireSession: async () => ({ restaurantId }) },
    "@/lib/api": loadTs("lib/api.ts"),
    "@/lib/billing-notice": { validPaymentLink: () => true },
    "@/lib/db": db,
    "@/lib/payment-proof": { limitedBody, MAX_PROOF_BYTES, proofMime },
    "@/lib/types": { PLANS: { basic: { price: 10000 } } },
  }).POST;
  const send = () => {
    const form = new FormData();
    form.set("proof", new File([Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(120)])], "pago.pdf", { type: "application/pdf" }));
    return handler(new Request(`${origin}/api/payment-proof`, { method: "POST", headers: { origin, "sec-fetch-site": "same-origin" }, body: form }));
  };
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 409);
  assert.equal(saved, true);
});
