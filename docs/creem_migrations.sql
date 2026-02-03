-- Creem webhook events
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  type text not null,
  created_at timestamptz not null default now(),
  payload_json jsonb not null,
  received_at timestamptz not null default now(),
  process_status text not null default 'pending',
  processed_at timestamptz,
  error text
);

create unique index if not exists webhook_events_provider_event_id_key
  on public.webhook_events (provider, event_id);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  provider_checkout_id text not null unique,
  status text not null,
  amount numeric,
  currency text,
  paid_at timestamptz,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_subscription_id text not null unique,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_set_updated_at') then
    create trigger orders_set_updated_at
      before update on public.orders
      for each row
      execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'subscriptions_set_updated_at') then
    create trigger subscriptions_set_updated_at
      before update on public.subscriptions
      for each row
      execute procedure public.set_updated_at();
  end if;
end;
$$;
