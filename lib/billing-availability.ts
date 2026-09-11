/** Keep undelivered paid products unavailable at both UI and server boundaries.
 * Remove a product only after its allocation, fulfillment, expiry and refund
 * paths have passed isolated end-to-end tests. Existing purchases are not revoked.
 */
const pendingDeliveryProducts = new Set([
  "single_listing", "enhanced_visibility", "highest_visibility",
]);

export function isCheckoutProductAvailable(productCode: string) {
  return !pendingDeliveryProducts.has(productCode);
}
