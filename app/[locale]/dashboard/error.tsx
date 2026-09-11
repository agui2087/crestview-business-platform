"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="error-state" role="alert"><span>!</span><h2>We could not complete this request</h2><p>Refresh and review the latest saved information before trying again. Some earlier steps may already have been saved.</p><button className="button button--primary" onClick={reset}>Review saved information</button></div>;
}
