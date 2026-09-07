-- Defense-in-depth authorization for the buyer/broker transaction workspace.
-- RLS decides which rows a user may reach; these triggers also constrain which
-- fields each participant may change and keep all related IDs on the same deal.

create or replace function public.guard_deal_inquiry_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role text := auth.role();
  buyer_changed boolean;
  status_changed boolean;
begin
  if actor_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if actor is null or new.buyer_id <> actor then
      raise exception 'Only the signed-in buyer may create an inquiry';
    end if;
    if not exists (
      select 1 from public.marketplace_listings l
      where l.id = new.listing_id
        and l.broker_id = new.broker_id
        and l.status = 'published'
        and l.broker_id <> actor
    ) then
      raise exception 'Inquiry listing and broker do not match an active listing';
    end if;
    if new.status not in ('submitted','nda_sent')
       or new.financial_access_status <> 'not_requested'
       or new.financial_decided_at is not null then
      raise exception 'A new inquiry must begin at the request or automated-NDA stage';
    end if;
    if new.status = 'nda_sent' and not exists (
      select 1
      from public.listing_nda_templates t
      where t.listing_id = new.listing_id
        and t.broker_id = new.broker_id
        and t.auto_send = true
        and t.broker_attested = true
    ) then
      raise exception 'Automated NDA delivery is not configured for this listing';
    end if;
    return new;
  end if;

  if new.id <> old.id
     or new.listing_id <> old.listing_id
     or new.buyer_id <> old.buyer_id
     or new.broker_id <> old.broker_id
     or new.created_at <> old.created_at then
    raise exception 'Deal ownership fields are immutable';
  end if;

  if actor = old.buyer_id then
    if (to_jsonb(new) - array[
          'status', 'requested_items', 'financial_access_status',
          'financial_request_message', 'financial_request_timeline',
          'financial_request_capital', 'financial_requested_at', 'updated_at'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'status', 'requested_items', 'financial_access_status',
          'financial_request_message', 'financial_request_timeline',
          'financial_request_capital', 'financial_requested_at', 'updated_at'
        ]) then
      raise exception 'Buyers may only update their request details';
    end if;

    status_changed := new.status is distinct from old.status;
    buyer_changed := new.financial_access_status is distinct from old.financial_access_status
      or new.requested_items is distinct from old.requested_items
      or new.financial_request_message is distinct from old.financial_request_message
      or new.financial_request_timeline is distinct from old.financial_request_timeline
      or new.financial_request_capital is distinct from old.financial_request_capital
      or new.financial_requested_at is distinct from old.financial_requested_at;

    if status_changed then
      if buyer_changed
         or old.status <> 'nda_sent'
         or new.status <> 'nda_signed'
         or not exists (
           select 1 from public.deal_ndas n
           where n.inquiry_id = old.id and n.buyer_id = actor and n.status = 'signed'
         ) then
        raise exception 'Buyer deal-stage transition is not allowed';
      end if;
    elsif buyer_changed then
      if new.financial_access_status <> 'requested'
         or new.status not in ('nda_signed','document_review','meeting','offer')
         or not exists (
           select 1 from public.deal_ndas n
           where n.inquiry_id = old.id and n.buyer_id = actor and n.status = 'signed'
         ) then
        raise exception 'Financial access requires a signed NDA';
      end if;
    end if;
  elsif actor = old.broker_id then
    if (to_jsonb(new) - array[
          'status', 'financial_access_status', 'financial_decided_at', 'updated_at'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'status', 'financial_access_status', 'financial_decided_at', 'updated_at'
        ]) then
      raise exception 'Brokers may only update deal decisions and stage';
    end if;
    if new.financial_access_status is distinct from old.financial_access_status
       and new.financial_access_status not in ('more_information','approved','declined') then
      raise exception 'Broker financial-access decision is not allowed';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'submitted' and new.status in ('screening','approved','declined'))
      or (old.status = 'screening' and new.status in ('approved','declined'))
      or (
        old.status in ('submitted','screening','approved')
        and new.status = 'nda_sent'
        and exists (
          select 1 from public.deal_ndas n
          where n.inquiry_id = old.id and n.broker_id = actor and n.status = 'sent'
        )
      )
      or (old.status = 'approved' and new.status = 'declined')
      or (old.status = 'declined' and new.status = 'screening')
      or (old.status = 'nda_sent' and new.status = 'declined')
      or (old.status = 'nda_signed' and new.status in ('document_review','meeting','declined'))
      or (old.status = 'document_review' and new.status in ('meeting','offer','declined'))
      or (old.status = 'meeting' and new.status in ('document_review','offer','declined'))
      or (old.status = 'offer' and new.status in ('document_review','closed','declined'))
    ) then
      raise exception 'Broker deal-stage transition is not allowed';
    end if;
  else
    raise exception 'Only deal participants may update an inquiry';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_deal_inquiry_write on public.deal_inquiries;
