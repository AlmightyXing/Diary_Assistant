# Diary Assistant 工单切片拆解 (Tracer Bullet Issues)

根据 `/to-issues` 的要求，我已将 PRD 拆解为多个独立的“垂直切片 (Vertical Slices)”。
**每个切片都会贯穿从数据层、后台逻辑到前端 UI 的完整链路，确保每个切片完成后都有可验证的完整闭环。**

## User Review Required

请审查以下工单拆解的颗粒度与依赖关系。你可以直接提出修改建议：
- 颗粒度是否合适（太大或太小）？
- 依赖关系是否正确？
- 是否有需要合并或进一步拆分的切片？

如果你觉得没有问题，请点击“Proceed”批准此计划。批准后，我会在本地为你生成这些独立的 Issue 文档。

---

## 拟定的垂直切片工单列表

### 1. 基础日程的闭环 (Basic Schedule CRUD)
- **Title**: 基础日程展示与管理
- **Blocked by**: 无 - 可以立即开始
- **User stories covered**: #1
- **What to build**: 建立基础的数据储存方案（如 SQLite/JSON ），并在界面上实现单个日期下的普通日程“增、删、改、查”。用户可以通过 UI 成功存储并在界面上立刻看到新增的日程记录。

### 2. 应用追踪与白名单基础 (App Usage Tracking & Whitelist)
- **Title**: 后台窗口时间捕获与白名单过滤
- **Blocked by**: 无 - 可以立即开始
- **User stories covered**: #4
- **What to build**: 开发系统底层挂钩进程（例如通过 Node 插件或 Python 脚本获取前台窗口），并在 UI 中提供一个隐私白名单设置面板。系统仅捕获和累加白名单内的应用活跃时间。

### 3. 固定日程模板与生成 (Fixed Schedule Templates)
- **Title**: 固定日程的模板化生成与实例编辑
- **Blocked by**: #1 (Basic Schedule CRUD)
- **User stories covered**: #2, #3
- **What to build**: 构建一套后台规则生成器。用户可以在界面上创建周期性模板（如“每天下午开会”），后台会在对应的日期自动生成当天的日程实例。并且，用户可以自由修改当天的实例数据而不影响模板数据，界面需提供跳转回编辑模板的快速入口。

### 4. 日记草稿生成与手动定稿 (Diary Draft & Manual Finalize)
- **Title**: 日志数据汇总与大模型生成
- **Blocked by**: #1, #2 (需要日程和应用追踪作为上下文数据)
- **User stories covered**: #7, #8, #9, #11 (手动操作弹窗)
- **What to build**: 构建日记功能面板。自动汇总当天的“日程”和“应用使用情况”构成草稿。提供手动上传按钮并配有隐私弹窗，上传后调用大模型接口（模拟或真实 API）获取文本初稿。提供文本编辑器让用户微调，最后保存为本地定稿。

### 5. 静默自动定稿与降级登记机制 (Silent Auto-Finalize & Fallback)
- **Title**: 自动上传调度器与状态机流转
- **Blocked by**: #4 (Diary Draft & Manual Finalize)
- **User stories covered**: #10, #11, #12
- **What to build**: 增加一个后台定时任务调度器。如果用户在设置中开启自动上传并授予隐私许可，到点时后台默默发送草稿给 LLM 并落库；如果处于待确认阶段则系统挂起；如果未开启自动上传功能，则到点时将草稿降级转存为正式日记。

### 6. 历史日记日历视图 (Historical Diary Calendar View)
- **Title**: 历史日历视图与事后补救
- **Blocked by**: #4 (需要有已定稿的日记数据结构)
- **User stories covered**: #13
- **What to build**: 增加一个全年的日历导航视图，点击历史日期可调出当天的定稿日记，并允许用户重新进行文本编辑和保存。

### 7. 基于活跃状态的健康计时器 (Activity-Aware Health Timers)
- **Title**: 支持休眠挂起与手动干预的健康提醒
- **Blocked by**: #2 (依赖系统底层的活跃状态监测机制)
- **User stories covered**: #5, #6
- **What to build**: 开发后台健康计时服务。利用系统的键盘鼠标事件或息屏状态作为干预器，让“久坐”和“用眼疲劳”倒计时在挂机时暂停。在 UI 上弹出提醒时，提供“重置”和“进入下一阶段”的手动干预按钮。

### 8. 桌面悬浮小组件 (Desktop Widget)
- **Title**: 独立运行的桌面悬浮小组件
- **Blocked by**: #1 (Basic Schedule), #7 (Activity-Aware Health Timers)
- **User stories covered**: (前端核心功能展示)
- **What to build**: 增加一个独立于后台主界面的桌面级小组件（例如采用无边框透明窗口）。该组件实时同步读取数据库中的当日日程安排与后台正在运行的健康倒计时状态，供用户在桌面上随时快捷预览，并提供点击穿透或跳转回后台主界面的入口。
