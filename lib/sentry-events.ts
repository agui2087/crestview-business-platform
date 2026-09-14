// Minimal server-only error transport. Never sends request data, source text,
// exception messages, attachments, user identifiers, or browser recordings.
const allowedEvents = new Set([
  'request.unhandled_error','stripe.checkout_failed','stripe.portal_failed',
  'stripe.signature_rejected','stripe.payment_failed','stripe.webhook_failed',
  'document.download_failed','document.metadata_update_failed','document.scan_blocked',
  'document.scan_unavailable','document.replace_failed','document.storage_cleanup_failed',
  'document.delete_failed','document.list_failed','document.upload_failed',
  'document.security_event_failed','auth.sign_in_validation_failed','auth.sign_up_validation_failed',
  'auth.sign_up_failed','health.database_failed','deal.notification_failed',
  'deal.financial_access_failed','pilot.telemetry_failed','pilot.feedback_failed',
  'security.origin_rejected','monitor.synthetic_delivery_test',
]);
export async function sendSentryEvent(event: string, options: {
  dsn?: string; fetchImpl?: typeof fetch; environment?: string; release?: string;
} = {}): Promise<'disabled' | 'sent'> {
  const dsn = options.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) return 'disabled';
  const url = new URL(dsn);
  if (url.protocol !== 'https:' || !/^o\d+\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(url.hostname)
    || url.port || url.password || url.search || url.hash || !/^[a-f0-9]{32}$/.test(url.username)
    || !/^\/\d+$/.test(url.pathname)) throw new Error('Invalid Sentry configuration');
  const category = allowedEvents.has(event) ? event : 'application.error';
  const id = crypto.randomUUID().replaceAll('-', '');
  const environment = options.environment ?? process.env.VERCEL_ENV;
  const release = options.release ?? process.env.VERCEL_GIT_COMMIT_SHA;
  const payload = JSON.stringify({event_id:id,timestamp:new Date().toISOString(),platform:'javascript',
    level:'error',logger:'crestview',message:category,fingerprint:[category],
    environment:['production','preview','development'].includes(environment ?? '') ? environment : 'unknown',
    ...(/^[a-f0-9]{7,40}$/.test(release ?? '') ? {release} : {}),
  });
  const body = `${JSON.stringify({event_id:id,dsn,sent_at:new Date().toISOString()})}\n${JSON.stringify({type:'event',length:new TextEncoder().encode(payload).length})}\n${payload}\n`;
  const response = await (options.fetchImpl ?? fetch)(`https://${url.host}/api${url.pathname}/envelope/`, {
    method:'POST',redirect:'error',headers:{'content-type':'application/x-sentry-envelope'},body,
    signal:AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error('Sentry delivery failed');
  return 'sent';
}
