drop function if exists public.complete_onboarding(text, date, text, text, text, text[], text, text, jsonb);
drop table if exists public.medications;

alter table public.profiles
  add column mobility_aid text,
  add column fall_history text,
  add column predictive_insoles_enabled boolean not null default true,
  add column photo_dial_enabled boolean not null default true,
  add column product_setup_completed boolean not null default false;

create table public.photo_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) between 3 and 40),
  relationship text,
  dial_position smallint not null check (dial_position between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dial_position)
);

create table public.connected_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_type text not null check (device_type in ('gait_insoles', 'photo_dial')),
  display_name text not null,
  hardware_id text,
  paired_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.gait_readings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid references public.connected_devices (id) on delete set null,
  recorded_at timestamptz not null,
  cadence_spm numeric(6, 2),
  stride_variability numeric(7, 4),
  symmetry_percent numeric(5, 2),
  fall_risk_score numeric(5, 2) check (fall_risk_score between 0 and 100),
  created_at timestamptz not null default now()
);

create index photo_contacts_user_id_idx on public.photo_contacts (user_id);
create index connected_devices_user_id_idx on public.connected_devices (user_id);
create index gait_readings_user_recorded_idx on public.gait_readings (user_id, recorded_at desc);

alter table public.photo_contacts enable row level security;
alter table public.connected_devices enable row level security;
alter table public.gait_readings enable row level security;

revoke all on table public.photo_contacts from anon, authenticated;
revoke all on table public.connected_devices from anon, authenticated;
revoke all on table public.gait_readings from anon, authenticated;
grant select, insert, update, delete on table public.photo_contacts to authenticated;
grant select, insert, update, delete on table public.connected_devices to authenticated;
grant select on table public.gait_readings to authenticated;

create policy "Users manage their own photo contacts"
on public.photo_contacts for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own devices"
on public.connected_devices for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users read their own gait data"
on public.gait_readings for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.complete_product_onboarding(
  p_full_name text,
  p_date_of_birth date,
  p_phone text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_allergies text[],
  p_medical_notes text,
  p_mobility_aid text,
  p_fall_history text,
  p_predictive_insoles_enabled boolean,
  p_photo_dial_enabled boolean,
  p_terms_version text,
  p_photo_contacts jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (
    id, full_name, date_of_birth, phone, emergency_contact_name,
    emergency_contact_phone, allergies, medical_notes, mobility_aid,
    fall_history, predictive_insoles_enabled, photo_dial_enabled,
    terms_version, terms_accepted_at, onboarding_completed,
    product_setup_completed, updated_at
  ) values (
    current_user_id, trim(p_full_name), p_date_of_birth,
    nullif(trim(p_phone), ''), nullif(trim(p_emergency_contact_name), ''),
    nullif(trim(p_emergency_contact_phone), ''), coalesce(p_allergies, '{}'),
    nullif(trim(p_medical_notes), ''), nullif(trim(p_mobility_aid), ''),
    nullif(trim(p_fall_history), ''), p_predictive_insoles_enabled,
    p_photo_dial_enabled, p_terms_version, now(), true, true, now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    date_of_birth = excluded.date_of_birth,
    phone = excluded.phone,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    allergies = excluded.allergies,
    medical_notes = excluded.medical_notes,
    mobility_aid = excluded.mobility_aid,
    fall_history = excluded.fall_history,
    predictive_insoles_enabled = excluded.predictive_insoles_enabled,
    photo_dial_enabled = excluded.photo_dial_enabled,
    terms_version = excluded.terms_version,
    terms_accepted_at = excluded.terms_accepted_at,
    onboarding_completed = true,
    product_setup_completed = true,
    updated_at = now();

  delete from public.photo_contacts where user_id = current_user_id;

  insert into public.photo_contacts (user_id, name, phone, relationship, dial_position)
  select current_user_id, trim(contact.name), trim(contact.phone),
    nullif(trim(contact.relationship), ''), contact.dial_position
  from jsonb_to_recordset(coalesce(p_photo_contacts, '[]'::jsonb)) as contact(
    name text, phone text, relationship text, dial_position smallint
  );
end;
$$;

revoke all on function public.complete_product_onboarding(text, date, text, text, text, text[], text, text, text, boolean, boolean, text, jsonb) from public, anon;
grant execute on function public.complete_product_onboarding(text, date, text, text, text, text[], text, text, text, boolean, boolean, text, jsonb) to authenticated;