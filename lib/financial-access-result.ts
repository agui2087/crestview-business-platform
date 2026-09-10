export type FinancialChangeResult =
  | { ok: true }
  | { ok: false; reason: "conflict" | "forbidden" | "invalid" | "unavailable" };

// Supabase reports database failures in a resolved result, not only by throwing.
// Never translate a missing/failed response into the success redirect.
export async function runFinancialAccessChange(
  call: () => PromiseLike<{ error: { code?: string } | null }>,
): Promise<FinancialChangeResult> {
  try {
    const result = await call();
    if (!result || !("error" in result)) return { ok: false, reason: "unavailable" };
    if (result.error === null) return { ok: true };
    const code = result.error?.code;
    return { ok: false, reason: code === "40001" ? "conflict" : code === "42501" ? "forbidden" : code === "22023" ? "invalid" : "unavailable" };
  } catch {
    // The transaction may have committed before a connection dropped. The UI
    // tells the user to refresh and check the current state, not blindly retry.
    return { ok: false, reason: "unavailable" };
  }
}
