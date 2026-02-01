-- Supabase RLS policies for public reading + authenticated reactions/unlocks.

alter table if exists "Novel" enable row level security;
alter table if exists "NovelChapter" enable row level security;
alter table if exists "NovelReaction" enable row level security;
alter table if exists "Entitlement" enable row level security;
alter table if exists "NovelPurchase" enable row level security;

-- Public read for published novels.
drop policy if exists "Public read published novels" on "Novel";
create policy "Public read published novels"
on "Novel"
for select
using (status = 'PUBLISHED');

-- Admin write access for novels.
drop policy if exists "Admin write novels" on "Novel";
create policy "Admin write novels"
on "Novel"
for all
using ((auth.jwt() ->> 'email') = 'admin@hookedup.me')
with check ((auth.jwt() ->> 'email') = 'admin@hookedup.me');

-- Public read for published chapters that belong to published novels.
drop policy if exists "Public read published chapters" on "NovelChapter";
create policy "Public read published chapters"
on "NovelChapter"
for select
using (
  "isPublished" = true
  and exists (
    select 1
    from "Novel" n
    where n.id = "NovelChapter"."novelId"
      and n.status = 'PUBLISHED'
  )
);

-- Admin write access for chapters.
drop policy if exists "Admin write chapters" on "NovelChapter";
create policy "Admin write chapters"
on "NovelChapter"
for all
using ((auth.jwt() ->> 'email') = 'admin@hookedup.me')
with check ((auth.jwt() ->> 'email') = 'admin@hookedup.me');

-- Reactions: authenticated users can read/insert/update/delete their own.
drop policy if exists "Read reactions" on "NovelReaction";
create policy "Read reactions"
on "NovelReaction"
for select
using (true);

drop policy if exists "Insert own reaction" on "NovelReaction";
create policy "Insert own reaction"
on "NovelReaction"
for insert
with check (auth.uid()::text = "userId");

drop policy if exists "Update own reaction" on "NovelReaction";
create policy "Update own reaction"
on "NovelReaction"
for update
using (auth.uid()::text = "userId")
with check (auth.uid()::text = "userId");

drop policy if exists "Delete own reaction" on "NovelReaction";
create policy "Delete own reaction"
on "NovelReaction"
for delete
using (auth.uid()::text = "userId");

-- Entitlements: authenticated users can read/insert their own.
drop policy if exists "Read own entitlements" on "Entitlement";
create policy "Read own entitlements"
on "Entitlement"
for select
using (auth.uid()::text = "userId");

drop policy if exists "Insert own entitlements" on "Entitlement";
create policy "Insert own entitlements"
on "Entitlement"
for insert
with check (auth.uid()::text = "userId");

-- Purchases: authenticated users can insert/read their own.
drop policy if exists "Read own purchases" on "NovelPurchase";
create policy "Read own purchases"
on "NovelPurchase"
for select
using (auth.uid()::text = "userId");

drop policy if exists "Insert own purchases" on "NovelPurchase";
create policy "Insert own purchases"
on "NovelPurchase"
for insert
with check (auth.uid()::text = "userId");
