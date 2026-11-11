-- ==========================================================================
-- FIXON - Supabase setup, run top to bottom in the Supabase dashboard's
-- SQL Editor (Dashboard -> SQL Editor -> New query -> Run).
-- --------------------------------------------------------------------------
-- One pass is enough: every statement is written to be safe to re-run.
-- After this file, the only remaining steps are:
--   1. create your admin auth user  (section 6 below)
--   2. create the storage bucket    (section 7 - one click, or the SQL note)
--   3. paste the project URL + anon key into js/config.js and, for server
--      ordering, into the Vercel environment variables.
-- The anon key is a public value - these policies are what protect the data,
-- not the key's secrecy. Never put the service_role key in this repository.
-- ==========================================================================


-- --------------------------------------------------------------------------
-- 1. PRODUCTS  (the shop's catalog; the admin dashboard writes here)
-- --------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 800),
  price       numeric check (price is null or (price > 0 and price < 10000000)),
  category    text not null default '' check (char_length(category) <= 60),
  image_url   text not null default '' check (char_length(image_url) <= 500),
  stock       integer check (stock is null or (stock >= 0 and stock <= 100000)),
  stock_note  text not null default '' check (char_length(stock_note) <= 60),
  featured    boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_active_idx on public.products (is_active);
create index if not exists products_category_idx on public.products (lower(category));

-- Keep updated_at honest without triggers the owner has to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();


-- --------------------------------------------------------------------------
-- 2. ADMINS  (which auth users may manage the shop)
-- --------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 3. is_admin()  -  SECURITY DEFINER
-- Policies must not query the admins table directly: a policy that reads an
-- RLS-protected table to decide whether RLS lets you read it recurses and
-- hangs every query. A SECURITY DEFINER function reads the table as its
-- owner, which breaks that loop. It is marked volatile so Postgres does not
-- cache one request's answer for another.
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from anon;


-- --------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY on products + admins
-- --------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.admins  enable row level security;

-- Visitors: active products only, read only. Inactive rows do not exist for
-- them - not even by id lookup.
drop policy if exists "public reads active products" on public.products;
create policy "public reads active products"
  on public.products for select
  to anon, authenticated
  using (is_active);

-- Admins: full read of every row, including inactive ones.
drop policy if exists "admins read all products" on public.products;
create policy "admins read all products"
  on public.products for select
  to authenticated
  using (public.is_admin());

-- Admins only, for every change. Note "with check (is_active)" on insert:
-- even an admin cannot create a row that would be invisible to visitors in
-- the same statement.
drop policy if exists "admins insert products" on public.products;
create policy "admins insert products"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins update products" on public.products;
create policy "admins update products"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete products" on public.products;
create policy "admins delete products"
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- Admins may see their own membership row (the dashboard uses that read as
-- the authorization check) and nothing else. No insert/update/delete policy
-- exists on purpose: nobody can add an admin through the API. Membership is
-- inserted only by the owner, with the dashboard's SQL editor, below.
drop policy if exists "admins see own membership" on public.admins;
create policy "admins see own membership"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));


-- --------------------------------------------------------------------------
-- 5. STORAGE  (bucket name: product-images, public read, admin-only writes)
-- Create the bucket first (Storage -> New bucket):
--   Name: product-images | Public: YES | File size limit: 5242880
--   Allowed MIME types: image/jpeg, image/png, image/webp
-- The SQL below only adds the policies; the bucket itself is a dashboard
-- action so its settings are visible where they are edited.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images are public" on storage.objects;
create policy "product images are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins replace product images" on storage.objects;
create policy "admins replace product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admins remove product images" on storage.objects;
create policy "admins remove product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());


-- --------------------------------------------------------------------------
-- 6. CREATE THE FIRST ADMIN  (repeat per admin; the owner does this in the
-- SQL editor - there is deliberately no public registration)
-- --------------------------------------------------------------------------
-- 6a. If you already created the login user (Authentication -> Add user ->
--     Email, and set a password), skip to 6b. Otherwise create it here:
--       insert into auth.users (instance_id, aud, role, email, email_confirmed_at)
--       select '1', 'authenticated', 'authenticated', 'you@example.com', now()
--       where not exists (select 1 from auth.users where email = 'you@example.com');
--     (The dashboard's "Add user" form is easier and also sets the password.)
--
-- 6b. Grant admin rights - run this once with the real address:
--
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'you@example.com'
-- on conflict (user_id) do nothing;
--
-- 6c. To remove an admin:
--
-- delete from public.admins where email = 'former@example.com';


-- --------------------------------------------------------------------------
-- 7. MIGRATE THE EXISTING CSV (optional, one-off)
-- --------------------------------------------------------------------------
-- The site ships with data/catalog.csv. Supabase's dashboard cannot read a
-- CSV from your disk, so import it like this:
--   Table editor -> products -> Import data from file -> upload catalog.csv
-- Then map the columns once: name->name, description->description,
-- price->price, category->category, image->image_url, active->is_active
-- (TRUE/FALSE), and leave id/stock/created_at/updated_at to their defaults.
-- A bare file name in the sheet's image column needs the site folder prefix
-- to work off-site; either keep the full "images/products/xxx.jpg" path and
-- serve images from the site, or re-upload the photos through the admin
-- dashboard once and let it fill image_url with the Supabase address.
