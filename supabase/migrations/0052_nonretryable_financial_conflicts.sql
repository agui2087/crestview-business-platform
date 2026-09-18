-- A stale form is a business conflict, not a retryable serialization failure.
-- Preserve the deployed function and its grants; change only the error code.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.change_deal_financial_access(uuid,text,timestamptz,text,text,text,text[],text)'::regprocedure) into definition;
  execute replace(definition, '''40001''', '''P0001''');
end;
$$;
