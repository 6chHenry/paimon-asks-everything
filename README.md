# 派蒙三千问 · Paimon Asks Everything

一个面向《原神》国际化发行场景的中英文版本理解 Agent Demo。它按玩家显式选择的进度、兴趣和剧透偏好组织回答，同时将最小化匿名问题事件沉淀为可回溯的 FAQ 与内容调整建议。

## 60 秒体验

1. 打开首页，选择“回归玩家 / 枫丹 / 轻度剧透”。
2. 进入“问派蒙”，点击“我停在枫丹，现在还能看懂目标版本吗？”。
3. 展开来源，查看事实状态、双语受控语料和证据片段。
4. 点击高风险身份问题，观察一次性剧透二次确认。
5. 打开发行洞察，刷新并查看现场匿名事件如何改变统计。
6. 打开技术评测，运行单题或全部 12 项确定性检查。

## 本地运行

要求：Node.js 20+。

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

生产构建：

```bash
npm run typecheck
npm test
npm run build
npm start
```

## 可选环境变量

复制 `.env.example` 为 `.env.local`：

```env
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=deepseek-v4-flash

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- 未配置模型密钥时，系统使用证据约束的确定性回答生成器，完整核心流程仍可运行。
- 未配置 Supabase 时，现场匿名事件写入 `.data/events.json`；生产环境可执行 `supabase/migrations/0001_initial.sql` 后切换到 Supabase REST。
- 模型密钥和 Supabase service role 只在服务端使用。

## 核心架构

```text
玩家偏好
  → 安全与问题分类
  → 双语受控词法检索
  → 剧透过滤 / 一次性确认
  → 低置信度白名单 Wiki 搜索
  → 证据约束回答与引用
  → 最小化匿名事件
  → 聚合规则信号
  → 待人工审核的发行建议
```

主要边界：

- `lib/retrieval.ts`：别名扩展、同语言优先、词法排序和剧透过滤。
- `lib/agent.ts`：单 Agent 工作流、安全拒答、外部搜索与事件编排。
- `lib/event-store.ts`：Supabase / 本地 JSON 存储适配。
- `lib/insights.ts`：高频困惑、画像集中和语言差异规则。
- `lib/evaluation.ts`：固定问题集与确定性检查。
- `data/knowledge.ts`：12 个概念、24 条中英文受控知识条目。

## 隐私与证据策略

- 默认不保存原始问题、回答、完整会话、账号、UID、邮箱或 IP。
- 用户主动开启授权后，才保存该问题文本用于 FAQ 改进。
- 来源类型与事实状态分别展示。
- `demo_hypothesis`、社区推测和官方明确内容不会混为一类。
- Level 3 身份反转或结局信息始终要求当前问题的一次性确认。
- 评测运行不会写入现场洞察事件。

## 测试

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

当前自动化覆盖：

- 同语言受控检索与跨语言边界；
- Level 3 剧透过滤和一次性 token；
- 安全拒答；
- 匿名事件写入；
- 洞察信号和草稿建议；
- 12 条中英文产品内评测用例。

## 已知限制

- 受控语料聚焦“枫丹—桑多涅”版本桥接案例，不代表完整游戏知识库。
- 白名单 Wiki 搜索依赖实时网络，失败时会明确降级而不是补写确定事实。
- 本地 JSON 存储只适合单实例 Demo；公开部署应配置 Supabase。
- 7.0 内容只作为产品发行场景假设，不代表官方剧情或版本信息。
- 建议均为待审核草稿，不会自动发布或替代团队决策。
