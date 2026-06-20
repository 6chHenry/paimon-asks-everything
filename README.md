# 派蒙三千问 · Paimon Asks Everything

面向《原神》国际化发行场景的 AI Agent Demo —— 为玩家提供证据约束的中英文问答，同时为运营团队沉淀匿名洞察与发行建议。

## 功能概览

| 页面 | 功能 |
|------|------|
| 首页 | 策划主题选择、剧透偏好（无剧透 / 轻度 / 完整考据）、玩家档案（回归 / 新玩家 / 活跃） |
| 版本预热 | 蒙德至挪德卡莱事件链的时间线可视化与局部关系图 |
| 问派蒙 | 基于受控语料 + 白名单 Wiki 搜索的证据约束问答，支持来源引用与双语检索 |
| 发行洞察 | 匿名问题事件的兴趣聚类、理解断点与内容调整建议 |
| 技术评测 | 固定问题集的确定性检查与人工复核 |

## 本地运行

**要求：** Node.js 20+

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

**生产构建：**

```bash
npm run typecheck
npm test
npm run build
npm start
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```env
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=
LLM_MODEL=deepseek-v4-flash

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- **未配置模型密钥**：使用证据约束的确定性回答生成器，核心流程仍可完整运行。
- **未配置 Supabase**：问题事件写入 `.data/events.json`，预热互动写入 `.data/preheat-events.json`；生产环境依次执行 migration 后切换到 Supabase。
- 模型密钥和 Supabase service role 仅在服务端使用。
- 存在 `HTTP_PROXY` / `HTTPS_PROXY` 时通过代理访问模型接口。

## 核心架构

```
用户偏好（进度 / 剧透 / 语言）
  → 策划主题编排
  → 双语受控词法检索（同语言优先 + 别名扩展）
  → 剧透门控（Level 3 身份反转需二次确认）
  → 外部白名单 Wiki 搜索（Fandom / BWIKI / HoYoWiki / 观测枢）
  → 通用网页搜索（DuckDuckGo / Yahoo）
  → 来源治理（official / trusted_wiki / community / unknown_web）
  → 证据约束回答生成 + 结构化引用
  → 最小化匿名事件写入
  → 聚合规则信号 → 发行洞察与建议草稿
```

### 关键模块

| 模块 | 职责 |
|------|------|
| `lib/retrieval.ts` | 别名扩展、同语言优先、词法排序与剧透过滤 |
| `lib/agent.ts` | 单 Agent 工作流：安全拒答 → 搜索编排 → 生成 |
| `lib/generation.ts` | OpenAI-compatible Chat Completions、tool calling 搜索循环、结构化回答解析与 citation 校验 |
| `lib/external-search.ts` | 多 Wiki provider 搜索、通用网页搜索、来源评估与引用排序 |
| `lib/source-governance.ts` | 来源可信度分级、发布者身份识别、平台分类 |
| `lib/preheat.ts` | 策划主题、两档深度、按主线进度解锁的时间线与关系图 |
| `lib/insights.ts` | 兴趣聚类、理解断点、高频困惑与语言差异分析 |
| `lib/evaluation.ts` | 固定问题集与确定性评测 |
| `lib/event-store.ts` | Supabase / 本地 JSON 存储适配 |
| `lib/rate-limit.ts` | 面向公开 Demo 的服务端请求限流 |
| `lib/answer-prompt.ts` | 结构化回答 prompt 模板（中英文） |
| `lib/question-understanding.ts` | 问题意图分类与实体抽取 |
| `data/gnosis-knowledge.ts` | 愚人众与神之心中英文受控知识条目 |

## 搜索与证据策略

- **Wiki 搜索**：英文 Fandom、中文 Fandom、BWIKI、HoYoWiki、观测枢 —— 通过 MediaWiki API 获取页面摘要与全文解析。
- **通用网页搜索**：DuckDuckGo HTML + Yahoo Search，自动抓取结果页正文并提取相关段落。
- **来源分级**：
  - `official` — 米哈游 / HoYoverse 官方渠道
  - `trusted_wiki` — 白名单 Wiki（作为社区索引，不标为官方）
  - `community` — 贴吧、知乎、NGA 等社区平台
  - `unknown_web` — 其他网页
- **身份声明搜索**：对身份/来历类问题自动扩展搜索词（传说任务文本、星海、世界边界等），优先匹配剧情原文。
- 受控知识条目区分 `confirmed`、`narrative_implication`、`community_speculation` 与 `demo_hypothesis`。

## 隐私

- 默认不保存原始问题、回答、账号、UID、邮箱或 IP。
- 预热只记录主题、深度、节点枚举，不记录浏览行为。
- 用户主动授权后才保存问题文本用于 FAQ 改进。
- 评测运行不写入洞察事件。

## 测试

```bash
npm run typecheck   # TypeScript 类型检查
npm test            # Vitest 单元测试
npm run build       # 生产构建验证
```

自动化覆盖：

- 同语言受控检索与跨语言边界
- Level 3 剧透过滤与一次性 token
- 高风险剧透意图的二次确认
- 外部 Wiki 搜索结果与页面解析
- 通用网页搜索的正文提取与来源评估
- 身份声明查询的搜索扩展与证据排序
- OpenAI-compatible 结构化生成与 citation 校验
- API 限流、安全拒答、匿名事件写入
- 预热主题引用、关系边、时间线证据审计
- 洞察信号聚合与草稿建议
- 技术评测的回答、引用与失败项输出

## 已知限制

- 受控语料覆盖愚人众神之心主线与枫丹—桑多涅桥接案例，不代表完整游戏百科。
- 神之心时间线纳入蒙德至挪德卡莱月之七的已实装确定事件；月之八尚未实装。
- 白名单 Wiki 搜索仍是社区索引，失败时明确降级而不补写确定事实。
- API 有进程内轻量限流；多实例部署建议接入平台级限流或边缘网关。
- 本地 JSON 存储仅适合单实例 Demo；公开部署应配置 Supabase。
- 版本边界由服务端发布上下文维护；已实装内容与官方前瞻明确区分，泄露/未公开信息不进入回答。
- 建议均为待审核草稿，不会自动发布或替代团队决策。
