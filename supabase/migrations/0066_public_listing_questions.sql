-- A public-information question starts a conversation, never an NDA or document grant.
create or replace function public.ask_listing_question(target_listing uuid, question text, language text default 'en')
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 actor uuid := auth.uid();
 listing public.marketplace_listings;
 inquiry public.deal_inquiries;
begin
 if actor is null or not exists(select 1 from public.profiles where user_id=actor and 'buyer'=any(account_roles)) then raise exception 'Buyer account required'; end if;
 question := btrim(question);
 if question is null or length(question)<10 or length(question)>5000 then raise exception 'Question must contain 10 to 5000 characters'; end if;
 if language is null or language not in ('en','es') then raise exception 'Invalid language'; end if;
 -- Serialize submissions from one buyer, including cross-listing rate-limit checks.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,66));
 select * into listing from public.marketplace_listings where id=target_listing and status='published';
 if listing.id is null or listing.broker_id=actor then raise exception 'Listing unavailable'; end if;
 select * into inquiry from public.deal_inquiries where listing_id=target_listing and buyer_id=actor;
 if inquiry.id is not null then
  if inquiry.status in ('declined','closed') then raise exception 'This conversation is closed'; end if;
  if exists(select 1 from public.deal_messages where inquiry_id=inquiry.id and sender_id=actor and body=question and created_at>now()-interval '10 minutes') then return inquiry.id; end if;
 end if;
 if (select count(*) from public.deal_messages where sender_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before sending more messages'; end if;
 if inquiry.id is null then
  insert into public.deal_inquiries(listing_id,buyer_id,broker_id,subject,initial_message,requested_items,status)
  values(listing.id,actor,listing.broker_id,'Question about '||listing.title,question,array['Public listing question'],'submitted')
  on conflict(listing_id,buyer_id) do nothing returning * into inquiry;
  if inquiry.id is null then raise exception 'Conversation changed; please try again'; end if;
 end if;
 insert into public.deal_messages(inquiry_id,sender_id,recipient_id,body) values(inquiry.id,actor,listing.broker_id,question);
 insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href)
 values(listing.broker_id,inquiry.id,'message','Listing question','A buyer has a question about public listing information.','/'||language||'/dashboard/deals/'||inquiry.id);
 return inquiry.id;
end;
$$;
revoke all on function public.ask_listing_question(uuid,text,text) from public,anon;
grant execute on function public.ask_listing_question(uuid,text,text) to authenticated;
