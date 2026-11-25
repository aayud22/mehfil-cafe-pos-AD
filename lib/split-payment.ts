/**
 * Divides a rupee total into N equal parts in paise (integer arithmetic),
 * assigning any remainder paise to the last person so the sum is exact.
 */
export function splitAmountEquallyInPaise(totalRupees: number, peopleCount: number): number[] {
  const count = Math.max(2, Math.min(10, Math.floor(peopleCount)));
  const totalPaise = Math.max(0, Math.round(totalRupees * 100));
  const basePaise = Math.floor(totalPaise / count);
  const remainderPaise = totalPaise - basePaise * count;

  return Array.from({ length: count }, (_, idx) => {
    const paise = idx === count - 1 ? basePaise + remainderPaise : basePaise;
    return paise / 100;
  });
}

export function formatPaiseToInput(rupees: number): string {
  return rupees.toFixed(2).replace(/\.00$/, '');
}
