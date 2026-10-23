alter table public.connected_devices
  drop constraint connected_devices_device_type_check;

alter table public.connected_devices
  add constraint connected_devices_device_type_check
  check (device_type in ('gait_insoles', 'photo_dial', 'silvercare_watch'));

create unique index connected_devices_user_hardware_idx
on public.connected_devices (user_id, device_type, hardware_id)
where hardware_id is not null;

create table public.watch_health_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null references public.connected_devices (id) on delete cascade,
  boot_session_id text not null check (boot_session_id ~ '^[0-9a-f]{16}$'),
  sequence bigint not null check (sequence between 1 and 4294967295),
  metric_kind text not null check (metric_kind in (
    'heart-rate-bpm', 'step-count', 'cadence-spm', 'gait-symmetry-percent'
  )),
  observed_at timestamptz not null,
  value numeric not null,
  quality_percent smallint not null check (quality_percent between 0 and 100),
  received_at timestamptz not null default now(),
  unique (device_id, boot_session_id, sequence)
);

create index watch_health_events_user_observed_idx
on public.watch_health_events (user_id, observed_at desc);

alter table public.watch_health_events enable row level security;
revoke all on table public.watch_health_events from anon, authenticated;
grant select on table public.watch_health_events to authenticated;

create policy "Users read their own watch health data"
on public.watch_health_events for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.enroll_silvercare_watch(
  p_hardware_id text,
  p_display_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  enrolled_device_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_hardware_id)) not between 1 and 200 then raise exception 'Invalid hardware ID'; end if;
  if char_length(trim(p_display_name)) not between 1 and 100 then raise exception 'Invalid display name'; end if;

  insert into public.connected_devices (
    user_id, device_type, display_name, hardware_id, paired_at, last_seen_at
  ) values (
    current_user_id, 'silvercare_watch', trim(p_display_name), trim(p_hardware_id), now(), now()
  )
  on conflict (user_id, device_type, hardware_id) where hardware_id is not null
  do update set display_name = excluded.display_name, last_seen_at = now()
  returning id into enrolled_device_id;

  return enrolled_device_id;
end;
$$;

create or replace function public.ingest_watch_health_event(
  p_device_id uuid,
  p_boot_session_id text,
  p_sequence bigint,
  p_metric_kind text,
  p_observed_at timestamptz,
  p_value numeric,
  p_quality_percent smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  affected_rows integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.connected_devices
    where id = p_device_id and user_id = current_user_id and device_type = 'silvercare_watch'
  ) then raise exception 'Watch is not enrolled'; end if;
  if p_boot_session_id !~ '^[0-9a-f]{16}$' then raise exception 'Invalid boot session'; end if;
  if p_sequence not between 1 and 4294967295 then raise exception 'Invalid sequence'; end if;
  if p_metric_kind not in ('heart-rate-bpm', 'step-count', 'cadence-spm', 'gait-symmetry-percent') then
    raise exception 'Invalid metric';
  end if;
  if (p_metric_kind = 'heart-rate-bpm' and p_value not between 20 and 250)
    or (p_metric_kind = 'step-count' and p_value not between 0 and 1000000)
    or (p_metric_kind = 'cadence-spm' and p_value not between 0 and 300)
    or (p_metric_kind = 'gait-symmetry-percent' and p_value not between 0 and 100) then
    raise exception 'Metric value outside allowed range';
  end if;
  if p_quality_percent not between 0 and 100 then raise exception 'Invalid quality'; end if;
  if p_observed_at < now() - interval '30 days' or p_observed_at > now() + interval '10 minutes' then
    raise exception 'Observation timestamp outside allowed window';
  end if;

  insert into public.watch_health_events (
    user_id, device_id, boot_session_id, sequence, metric_kind,
    observed_at, value, quality_percent
  ) values (
    current_user_id, p_device_id, p_boot_session_id, p_sequence, p_metric_kind,
    p_observed_at, p_value, p_quality_percent
  ) on conflict (device_id, boot_session_id, sequence) do nothing;
  get diagnostics affected_rows = row_count;

  update public.connected_devices set last_seen_at = now()
  where id = p_device_id and user_id = current_user_id;
  return affected_rows > 0;
end;
$$;

revoke all on function public.enroll_silvercare_watch(text, text) from public, anon;
revoke all on function public.ingest_watch_health_event(uuid, text, bigint, text, timestamptz, numeric, smallint) from public, anon;
grant execute on function public.enroll_silvercare_watch(text, text) to authenticated;
grant execute on function public.ingest_watch_health_event(uuid, text, bigint, text, timestamptz, numeric, smallint) to authenticated;