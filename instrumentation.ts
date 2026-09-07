import { logOperationalEvent } from "@/lib/observability";

export async function register() {}

export function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  logOperationalEvent({
    event: "request.unhandled_error",
    level: "error",
    route: request.path,
    error,
    details: {
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
}
