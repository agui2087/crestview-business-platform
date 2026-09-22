import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listingFinancialContextSchema } from './listing-financial-context.ts';
const input={listing_id:'00000000-0000-4000-8000-000000000001',financial_period_start:'',financial_period_end:'',cash_flow_basis:'not_specified',financial_figure_type:'not_specified',financial_context_note:''};
test('listing financial context permits unknown facts without inventing verification',()=>{const result=listingFinancialContextSchema.parse(input);assert.equal(result.financial_period_start,null);assert.equal(result.cash_flow_basis,'not_specified');assert.equal(listingFinancialContextSchema.safeParse({...input,financial_figure_type:'verified'}).success,false);});
test('listing periods require real paired dates in the right order',()=>{
 assert.equal(listingFinancialContextSchema.safeParse({...input,financial_period_start:'2026-01-01'}).success,false);
 assert.equal(listingFinancialContextSchema.safeParse({...input,financial_period_start:'2026-02-30',financial_period_end:'2026-12-31'}).success,false);
 assert.equal(listingFinancialContextSchema.safeParse({...input,financial_period_start:'2026-12-31',financial_period_end:'2026-01-01'}).success,false);
 assert.equal(listingFinancialContextSchema.safeParse({...input,financial_period_start:'2026-01-01',financial_period_end:'2026-06-30',financial_figure_type:'actual'}).success,true);
});
