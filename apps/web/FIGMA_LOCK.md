# FIGMA_LOCK (UI must match Figma)

Non-negotiables:
1) Work scope: only modify files under apps/web. Do not change apps/api or shared backend code.
2) Do not change global layout primitives unless explicitly required and stated in the task.
3) Do not change Tailwind config except adding safe semantic tokens. No breaking theme refactors.
4) TopNav must be pill-container style (Hall/Rooms/Private/Bookstore) with active = white background + dark stroke border.
5) Hall must have: hero banner, pill filter tabs, composer row, masonry feed.
6) Rooms list must have: search input + Create Room pill button; Live Now section with LIVE badges.
7) Private must be: split layout (list left, chat right), online indicator, send button styling.
8) CatGuide must be: fixed bottom-right, round button, green online dot, must not block primary CTAs.
9) Colors must follow COLOR_GUIDE.md; never hardcode hex/rgb/hsl in components.
10) Refactor policy: prioritize UI structure/layout first; do not change business logic, data fetching, or routes unless explicitly requested.

Output requirements for any change:
- List modified files
- Provide run + verify steps
- If anything is unclear, list TODOs instead of guessing
