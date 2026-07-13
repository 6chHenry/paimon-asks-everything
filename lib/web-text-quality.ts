const namedEntities: Record<string, string> = {
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  hellip: "…",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&([a-z]+);/giu, (entity, name: string) =>
      Object.prototype.hasOwnProperty.call(namedEntities, name.toLowerCase())
        ? namedEntities[name.toLowerCase()]!
        : entity,
    )
    .replace(/&#x([0-9a-f]+);/giu, (entity, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    })
    .replace(/&#(\d+);/gu, (entity, code: string) => {
      const point = Number.parseInt(code, 10);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    });
}

export function containsUnrenderedHtmlEntity(value: string) {
  return /&(?:[a-z][a-z0-9]+|#x[0-9a-f]+|#\d+);/iu.test(value);
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

export function isNavigationHeavy(value: string) {
  const text = value.normalize("NFKC");
  const tokens = text.match(
    /Created with Sketch|首页|新闻|公告|攻略|图鉴|角色|武器|圣遗物|社区|编辑|历史|Toggle|Contents?|Navigation|Gallery|Change History/giu,
  ) ?? [];
  return /Created with Sketch/iu.test(text) || new Set(tokens.map((token) => token.toLowerCase())).size >= 6;
}

export function looksLikeDialogueDump(value: string) {
  const labels = value.match(/(?:^|[。！？!?]\s*)([\p{L}\p{N}·]{1,16})\s*[:：]/gu) ?? [];
  return labels.length >= 3;
}

export function cleanWebText(value: string) {
  return decodeHtmlEntities(value.normalize("NFKC"))
    .replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/gu, "")
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
  let score = Math.min(clean.length, 700);
  if (containsUnrenderedHtmlEntity(value)) score -= 180;
  if (hasRepeatedSiteChrome(value)) score -= 320;
  if (isNavigationHeavy(value)) score -= 320;
  if (looksLikeDialogueDump(value)) score -= 100;
  return score;
}

export function preferHigherQualityWebText(original: string, candidate: string) {
  if (!candidate.trim()) return original;
  return webTextQualityScore(candidate) > webTextQualityScore(original)
    ? candidate
    : original;
}
