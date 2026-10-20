import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const id = "11111111-1111-4111-8111-111111111111";
const origin = "https://polo.example.test";

function loadTs(path, dependencies = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  runInNewContext(outputText, {
    module, exports: module.exports,
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    process: { env: { SMTP_USER: "billing@example.test", SMTP_PASSWORD: "fixture" } },
    console, Buffer, URL, Date,
  }, { filename });
  return module.exports;
}

function fixture() {
  const account = { name: "Café <Centro>", plan: "basic", paid_until: new Date("2026-09-19T03:00:00Z"), signup_status: "active", owner_email: "owner@example.test" };
  const links = { basic_url: "https://mpago.la/test-basic", premium_url: "https://mpago.la/test-premium" };
  const notices = new Map();
  const deliveries = [];
  let failDelivery = false;
  const db = {
    transaction: async (fn) => fn({ query: async (sql, params) => {
      if (sql.includes("FROM restaurants r WHERE")) return { rows: [account] };
      if (sql.includes("FROM billing_settings")) return { rows: [links] };
      if (sql.includes("INSERT INTO billing_notices")) {
        const key = `${params[1]}:${params[2].toISOString()}`;
        const previous = notices.get(key);
        if (previous && previous.status !== "failed") return { rowCount: 0, rows: [] };
        const notice = { id: previous?.id || params[0], status: "sending" };
        notices.set(key, notice);
        return { rowCount: 1, rows: [{ id: notice.id }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    } }),
    query: async (sql, params) => {
      assert.match(sql, /^UPDATE billing_notices/);
      const notice = [...notices.values()].find((item) => item.id === params[0]);
      assert.ok(notice);
      notice.status = sql.includes("status = 'sent'") ? "sent" : "failed";
      return { rowCount: 1 };
    },
  };
  const handler = loadTs("app/api/admin/restaurants/[id]/billing-notice/route.ts", {
    "@/lib/auth": { requireSession: async () => true },
    "@/lib/api": loadTs("lib/api.ts"),
    "@/lib/db": db,
    "@/lib/types": { PLANS: { basic: { price: 10000 }, premium: { price: 18000 } } },
    "@/lib/billing-notice": {
      validPaymentLink: (url) => url.startsWith("https://mpago.la/"),
      sendBillingNotice: async (message) => { deliveries.push(message); if (failDelivery) throw new Error("SMTP fixture failure"); },
    },
  }).POST;
  const send = () => handler(new Request(`${origin}/api/admin/restaurants/${id}/billing-notice`, {
    method: "POST", headers: { origin, "sec-fetch-site": "same-origin" },
  }), { params: Promise.resolve({ id }) });
  return { account, links, notices, deliveries, send, setFailDelivery: (value) => { failDelivery = value; } };
}

test("sends one notice for an expired period with the plan's link and amount", async () => {
  const f = fixture();
  assert.equal((await f.send()).status, 200);
  assert.equal(f.deliveries.length, 1);
  assert.equal(f.deliveries[0].paymentUrl, f.links.basic_url);
  assert.equal(f.deliveries[0].email, f.account.owner_email);
  assert.equal([...f.notices.values()][0].status, "sent");
  assert.equal((await f.send()).status, 409);
  assert.equal(f.deliveries.length, 1);
});

test("does not send before expiry or without a payment link", async () => {
  const f = fixture();
  f.account.paid_until = new Date(Date.now() + 86_400_000);
  assert.equal((await f.send()).status, 409);
  f.account.paid_until = new Date("2026-09-19T03:00:00Z");
  f.links.basic_url = "";
  assert.equal((await f.send()).status, 409);
  assert.equal(f.deliveries.length, 0);
});

test("retries a delivery that failed before SMTP accepted it", async () => {
  const f = fixture();
  f.setFailDelivery(true);
  assert.equal((await f.send()).status, 500);
  assert.equal([...f.notices.values()][0].status, "failed");
  f.setFailDelivery(false);
  assert.equal((await f.send()).status, 200);
  assert.equal([...f.notices.values()][0].status, "sent");
});

test("accepts only HTTPS Mercado Pago payment links", () => {
  const { validPaymentLink } = loadTs("lib/billing-notice.ts", {
    "@/lib/types": { PLANS: {} },
  });
  assert.equal(validPaymentLink("https://mpago.la/abc123"), true);
  assert.equal(validPaymentLink("https://link.mercadopago.com.ar/polo"), true);
  assert.equal(validPaymentLink("http://mpago.la/abc123"), false);
  assert.equal(validPaymentLink("https://mpago.la.evil.test/abc123"), false);
});

test("email QR, button and plain text use the same payment link", async () => {
  const paymentUrl = "https://mpago.la/polo-basic";
  let encodedUrl;
  let mail;
  const { sendBillingNotice } = loadTs("lib/billing-notice.ts", {
    "@/lib/types": { PLANS: { basic: { label: "Esencial", price: 10000 } }, formatMoney: () => "$ 10.000" },
    qrcode: { toBuffer: async (url) => { encodedUrl = url; return Buffer.from("fixture-qr"); } },
    nodemailer: { createTransport: () => ({ sendMail: async (message) => { mail = message; } }) },
  });
  await sendBillingNotice({ email: "owner@example.test", restaurantName: "Café <Central>", plan: "basic", paymentUrl, dueAt: new Date("2026-09-19T03:00:00Z") });
  assert.equal(encodedUrl, paymentUrl);
  assert.match(mail.html, /href="https:\/\/mpago\.la\/polo-basic"/);
  assert.match(mail.html, /cid:polo-payment-qr/);
  assert.match(mail.html, /Café &lt;Central&gt;/);
  assert.match(mail.text, /\$ 10\.000/);
  assert.match(mail.text, /no es una factura fiscal/);
  assert.equal(mail.attachments[0].cid, "polo-payment-qr");
  assert.equal(mail.attachments[0].content.toString(), "fixture-qr");
});
