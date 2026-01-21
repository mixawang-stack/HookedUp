# INTERACTION_RULES.md

原则：不猜。缺失交互一律列 TODO。

## Global
- Tabs 切换用 state（除非现有已用路由且稳定）
- Modal 统一组件
- 移动端无 hover：hover 行为必须有移动端替代或降级
- 列表必须有 loading + empty

## Hall
- Filter tabs: All/Stories/Posts → 过滤 feed；切换不跳回顶部
- 点击卡片主体 → 进入详情（PostDetail/NovelDetail）(TODO: route path)
- Like/Comment/Bookmark：
  - 未登录 (TODO: 是否弹登录)
  - 已登录：本地 optimistic + 请求

## Rooms
- Search: 输入过滤 rooms（debounce 300ms）
- Create Room: 打开 modal 表单；成功后列表更新（置顶 live or 最新）

## Private
- Enter 发送，Shift+Enter 换行
- 进入会话自动滚到底部
- 在线状态视觉显示即可（TODO: 是否 WS 实时）

## Bookstore
- Free/Premium filter：筛选列表
- Tag filter：默认单选（TODO: 是否多选）

## Novel Detail
- Tabs 切换：state
- Premium 章节点击 → 付费提示 Modal（不跳转）
