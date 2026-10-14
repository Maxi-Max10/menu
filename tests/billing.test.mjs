import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarMonth, nextPeriodEnd } from "../lib/billing.ts";

test("a free month uses a calendar month and clamps month-end dates", () => {
  assert.equal(addCalendarMonth(new Date("2026-01-31T15:30:00Z")).toISOString(), "2026-02-28T15:30:00.000Z");
  assert.equal(addCalendarMonth(new Date("2028-01-31T15:30:00Z")).toISOString(), "2028-02-29T15:30:00.000Z");
  assert.equal(addCalendarMonth(new Date("2026-10-14T15:30:00Z")).toISOString(), "2026-11-14T15:30:00.000Z");
});

test("an early first payment starts after the free month", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const trialEnd = new Date("2026-11-14T15:30:00Z");
  assert.equal(nextPeriodEnd(trialEnd, now).toISOString(), "2026-12-14T15:30:00.000Z");
});

test("a payment after expiry starts a new month from payment time", () => {
  const now = new Date("2026-12-10T12:00:00Z");
  const trialEnd = new Date("2026-11-14T15:30:00Z");
  assert.equal(nextPeriodEnd(trialEnd, now).toISOString(), "2027-01-10T12:00:00.000Z");
  assert.equal(nextPeriodEnd(null, now).toISOString(), "2027-01-10T12:00:00.000Z");
});
