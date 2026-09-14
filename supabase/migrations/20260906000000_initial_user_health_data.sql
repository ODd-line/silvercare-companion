create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  date_of_birth date,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text[] not null default '{}',
  medical_notes text,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  dosage text not null check (char_length(dosage) between 1 and 120),
  instructions text,
  schedule_time time not null,
  days smallint not null default 127 check (days between 1 and 127),
  box_slot smallint not null check (box_slot between 1 and 12),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medications_user_id_idx on public.medications (user_id);

alter table public.profiles enable row level security;
alter table public.medications enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.medications from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.medications to authenticated;

create policy "Users read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users create their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users delete their own profile"
on public.profiles for delete to authenticated
using ((select auth.uid()) = id);

create policy "Users read their own medications"
on public.medications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their own medications"
on public.medications for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own medications"
on public.medications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own medications"
on public.medications for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.complete_onboarding(
  p_full_name text,
  p_date_of_birth date,
  p_phone text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_allergies text[],
  p_medical_notes text,
  p_terms_version text,
  p_medications jsonb
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
    id,
    full_name,
    date_of_birth,
    phone,
    emergency_contact_name,
    emergency_contact_phone,
    allergies,
    medical_notes,
    terms_version,
    terms_accepted_at,
    onboarding_completed,
    updated_at
  ) values (
    current_user_id,
    trim(p_full_name),
    p_date_of_birth,
    nullif(trim(p_phone), ''),
    nullif(trim(p_emergency_contact_name), ''),
    nullif(trim(p_emergency_contact_phone), ''),
    coalesce(p_allergies, '{}'),
    nullif(trim(p_medical_notes), ''),
    p_terms_version,
    now(),
    true,
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    date_of_birth = excluded.date_of_birth,
    phone = excluded.phone,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    allergies = excluded.allergies,
    medical_notes = excluded.medical_notes,
    terms_version = excluded.terms_version,
    terms_accepted_at = excluded.terms_accepted_at,
    onboarding_completed = true,
    updated_at = now();

  delete from public.medications where user_id = current_user_id;

  insert into public.medications (
    user_id,
    name,
    dosage,
    instructions,
    schedule_time,
    days,
    box_slot
  )
  select
    current_user_id,
    trim(medicine.name),
    trim(medicine.dosage),
    nullif(trim(medicine.instructions), ''),
    medicine.schedule_time,
    medicine.days,
    medicine.box_slot
  from jsonb_to_recordset(coalesce(p_medications, '[]'::jsonb)) as medicine(
    name text,
    dosage text,
    instructions text,
    schedule_time time,
    days smallint,
    box_slot smallint
  );
end;
$$;

revoke all on function public.complete_onboarding(text, date, text, text, text, text[], text, text, jsonb) from public, anon;
grant execute on function public.complete_onboarding(text, date, text, text, text, text[], text, text, jsonb) to authenticated;