create trigger guard_deal_inquiry_write
before insert or update on public.deal_inquiries
for each row execute function public.guard_deal_inquiry_write();

drop policy if exists "buyers create inquiries" on public.deal_inquiries;
create policy "buyers create verified inquiries" on public.deal_inquiries
  for insert with check (
    buyer_id = auth.uid()
    and broker_id <> auth.uid()
    and exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id
        and l.broker_id = deal_inquiries.broker_id
        and l.status = 'published'
    )
  );

drop policy if exists "participants update inquiries" on public.deal_inquiries;
create policy "buyers update own inquiry requests" on public.deal_inquiries
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "brokers update own inquiry decisions" on public.deal_inquiries
  for update using (broker_id = auth.uid()) with check (broker_id = auth.uid());

drop policy if exists "participants send messages" on public.deal_messages;
create policy "participants send messages to counterpart" on public.deal_messages
  for insert with check (
    sender_id = auth.uid()
    and sender_id <> recipient_id
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (
          (i.buyer_id = auth.uid() and recipient_id = i.broker_id)
          or (i.broker_id = auth.uid() and recipient_id = i.buyer_id)
        )
    )
  );
revoke update on public.deal_messages from authenticated;

create or replace function public.guard_deal_nda_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if auth.role() = 'service_role' then return new; end if;

  if not exists (
    select 1 from public.deal_inquiries i
    where i.id = new.inquiry_id
      and i.buyer_id = new.buyer_id
      and i.broker_id = new.broker_id
  ) then
    raise exception 'NDA participants do not match the inquiry';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.inquiry_id <> old.inquiry_id
       or new.buyer_id <> old.buyer_id or new.broker_id <> old.broker_id
       or new.created_at <> old.created_at then
      raise exception 'NDA ownership fields are immutable';
    end if;

    if actor = old.buyer_id then
      if (to_jsonb(new) - array[
            'status', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ])
         is distinct from
         (to_jsonb(old) - array[
            'status', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ])
         or old.status not in ('sent','viewed')
         or new.status <> 'signed'
         or new.signed_at is null
         or nullif(trim(new.signer_name), '') is null then
        raise exception 'Buyer may only sign the delivered NDA';
      end if;
    elsif actor = old.broker_id then
      if (to_jsonb(new) - array[
            'document_name', 'storage_path', 'template_body', 'template_version',
            'status', 'sent_at', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ])
         is distinct from
         (to_jsonb(old) - array[
            'document_name', 'storage_path', 'template_body', 'template_version',
            'status', 'sent_at', 'signed_at', 'signer_name', 'signer_ip_hash',
            'signature_record', 'document_fingerprint'
          ]) then
        raise exception 'Broker NDA update is not allowed';
      end if;
    else
      raise exception 'Only NDA participants may update it';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deal_nda_write on public.deal_ndas;
create trigger guard_deal_nda_write
before insert or update on public.deal_ndas
for each row execute function public.guard_deal_nda_write();

drop policy if exists "nda participants update" on public.deal_ndas;
create policy "buyers sign own nda" on public.deal_ndas
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "brokers update own nda" on public.deal_ndas
  for update using (broker_id = auth.uid()) with check (broker_id = auth.uid());

