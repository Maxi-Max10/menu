/** Move one calendar month forward, clamping dates such as January 31 to February's last day. */
export function addCalendarMonth(date: Date) {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** An early payment extends the current trial/paid period; an expired period starts today. */
export function nextPeriodEnd(currentEnd: Date | null, now = new Date()) {
  return addCalendarMonth(currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now);
}
