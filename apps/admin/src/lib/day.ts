/** ISO timestamp for the start (00:00) of the current KST day, as a UTC instant. */
export function kstDayStartISO(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const midnightUtcMs =
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
    9 * 60 * 60 * 1000;
  return new Date(midnightUtcMs).toISOString();
}
