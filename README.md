# 派蒙三千问 · Paimon Asks Everything

**在线体验：** [paimon-asks-everything.vercel.app](https://paimon-asks-everything.vercel.app/)

![banner](figures/banner.png)

面向《原神》国际化发行场景的 AI Agent Demo —— 为玩家提供证据约束的中英文问答、按地区与旅行者身份呈现的版本预热内容，以及至冬关系图谱；同时为制作组沉淀匿名洞察和可执行的发行分析。

制作初衷：原神的世界观很庞大，如何保证在不剧透的前提下能够让玩家快速了解或是回忆起相关概念。在月之六版本尝试的向导笔记仍由文案组手动撰写，但是原神世界里的各种事件/任务层出不穷，如何让玩家能够快速找到问题的答案，同时又不剧透未来的剧情内容/降低游戏趣味性。比方说可以快速跳转书籍页面。现在是由原神wiki在完成，能够写进游戏内部？派蒙本身的定位就是玩家的向导，那派蒙其实完全可以成为这个AI的载体。玩家可以询问他相关知识，而派蒙的回复也需要结合派蒙本身的语言风格等特性完成。由于至冬可能会是我们在原神提瓦特篇进入的最后一个国家（除坎瑞亚外），在挪德卡莱这个版本已经有许多伏笔收束，玩家其实很期待看见更多伏笔的收束以及未来更多的世界观拓展以及玩法上的突破。毕竟原神短时间内不会完结，所以如何既回扣往日埋下的伏笔，有铺垫新的内容，持续地吸引玩家，这也很重要。

## 功能概览

| 页面 | 功能 |
|------|------|
| 首页 | 至冬 7.0 更新倒计时、官方影像、新角色立绘预览、至冬关系图 |
| 版本预热 | 直接选择地区，并按新玩家、回归玩家、剧情党三种身份呈现无剧透入门、地区回顾与引子，或完整剧情、证据和关系图 |
| 至冬关系图 | 至冬角色、组织与概念的交互式图探索，支持节点详情、关系分析、文本线索溯源 |
| 问派蒙 | 基于受控语料 + DeepSeek 原生 Web Search 的证据约束问答，支持真实来源引用、双语检索与自建搜索回退 |
| 发行洞察 | 面向中国制作组的中文发行简报：AI 综合分析 → 玩家需求切片 → 制作动作清单 → 证据工作台 |
| 增量实验 | 面试演示用发行增量实验室：PV × 玩家 Uplift 决策、达人 × 展会 2×2 归因、置信区间与 Holdout |
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
LLM_API_STYLE=anthropic
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

![设计思维导图](figures/%E8%AE%BE%E8%AE%A1%E6%80%9D%E7%BB%B4%E5%AF%BC%E5%9B%BE.png)

```
用户偏好（身份 / 地区 / 剧透 / 语言）
  → 策划主题编排
  → 双语受控词法检索（同语言优先 + 别名扩展）
  → 剧透门控（Level 3 身份反转需二次确认）
  → 默认 DeepSeek Anthropic Messages + 原生 web_search_20250305
  → 原生搜索失败时一次性回退白名单 Wiki / 通用网页搜索
  → 来源整理（official / trusted_wiki / community / unknown_web）
  → 证据约束回答生成 + 结构化引用
  → 最小化匿名事件写入
  → 聚合规则信号 → 评分引擎 → AI 发行简报 / 规则兜底
```

### 关键模块

| 模块 | 职责 |
|------|------|
| `lib/retrieval.ts` | 别名扩展、同语言优先、词法排序与剧透过滤 |
| `lib/agent.ts` | 单 Agent 工作流：安全拒答 → 搜索编排 → 生成 |
| `lib/generation.ts` | API 风格分派、OpenAI-compatible 备用链路、结构化回答解析与 citation 校验 |
| `lib/deepseek-anthropic.ts` | Anthropic Messages 请求、UTF-8、超时与一次 `pause_turn` 续传 |
| `lib/native-web-search.ts` | 原生搜索响应块解析、正文选择、搜索结果去重与死编号清理 |
| `lib/native-search-adapter.ts` | 原生正文和来源到统一问答结果的适配、来源治理与一次回退判定 |
| `lib/external-search.ts` | 多 Wiki provider 搜索、通用网页搜索、来源评估与引用排序 |
| `lib/source-governance.ts` | 来源可信度分级、发布者身份识别、平台分类 |
| `lib/preheat.ts` | 版本预热编排：根据身份与地区返回无剧透入门、地区回顾或完整剧情视图 |
| `data/preheat-region-guides.ts` | 八个地区的新玩家阵营导览、剧情脉络、回归回顾与后续引子 |
| `components/preheat-role-views.tsx` | 新玩家、回归玩家、剧情党三套差异化预热界面 |
| `data/snezhnaya-graph.ts` | 结构化角色、组织与概念图谱，支持多语言、多证据等级 |
| `components/snezhnaya-graph.tsx` | 交互式图谱：节点探索、关系分析、文本线索溯源 |
| `lib/insights.ts` | 兴趣聚类、理解断点、高频困惑与语言差异分析 |
| `lib/release-insights.ts` | 发行决策引擎：内容机会分、理解风险分、信心等级、行动卡片生成 |
| `lib/release-ai-briefing.ts` | 发行洞察 AI 简报：结构化中文分析、证据白名单校验、规则兜底 |
| `data/release-topic-map.ts` | 主题归一化映射：连接问题 / 预热 / 图谱节点到统一发行主题 |
| `components/release-decision-center.tsx` | 决策台 UI：制作组简报 → 排期 → 风险 → 证据工作台 |
| `components/home-countdown.tsx` | 首页至冬 7.0 更新倒计时，按北京时间目标点实时计算 |
| `lib/evaluation.ts` | 固定问题集与确定性评测 |
| `lib/event-store.ts` | Supabase / 本地 JSON 存储适配 |
| `lib/rate-limit.ts` | 面向公开 Demo 的服务端请求限流 |
| `lib/answer-prompt.ts` | 结构化回答 prompt 模板（中英文） |
| `lib/question-understanding.ts` | 问题意图分类与实体抽取 |
| `data/gnosis-knowledge.ts` | 愚人众与神之心中英文受控知识条目 |

## 版本预热

版本预热不再用统一内容只改变标题，而是让“地区 × 旅行者身份”实际决定页面内容。地区通过按钮直接选择；身份只保留三类：

- **新玩家** — 用通俗、无剧透的方式介绍所选地区、需要认识的主要阵营，以及三步剧情脉络；不会展示完整时间线和证据详情。
- **回归玩家** — 回顾所选地区的关键剧情，展示当地人物关系，并用尚未回答的问题作为后续引子，帮助玩家接回当前主线。
- **剧情党** — 以所选地区作为默认聚焦点，同时开放全部已实装剧情时间线、详细事件与证据、完整关系图和延伸问题。

蒙德、璃月、稻妻、须弥、枫丹、纳塔、挪德卡莱与至冬均有独立的地区导览。

## 发行决策台

发行洞察页面已从统计展示改造成面向中国制作组的决策工具：

1. **制作组简报** — AI 优先综合站内提问、预热互动和图谱行为，输出当前判断、下一步和证据引用。
2. **玩家需求切片** — 按回归玩家、剧情党、探索型玩家等人群说明他们具体卡在哪里，以及制作组应该补什么。
3. **制作动作清单** — 将建议落到负责人、排期、具体动作和验收标准，避免空泛的“加强引导”。
4. **机会与风险矩阵** — 同时展示内容机会分和理解风险分，判断主题是否适合进入近期发布。
5. **证据工作台** — 标签切换：站内证据 / 站外趋势（占位）/ 数据说明。

所有分数由确定性规则计算；AI 只生成结构化分析和行动建议，并且必须引用白名单证据。模型不可用或引用越界时，页面自动回到规则备用版。

## 发行增量实验室

`/release-lab` 将发行洞察从“玩家对什么感兴趣”延伸到“哪项动作对哪类玩家带来增量”：

1. **PV × 玩家** — 用多处理 T-Learner 比较剧情、角色、玩法 PV 与不触达控制，输出分群 CATE、95% 区间和 10% Holdout 建议。
2. **安全决策** — 只有置信区间下界超过 1 pp 业务阈值才建议触达；不确定或负向人群明确输出“不触达”。
3. **达人 × 展会** — 用 2×2 随机实验拆分达人、展会、协同和联合增量，再用 Shapley 分配联合增量。
4. **证据边界** — 所有页面数字均来自固定种子的合成随机实验，仅验证方法和产品闭环，不代表真实业务效果。

生成和验证模型产物：

```bash
python -m pip install -r requirements-release-lab.txt
npm run report:release-lab
npm run test:release-lab
```

面试演示讲解见 `docs/release-incrementality-interview-guide.md`。

## 仓库说明

- `docs/`、`.data/`、本地计划文件和上下文文件默认不发布到远端仓库。
- `docs/superpowers/specs/` 只作为本地设计草稿目录使用，不纳入版本追踪。

## 至冬关系图

交互式图谱探索至冬国角色、组织与概念间的关联：

- **节点探索** — 冰之女皇、执行官、愚人众组织、关键概念等节点的多语言详情与证据等级
- **关系分析** — 选择两个节点分析其关联，支持文本线索溯源和证据引用
- **文本线索** — 每个关系和节点背后关联来自 Wiki、剧情文本、武器/圣遗物文本的可靠线索

## 搜索与证据策略

- **API 风格**：问答页可按次切换自研 OpenAI-compatible 搜索流程和 Anthropic 原生 Web Search；API 请求未提供 `apiStyle` 时默认使用 `anthropic`。
- **平滑回退**：原生搜索遇到超时、HTTP/JSON 错误、无最终正文、无相关来源或不完整截断时，每个请求最多回退一次；用户不会看到底层接口错误。
- **原生来源**：结构化搜索结果先做 URL 规范化、去重、实体相关性和来源治理，再进入现有资料卡；无法可靠映射的 `【n】` 不会伪造为行内引用。
- **选择性阅读与观看**：主回答先返回，再优先复用本次原生搜索来源；可用资源不足时仅追加一次 Anthropic 原生搜索，不再同时启动多组自建搜索。
- **Wiki 搜索**：英文 Fandom、中文 Fandom、BWIKI、HoYoWiki、观测枢 —— 通过 MediaWiki API 获取页面摘要与全文解析。
- **通用网页搜索**：DuckDuckGo HTML + Yahoo Search，自动抓取结果页正文并提取相关段落。
- **来源分级**：
  - `official` — 米哈游 / HoYoverse 官方渠道
  - `trusted_wiki` — 百度百科、萌娘百科、Fandom、BWIKI、HoYoWiki、观测枢等可信二手资料（不标为米哈游第一方官方）
  - `community` — 贴吧、知乎、NGA 等社区平台
  - `unknown_web` — 其他网页
- **身份声明搜索**：对身份/来历类问题自动扩展搜索词（传说任务文本、星海、世界边界等），优先匹配剧情原文。
- 受控知识条目区分 `confirmed`、`narrative_implication`、`community_speculation` 与 `demo_hypothesis`。

## 隐私

- 默认不保存原始问题、回答、账号、UID、邮箱或 IP。
- 预热仅在打开时间线或关系节点时记录主题、旅行者身份和目标节点等匿名枚举，不保存地区选择、账号或可识别的浏览轨迹。
- 用户主动授权后才保存问题文本用于 FAQ 改进。
- 评测运行不写入洞察事件。

## 测试

```bash
npm run typecheck   # TypeScript 类型检查
npm test            # Vitest 单元测试
npm run build       # 生产构建验证
npm run test:release-lab   # Python 增量模型测试
npm run report:release-lab # 重建固定合成实验产物
```

自动化覆盖：

- 同语言受控检索与跨语言边界
- Level 3 剧透过滤与一次性 token
- 高风险剧透意图的二次确认
- 外部 Wiki 搜索结果与页面解析
- 通用网页搜索的正文提取与来源评估
- 身份声明查询的搜索扩展与证据排序
- OpenAI-compatible 结构化生成与 citation 校验
- 发行洞察 AI 简报的证据白名单与规则兜底
- PV 多处理 Uplift、安全触达阈值和结果期特征泄漏检查
- 达人 × 展会四组实验、置信区间与 Shapley 算术约束
- API 限流、安全拒答、匿名事件写入
- 三类旅行者预热视图、八地区导览完整性与旧偏好兼容
- 预热主题引用、关系边、时间线证据审计
- 洞察信号聚合与草稿建议
- 技术评测的回答、引用与失败项输出

## 已知限制

- Vercel端需要冷启动，初次回答可能出错，需要再次询问。
- 神之心时间线纳入蒙德至挪德卡莱月之七的已实装确定事件；月之八尚未实装。
- 白名单 Wiki 搜索仍是社区索引，失败时明确降级而不补写确定事实。
- API 有进程内轻量限流；多实例部署建议接入平台级限流或边缘网关。
- 本地 JSON 存储仅适合单实例 Demo；公开部署应配置 Supabase。
- 版本边界由服务端发布上下文维护；已实装内容与官方前瞻明确区分，泄露/未公开信息不进入回答。
- 建议均为待审核草稿，不会自动发布或替代团队决策。
- 决策台的站外趋势层暂未接入，当前优先级仅依据站内行为。
- 增量实验室使用合成随机数据，只能证明方法链路可运行；真实留存提升必须由线上随机 Holdout 或地域实验验证。

## 未来计划

- 补充月之八内容
- 完善UI，更加贴近游戏内风格
- 增强可交互性
- 保证搜索内容的合理准确，不完全依赖于API，可通过本地数据库训练本地模型
- 使用派蒙语料库微调模型，保证风格统一
