"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main className="error-state" role="alert"><span>!</span><h1>Crestview could not load</h1><p>Please refresh the page. Your saved information remains secure.</p><button onClick={reset}>Try again</button></main></body></html>;
}
