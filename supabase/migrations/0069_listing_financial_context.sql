alter table public.marketplace_listings
 add column financial_period_start date,
 add column financial_period_end date,
 add column cash_flow_basis text not null default 'not_specified' check(cash_flow_basis in('not_specified','sde','ebitda','net_income','operating_cash_flow')),
 add column financial_figure_type text not null default 'not_specified' check(financial_figure_type in('not_specified','actual','projected','mixed')),
 add column financial_context_note text not null default '' check(length(financial_context_note)<=1000),
 add constraint listing_financial_period_complete check((financial_period_start is null)=(financial_period_end is null)),
 add constraint listing_financial_period_order check(financial_period_start<=financial_period_end);
