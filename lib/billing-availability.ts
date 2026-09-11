/** Keep undelivered paid products unavailable at both UI and server boundaries.
 * Enable another product only after its allocation, fulfillment, expiry and refund
 * paths have passed isolated end-to-end tests. Existing purchases are not revoked.
 */
const availableProducts = new Set([
  "broker_plan", "crestview_pro", "workforce",
]);

export function isCheckoutProductAvailable(productCode: string) {
  return availableProducts.has(productCode) || (listingProductsEnabled() && isListingProduct(productCode));
}

export function listingProductsEnabled() {
  return process.env.CRESTVIEW_LISTING_PRODUCTS_ENABLED === 'true';
}

export function isListingProduct(value: string) {
  return ['single_listing','enhanced_visibility','highest_visibility'].includes(value);
}
