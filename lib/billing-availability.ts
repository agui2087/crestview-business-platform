/** Keep undelivered paid products unavailable at both UI and server boundaries.
 * Enable another product only after its allocation, fulfillment, expiry and refund
 * paths have passed isolated end-to-end tests. Existing purchases are not revoked.
 */
const availableProducts = new Set([
  "broker_plan", "crestview_pro", "workforce",
]);

export function isCheckoutProductAvailable(productCode: string) {
  return availableProducts.has(productCode);
}
