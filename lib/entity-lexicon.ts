export interface QuestionEntity {
  canonical: string;
  aliases: string[];
  kind: "character" | "story";
}

const questionEntities: QuestionEntity[] = [
  {
    canonical: "丝柯克",
    aliases: ["Skirk"],
    kind: "character",
  },
  {
    canonical: "爱可菲",
    aliases: ["Escoffier"],
    kind: "character",
  },
  {
    canonical: "桑多涅",
    aliases: ["Sandrone", "木偶", "Marionette"],
    kind: "character",
  },
  {
    canonical: "女士",
    aliases: ["La Signora", "Signora", "罗莎琳", "Rosalyne"],
    kind: "character",
  },
  {
    canonical: "富人",
    aliases: ["Pantalone", "Regrator", "潘塔罗涅"],
    kind: "character",
  },
  {
    canonical: "博士",
    aliases: ["Dottore", "Il Dottore", "多托雷"],
    kind: "character",
  },
];

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

const genericTerms = new Set([
  "原神",
  "外星人",
  "角色",
  "身份",
  "背景",
  "剧情",
  "传说任务",
  "关系",
  "联系",
  "故事",
  "设定",
  "资料",
  "信息",
  "官方",
  "目前",
  "现在",
  "真的",
  "是不是",
  "为什么",
  "怎么",
  "什么",
  "谁",
  "他",
  "她",
  "它",
]);

function cleanCandidate(value: string) {
  return value
    .replace(/[「」『』《》“”"'`]/gu, "")
    .replace(/^(?:我想问|我问|请问|问一下|想知道|关于|所以|那|这个|那个)+/u, "")
    .replace(/(?:的|之)$/u, "")
    .replace(/(?:到底|真的|目前|现在|原神|游戏里|剧情里)+$/u, "")
    .trim();
}

function isUsefulCandidate(value: string, options: { allowShort?: boolean } = {}) {
  const cleaned = cleanCandidate(value);
  const minLength = options.allowShort ? 1 : 2;
  if (cleaned.length < minLength || cleaned.length > 12) return false;
  if (genericTerms.has(cleaned)) return false;
  if (/^[吗呢吧啊呀了的得地\s]+$/u.test(cleaned)) return false;
  return /[\p{L}\p{N}]/u.test(cleaned);
}

function inferredKind(value: string): QuestionEntity["kind"] {
  return /神之心|世界树|深渊|坎瑞亚|水仙十字/u.test(value) ? "story" : "character";
}

function pushCandidate(
  target: QuestionEntity[],
  rawValue: string,
  options: { allowShort?: boolean } = {},
) {
  const canonical = cleanCandidate(rawValue);
  if (!isUsefulCandidate(canonical, options)) return;
  if (target.some((item) => normalized(item.canonical) === normalized(canonical))) {
    return;
  }
  target.push({
    canonical,
    aliases: [],
    kind: inferredKind(canonical),
  });
}

function inferQuestionEntities(question: string): QuestionEntity[] {
  const candidates: QuestionEntity[] = [];
  let hasRelationshipCandidates = false;
  const normalizedQuestion = question
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();

  const quotedRelationMatch = normalizedQuestion.match(
    /[「"']([^」"']{1,18})[」"'](?:和|与|跟|同)[「"']([^」"']{1,18})[」"'][^。！？.!?]{0,80}(?:关系|联系|区别)/u,
  );
  if (quotedRelationMatch) {
    pushCandidate(candidates, quotedRelationMatch[1] ?? "", { allowShort: true });
    pushCandidate(candidates, quotedRelationMatch[2] ?? "", { allowShort: true });
    hasRelationshipCandidates = true;
  }

  const relationMatch = normalizedQuestion.match(
    /^(.{2,18}?)(?:和|与|跟|同)(.{2,18}?)(?:之间)?(?:的)?(?:是(?:什么|啥))?(?:关系|联系|区别)/u,
  );
  if (relationMatch) {
    pushCandidate(candidates, relationMatch[1] ?? "", { allowShort: true });
    pushCandidate(candidates, relationMatch[2] ?? "", { allowShort: true });
    hasRelationshipCandidates = true;
  }

  const predicateMatch = normalizedQuestion.match(
    /^(.{2,18}?)(?:是(?:不是)?|是不是|是谁|为什么|为何|怎么|如何|传说任务|故事|背景|身份|设定|死在|死亡|讲了什么|讲什么|说了什么)/u,
  );
  if (!hasRelationshipCandidates && predicateMatch) {
    pushCandidate(candidates, predicateMatch[1] ?? "");
  }

  return candidates;
}

export function detectQuestionEntities(question: string) {
  const haystack = normalized(question);
  const known = questionEntities.filter((entity) =>
    [entity.canonical, ...entity.aliases].some((alias) =>
      haystack.includes(normalized(alias)),
    ),
  );
  const inferred = inferQuestionEntities(question).filter(
    (entity) =>
      !known.some((knownEntity) =>
        [knownEntity.canonical, ...knownEntity.aliases].some(
          (alias) => normalized(alias) === normalized(entity.canonical),
        ),
      ),
  );
  return [...known, ...inferred];
}
