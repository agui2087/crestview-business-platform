declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    DOCUMENTS: R2Bucket;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
