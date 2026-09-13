import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {editableWorkforceSubscription, matchesWorkforcePortal, workforcePortalConfiguration} from './workforce-subscription-change.ts';

function subscription(overrides = {}) {
  return {id: 'sub_owned', customer: 'cus_owned', status: 'active', items: {data: [{id: 'si_owned', price: {id: 'price_workforce'}}]}, latest_invoice: {status: 'paid'}, collection_method: 'charge_automatically', ...overrides} as unknown as Stripe.Subscription;
}
test('Workforce subscription editing only selects the authenticated customer and configured price', () => {
  assert.equal(editableWorkforceSubscription([subscription()], 'cus_owned', 'price_workforce').id, 'sub_owned');
  for (const list of [[], [subscription(), subscription()], [subscription({customer: 'cus_other'})], [subscription({items: {data: [{price: {id: 'price_pro'}}]}})]]) {
    assert.throws(() => editableWorkforceSubscription(list, 'cus_owned', 'price_workforce'));
  }
});
test('Workforce edits reject unpaid, ambiguous, scheduled and pending subscriptions', () => {
  for (const overrides of [
    ...['past_due','unpaid','incomplete','trialing','paused','canceled','incomplete_expired'].map(status => ({status})),
    {pending_update: {}}, {schedule: 'sched_1'}, {cancel_at: 123}, {cancel_at_period_end: true},
    {pause_collection: {}}, {collection_method: 'send_invoice'}, {latest_invoice: null}, {latest_invoice: 'in_unexpanded'},
    ...['open','draft','void','uncollectible'].map(status => ({latest_invoice: {status}})),
    {items: {data: [{price: {id: 'price_workforce'}}, {price: {id: 'price_other'}}]}},
  ]) assert.throws(() => editableWorkforceSubscription([subscription(overrides)], 'cus_owned', 'price_workforce'));
});
test('Workforce portal is quantity-only, prorated and scoped to its configured price', () => {
  const config = {...workforcePortalConfiguration('prod_workforce', 'price_workforce'), active: true} as Stripe.BillingPortal.Configuration;
  assert.equal(matchesWorkforcePortal(config, 'prod_workforce', 'price_workforce'), true);
  for (const mutate of [
    (c: typeof config) => {c.active = false;},
    (c: typeof config) => {c.features.payment_method_update.enabled = false;},
    (c: typeof config) => {c.features.subscription_update.default_allowed_updates.push('price');},
    (c: typeof config) => {c.features.subscription_update.proration_behavior = 'none';},
    (c: typeof config) => {c.features.subscription_update.billing_cycle_anchor = 'now';},
    (c: typeof config) => {c.features.subscription_update.products![0].prices = ['price_other'];},
    (c: typeof config) => {c.features.subscription_update.products![0].adjustable_quantity.minimum = 0;},
    (c: typeof config) => {c.features.subscription_update.schedule_at_period_end = {conditions: [{type: 'decreasing_item_amount'}]};},
  ]) { const changed = structuredClone(config); mutate(changed); assert.equal(matchesWorkforcePortal(changed, 'prod_workforce', 'price_workforce'), false); }
});
