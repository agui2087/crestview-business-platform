import type Stripe from 'stripe';
import {MAX_WORKFORCE_SEATS} from './workforce-seat-pricing.ts';

/** Only the authenticated customer's single, settled Workforce subscription is editable. */
export function editableWorkforceSubscription(subscriptions: Stripe.Subscription[], customer: string, price: string) {
  const candidates = subscriptions.filter(s => !['canceled', 'incomplete_expired'].includes(s.status) && s.items.data.some(i => i.price.id === price));
  if (candidates.length !== 1) throw new Error('workforce_subscription_unavailable');
  const subscription = candidates[0];
  const invoice = subscription.latest_invoice;
  if (subscription.customer !== customer || subscription.status !== 'active' || subscription.items.data.length !== 1 ||
      subscription.pending_update || subscription.schedule || subscription.cancel_at || subscription.cancel_at_period_end ||
      subscription.pause_collection || subscription.collection_method !== 'charge_automatically' ||
      !invoice || typeof invoice === 'string' || invoice.status !== 'paid') {
    throw new Error('workforce_subscription_unavailable');
  }
  return subscription;
}

export function workforcePortalConfiguration(product: string, price: string): Stripe.BillingPortal.ConfigurationCreateParams {
  return {
    name: 'Crestview Workforce employee changes',
    metadata: {crestview_purpose: 'workforce_seats_v2', crestview_price: price},
    features: {
      payment_method_update: {enabled: true},
      subscription_update: {
        enabled: true, default_allowed_updates: ['quantity'],
        proration_behavior: 'always_invoice', billing_cycle_anchor: 'unchanged',
        products: [{product, prices: [price], adjustable_quantity: {enabled: true, minimum: 1, maximum: MAX_WORKFORCE_SEATS}}],
      },
    },
  };
}

/** Do not silently reuse a dashboard-edited configuration with different billing rules. */
export function matchesWorkforcePortal(config: Stripe.BillingPortal.Configuration, product: string, price: string) {
  const update = config.features.subscription_update;
  const products = update.products;
  const item = products?.[0];
  return config.active && config.metadata?.crestview_purpose === 'workforce_seats_v2' && config.metadata?.crestview_price === price && config.features.payment_method_update.enabled &&
    update.enabled && update.default_allowed_updates.length === 1 && update.default_allowed_updates[0] === 'quantity' &&
    update.proration_behavior === 'always_invoice' && update.billing_cycle_anchor !== 'now' &&
    !update.schedule_at_period_end?.conditions?.length && products?.length === 1 && item?.product === product &&
    item.prices.length === 1 && item.prices[0] === price && item.adjustable_quantity.enabled &&
    item.adjustable_quantity.minimum === 1 && item.adjustable_quantity.maximum === MAX_WORKFORCE_SEATS;
}
