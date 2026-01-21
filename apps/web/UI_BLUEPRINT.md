# UI_BLUEPRINT.md (Figma-aligned)

目标：在不推翻业务逻辑的前提下，把 UI 框架/结构/交互逐步重构到 Figma 设计一致。
已完成：颜色体系大部分已按 COLOR_GUIDE.md 落地。
待完成：页面布局、组件结构、交互流转。

---

## Global Layout
### TopNav (all pages)
- Left: round logo + "Stories & Spaces"
- Center: pill container with tabs: Hall / Rooms / Private / Bookstore
- Active: white background + dark stroke
- Right: profile avatar button

### Floating CatGuide (all pages)
- fixed bottom-right
- round button + green dot

### Shared UI primitives
- Container: max width + responsive padding
- Card: consistent radius, border, shadow rules
- Tabs: pill style, active/inactive states
- Badge: LIVE / STORY / Trending / New / Premium

---

## Page: Hall
Sections:
1) Hero banner (large rounded, title+subtitle)
2) Filter tabs (All / Stories / Posts) - pill buttons
3) Composer (avatar + rounded input + round icon button)
4) Masonry feed (desktop 2 columns; mobile 1)
Cards:
- StoryCard (image heavy, STORY badge, bookmark)
- PostCard (text heavy, bookmark)

---

## Page: Rooms (list)
Sections:
1) Header title + subtitle
2) Search input (rounded, icon)
3) Create Room button (pill)
4) Live Now label + cards
Cards:
- RoomCard (LIVE badge optional, topic tag, title, host, stats)

---

## Page: Room Detail
Sections:
1) Room header card (LIVE badge, stats)
2) Guidelines box
3) Messages list
4) Composer (input + Send pill)

---

## Page: Private
Layout:
- Desktop split: left list, right chat
- Mobile: list->chat drill-in (state or route)
Components:
- ConversationListItem (unread badge)
- ChatHeader (online indicator + menu)
- MessageBubble (incoming neutral, outgoing warm)
- Composer (rounded input + round send)

---

## Page: Bookstore
Sections:
1) Header title + subtitle
2) Filters: Free / Premium (pill)
3) Tag filters (single-select unless specified otherwise)
4) Novel grid
Cards:
- NovelCard (cover, title, rating, stats, Trending/New badge, Premium accent)

---

## Page: Novel Detail
Sections:
1) Cover + meta info
2) Tabs: About / Chapters / Reviews
3) Chapters list: first 5 free, rest locked (Premium modal)
4) Reader view

---

## Page: Post Detail
Sections:
1) Content
2) Comments list + composer
3) Related content
4) Author info
