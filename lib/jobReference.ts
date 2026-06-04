/** `JC-YYYYMMDD-001` — sequence resets each calendar day (local). */
const JOB_REFERENCE_RE = /^JC-(\d{8})-(\d+)$/;

export function jobReferenceDateStamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function formatJobReferenceSeq(seq: number): string {
  const width = seq >= 1000 ? String(seq).length : 3;
  return String(seq).padStart(width, '0');
}

/** Next reference for `date` given jobs already stored (any org/user). */
export function nextJobReference(
  existing: Array<{ reference: string }>,
  date = new Date(),
): string {
  const stamp = jobReferenceDateStamp(date);
  const prefix = `JC-${stamp}-`;
  let max = 0;

  for (const job of existing) {
    const match = job.reference.trim().match(JOB_REFERENCE_RE);
    if (!match || match[1] !== stamp) continue;
    const seq = parseInt(match[2], 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }

  return `${prefix}${formatJobReferenceSeq(max + 1)}`;
}