drop policy if exists "brokers manage room documents" on public.deal_room_documents;
create policy "brokers manage verified room documents" on public.deal_room_documents
  for all using (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  ) with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id and i.broker_id = auth.uid()
    )
  );

create or replace function public.guard_deal_room_document_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'UPDATE' and (
    new.id <> old.id or new.inquiry_id <> old.inquiry_id
    or new.uploaded_by <> old.uploaded_by or new.created_at <> old.created_at
  ) then
    raise exception 'Deal-room document ownership fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_deal_room_document_write on public.deal_room_documents;
create trigger guard_deal_room_document_write
before update on public.deal_room_documents
for each row execute function public.guard_deal_room_document_write();

create or replace function public.guard_document_request_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.id <> old.id or new.inquiry_id <> old.inquiry_id
     or new.requested_by <> old.requested_by or new.item_name <> old.item_name
     or new.note is distinct from old.note or new.created_at <> old.created_at then
    raise exception 'Document-request identity and buyer request are immutable';
  end if;
  if new.document_id is not null and not exists (
    select 1 from public.deal_room_documents d
    where d.id = new.document_id and d.inquiry_id = new.inquiry_id
  ) then
    raise exception 'Fulfillment document must belong to the same inquiry';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_document_request_update on public.deal_document_requests;
create trigger guard_document_request_update
before update on public.deal_document_requests
for each row execute function public.guard_document_request_update();

drop policy if exists "notifications self read update delete" on public.marketplace_notifications;
create policy "notifications self read" on public.marketplace_notifications
  for select using (user_id = auth.uid());
create policy "notifications self update" on public.marketplace_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications self delete" on public.marketplace_notifications
  for delete using (user_id = auth.uid());

drop policy if exists "participants create notifications" on public.marketplace_notifications;
create policy "participants notify counterpart" on public.marketplace_notifications
  for insert with check (
    user_id <> auth.uid()
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (
          (i.buyer_id = auth.uid() and user_id = i.broker_id)
          or (i.broker_id = auth.uid() and user_id = i.buyer_id)
        )
    )
  );

drop policy if exists "participants create status events" on public.deal_status_events;
create policy "participants create verified status events" on public.deal_status_events
  for insert with check (
    actor_id = auth.uid()
    and to_status in ('submitted','screening','approved','declined','nda_sent','nda_signed','document_review','meeting','offer','closed')
    and exists (
      select 1 from public.deal_inquiries i
      where i.id = inquiry_id
        and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
    )
  );

drop policy if exists "participants create audit events" on public.marketplace_audit_events;
create policy "participants create scoped audit events" on public.marketplace_audit_events
  for insert with check (
    actor_id = auth.uid()
    and (inquiry_id is not null or listing_id is not null)
    and (
      inquiry_id is null
      or exists (
        select 1 from public.deal_inquiries i
        where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
      )
    )
    and (
      listing_id is null
      or exists (
        select 1 from public.marketplace_listings l
        where l.id = listing_id and l.broker_id = auth.uid()
      )
    )
  );

drop policy if exists "users create reports" on public.marketplace_reports;
create policy "users create scoped reports" on public.marketplace_reports
  for insert with check (
    reporter_id = auth.uid()
    and status = 'open'
    and resolved_at is null
    and (listing_id is not null or inquiry_id is not null)
    and (
      listing_id is null
      or exists (
        select 1 from public.marketplace_listings l
        where l.id = listing_id and (l.status = 'published' or l.broker_id = auth.uid())
      )
    )
    and (
      inquiry_id is null
      or exists (
        select 1 from public.deal_inquiries i
        where i.id = inquiry_id and (i.buyer_id = auth.uid() or i.broker_id = auth.uid())
      )
    )
  );

-- These server-only vault tables intentionally remain inaccessible to browser
-- roles. The application accesses them through the service role after verifying
-- the immutable Supabase user UUID.
revoke all on public.vault_documents from anon, authenticated;
revoke all on public.vault_document_activity from anon, authenticated;
