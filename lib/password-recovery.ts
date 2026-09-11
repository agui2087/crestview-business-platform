export function recoveryOrigin(siteUrl: string | undefined): string | null {
  try {
    const url = new URL(siteUrl ?? "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}

export function validNewPassword(password: unknown, confirmation: unknown) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128 && password === confirmation;
}
