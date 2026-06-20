-- Hardened validate_and_mark (server-side only; not exposed to mobile clients).
-- Apply via Supabase SQL editor or tikiti migration 20260501_security_hardening.sql.

create or replace function public.validate_and_mark(qr text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  select id, attendee_name, email, used, event_id, created_at, payment_status
  into t
  from public.tickets
  where qr_code_data = qr
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if coalesce(t.payment_status, '') <> 'paid' then
    return jsonb_build_object('status', 'not_found');
  end if;

  if coalesce(t.used, false) then
    return jsonb_build_object(
      'status', 'already_used',
      'ticket', jsonb_build_object(
        'attendee_name', t.attendee_name,
        'email', t.email,
        'event_id', t.event_id,
        'created_at', t.created_at
      )
    );
  end if;

  update public.tickets set used = true where id = t.id;

  return jsonb_build_object(
    'status', 'valid',
    'ticket', jsonb_build_object(
      'attendee_name', t.attendee_name,
      'email', t.email,
      'event_id', t.event_id,
      'created_at', t.created_at
    )
  );
end;
$$;

revoke execute on function public.validate_and_mark(text) from anon, authenticated, public;
