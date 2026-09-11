import test from "node:test";
import assert from "node:assert/strict";
import { acquisitionProgress, canReviewAcquisitionStep } from "./acquisition-progress.ts";

const items = [["Fit", "Goals"], ["NDA"], ["Closing"], ["Transition"]];
function completed() {
  const statuses: Record<string, string> = {};
  items.forEach((stage, step) => {
    stage.forEach((_, item) => { statuses[`item:${step}:${item}`] = "complete"; });
    statuses[String(step)] = "complete";
    statuses[`decision:${step}`] = "continue";
  });
  return statuses;
}

test("new buyers start at step one; browsing never earns progress", () => {
  const progress = acquisitionProgress(items, {});
  assert.equal(progress.percent, 0);
  assert.equal(progress.nextStep, 0);
  assert.equal(canReviewAcquisitionStep(items, {}, 3), false);
});

test("all ticked tasks cannot reach 100% until every stage review is saved", () => {
  const statuses = completed();
  delete statuses["3"];
  const progress = acquisitionProgress(items, statuses);
  assert.equal(progress.completedItems, 5);
  assert.equal(progress.percent, 88);
  assert.equal(progress.finished, false);
  assert.equal(canReviewAcquisitionStep(items, statuses, 3), true);
  assert.equal(acquisitionProgress(items, completed()).percent, 100);
});

test("skipped work remains next and blocks later reviews without erasing saved work", () => {
  const statuses = completed();
  statuses["0"] = "skipped";
  const before = { ...statuses };
  const progress = acquisitionProgress(items, statuses);
  assert.equal(progress.nextStep, 0);
  assert.equal(progress.finished, false);
  assert.equal(canReviewAcquisitionStep(items, statuses, 1), false);
  assert.equal(canReviewAcquisitionStep(items, statuses, 3), false);
  assert.equal(canReviewAcquisitionStep(items, statuses, 0), true);
  assert.deepEqual(statuses, before);
});

test("reopened tasks or paused decisions reopen the earliest affected stage", () => {
  const statuses = completed();
  statuses["item:1:0"] = "open";
  assert.equal(acquisitionProgress(items, statuses).nextStep, 1);
  assert.equal(canReviewAcquisitionStep(items, statuses, 3), false);
  statuses["item:1:0"] = "complete";
  statuses["decision:2"] = "pause";
  assert.equal(acquisitionProgress(items, statuses).nextStep, 2);
  assert.equal(canReviewAcquisitionStep(items, statuses, 2), false);
});

test("legacy stage flags alone and unknown keys do not falsely complete a checklist", () => {
  assert.equal(acquisitionProgress(items, {"0": "complete", "item:99:0": "complete"}).percent, 0);
  assert.equal(acquisitionProgress([], {}).finished, false);
  for (const step of [-1, 9, NaN, 0.5]) assert.equal(canReviewAcquisitionStep(items, completed(), step), false);
});
