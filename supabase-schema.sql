-- AFTER8 database schema for Supabase
-- Run this whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  category text,
  price numeric(12,2) not null default 0,
  sizes text[] not null default '{}',
  image text,
  published boolean not null default true,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null,
  phone text not null,
  address text not null,
  province text,
  postal_code text,
  payment_method text not null check (payment_method in ('transfer','cod')),
  subtotal numeric(12,2) not null,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','awaiting_payment','preparing','shipped','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  size text,
  quantity integer not null check (quantity > 0)
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'); $$;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id=auth.uid() or public.is_admin());

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (published=true or public.is_admin());

drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders own read" on public.orders;
create policy "orders own read" on public.orders for select using (user_id=auth.uid() or public.is_admin());

drop policy if exists "orders own insert" on public.orders;
create policy "orders own insert" on public.orders for insert with check (user_id=auth.uid());

drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "items own read" on public.order_items;
create policy "items own read" on public.order_items for select using (
  public.is_admin() or exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
);

drop policy if exists "items own insert" on public.order_items;
create policy "items own insert" on public.order_items for insert with check (
  exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
  insert into public.profiles(id,email) values(new.id,new.email);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- After creating your own account, promote it to admin:
-- update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';

-- Starter products using the uploaded image paths.
insert into public.products(name,slug,description,category,price,sizes,image,published,stock)
values
('A8 STRIPE POLO','a8-stripe-polo','100% cotton, classic polo collar, embroidered A8 logo, relaxed fit.','Polos',1890,array['S','M','L','XL'],'assets/product-polo.png',true,30),
('AFTER8 PREMIUM TEE / WHITE','after8-premium-tee-white','240 GSM premium combed cotton, reactive dye, relaxed fit, silicone wash finish.','T-Shirts',1290,array['S','M','L','XL'],'assets/product-tee.png',true,30),
('AFTER8 / 001 SUNRISE DENIM','after8-001-sunrise-denim','Premium denim 14.5 oz, oversized fit, sunrise embroidery, limited numbering.','Jackets',3990,array['S','M','L','XL'],'assets/product-jacket.png',true,10)
on conflict (slug) do nothing;
