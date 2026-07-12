# 问派蒙定制问题建议设计

## 目标

把“问派蒙”页的固定问题替换为地区和剧情专题驱动的定制建议：玩家选择后获得 4–5 个不同角度的问题，并能一键提交；模型不可用时仍显示同专题的高质量预设问题。

## 范围

- 支持蒙德、璃月、稻妻、须弥、枫丹、纳塔、挪德卡莱七个地区。
- 首批提供 15 个受控专题：地区主线与风龙、烬寂海、送仙典仪、层岩巨渊与坎瑞亚、雷电影、鹤观与雷鸟、世界树、森林书、黄金梦乡与沙漠、枫丹预言、水仙十字结社、纳塔深渊战争、夜神之国与古名、挪德卡莱主线、月之力量与霜月之子。
- 每个专题拥有双语名称、可提问范围、权威剧情/资料锚点以及 5 条双语兜底问题。
- 不保存这次选择或生成的问题文本；一键提问继续走已有的聊天与隐私机制。

## 体验

“不知道问什么？”侧栏改为三步：

1. 选择地区，默认按当前语言显示地区名。
2. 选择该地区的剧情专题；切换地区时自动选中该地区第一个专题。
3. 点击“让派蒙想几个问题”，显示生成中的轻量状态，然后以 4–5 张问题卡替换列表。

问题卡继续调用既有 `submitQuestion`，因此会继承当前进度、剧透偏好、语言和反馈流程。模型调用失败、超时、JSON 不合格、数量不在 4–5、内容重复或超出专题范围时，页面不报错，直接返回该专题的 5 条预设问题，并标明“派蒙准备的参考问题”。

## 数据与 API

`data/question-suggestion-topics.ts` 定义 `QuestionSuggestionTopic`：

```ts
type QuestionSuggestionTopic = {
  id: string;
  region: Progress;
  title: Record<Language, string>;
  scope: Record<Language, string>;
  sourceAnchors: Array<{ title: string; url: string; authority: "official" | "trusted_wiki" }>;
  fallbackQuestions: Record<Language, [string, string, string, string, string]>;
};
```

新路由 `POST /api/question-suggestions` 接收 `{ topicId, language, profile, progress, spoilerPreference, focus }`，经过 zod 校验和每分钟限流后调用 `lib/question-suggestion-generator.ts`。生成器使用现有 OpenAI-compatible 配置，要求只返回 JSON 字符串数组；提示词传入专题的范围而非长篇剧情，并明确禁止答案、剧透扩写、未确认前提和编造来源。

返回：

```ts
{ topicId: string; questions: string[]; source: "generated" | "fallback" }
```

生成结果按 `language + topicId + profile + progress + spoilerPreference + focus` 缓存 30 分钟；缓存与失败不写入事件存储。

## 可靠性和安全

- 仅允许目录内 `topicId`；未知 ID 返回 400。
- 当前进度和剧透偏好进入生成指令，但不改变受控目录。
- 生成校验会去空、去重、限制 4–5 条，拒绝包含回答式断言或不属于专题范围的输出。
- 任何失败都只降级到本专题预设问题；不调用聊天回答接口。
- 资料锚点用于专题治理，不作为模型生成时的虚构引用。

## 验证

- 目录测试：七地区齐全、每专题有可信锚点和五条双语兜底问题。
- 生成器测试：合法 JSON、重复/越界数量/无效内容降级、缓存命中与无 API key 降级。
- 路由测试：有效请求、未知专题、限流和模型失败均返回正确结构。
- UI 源码测试：选择器、生成按钮、加载状态、一键提交和 fallback 提示存在。
- 运行 `npm test`、`npm run typecheck`、`npm run build`。

## 非目标

- 不根据外部实时热度自动扩展专题。
- 不生成答案、人物结论、来源链接或新的剧情事实。
- 不新增账号、服务端偏好记录或原始问题存储。
