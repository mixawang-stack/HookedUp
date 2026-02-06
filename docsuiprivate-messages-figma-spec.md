# Private Messages ¡ª Figma Spec (Must Match Screenshot)

Goal:
Match the provided Figma screenshot layout and UI details.
No redesign, no approximation.

---

## Layout

- Page background: very light warm beige (use existing theme background)
- Main container centered, max-width ~ 1200-1280px
- Container has rounded corners and thin border, with subtle shadow
- Two columns:
  - Left sidebar: fixed width 340-380px
  - Right chat area: fills remaining width
- Vertical divider line between columns (thin, light)

The whole container height should fit viewport with padding top/bottom ~24px.

---

## Header (Top of page)

- Title: "Private Messages" (large, bold)
- Subtitle: "Connect one-on-one with other community members" (smaller, gray)
- These two lines are OUTSIDE the main container, aligned left with the container.

Remove any extra marketing copy or placeholder sentences.

---

## Left Sidebar

### Search box
- At top inside sidebar
- Rounded pill input, height ~40-44px
- Left icon: search
- Placeholder: "Search conversations..."
- Background: slightly darker than page background (soft beige/cream)

### Conversation list
- Each item is a row with:
  - Avatar left (40-44px)
  - Name (bold)
  - Last message snippet (small, gray, single line, ellipsis)
  - Right side: timestamp (small, gray)
  - Optional unread badge (small circle with number)
- Selected item background: slightly highlighted (soft beige)
- Hover state: very light highlight
- List is scrollable (custom thin scrollbar okay)

---

## Right Chat Panel

### Top bar (inside container)
- Left: avatar + name + online status stacked:
  - Name bold (e.g., "Maya Rodriguez")
  - Online row: green dot + text "Online"
- Right: vertical 3-dot menu icon
- Bottom border under top bar (thin line)

### Messages area
- Scrollable
- Message bubbles:
  - Other person (left):
    - Bubble background: very light beige/cream
    - Text: dark
    - Has avatar shown beside bubble (small avatar)
    - Time label under bubble left (small gray)
  - Me (right):
    - Bubble background: warm pink/salmon
    - Text: white
    - Time label under bubble right (small gray)
- Bubble shape: large rounded corners (16-20px)
- Bubble max width: ~60% of chat width
- Spacing between messages: 16-20px

### Input bar
- Fixed at bottom of chat panel
- Large rounded pill input (height ~48-56px)
- Placeholder: "Type a message..."
- Right side: circular send button (paper plane icon)
  - Button background: warm tan/brown
  - Icon: white
- No "Send" text button
- No "Refresh" button
- No character counter

---

## Remove / Must NOT appear

- Remove floating assistant/avatar button (bottom right big circle) from this page
- Remove any "Keep it Private" footer section under the container
- Remove "Refresh" button
- Remove "0 chars" counter
- Remove any extra left-side mascot icon

---

## Behavior

- When entering /private:
  - If URL includes target user (e.g. /private?userId=xxx), auto-create or fetch DM thread and open it.
  - Otherwise auto-select the most recent conversation if exists.
- Click conversation in left list switches right panel instantly.
- After sending message: scroll to bottom.

---

## Acceptance checklist

- Layout looks like screenshot: centered two-column box, search at top left, chat header with online status, bubble styles match, bottom pill input + circular send icon.
- No footer text below container.
- No floating assistant button on this page.
