-- NBD education platform: core schema.
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Each brand is a sequence of ordered steps you build manually from the
-- admin panel — any mix of video / quiz / certificate steps, in any order
-- (e.g. video, video, quiz, video, quiz, certificate). A customer must
-- complete each step before the next one unlocks.

create extension if not exists pgcrypto;

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists brand_steps (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  type text not null check (type in ('video', 'quiz', 'certificate')),
  title text not null,
  video_url text,
  duration text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references brand_steps(id) on delete cascade,
  text text not null,
  options jsonb not null,
  correct_index int not null,
  order_index int not null default 0
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  customer_number text unique,
  main_contact_name text not null,
  main_contact_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  approved_brand_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Named app_users (not "users") to stay clear of Supabase's own auth.users table.
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('holder', 'staff')),
  auth_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Deliberately its own table, not a role flag on app_users — admin access
-- should be a distinct, more tightly controlled account per the build plan.
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  auth_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A row here just means "this user completed this step." Absence of a row
-- means locked/not-yet-reached — computed from step order, not stored.
create table if not exists step_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  step_id uuid not null references brand_steps(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, step_id)
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  google_drive_file_id text,
  issued_at timestamptz not null default now(),
  unique (user_id, brand_id)
);

create index if not exists brand_steps_brand_id_idx on brand_steps(brand_id);
create index if not exists quiz_questions_step_id_idx on quiz_questions(step_id);
create index if not exists app_users_account_id_idx on app_users(account_id);
create index if not exists step_progress_user_id_idx on step_progress(user_id);
create index if not exists certificates_user_id_idx on certificates(user_id);
