-- ── Seed: Acme HVAC demo data ─────────────────────────────────────────────────
-- Re-runnable: wipes and regenerates all activity for the Acme HVAC demo
-- client. Spans the trailing 90 days with meaningful volume in the last 30.
--
-- Cohorts are built to exercise every derived lead status
-- (src/lib/lead-status.ts) and the revenue split (src/lib/revenue.ts):
--   i 1..62    won          booked call → completed appointment
--   i 63..117  booked       booked call → confirmed/booked appointment
--   i 118..192 engaged      follow-up/booked call, no live appointment
--                           (118..142 also get a two-way SMS thread)
--   i 193..282 lost         one dead-end call, 15-85 days old
--   i 283..297 new          recent dead-end call (< 14 days)
--   i 298..305 reactivated  dead-end call 45-80d ago + engaged call < 10d ago
--
-- ~25% of calls are flagged after_hours (the vertical's core pitch).
-- Unanswered outcomes (voicemail/hung_up) stay under ~7% so the answer-rate
-- consistency streak (hero band tile 3) has a >90% rate to celebrate.
-- HVAC service types carry realistic estimated_value on ~2/3 of appointments;
-- the rest fall back to avg_ticket_value at read time.
--
-- Run: paste into the Supabase SQL editor, or execute via MCP/psql.

do $$
declare
  cid constant uuid := '8e729b01-3228-4d79-9634-dbc556d883b7';
  firsts constant text[] := array['Marcus','Dana','Theo','Priya','Colin','Renee','Hank','Alicia','Jorge','Bethany','Walt','Simone','Derek','Nadia','Frank','Olivia','Ray','Tess','Victor','June'];
  lasts  constant text[] := array['Bell','Whitfield','Ramirez','Nadar','Fisk','Okafor','Delgado','Marsh','Kim','Prewitt','Sandoval','Cho','Baxter','Ivey','Munoz','Grant','Pham','Ellison','Roark','Sutter','Vega','Holt','Mercer','Quinn','Dietrich'];
  services constant text[] := array['tune_up','repair','install','emergency_repair','maintenance','duct_cleaning'];
  -- realistic HVAC ticket ranges per service (min, max)
  svc_lo constant int[] := array[129, 250, 4500, 400, 150, 300];
  svc_hi constant int[] := array[199, 650, 9000, 900, 300, 500];

  i int;
  contact_id uuid;
  call_id uuid;
  conv_id uuid;
  nm text;
  phone text;
  svc_idx int;
  svc text;
  call_ts timestamptz;
  call2_ts timestamptz;
  dur int;
  outc text;
  senti text;
  ah boolean;
  appt_status text;
  appt_sched timestamptz;
  appt_value numeric;
begin
  -- wipe prior Acme activity (keeps the client + settings rows)
  delete from messages     where client_id = cid;
  delete from appointments where client_id = cid;
  delete from calls        where client_id = cid;
  delete from contacts     where client_id = cid;

  for i in 1..305 loop
    contact_id := gen_random_uuid();
    nm := firsts[1 + (i % 20)] || ' ' || lasts[1 + ((i / 20) % 25)];
    phone := '+1512555' || lpad((1000 + i)::text, 4, '0');
    svc_idx := 1 + (i % 6);
    svc := services[svc_idx];
    ah := random() < 0.25;

    -- ── cohort timing + outcome ────────────────────────────────────────────
    if i <= 62 then -- won
      call_ts := now() - (3 + random() * 72) * interval '1 day';
      outc := 'booked';
      senti := case when random() < 0.8 then 'positive' else 'neutral' end;
    elsif i <= 117 then -- booked
      call_ts := now() - (1 + random() * 29) * interval '1 day';
      outc := 'booked';
      senti := case when random() < 0.7 then 'positive' else 'neutral' end;
    elsif i <= 192 then -- engaged
      call_ts := now() - (1 + random() * 24) * interval '1 day';
      outc := case when random() < 0.6 then 'follow_up_needed' else 'booked' end;
      senti := case when random() < 0.5 then 'positive' else 'neutral' end;
    elsif i <= 282 then -- lost: mostly answered-but-cold (AI answers ~95% of calls)
      call_ts := now() - (15 + random() * 70) * interval '1 day';
      outc := case when i % 10 = 0 then 'voicemail' when i % 10 = 5 then 'hung_up' else 'info_only' end;
      senti := case when outc = 'hung_up' and random() < 0.5 then 'negative' else 'neutral' end;
    elsif i <= 297 then -- new (recent, unresolved)
      call_ts := now() - (random() * 12) * interval '1 day';
      outc := case when i % 5 = 0 then 'voicemail' else 'info_only' end;
      senti := 'neutral';
    else -- reactivated: dormant gap then recent engaged call
      call_ts := now() - (45 + random() * 35) * interval '1 day';
      outc := 'info_only';
      senti := 'neutral';
    end if;

    insert into contacts (id, client_id, phone, full_name, source, first_seen_at, last_seen_at, created_at)
    values (contact_id, cid, phone, nm,
            case when i between 118 and 142 then 'sms'::contact_source else 'inbound_call'::contact_source end,
            call_ts, call_ts, call_ts);

    -- ── first (or only) call ───────────────────────────────────────────────
    dur := case when outc in ('voicemail','hung_up') then 15 + (random() * 45)::int
                else 60 + (random() * 360)::int end;
    call_id := gen_random_uuid();
    insert into calls (id, client_id, contact_id, direction, from_number, to_number,
                       started_at, ended_at, duration_seconds, outcome, intent, sentiment,
                       after_hours, summary, created_at)
    values (call_id, cid, contact_id, 'inbound', phone, '+15125550100',
            call_ts, call_ts + dur * interval '1 second', dur, outc::call_outcome, svc, senti, ah,
            case outc
              when 'booked' then 'Caller needs ' || replace(svc, '_', ' ') || ' service; AI scheduled an appointment and confirmed contact details.'
              when 'follow_up_needed' then 'Caller asked about ' || replace(svc, '_', ' ') || ' pricing and availability; wants a callback to confirm timing.'
              when 'info_only' then 'Caller asked general questions about ' || replace(svc, '_', ' ') || ' service; no booking intent yet.'
              when 'voicemail' then 'Call went to AI voicemail; caller left a brief message about ' || replace(svc, '_', ' ') || '.'
              else 'Caller hung up shortly after connecting.'
            end,
            call_ts);

    -- ── reactivated cohort: second, recent engaged call after the gap ─────
    if i > 297 then
      call2_ts := now() - (1 + random() * 9) * interval '1 day';
      dur := 90 + (random() * 240)::int;
      insert into calls (id, client_id, contact_id, direction, from_number, to_number,
                         started_at, ended_at, duration_seconds, outcome, intent, sentiment,
                         after_hours, summary, created_at)
      values (gen_random_uuid(), cid, contact_id, 'inbound', phone, '+15125550100',
              call2_ts, call2_ts + dur * interval '1 second', dur,
              (case when i % 2 = 0 then 'booked' else 'follow_up_needed' end)::call_outcome,
              svc, 'positive', random() < 0.25,
              'Returning caller — went quiet after an earlier inquiry, now ready to move forward with ' || replace(svc, '_', ' ') || '.',
              call2_ts);
      update contacts set last_seen_at = call2_ts where id = contact_id;
    end if;

    -- ── appointments ───────────────────────────────────────────────────────
    if i <= 62 then -- won: completed job in the past
      appt_sched := call_ts + (1 + random() * 4) * interval '1 day';
      appt_status := 'completed';
    elsif i <= 117 then -- booked: on the calendar, upcoming
      appt_sched := now() + (1 + random() * 13) * interval '1 day';
      appt_status := case when i % 10 < 7 then 'confirmed' else 'booked' end;
    elsif i between 118 and 192 and i % 9 = 0 then -- a few no-shows for realism
      appt_sched := call_ts + (1 + random() * 3) * interval '1 day';
      appt_status := 'no_show';
    elsif i between 193 and 282 and i % 11 = 0 then -- a few cancellations
      appt_sched := call_ts + (1 + random() * 3) * interval '1 day';
      appt_status := 'cancelled';
    else
      appt_status := null;
    end if;

    if appt_status is not null then
      -- ~2/3 carry a realistic per-service value; the rest exercise the
      -- avg-ticket fallback in src/lib/revenue.ts
      appt_value := case when random() < 0.67
        then svc_lo[svc_idx] + round(random() * (svc_hi[svc_idx] - svc_lo[svc_idx]))
        else null end;
      insert into appointments (id, client_id, contact_id, call_id, scheduled_at, duration_minutes,
                                service_type, status, estimated_value, notes, created_at)
      values (gen_random_uuid(), cid, contact_id, call_id, appt_sched,
              case when svc = 'install' then 240 else 60 + (random() * 60)::int end,
              svc, appt_status::appointment_status, appt_value,
              case when appt_status = 'completed' then 'Job completed by field crew.' else null end,
              call_ts + interval '2 minutes');
    end if;

    -- ── two-way SMS threads for a slice of engaged contacts ───────────────
    if i between 118 and 142 then
      conv_id := gen_random_uuid();
      insert into messages (id, client_id, contact_id, conversation_id, direction, body, sent_at, created_at) values
        (gen_random_uuid(), cid, contact_id, conv_id, 'inbound',
         'Hi, do you guys handle ' || replace(svc, '_', ' ') || '? Looking to get something scheduled this week.',
         call_ts + interval '10 minutes', call_ts + interval '10 minutes'),
        (gen_random_uuid(), cid, contact_id, conv_id, 'outbound',
         'Absolutely — we can help with ' || replace(svc, '_', ' ') || '. What day works best for you? We have openings this week.',
         call_ts + interval '12 minutes', call_ts + interval '12 minutes'),
        (gen_random_uuid(), cid, contact_id, conv_id, 'inbound',
         'Great, let me check my schedule and get back to you.',
         call_ts + interval '25 minutes', call_ts + interval '25 minutes');
    end if;
  end loop;
end $$;

-- quick shape report
select 'contacts' as t, count(*) from contacts where client_id = '8e729b01-3228-4d79-9634-dbc556d883b7'
union all select 'calls', count(*) from calls where client_id = '8e729b01-3228-4d79-9634-dbc556d883b7'
union all select 'calls_after_hours', count(*) from calls where client_id = '8e729b01-3228-4d79-9634-dbc556d883b7' and after_hours
union all select 'calls_last_30d', count(*) from calls where client_id = '8e729b01-3228-4d79-9634-dbc556d883b7' and started_at > now() - interval '30 days'
union all select 'appointments', count(*) from appointments where client_id = '8e729b01-3228-4d79-9634-dbc556d883b7'
union all select 'messages', count(*) from messages where client_id = '8e729b01-3228-4d79-9634-dbc556d883b7';
