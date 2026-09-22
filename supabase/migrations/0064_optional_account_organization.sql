-- New buyers need not own a company already. Do not invent one for them.
-- Existing values are deliberately preserved.
alter table public.profiles alter column organization_name drop default;
