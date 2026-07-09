## What to build
构建完整的日记生成链路面板。自动汇总当天的日程和应用使用情况。用户确认草稿后上传给大模型接口，返回初稿，允许再次微调，最终保存入库。

## Acceptance criteria
- [ ] 构建日记面板，从数据库拉取当天的“已完成日程”和“应用追踪记录”，组合为文本展示。
- [ ] 在上传前提供包含明确风险提示的确认弹窗。
- [ ] 开发连接到 LLM（例如通过配置的 OpenAI 兼容 API 密钥）的请求封装服务。
- [ ] 收到大模型返回的文本后，展示在编辑器中，并提供“重新生成”功能。
- [ ] 用户微调文本后点击保存，该文本作为该日的“Finalized Diary”持久化储存。

## Blocked by
- issue-1 (Basic Schedule CRUD)
- issue-2 (App Usage Tracking & Whitelist)
