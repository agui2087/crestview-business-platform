create function public.advance_my_broker_inquiry(p_inquiry uuid,p_expected timestamptz,p_status text,p_reason text default '',p_closed_confirmed boolean default false,p_locale text default 'en') returns void
language plpgsql security invoker set search_path=public as $$
declare item public.deal_inquiries; reason text:=trim(coalesce(p_reason,''));
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into item from public.deal_inquiries where id=p_inquiry and broker_id=auth.uid() for update;
 if not found then raise exception 'Inquiry unavailable'; end if;
 if p_expected is distinct from item.updated_at then raise exception 'Stage changed; refresh first'; end if;
 if p_locale is null or p_locale not in('en','es') or length(reason)>1000 or (length(reason)>0 and length(reason)<10) then raise exception 'Invalid explanation'; end if;
 if p_status='declined' and length(reason)<10 then raise exception 'Explain the decline'; end if;
 if p_status='closed' and p_closed_confirmed is not true then raise exception 'Confirm external closing'; end if;
 if p_status is null or not coalesce(case item.status
 when 'submitted' then p_status in('screening','approved','declined')
 when 'screening' then p_status in('approved','declined')
 when 'approved' then p_status='declined'
 when 'declined' then p_status='screening'
 when 'nda_sent' then p_status='declined'
 when 'nda_signed' then p_status in('document_review','meeting','declined')
 when 'document_review' then p_status in('meeting','offer','declined')
 when 'meeting' then p_status in('document_review','offer','declined')
 when 'offer' then p_status in('document_review','closed','declined')
 else false end,false) then raise exception 'Stage transition not allowed'; end if;
 update public.deal_inquiries set status=p_status,updated_at=now() where id=item.id;
 insert into public.deal_status_events(inquiry_id,actor_id,from_status,to_status,note) values(item.id,auth.uid(),item.status,p_status,nullif(reason,''));
 if reason<>'' then insert into public.deal_messages(inquiry_id,sender_id,recipient_id,body) values(item.id,auth.uid(),item.buyer_id,reason); end if;
 insert into public.marketplace_notifications(user_id,inquiry_id,kind,title,body,href) values(item.buyer_id,item.id,'status',case when p_locale='es' then 'Etapa del trato actualizada' else 'Deal status updated' end,case when p_locale='es' then 'Revisa la etapa y la explicación en la conversación.' else 'Review the updated stage and explanation in the conversation.' end,'/'||p_locale||'/dashboard/deals/'||item.id);
end;$$;
revoke all on function public.advance_my_broker_inquiry(uuid,timestamptz,text,text,boolean,text) from public,anon;
grant execute on function public.advance_my_broker_inquiry(uuid,timestamptz,text,text,boolean,text) to authenticated;
