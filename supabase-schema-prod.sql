-- ENUM
create type rack_type as enum ('full','half','stand');

-- TABLES

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'coach')),
  created_at timestamptz default now()
);

create table sides (
  id bigserial primary key,
  key text unique not null, -- 'Power' | 'Base'
  name text not null
);

create table racks (
  id bigserial primary key,
  side_id bigint references sides(id) on delete cascade,
  number int not null,
  type rack_type not null,
  zone text,
  unique (side_id, number)
);

create table areas (
  id bigserial primary key,
  side_id bigint references sides(id) on delete cascade,
  key text not null,
  name text not null,
  unique (side_id, key)
);

create table bookings (
  id bigserial primary key,
  title text not null,
  side_id bigint references sides(id) on delete cascade,
  start_template timestamptz not null,
  end_template timestamptz not null,
  recurrence jsonb,
  areas jsonb not null,
  racks jsonb not null,
  color text,
  created_by uuid references auth.users(id),
  is_locked boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table booking_instances (
  id bigserial primary key,
  booking_id bigint references bookings(id) on delete cascade,
  side_id bigint references sides(id) on delete cascade,
  start timestamptz not null,
  "end" timestamptz not null,
  areas jsonb not null,
  racks jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table bookings enable row level security;
alter table booking_instances enable row level security;

-- POLICIES (fill in from your working dev project!)

-- Example admin policy for bookings:
create policy "admin_bookings_all"
on bookings
for all
using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Example coach policies (match what you already use in dev):
create policy "coach_insert_unlocked_bookings"
on bookings
for insert
with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'coach'
  )
  and is_locked = false
  and created_by = auth.uid()
);

create policy "coach_update_unlocked_bookings"
on bookings
for update
using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'coach'
  )
  and is_locked = false
  and created_by = auth.uid()
)
with check (
  is_locked = false
  and created_by = auth.uid()
);

create policy "coach_delete_unlocked_bookings"
on bookings
for delete
using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'coach'
  )
  and is_locked = false
  and created_by = auth.uid()
);

-- booking_instances policies (similar pattern):
create policy "admin_booking_instances_all"
on booking_instances
for all
using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "coach_select_booking_instances"
on booking_instances
for select
using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('coach','admin')
  )
);

-- you can add more fine-grained coach update/delete policies if needed

-- SEED DATA
insert into sides (key, name)
values ('Power', 'Powerbase Performance'), ('Base', 'Powerbase Base')
on conflict (key) do nothing;
