const namedEntities: Record<string, string> = {
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

function isDisplayCodePoint(point: number) {
  if (!Number.isInteger(point) || point <= 0 || point > 0x10ffff) {
    return false;
  }
  if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) {
    return false;
  }
  if (point >= 0xd800 && point <= 0xdfff) {
    return false;
  }
  if (point >= 0xfdd0 && point <= 0xfdef) {
    return false;
  }
  const planePoint = point & 0xffff;
  return planePoint !== 0xfffe && planePoint !== 0xffff;
}

function decodeHtmlEntitiesOnce(value: string) {
  return value
    .replace(/&([a-z]+);/giu, (entity, name: string) =>
      Object.prototype.hasOwnProperty.call(namedEntities, name.toLowerCase())
        ? namedEntities[name.toLowerCase()]!
        : entity,
    )
    .replace(/&#x([0-9a-f]+);/giu, (entity, code: string) => {
      const point = Number.parseInt(code, 16);
      return isDisplayCodePoint(point) ? String.fromCodePoint(point) : entity;
    })
    .replace(/&#(\d+);/gu, (entity, code: string) => {
      const point = Number.parseInt(code, 10);
      return isDisplayCodePoint(point) ? String.fromCodePoint(point) : entity;
    });
}

export function decodeHtmlEntities(value: string) {
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decodeHtmlEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function containsUnrenderedHtmlEntity(value: string) {
  return /&(?:[a-z][a-z0-9]*|#x[0-9a-z]+|#[0-9a-z]+);/iu.test(value);
}

function compactForComparison(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
}

export function hasRepeatedSiteChrome(value: string) {
  const compact = compactForComparison(value);
  const siteSignal = /wiki|平台|官网|观测枢|数据库|database|navigation/iu;
  for (let size = Math.min(80, Math.floor(compact.length / 2)); size >= 6; size -= 1) {
    for (let start = 0; start + size * 2 <= compact.length; start += 1) {
      const segment = compact.slice(start, start + size);
      if (siteSignal.test(segment) && segment === compact.slice(start + size, start + size * 2)) {
        return true;
      }
    }
  }
  return false;
}

export function looksLikeBrowserEditShell(value: string) {
  const text = value.normalize("NFKC");
  const requiresJavascript =
    /(?:requires?|enable|enabled|disabled?).{0,40}javascript|javascript.{0,40}(?:requires?|enable|enabled|disabled?)/iu.test(
      text,
    );
  const browserSettings =
    /browser.{0,30}(?:settings?|configuration)|(?:settings?|configuration).{0,30}browser/iu.test(
      text,
    );
  const collaborativeEditContext = /欢迎|welcome|正在阅读|reading/iu.test(text);
  const collaborativeEditRelation =
    /(?:协助|帮助)[\s\S]{0,30}编辑[\s\S]{0,20}(?:条目|页面|词条)/u.test(text) ||
    /(?:assist|help)[\s\S]{0,40}edit[\s\S]{0,20}(?:entry|page)/iu.test(text);
  return (
    (requiresJavascript && browserSettings) ||
    (collaborativeEditContext && collaborativeEditRelation)
  );
}

export function isNavigationHeavy(value: string) {
  const text = value.normalize("NFKC");
  const browserOrWikiUi =
    /(?:^|\s)(?:首页|主页|home)\s*(?:>|›|→)|\bCtrl\s*\+\s*D\b|(?:WIKI\s*)?功能\s*(?:>|›|→)\s*(?:编辑|edit)/iu;
  const tokens = text.match(
    /Created with Sketch|首页|新闻|公告|攻略|图鉴|角色|武器|圣遗物|社区|编辑|历史|Toggle|Contents?|Navigation|Gallery|Change History/giu,
  ) ?? [];
  const taskIndexTokens = text.match(
    /任务攻略|任务流程|前置任务|后续任务|任务列表|任务索引|章节列表|上一任务|下一任务|quest\s*(?:guide|steps?|list|index)|previous\s+quest|next\s+quest/giu,
  ) ?? [];
  const compactLength = text.replace(/\s+/gu, "").length;
  const navigationDensity =
    tokens.reduce((total, token) => total + token.length, 0) /
    Math.max(compactLength, 1);
  return (
    /Created with Sketch/iu.test(text) ||
    looksLikeBrowserEditShell(text) ||
    browserOrWikiUi.test(text) ||
    new Set(tokens.map((token) => token.toLowerCase())).size >= 6 ||
    (tokens.length >= 4 && navigationDensity >= 0.25) ||
    taskIndexTokens.length >= 3
  );
}

export function looksLikeDialogueDump(value: string) {
  const structuralLabels = new Set([
    "前因",
    "转折",
    "轉折",
    "结果",
    "結果",
    "结局",
    "結局",
    "背景",
    "概述",
    "总结",
    "總結",
    "原因",
  ]);
  const labels = Array.from(
    value.matchAll(/(?:^|\s+|[。！？!?]\s*)([\p{L}\p{N}·]{1,16})\s*[:：]/gu),
    (match) => match[1]!.normalize("NFKC").toLowerCase(),
  ).filter((label) => !structuralLabels.has(label));
  if (labels.length < 3) return false;

  const turnsBySpeaker = new Map<string, number>();
  for (const label of labels) {
    turnsBySpeaker.set(label, (turnsBySpeaker.get(label) ?? 0) + 1);
  }
  return (
    Array.from(turnsBySpeaker.values()).some((turns) => turns >= 2) ||
    labels.length >= 5 ||
    (labels.length >= 4 && value.normalize("NFKC").length >= 60)
  );
}

export function looksLikeShortRawDialogue(value: string) {
  const text = value.normalize("NFKC");
  if (!/^\s*[\p{L}\p{N}·]{1,16}\s*[:：]/u.test(text)) return false;

  const labeledTurns = Array.from(
    text.matchAll(
      /(?:^|[\s。！？!?….]+)([\p{L}\p{N}·]{1,16})\s*[:：]/gu,
    ),
  );
  return labeledTurns.length >= 2;
}

export function looksLikeSiteDescriptionShell(value: string) {
  const intro = value.normalize("NFKC").slice(0, 220);
  const hasSiteIdentityNoun =
    /社区|平台|网站|论坛|门户|站点|\bwiki\b|\bcommunity\b|\bplatform\b|\bwebsite\b|\bsite\b|\bforum\b|\bportal\b/iu.test(
      intro,
    );
  const hasIdentityRelation =
    /(?:是|属于|隶属于|旗下|由[\s\S]{0,30}(?:运营|创办|维护))|\b(?:is|belongs\s+to|owned\s+by|operated\s+by|run\s+by)\b/iu.test(
      intro,
    );
  const hasOfficialSiteIdentity =
    /官方(?:社区|网站|平台|论坛|门户|站点)|\bofficial[\s-]*(?:community|site|website|platform|forum|portal)\b/iu.test(
      intro,
    );
  const catalogTerms = intro.match(
    /资讯|新闻|攻略|图鉴|活动|下载|礼包|作品|数据库|\bnews\b|\bguides?\b|\bcatalog\b|\bdatabase\b|\bevents?\b|\bdownloads?\b|\bresources?\b/giu,
  ) ?? [];
  const distinctCatalogTerms = new Set(
    catalogTerms.map((term) => term.normalize("NFKC").toLowerCase()),
  );

  return (
    hasSiteIdentityNoun &&
    hasIdentityRelation &&
    (hasOfficialSiteIdentity || distinctCatalogTerms.size >= 2)
  );
}

export function looksLikePromotionalListingShell(value: string) {
  const text = value.normalize("NFKC");
  const continuousAvailability =
    /7\s*(?:\*|x|×|\/)\s*24\s*(?:小时|小時|hours?|hrs?)?|\b24\s*\/\s*7\b|\baround[-\s]+the[-\s]+clock\b/iu.test(
      text,
    );
  const promotionalLanguage =
    /更多|热门|熱門|持续更新|持續更新|尽在|盡在|\bmore\b|\bpopular\b|\bcontinuously\s+updated\b|\bupdated\b|\bavailable\s+here\b|\bdiscover\b/iu.test(
      text,
    );
  if (continuousAvailability && promotionalLanguage) return true;

  const textWithoutBulletCommentLabels = text.replace(
    /\bbullet\s*comments?\b/giu,
    " ",
  );
  const metricCategories = [
    /(?:视频|視頻)?播放(?:量|数|數|次数|次數)|观看(?:量|数|數|次数|次數)|觀看(?:量|數|次數)|浏览(?:量|数|數|次数|次數)|瀏覽(?:量|數|次數)|\bplay\s*count\b|\bviews?\b\s*[:：]?\s*\d[\d.,]*[kmb]?/iu,
    /弹幕(?:量|数)|彈幕(?:量|數)|(?:弹幕|彈幕)\s*[:：]?\s*\d|\bdanmaku(?:\s+count)?\b\s*[:：]?\s*\d|\bbullet\s*comments?\b\s*[:：]?\s*\d|\bbullet\s*comment\s*count\b/iu,
    /点赞(?:数|量)|點讚(?:數|量)|(?:点赞|點讚)\s*[:：]?\s*\d|\blike\s*count\b|\blikes?\b\s*[:：]?\s*\d/iu,
    /投硬币枚数|投硬幣枚數|硬币(?:数|量)|硬幣(?:數|量)|投币(?:数|量)|投幣(?:數|量)|打赏(?:数|量)|打賞(?:數|量)|小费(?:数|量)|小費(?:數|量)|(?:投币|投幣|打赏|打賞|小费|小費)\s*[:：]?\s*\d|\b(?:coin|tip|donation)\s*count\b|\b(?:coins?|tips?|donations?)\b\s*[:：]?\s*\d/iu,
    /收藏(?:数|數|量)|收藏\s*[:：]?\s*\d|\b(?:favou?rite|bookmark)\s*count\b|\b(?:favou?rites?|bookmarks?)\b\s*[:：]?\s*\d/iu,
    /分享(?:数|數|量)|转发(?:数|量)|轉發(?:數|量)|(?:分享|转发|轉發)\s*[:：]?\s*\d|\b(?:share|repost)\s*count\b|\b(?:shares?|reposts?)\b\s*[:：]?\s*\d/iu,
    /评论(?:数|數|量)|評論(?:數|量)|留言(?:数|數|量)|(?:评论|評論|留言)\s*[:：]?\s*\d|\b(?:comment|reply)\s*count\b|\b(?:comments?|replies?)\b\s*[:：]?\s*\d/iu,
  ];
  return (
    metricCategories.filter((pattern, index) =>
      pattern.test(index === metricCategories.length - 1 ? textWithoutBulletCommentLabels : text),
    ).length >= 3
  );
}

export function isUnusableWebText(
  value: string,
  options: { rejectDialogue?: boolean } = {},
) {
  return (
    containsUnrenderedHtmlEntity(cleanWebText(value)) ||
    hasRepeatedSiteChrome(value) ||
    isNavigationHeavy(value) ||
    looksLikeSiteDescriptionShell(value) ||
    looksLikePromotionalListingShell(value) ||
    (options.rejectDialogue === true && looksLikeDialogueDump(value))
  );
}

export function cleanWebText(value: string) {
  return decodeHtmlEntities(value.normalize("NFKC"))
    .replace(/[\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu, "")
    .replace(/\[(?:\d{1,3}|编辑|edit)\]/giu, "")
    .replace(/\bToggle\b(?:\s+\w+){0,3}/giu, "")
    .replace(/\bContents?\b(?:\s+\d+(?:\.\d+)*)*/giu, "")
    .replace(/\bGallery\b|\bChange History\b|\bReferences\b|\bNavigation\b/giu, "")
    .replace(/\s+/gu, " ")
    .replace(/^[。；，、,.!?：:\s]+/u, "")
    .trim();
}

export function webTextQualityScore(value: string) {
  const clean = cleanWebText(value);
  if (isUnusableWebText(value, { rejectDialogue: true })) {
    return Number.NEGATIVE_INFINITY;
  }

  return Math.min(clean.length, 700);
}

export function preferHigherQualityWebText(original: string, candidate: string) {
  if (!candidate.trim()) return original;
  return webTextQualityScore(candidate) > webTextQualityScore(original)
    ? candidate
    : original;
}
