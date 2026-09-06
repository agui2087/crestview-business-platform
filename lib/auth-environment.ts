export function isLocalAuthenticationAllowed(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV !== "production" && environment.CRESTVIEW_ENABLE_LOCAL_AUTH === "true";
}
