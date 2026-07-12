import type { Progress } from "@/lib/domain";

type RegionKey = Exclude<Progress, "unknown">;

export const globalCustomTopicKeywords = [
  "戴因斯雷布",
  "坎瑞亚",
  "深渊",
  "旅行者血亲",
  "斯卡拉姆齐",
  "魔女会",
  "天理",
  "虚假之天",
  "龙王",
  "世界树",
  "法涅斯",
  "水仙十字结社",
] as const;

export const customTopicKeywordsByRegion: Record<RegionKey, readonly string[]> = {
  mondstadt: [
    "阿贝多", "安柏", "芭芭拉", "班尼特", "迪卢克", "迪奥娜", "优菈", "菲谢尔", "琴", "凯亚", "可莉", "丽莎", "莫娜", "诺艾尔", "罗莎莉亚", "雷泽", "砂糖", "温迪", "米卡", "法尔伽", "爱丽丝", "杜林", "莱茵多特",
  ],
  liyue: [
    "白术", "北斗", "重云", "嘉明", "甘雨", "胡桃", "刻晴", "凝光", "七七", "申鹤", "香菱", "魈", "行秋", "辛焱", "烟绯", "夜兰", "瑶瑶", "云堇", "钟离", "闲云", "蓝砚", "归终", "若陀龙王", "萍姥姥",
  ],
  inazuma: [
    "神里绫华", "神里绫人", "荒泷一斗", "五郎", "枫原万叶", "九条裟罗", "久岐忍", "宵宫", "雷电将军", "早柚", "珊瑚宫心海", "托马", "八重神子", "鹿野院平藏", "千织", "绮良良", "梦见月瑞希", "雷电影", "狐斋宫", "御舆千代",
  ],
  sumeru: [
    "艾尔海森", "坎蒂丝", "赛诺", "迪希雅", "多莉", "珐露珊", "卡维", "柯莱", "莱依拉", "纳西妲", "妮露", "提纳里", "流浪者", "赛索斯", "大慈树王", "博士", "迪娜泽黛",
  ],
  fontaine: [
    "林尼", "琳妮特", "菲米尼", "夏洛蒂", "莱欧斯利", "那维莱特", "芙宁娜", "娜维娅", "夏沃蕾", "克洛琳德", "希格雯", "艾梅莉埃", "爱可菲", "芙卡洛斯", "雷内", "雅各布", "阿兰", "玛丽安", "卡特皮拉",
  ],
  natlan: [
    "卡齐娜", "玛拉妮", "基尼奇", "希诺宁", "欧洛伦", "恰斯卡", "玛薇卡", "茜特菈莉", "伊安珊", "瓦雷莎", "伊法", "希巴拉克",
  ],
  nodkrai: [
    "菈乌玛", "菲林斯", "爱诺", "哥伦比娅", "奈芙尔", "雅珂达", "琳妮亚", "伊诺克",
  ],
  snezhnaya: [
    "达达利亚", "阿蕾奇诺", "冰之女皇", "丑角", "博士", "少女", "木偶", "队长", "富人", "公子", "仆人", "散兵", "淑女",
  ],
};

const regionKeys = Object.keys(customTopicKeywordsByRegion) as RegionKey[];

function normalizeCandidate(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function getCustomTopicCandidates(region: RegionKey, query: string) {
  const normalizedQuery = normalizeCandidate(query.trim());
  if (!normalizedQuery) return [];

  const regional = customTopicKeywordsByRegion[region];
  const elsewhere = regionKeys.flatMap((key) =>
    key === region ? [] : customTopicKeywordsByRegion[key],
  );
  return [...new Set([...regional, ...globalCustomTopicKeywords, ...elsewhere])]
    .filter((item) => normalizeCandidate(item).includes(normalizedQuery))
    .slice(0, 4);
}
