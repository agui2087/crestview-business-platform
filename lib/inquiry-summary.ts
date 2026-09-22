/** Sharing permission belongs to an inquiry, not globally to its buyer. */
export function indexInquirySummaries<T>(records: Array<{ inquiry: { id: string }; result: { data: T | null } }>): Map<string, T> {
  const summaries = new Map<string, T>();
  for (const { inquiry, result } of records) {
    if (result.data !== null) summaries.set(inquiry.id, result.data);
  }
  return summaries;
}
