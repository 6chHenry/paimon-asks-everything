# Demo 检索路线切换器设计

**日期：** 2026-07-14  
**状态：** 已确认，待实施计划  
**目标分支：** `codex/deepseek-anthropic-native-search`

## 1. 目标

在问答页增加一个面向现场演示的检索路线切换器，让演示者可以明确选择：

1. 项目自研的 Web 搜索流程，通过 OpenAI 兼容接口完成搜索规划与回答生成。
2. DeepSeek 原生 Web Search，通过 Anthropic Messages 接口完成搜索与回答生成。

切换器需要突出自研流程的设计价值，同时保持两种路线的描述中性，不把其中一条写成“差”或“备用”。

## 2. 交互设计

切换器放在问答输入框上方，作为 composer 的一部分，标题为：

> DEMO SEARCH MODE / 检索路线

采用双段式 segmented control：

### 自研检索

- 主标题：`自研检索`
- 英文：`Designed Search`
- 副标题：`OpenAI 接口 · 分层搜索与来源治理`
- 演示标记：`我的设计` / `MY DESIGN`
- 默认选中
- 流程说明：`理解问题 → 分层检索 → 实体过滤 → 来源治理 → 生成回答`

### 原生搜索

- 主标题：`原生搜索`
- 英文：`Native Search`
- 副标题：`Anthropic 接口 · DeepSeek 原生 Web Search`
- 流程说明：`DeepSeek 原生搜索 → 来源适配 → 生成回答`

## 3. 状态与行为

- 页面首次加载和刷新后默认选择 `openai`，确保 Demo 从自研路线开始。
- 切换只影响下一次提问，不重跑或改写当前答案。
- 请求进行中禁用切换器，避免页面显示路线与实际请求不一致。
- 每次提交时把当前选择保存为该问题的 `lastRequestApiStyle`。
- 如果出现剧透确认，确认请求继续使用原问题的 `lastRequestApiStyle`，不受之后 UI 状态变化影响。
- 推荐问题点击提交与手动输入提交使用同一选择状态。
- 服务端仍保留兼容行为：未传 `apiStyle` 的调用默认 `anthropic`。

## 4. 视觉方向

整体延续当前“旅行手帐 × 调查记录”的界面语言，不重做问答页。

- 切换器使用当前暖色纸张、深蓝墨色和金色强调变量。
- `我的设计` 采用小型印章/档案标签风格，不使用夸张霓虹或营销式渐变。
- 选中项具有清晰边框、轻微内阴影和短促位移动效。
- 未选中项保持可读，但视觉权重降低。
- 流程说明作为一行“路线图”显示，切换时使用轻微淡入。
- 核心答案、引用卡、输入文字保持现有颜色，不因主题切换而重新着色。

移动端：

- 两个主选项仍横向并列。
- 隐藏较长副标题，保留主标题和接口短标签。
- 流程说明允许换行，不产生横向滚动。

## 5. 数据模型与 API

新增稳定类型：

```ts
export type LlmApiStyle = "anthropic" | "openai";
```

`chatRequestSchema` 新增：

```ts
apiStyle: z.enum(["anthropic", "openai"]).default("anthropic")
```

前端问答页显式发送：

```ts
{
  ...preferences,
  apiStyle: selectedApiStyle
}
```

生成链路不再只从 `process.env.LLM_API_STYLE` 决定本次请求，而是按以下优先级解析：

1. 已通过 schema 校验的请求级 `apiStyle`。
2. 未提供请求字段时读取服务端环境变量。
3. 两者均无有效值时默认 `anthropic`。

`runAgent()` 把请求级选择传给 `generateGroundedResponse()`。两条路线仍输出同一个 `GroundedGenerationResult` 和 `ChatResult`，UI 不需要理解 provider 响应结构。

## 6. Trace 与演示反馈

本次请求开始后，Trace 增加不含敏感信息的路线提示：

- 自研：`自研检索路线 · OpenAI-compatible + custom_web`
- 原生：`原生检索路线 · Anthropic + deepseek_native`

Trace 只显示选定路线和现有阶段，不显示 API Key、thinking、完整底层响应或私有推理。

答案完成后，当前答案区域旁保留本次使用的路线标签。标签读取 `lastRequestApiStyle`，而不是当前切换器状态，因此用户在答案完成后切换下一次路线，不会改写旧答案标签。

## 7. 错误与回退

- `apiStyle` 非法时 schema 返回 `invalid_request`，不允许任意 provider 字符串进入服务端。
- `openai` 路线直接进入现有自建 Web Search，不先调用 Anthropic。
- `anthropic` 路线保留当前一次性回退到自建搜索的容错行为。
- 回退发生时 Trace 继续显示实际 fallback 信息；答案路线标签仍显示用户选择的原始模式，避免把自动容错误解为用户主动切换。
- 请求失败时保留选择状态，方便直接重试。

## 8. 可访问性

- 使用两个真实 `button`，容器语义为 `radiogroup`，按钮使用 `aria-pressed` 或 `role="radio" + aria-checked`。
- 键盘 Tab 可进入两个选项，Enter/Space 可切换。
- 选中状态不能仅依赖颜色，必须同时有边框、标记或图标差异。
- 禁用状态使用 `disabled`，并保持文字对比度。

## 9. 测试

### 单元与集成测试

1. 未传 `apiStyle` 时 schema 输出 `anthropic`。
2. `openai` 和 `anthropic` 均通过 schema；其他值被拒绝。
3. 请求级 `openai` 覆盖默认环境值并跳过 Anthropic。
4. 请求级 `anthropic` 覆盖 OpenAI 环境值并进入原生路径。
5. 剧透确认 schema 保留 `apiStyle`。
6. Trace 能区分用户选择的两条路线。
7. 现有未携带 `apiStyle` 的测试和 API 客户端继续工作。

### UI 测试

1. 页面源码包含两个模式选项及中英文标签。
2. 初始状态为 `openai`。
3. 提交体携带当前 `apiStyle`。
4. loading 时切换器禁用。
5. 剧透确认使用 `lastRequestApiStyle`。
6. 桌面和移动端无横向溢出。

### 回归

- 全量 Vitest。
- TypeScript。
- Next.js production build。
- 浏览器验证两种模式各完成一次提问，并确认 Trace、来源和答案路线标签正确。

## 10. 非目标

- 不在本阶段实现同一问题双路并发对比。
- 不自动计算两种路线的胜负或质量评分。
- 不把环境变量或 API Key 暴露到客户端。
- 不重做答案卡、Trace Timeline 或整个问答页布局。
- 不影响问题推荐生成等非聊天 API 的 provider 行为。
