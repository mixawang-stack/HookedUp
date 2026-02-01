-- Supabase RLS policies for public reading + authenticated reactions/unlocks.

alter table if exists "Novel" enable row level security;
alter table if exists "NovelChapter" enable row level security;
alter table if exists "Trace" enable row level security;
alter table if exists "TraceReply" enable row level security;
alter table if exists "TraceLike" enable row level security;
alter table if exists "User" enable row level security;
alter table if exists "Room" enable row level security;
alter table if exists "RoomMembership" enable row level security;
alter table if exists "RoomMessage" enable row level security;
alter table if exists "Preference" enable row level security;
alter table if exists "Conversation" enable row level security;
alter table if exists "ConversationParticipant" enable row level security;
alter table if exists "Match" enable row level security;
alter table if exists "Message" enable row level security;
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

-- Rooms.
drop policy if exists "Public read rooms" on "Room";
create policy "Public read rooms"
on "Room"
for select
using (true);

drop policy if exists "Insert own room" on "Room";
create policy "Insert own room"
on "Room"
for insert
with check (auth.uid()::text = "createdById");

drop policy if exists "Update own room" on "Room";
create policy "Update own room"
on "Room"
for update
using (auth.uid()::text = "createdById")
with check (auth.uid()::text = "createdById");

drop policy if exists "Delete own room" on "Room";
create policy "Delete own room"
on "Room"
for delete
using (auth.uid()::text = "createdById");

-- Room memberships.
drop policy if exists "Read room memberships" on "RoomMembership";
create policy "Read room memberships"
on "RoomMembership"
for select
using (true);

drop policy if exists "Insert own membership" on "RoomMembership";
create policy "Insert own membership"
on "RoomMembership"
for insert
with check (auth.uid()::text = "userId");

drop policy if exists "Delete own membership" on "RoomMembership";
create policy "Delete own membership"
on "RoomMembership"
for delete
using (auth.uid()::text = "userId");

-- Room messages.
drop policy if exists "Read room messages" on "RoomMessage";
create policy "Read room messages"
on "RoomMessage"
for select
using (true);

drop policy if exists "Insert own room message" on "RoomMessage";
create policy "Insert own room message"
on "RoomMessage"
for insert
with check (auth.uid()::text = "senderId");

-- Public read for forum traces.
drop policy if exists "Public read traces" on "Trace";
create policy "Public read traces"
on "Trace"
for select
using (true);

drop policy if exists "Insert own trace" on "Trace";
create policy "Insert own trace"
on "Trace"
for insert
with check (auth.uid()::text = "authorId");

drop policy if exists "Update own trace" on "Trace";
create policy "Update own trace"
on "Trace"
for update
using (auth.uid()::text = "authorId")
with check (auth.uid()::text = "authorId");

drop policy if exists "Delete own trace" on "Trace";
create policy "Delete own trace"
on "Trace"
for delete
using (auth.uid()::text = "authorId");

-- Trace replies.
drop policy if exists "Public read trace replies" on "TraceReply";
create policy "Public read trace replies"
on "TraceReply"
for select
using (true);

drop policy if exists "Insert own trace reply" on "TraceReply";
create policy "Insert own trace reply"
on "TraceReply"
for insert
with check (auth.uid()::text = "authorId");

-- Trace likes.
drop policy if exists "Public read trace likes" on "TraceLike";
create policy "Public read trace likes"
on "TraceLike"
for select
using (true);

drop policy if exists "Insert own trace like" on "TraceLike";
create policy "Insert own trace like"
on "TraceLike"
for insert
with check (auth.uid()::text = "userId");

drop policy if exists "Delete own trace like" on "TraceLike";
create policy "Delete own trace like"
on "TraceLike"
for delete
using (auth.uid()::text = "userId");

-- Public profile read for signed-in users.
drop policy if exists "Read profiles" on "User";
create policy "Read profiles"
on "User"
for select
using (auth.uid() is not null);

-- User profile updates (self only).
drop policy if exists "Update own profile" on "User";
create policy "Update own profile"
on "User"
for update
using (auth.uid()::text = "id")
with check (auth.uid()::text = "id");

-- Preferences (self only).
drop policy if exists "Read own preference" on "Preference";
create policy "Read own preference"
on "Preference"
for select
using (auth.uid()::text = "userId");

drop policy if exists "Upsert own preference" on "Preference";
create policy "Upsert own preference"
on "Preference"
for all
using (auth.uid()::text = "userId")
with check (auth.uid()::text = "userId");

-- Private conversations.
drop policy if exists "Read conversations" on "Conversation";
create policy "Read conversations"
on "Conversation"
for select
using (
  exists (
    select 1
    from "ConversationParticipant" cp
    where cp."conversationId" = "Conversation".id
      and cp."userId" = auth.uid()::text
  )
);

drop policy if exists "Read conversation participants" on "ConversationParticipant";
create policy "Read conversation participants"
on "ConversationParticipant"
for select
using (auth.uid()::text = "userId");

drop policy if exists "Update own conversation participant" on "ConversationParticipant";
create policy "Update own conversation participant"
on "ConversationParticipant"
for update
using (auth.uid()::text = "userId")
with check (auth.uid()::text = "userId");

-- Matches.
drop policy if exists "Read own matches" on "Match";
create policy "Read own matches"
on "Match"
for select
using (auth.uid()::text = "user1Id" or auth.uid()::text = "user2Id");

-- Messages.
drop policy if exists "Read match messages" on "Message";
create policy "Read match messages"
on "Message"
for select
using (
  exists (
    select 1
    from "Match" m
    where m.id = "Message"."matchId"
      and (m."user1Id" = auth.uid()::text or m."user2Id" = auth.uid()::text)
  )
);

drop policy if exists "Insert own match message" on "Message";
create policy "Insert own match message"
on "Message"
for insert
with check (
  auth.uid()::text = "senderId"
  and exists (
    select 1
    from "Match" m
    where m.id = "Message"."matchId"
      and (m."user1Id" = auth.uid()::text or m."user2Id" = auth.uid()::text)
  )
);

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
