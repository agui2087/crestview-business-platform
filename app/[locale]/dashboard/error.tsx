"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="error-state" role="alert"><span>!</span><h2>This page could not be loaded</h2><p>Your saved data was not changed. Check your connection and try again.</p><button className="button button--primary" onClick={reset}>Try again</button></div>;
}
