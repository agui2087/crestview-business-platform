/**
 * Checklist progress is self-reported work, not purchase/escrow confirmation.
 * Keep the existing stored keys so older workspaces retain all their work.
 */
export function acquisitionProgress(
  items: readonly (readonly string[])[],
  statuses: Readonly<Record<string, string>>,
) {
  const itemCounts = items.map((stage, step) =>
    stage.filter((_, item) => statuses[`item:${step}:${item}`] === "complete").length,
  );
  const complete = items.map((stage, step) =>
    stage.length > 0 && itemCounts[step] === stage.length &&
    statuses[String(step)] === "complete" && statuses[`decision:${step}`] === "continue",
  );
  const completedSteps = complete.filter(Boolean).length;
  const completedItems = itemCounts.reduce((sum, count) => sum + count, 0);
  const totalItems = items.reduce((sum, stage) => sum + stage.length, 0);
  const nextStep = complete.findIndex((done) => !done);
  // Include the saved stage reviews, not just ticks: all tasks ticked is not 100%.
  const total = totalItems + items.length;
  const finished = items.length > 0 && nextStep === -1;
  const percent = finished ? 100 : Math.min(99, total ? Math.floor((completedItems + completedSteps) / total * 100) : 0);
  return { complete, completedSteps, completedItems, totalItems, nextStep, percent, finished };
}

export function canReviewAcquisitionStep(
  items: readonly (readonly string[])[],
  statuses: Readonly<Record<string, string>>,
  step: number,
) {
  if (!Number.isInteger(step) || step < 0 || step >= items.length || !items[step].length) return false;
  const progress = acquisitionProgress(items, statuses);
  return progress.complete.slice(0, step).every(Boolean) &&
    items[step].every((_, item) => statuses[`item:${step}:${item}`] === "complete") &&
    statuses[`decision:${step}`] === "continue";
}
