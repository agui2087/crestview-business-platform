import { z } from "zod";
const date = z.string().transform(value=>value.trim()||null).pipe(z.string().date().nullable());
export const listingFinancialContextSchema = z.object({
 listing_id:z.string().uuid(),
 financial_period_start:date,
 financial_period_end:date,
 cash_flow_basis:z.enum(['not_specified','sde','ebitda','net_income','operating_cash_flow']),
 financial_figure_type:z.enum(['not_specified','actual','projected','mixed']),
 financial_context_note:z.string().trim().max(1000),
}).refine(value=>(value.financial_period_start===null)===(value.financial_period_end===null),{message:'Provide both period dates or leave both blank.'})
 .refine(value=>!value.financial_period_start||!value.financial_period_end||value.financial_period_start<=value.financial_period_end,{message:'The period must end on or after its start.'});
export const cashFlowLabels = {
 not_specified:['Basis not provided','Base no indicada'],sde:['SDE (seller discretionary earnings)','SDE (beneficio discrecional del vendedor)'],ebitda:['EBITDA','EBITDA'],net_income:['Net income','Beneficio neto'],operating_cash_flow:['Operating cash flow','Flujo de caja operativo'],
} as const;
export const figureTypeLabels = {not_specified:['Actual/projected not provided','Real/proyectado no indicado'],actual:['Reported actual figures','Cifras reales declaradas'],projected:['Projected figures','Cifras proyectadas'],mixed:['Mixed actual and projected figures','Cifras reales y proyectadas combinadas']} as const;
