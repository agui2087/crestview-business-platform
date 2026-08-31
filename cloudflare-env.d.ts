declare global {
  interface CloudflareEnv {
    DB: D1Database;
    DOCUMENTS: R2Bucket;
  }
}

export {};
