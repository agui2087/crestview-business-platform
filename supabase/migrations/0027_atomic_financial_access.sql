-- One transaction for the decision/request and all mandatory evidence.
-- SECURITY INVOKER intentionally preserves existing RLS and write guards.
create or replace function public.change_deal_financial_access(
  target_inquiry uuid,
  action text,
  expected_updated_at timestamptz,
  request_message text default null,
  request_timeline text default null,
  request_capital text default null,
  request_items text[] default '{}'::text[],
  locale text default 'en'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  inquiry public.deal_inquiries%rowtype;
  next_status text;
  recipient uuid;
  event_note text;
  event_title text;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if action is null or action not in ('requested','approved','declined','more_information')
     or locale is null or locale not in ('en','es') then
    raise exception 'Invalid financial access action' using errcode = '22023';
  end if;

  -- Lock before checking the supplied version: a stale browser must not
  -- overwrite a decision or a deal-stage change made in another session.
  select * into inquiry from public.deal_inquiries
    where id = target_inquiry for update;
  if not found or actor not in (inquiry.buyer_id, inquiry.broker_id) then
    raise exception 'Deal unavailable' using errcode = '42501';
  end if;
  if expected_updated_at is null or inquiry.updated_at <> expected_updated_at then
    raise exception 'Deal changed; refresh before retrying' using errcode = '40001';
  end if;
  if inquiry.status not in ('nda_signed','document_review','meeting','offer')
     or not exists (
       select 1 from public.deal_ndas n where n.inquiry_id = inquiry.id
         and n.buyer_id = inquiry.buyer_id and n.broker_id = inquiry.broker_id
         and n.status = 'signed'
     ) then
    raise exception 'Signed NDA required' using errcode = '42501';
  end if;

  next_status := inquiry.status;
  if action = 'requested' then
    if actor <> inquiry.buyer_id then
      raise exception 'Only the buyer may request access' using errcode = '42501';
    end if;
    -- Do not revoke approved access or silently duplicate a pending request.
    if inquiry.financial_access_status not in ('not_requested','more_information','declined') then
      raise exception 'Financial request is already pending or approved' using errcode = '40001';
    end if;
    if request_message is null or length(trim(request_message)) not between 20 and 3000
       or request_timeline is null or length(trim(request_timeline)) not between 2 and 120
       or request_capital is null or length(trim(request_capital)) not between 2 and 160
       or request_items is null or cardinality(request_items) > 12
       or exists (select 1 from unnest(request_items) item where item is null or length(item) > 200) then
      raise exception 'Invalid financial request details' using errcode = '22023';
    end if;
    update public.deal_inquiries set
      financial_access_status = action,
      financial_request_message = trim(request_message),
      financial_request_timeline = trim(request_timeline),
      financial_request_capital = trim(request_capital),
      financial_requested_at = clock_timestamp(), requested_items = request_items,
      updated_at = clock_timestamp()
    where id = target_inquiry;
    recipient := inquiry.broker_id;
    event_title := 'Financial access requested';
    event_note := 'Buyer requested broker approval for confidential financial information.';
  else
    if actor <> inquiry.broker_id then
      raise exception 'Only the broker may decide access' using errcode = '42501';
    end if;
    if inquiry.financial_access_status <> 'requested' then
      raise exception 'No pending financial request' using errcode = '40001';
    end if;
    -- Approval must not move a meeting/offer backwards to document review.
    if action = 'approved' and inquiry.status = 'nda_signed' then
      next_status := 'document_review';
    end if;
    update public.deal_inquiries set financial_access_status = action,
      financial_decided_at = clock_timestamp(), status = next_status,
      updated_at = clock_timestamp() where id = target_inquiry;
    recipient := inquiry.buyer_id;
    event_title := case action when 'approved' then 'Financial access approved'
      when 'declined' then 'Financial access declined' else 'More information requested' end;
    event_note := case action
      when 'approved' then 'Broker approved access to permission-controlled financial documents.'
      when 'declined' then 'Broker declined financial-document access.'
      else 'Broker requested more information before deciding financial access.' end;
  end if;
  if not found then
    raise exception 'Deal update was not permitted' using errcode = '42501';
  end if;

  insert into public.marketplace_notifications (user_id, inquiry_id, kind, title, body, href)
    values (recipient, target_inquiry,
      case when action = 'requested' then 'financial_request' else 'financial_decision' end,
      event_title, event_note, '/' || locale || '/dashboard/deals/' || target_inquiry::text);
  insert into public.deal_status_events (inquiry_id, actor_id, from_status, to_status, note)
    values (target_inquiry, actor, inquiry.status, next_status, event_note);
  insert into public.marketplace_audit_events (actor_id, inquiry_id, event_type, details)
    values (actor, target_inquiry,
      case when action = 'requested' then 'financial_access_requested' else 'financial_access_decided' end,
      jsonb_build_object('decision', action));
  -- Any exception rolls back every statement above. Do not catch and suppress.
end;
$$;

revoke all on function public.change_deal_financial_access(uuid,text,timestamptz,text,text,text,text[],text) from public, anon;
grant execute on function public.change_deal_financial_access(uuid,text,timestamptz,text,text,text,text[],text) to authenticated;
