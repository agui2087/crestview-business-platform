"use client";

import { useEffect } from "react";

export default function ApplicationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Crestview page error", { digest: error.digest });
  }, [error]);

  return <main className="error-state" role="alert"><span>!</span><h1>Something went wrong</h1><p>Your saved information was not changed. Try loading this page again.</p><button className="button button--primary" onClick={reset}>Try again</button></main>;
}
