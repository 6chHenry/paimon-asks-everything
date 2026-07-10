import type { QuestionSuggestionTopic } from "@/lib/domain";

const wiki = "https://genshin-impact.fandom.com/wiki/";

export const questionSuggestionTopics: QuestionSuggestionTopic[] = [
  {
    id: "mondstadt-main-story", region: "mondstadt",
    title: { "zh-CN": "蒙德主线与风魔龙", en: "Mondstadt and Stormterror" },
    scope: { "zh-CN": "旅行者抵达蒙德、风魔龙危机、温迪与四风守护。", en: "The Traveler's arrival, the Stormterror crisis, Venti, and the Four Winds." },
    sourceAnchors: [{ title: "Song of the Dragon and Freedom", url: `${wiki}Song_of_the_Dragon_and_Freedom`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["特瓦林为什么会被深渊教团影响？", "温迪在蒙德主线里扮演了什么角色？", "四风守护和风神之间是什么关系？", "风魔龙危机是怎样被解决的？", "蒙德主线有哪些后续伏笔？"],
      en: ["Why was Dvalin influenced by the Abyss Order?", "What role does Venti play in Mondstadt's main story?", "How do the Four Winds relate to the Anemo Archon?", "How is the Stormterror crisis resolved?", "Which Mondstadt details matter later in the story?"],
    },
  },
  {
    id: "mare-jivari", region: "mondstadt",
    title: { "zh-CN": "烬寂海与斯坦利的传说", en: "Mare Jivari and Stanley's tale" },
    scope: { "zh-CN": "烬寂海的已知传说、斯坦利与相关线索。", en: "Known legends of Mare Jivari, Stanley, and related clues." },
    sourceAnchors: [{ title: "Mare Jivari", url: "https://www.hoyolab.com/article/41684696", authority: "official" }],
    fallbackQuestions: {
      "zh-CN": ["烬寂海目前有哪些已知特征？", "斯坦利的故事和烬寂海有什么关系？", "游戏里哪些角色或任务描述了烬寂海？", "烬寂海为何常被视作未解之地？", "哪些烬寂海信息只是传闻？"],
      en: ["What characteristics of Mare Jivari are known?", "How does Stanley's story connect to Mare Jivari?", "Which quests or characters describe Mare Jivari?", "Why is Mare Jivari an unresolved place?", "Which Mare Jivari details are only rumors?"],
    },
  },
  {
    id: "liyue-main-story", region: "liyue",
    title: { "zh-CN": "璃月主线与送仙典仪", en: "Liyue and the Rite of Parting" },
    scope: { "zh-CN": "岩王帝君陨落、送仙典仪与璃月权力交接。", en: "Rex Lapis's apparent death, the Rite of Parting, and Liyue's transition." },
    sourceAnchors: [{ title: "A New Star Approaches", url: `${wiki}A_New_Star_Approaches`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["钟离为何策划自己的假死？", "送仙典仪有什么意义？", "七星和仙人各自做了什么？", "奥赛尔事件如何改变璃月？", "人治时代如何在璃月主线中体现？"],
      en: ["Why does Zhongli arrange his apparent death?", "What does the Rite of Parting mean?", "What do the Qixing and adepti each do?", "How does the Osial incident change Liyue?", "How does Liyue show a human-led era?"],
    },
  },
  {
    id: "chasm-khaenriah", region: "liyue",
    title: { "zh-CN": "层岩巨渊与坎瑞亚线索", en: "The Chasm and Khaenri'ah clues" },
    scope: { "zh-CN": "层岩巨渊深游记、黑蛇骑士与坎瑞亚灾变线索。", en: "The Chasm Delvers, Black Serpent Knights, and Khaenri'ah calamity clues." },
    sourceAnchors: [{ title: "Perilous Trail", url: `${wiki}Perilous_Trail`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["黑蛇骑士原本是什么身份？", "哈夫丹为何仍在守护旅行者？", "层岩巨渊揭示了哪些坎瑞亚线索？", "浮舍的结局与层岩巨渊有何关系？", "哪些坎瑞亚推断不能只凭层岩下结论？"],
      en: ["Who were the Black Serpent Knights?", "Why does Halfdan protect the Traveler?", "What Khaenri'ah clues come from the Chasm?", "How is Bosacius tied to the Chasm?", "Which Khaenri'ah theories need more than Chasm evidence?"],
    },
  },
  {
    id: "inazuma-main-story", region: "inazuma",
    title: { "zh-CN": "稻妻主线与雷电影", en: "Inazuma and Raiden Ei" },
    scope: { "zh-CN": "眼狩令、永恒、雷电影与稻妻政局。", en: "The Vision Hunt Decree, Eternity, Raiden Ei, and Inazuma's politics." },
    sourceAnchors: [{ title: "Omnipresence Over Mortals", url: `${wiki}Omnipresence_Over_Mortals`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["雷电影为何推行眼狩令？", "真和影对永恒有何不同理解？", "三奉行在危机中做了什么？", "散兵在稻妻主线起到什么作用？", "危机结束后哪些制度改变了？"],
      en: ["Why does Ei enforce the Vision Hunt Decree?", "How do Makoto and Ei view Eternity differently?", "What does each Tri-Commission do?", "What role does Scaramouche play in Inazuma?", "Which institutions change after the crisis?"],
    },
  },
  {
    id: "tsurumi-ruu", region: "inazuma",
    title: { "zh-CN": "鹤观与阿瑠", en: "Tsurumi and Ruu" },
    scope: { "zh-CN": "雾海纪行、阿瑠、雷鸟与鹤观循环。", en: "Through the Mists, Ruu, the Thunderbird, and Tsurumi's loop." },
    sourceAnchors: [{ title: "Through the Mists", url: `${wiki}Through_the_Mists`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["鹤观为何反复被浓雾笼罩？", "阿瑠和雷鸟之间发生了什么？", "旅行者如何打破鹤观循环？", "壁画透露了哪些历史线索？", "哪些鹤观内容应和坎瑞亚线索区分？"],
      en: ["Why is Tsurumi repeatedly covered in fog?", "What happened between Ruu and the Thunderbird?", "How does the Traveler break Tsurumi's loop?", "What historical clues appear in the murals?", "Which Tsurumi details should be separate from Khaenri'ah clues?"],
    },
  },
  {
    id: "sumeru-main-story", region: "sumeru",
    title: { "zh-CN": "须弥主线与世界树", en: "Sumeru and Irminsul" },
    scope: { "zh-CN": "花神诞祭轮回、造神计划、世界树与记忆改写。", en: "The Sabzeruz loop, god creation, Irminsul, and altered memories." },
    sourceAnchors: [{ title: "Akasha Pulses, the Kalpa Flame Rises", url: `${wiki}Akasha_Pulses,_the_Kalpa_Flame_Rises`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["花神诞祭轮回怎样运作？", "教令院为何推动造神计划？", "纳西妲如何夺回主动权？", "世界树删除会改变什么？", "须弥主线怎样衔接散兵剧情？"],
      en: ["How does the Sabzeruz Festival loop work?", "Why does the Akademiya pursue god creation?", "How does Nahida regain agency?", "What can Irminsul deletion change?", "How does Sumeru connect to Scaramouche's arc?"],
    },
  },
  {
    id: "aranyaka", region: "sumeru",
    title: { "zh-CN": "森林书与兰那罗", en: "Aranyaka and the Aranara" },
    scope: { "zh-CN": "森林书、兰那罗、无留陀与桓那兰那。", en: "Aranyaka, the Aranara, Marana, and Vanarana." },
    sourceAnchors: [{ title: "Aranyaka", url: `${wiki}Aranyaka`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["兰那罗为何会遗忘人类朋友？", "无留陀造成了什么问题？", "桓那兰那两种状态如何理解？", "拉娜和兰那罗的故事怎样相连？", "完成森林书后哪些地点值得回访？"],
      en: ["Why do the Aranara forget human friends?", "What problem does Marana cause?", "How should Vanarana's two states be understood?", "How are Rana and the Aranara connected?", "Which places are worth revisiting after Aranyaka?"],
    },
  },
  {
    id: "golden-slumber", region: "sumeru",
    title: { "zh-CN": "黄金梦乡与沙漠文明", en: "Golden Slumber and the desert" },
    scope: { "zh-CN": "黄金梦乡、赤王遗民、永恒绿洲与沙漠遗迹。", en: "Golden Slumber, King Deshret's legacy, the Eternal Oasis, and desert ruins." },
    sourceAnchors: [{ title: "Golden Slumber", url: `${wiki}Golden_Slumber`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["黄金梦乡的核心矛盾是什么？", "婕德经历了怎样的变化？", "赤王与花神的关系如何区分？", "永恒绿洲代表了什么？", "沙漠任务如何补充须弥主线？"],
      en: ["What is Golden Slumber's central conflict?", "How does Jeht change?", "How should King Deshret and the Goddess of Flowers be distinguished?", "What does the Eternal Oasis represent?", "How do desert quests complement Sumeru's story?"],
    },
  },
  {
    id: "fontaine-main-story", region: "fontaine",
    title: { "zh-CN": "枫丹主线与预言", en: "Fontaine and the prophecy" },
    scope: { "zh-CN": "原始胎海之水、预言、芙宁娜与那维莱特。", en: "Primordial Seawater, the prophecy, Furina, and Neuvillette." },
    sourceAnchors: [{ title: "Masquerade of the Guilty", url: `${wiki}Masquerade_of_the_Guilty`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["枫丹预言来自哪里？", "芙宁娜为何维持水神身份？", "那维莱特在最终审判做了什么选择？", "原始胎海之水如何关联枫丹人？", "结局改变了哪些已知设定？"],
      en: ["Where does Fontaine's prophecy come from?", "Why does Furina maintain the Hydro Archon's role?", "What choice does Neuvillette make at the final trial?", "How does Primordial Seawater relate to Fontainians?", "Which established ideas change at the finale?"],
    },
  },
  {
    id: "narzissenkreuz-ordo", region: "fontaine",
    title: { "zh-CN": "水仙十字结社", en: "The Narzissenkreuz Ordo" },
    scope: { "zh-CN": "水仙十字结社、安眠处、雷内与枫丹世界任务。", en: "The Narzissenkreuz Ordo, the Institute, Rene, and Fontaine world quests." },
    sourceAnchors: [{ title: "Narzissenkreuz Ordo", url: `${wiki}Narzissenkreuz_Ordo`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["结社最初想解决什么问题？", "雷内的计划为何失控？", "安眠处与成员有何联系？", "结社任务如何呼应枫丹主线？", "理解结社前推荐完成哪些任务？"],
      en: ["What problem did the Ordo originally try to solve?", "Why does Rene's plan lose control?", "How does the Institute connect to its members?", "How does the Ordo echo Fontaine's main story?", "Which quests best prepare someone to understand the Ordo?"],
    },
  },
  {
    id: "natlan-main-story", region: "natlan",
    title: { "zh-CN": "纳塔主线与深渊之战", en: "Natlan and the war with the Abyss" },
    scope: { "zh-CN": "六部族、火神、古名与对抗深渊的战争。", en: "Six tribes, the Pyro Archon, Ancient Names, and war against the Abyss." },
    sourceAnchors: [{ title: "Natlan", url: `${wiki}Natlan`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["纳塔的深渊威胁有何不同？", "火神承担了哪些责任？", "六部族如何影响局势？", "旅行者为何卷入纳塔战争？", "哪些内容适合通关后回顾？"],
      en: ["How is Natlan's Abyss threat different?", "What responsibilities does the Pyro Archon bear?", "How do the six tribes shape the situation?", "Why does the Traveler join Natlan's war?", "Which details are best revisited after the story?"],
    },
  },
  {
    id: "night-kingdom-ancient-names", region: "natlan",
    title: { "zh-CN": "夜神之国与古名", en: "Night Kingdom and Ancient Names" },
    scope: { "zh-CN": "夜神之国、夜魂、古名与纳塔的记忆传承。", en: "The Night Kingdom, Nightsoul, Ancient Names, and inherited memories." },
    sourceAnchors: [{ title: "Ancient Name", url: `${wiki}Ancient_Name`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["古名在纳塔剧情中有什么作用？", "夜神之国如何连接现实纳塔？", "谁能获得古名？", "夜魂对应了什么故事概念？", "哪些夜神之国说法仍属推测？"],
      en: ["What role do Ancient Names play in Natlan?", "How does the Night Kingdom connect to living Natlan?", "Who can receive an Ancient Name?", "What story concept does Nightsoul express?", "Which Night Kingdom claims remain theories?"],
    },
  },
  {
    id: "nodkrai-main-story", region: "nodkrai",
    title: { "zh-CN": "挪德卡莱主线", en: "Nod-Krai main story" },
    scope: { "zh-CN": "挪德卡莱主线、当地势力与已公开旅行者线索。", en: "Nod-Krai's main story, local factions, and public Traveler clues." },
    sourceAnchors: [{ title: "Nod-Krai", url: `${wiki}Nod-Krai`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["挪德卡莱处于怎样的位置？", "主线聚焦哪些冲突？", "当地势力如何区分？", "旅行者最先追查什么线索？", "哪些信息只能视作已公开而非定论？"],
      en: ["Where does Nod-Krai sit in Teyvat?", "Which conflicts does its main story focus on?", "How do local factions differ?", "What clue does the Traveler investigate first?", "Which details are public information rather than conclusions?"],
    },
  },
  {
    id: "nodkrai-lunar-power", region: "nodkrai",
    title: { "zh-CN": "月之力量与霜月之子", en: "Lunar power and Frostmoon Scions" },
    scope: { "zh-CN": "已公开的月之力量、霜月之子与相关信仰。", en: "Public lunar power, Frostmoon Scions, and related beliefs." },
    sourceAnchors: [{ title: "Frostmoon Scions", url: `${wiki}Frostmoon_Scions`, authority: "trusted_wiki" }],
    fallbackQuestions: {
      "zh-CN": ["月之力量有哪些已知特征？", "霜月之子与当地信仰有何关系？", "月之力量如何区别于元素力？", "哪些势力和霜月之子有关？", "哪些月之力量信息仍是合理推测？"],
      en: ["What characteristics of lunar power are public?", "How do Frostmoon Scions relate to local belief?", "How does lunar power differ from elemental power?", "Which factions connect to the Frostmoon Scions?", "Which lunar-power claims remain reasonable inferences?"],
    },
  },
];
