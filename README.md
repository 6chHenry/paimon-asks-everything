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
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=
LLM_MODEL=deepseek-v4-flash

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- 未配置模型密钥时，系统使用证据约束的确定性回答生成器，完整核心流程仍可运行。
- 未配置 Supabase 时，现场匿名事件写入 `.data/events.json`；生产环境可执行 `supabase/migrations/0001_initial.sql` 后切换到 Supabase REST。
- 模型密钥和 Supabase service role 只在服务端使用。
- 服务端在存在 `HTTP_PROXY` / `HTTPS_PROXY` 时会通过代理访问 OpenAI-compatible 模型接口；公开部署环境可直接出站时无需代理。

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
- `lib/generation.ts`：DeepSeek / OpenAI-compatible Chat Completions 调用、tool calling 搜索循环、结构化回答解析和 citation id 校验。
- `lib/event-store.ts`：Supabase / 本地 JSON 存储适配。
- `lib/rate-limit.ts`：面向公开 Demo 的轻量服务端请求限流。
- `lib/insights.ts`：高频困惑、画像集中和语言差异规则。
- `lib/evaluation.ts`：固定问题集与确定性检查。
- `data/knowledge.ts`：12 个概念、24 条中英文受控知识条目。

## DeepSeek 与联网工具

- DeepSeek API 支持 OpenAI-compatible `tools` / function calling；模型可以返回要调用的函数名和参数。
- DeepSeek 不会替应用执行函数；搜索、页面抓取、来源分级和工具结果回填由本应用实现。
- 当前版本使用 DeepSeek tool calling loop：安全与剧透门控后，模型必须先调用 `search_web_evidence`，应用执行联网搜索，再把证据交给 DeepSeek 生成。
- 联网搜索包含英文 Fandom、中文 Fandom、BWiki 等 Wiki provider，并通过轻量通用网页搜索纳入白名单外结果；贴吧、知乎、NGA、公众号等会按 `community` 低权重处理。
- 生产环境建议把轻量 HTML 搜索替换为稳定搜索 API，以获得更好的速率、摘要质量和可观测性。
- 来源等级区分为 `official`、`trusted_wiki`、`community`、`unknown_web`。白名单 Wiki 是高可信社区索引，不会被展示成官方。

## 隐私与证据策略

- 默认不保存原始问题、回答、完整会话、账号、UID、邮箱或 IP。
- 用户主动开启授权后，才保存该问题文本用于 FAQ 改进。
- 来源类型与事实状态分别展示。
- Wiki 来源在页面中标为 `trusted_wiki` / 高可信 Wiki；它可以承载已核验事实，但不会被展示成官方站点本身。
- 桑多涅、阿兰与玛丽安关系已作为受控双语条目维护：桑多涅是阿兰晚年的造物，形象与记忆源自玛丽安；它不是“无直接关系”的推测边界。
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
- 高风险剧透意图的独立二次确认；
- 外部 Wiki 搜索结果正文摘要抓取；
- OpenAI-compatible 结构化生成、citation id 校验和降级；
- 技术评测的回答、引用和失败项输出；
- API 限流核心逻辑；
- 安全拒答；
- 匿名事件写入；
- 洞察信号和草稿建议；
- 12 条中英文产品内评测用例。

## 已知限制

- 受控语料聚焦“枫丹—桑多涅”版本桥接案例，不代表完整游戏知识库。
- 白名单 Wiki 搜索会抓取搜索结果与页面摘要；它仍是社区索引资料，失败时会明确降级而不是补写确定事实。
- API 已有进程内轻量限流；多实例公开部署仍建议接入平台级限流或边缘网关。
- 本地 JSON 存储只适合单实例 Demo；公开部署应配置 Supabase。
- 版本边界由服务端发布上下文维护；当前已实装内容与官方前瞻会明确区分，泄露和未公开测试信息不进入回答。
- 建议均为待审核草稿，不会自动发布或替代团队决策。
