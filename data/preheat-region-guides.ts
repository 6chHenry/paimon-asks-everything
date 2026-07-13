import type { Language, Progress } from "@/lib/domain";

export type NamedProgress = Exclude<Progress, "unknown">;
export type LocalizedText = Record<Language, string>;

export interface PreheatRegionGuide {
  region: NamedProgress;
  timelineNodeId?: string;
  relationGraphId?: string;
  newPlayer: {
    overview: LocalizedText;
    factions: Array<{ name: LocalizedText; role: LocalizedText }>;
    storySteps: [LocalizedText, LocalizedText, LocalizedText];
  };
  returningPlayer: {
    recapPoints: Array<{ title: LocalizedText; body: LocalizedText }>;
    hooks: [LocalizedText, LocalizedText, ...LocalizedText[]];
  };
}

const text = (zh: string, en: string): LocalizedText => ({
  "zh-CN": zh,
  en,
});

export const namedProgress = [
  "mondstadt",
  "liyue",
  "inazuma",
  "sumeru",
  "fontaine",
  "natlan",
  "nodkrai",
  "snezhnaya",
] as const satisfies readonly NamedProgress[];

export const preheatRegionGuides: Record<
  NamedProgress,
  PreheatRegionGuide
> = {
  mondstadt: {
    region: "mondstadt",
    timelineNodeId: "mondstadt-gnosis",
    relationGraphId: "mondstadt-gnosis-graph",
    newPlayer: {
      overview: text(
        "蒙德是崇尚自由的风之国。旅行者最初会从一场席卷城市的风龙危机认识这里，并逐渐接触守护城市的人与隐藏在日常生活中的古老力量。",
        "Mondstadt is the nation of wind and freedom. The Traveler first meets it through a dragon crisis, then gradually encounters the people protecting the city and the older powers hidden within everyday life.",
      ),
      factions: [
        { name: text("西风骑士团", "Knights of Favonius"), role: text("负责城市治安与危机应对的主要组织。", "The main organization responsible for the city's safety and crisis response.") },
        { name: text("蒙德教会", "Church of Favonius"), role: text("侍奉风神并管理大教堂的宗教组织。", "The religious institution serving the Anemo Archon and caring for the cathedral.") },
        { name: text("愚人众", "Fatui"), role: text("来自至冬的外交与行动力量，在蒙德有自己的目标。", "A Snezhnayan diplomatic and operational force pursuing its own goals in Mondstadt.") },
      ],
      storySteps: [
        text("旅行者为寻找亲人来到蒙德，并遇见正在失控的风龙。", "The Traveler reaches Mondstadt while searching for their sibling and encounters a dragon in distress."),
        text("城市的守护者试图查明风龙异常的原因，而各方对解决方式并不完全一致。", "The city's protectors investigate the dragon's condition while disagreeing on how to respond."),
        text("旅行者会在骑士团、吟游诗人与外来势力之间理解蒙德的自由意味着什么。", "The Traveler learns what Mondstadt's freedom means through the knights, a bard, and outside powers."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("风龙危机", "The dragon crisis"), body: text("特瓦林受到深渊力量与旧伤影响，旅行者与蒙德众人共同追查并净化异常。", "Dvalin was affected by Abyssal power and an old wound, leading the Traveler and Mondstadt's defenders to investigate and cleanse the corruption.") },
        { title: text("风神现身", "The Anemo Archon revealed"), body: text("温迪以吟游诗人的身份行动，并借旅行者与伙伴的力量尝试重新与特瓦林建立信任。", "Venti acted as a bard and relied on the Traveler and their allies to rebuild trust with Dvalin.") },
        { title: text("神之心被夺", "The Gnosis taken"), body: text("危机结束后，女士袭击温迪并夺走风神之心，愚人众收集神之心的行动由此进入旅行者视野。", "After the crisis, Signora attacked Venti and took the Anemo Gnosis, bringing the Fatui's Gnosis campaign into view.") },
      ],
      hooks: [
        text("女士夺走风神之心，究竟只是一次单独行动，还是至冬长期计划的开端？", "Was Signora taking the Anemo Gnosis an isolated mission or the opening move of a longer Snezhnayan plan?"),
        text("温迪失去神之心后，神明与国家之间的关系发生了什么变化？", "How did losing the Gnosis change the relationship between Mondstadt and its Archon?"),
      ],
    },
  },
  liyue: {
    region: "liyue",
    timelineNodeId: "liyue-gnosis",
    relationGraphId: "liyue-gnosis-graph",
    newPlayer: {
      overview: text("璃月是重视契约、贸易与传统的岩之国。旅行者抵达时，一场突发事件让凡人、仙人与外来势力都开始重新思考谁该守护这片土地。", "Liyue is the nation of contracts, commerce, and tradition. When the Traveler arrives, a sudden incident forces humans, adepti, and foreign powers to reconsider who should protect the land."),
      factions: [
        { name: text("璃月七星", "Liyue Qixing"), role: text("管理港口、商业与公共事务的凡人领袖。", "Human leaders who govern the harbor, commerce, and public affairs.") },
        { name: text("仙人", "Adepti"), role: text("长期依约守护璃月的古老力量。", "Ancient beings bound by contract to protect Liyue.") },
        { name: text("愚人众", "Fatui"), role: text("以外交身份进入璃月，也在暗中推进自己的任务。", "A foreign diplomatic force that also pursues a covert mission in Liyue.") },
      ],
      storySteps: [
        text("旅行者来到璃月港，希望寻找岩神了解亲人的线索。", "The Traveler comes to Liyue Harbor hoping the Geo Archon can help with their search."),
        text("请仙典仪上的意外打乱秩序，七星、仙人与愚人众分别采取行动。", "An incident at the Rite of Descension disrupts the city, prompting the Qixing, adepti, and Fatui to act."),
        text("旅行者需要在契约与变化之间判断璃月应由谁继续守护。", "The Traveler must navigate contracts and change as Liyue decides who should guard its future."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("岩王帝君遇害疑云", "The apparent death of Rex Lapis"), body: text("请仙典仪突生变故，旅行者在公子协助下联系仙人，并逐步卷入七星与仙人的分歧。", "The Rite of Descension was interrupted, and with Childe's help the Traveler contacted the adepti and became involved in their dispute with the Qixing.") },
        { title: text("奥赛尔之战", "The battle against Osial"), body: text("公子利用百无禁忌箓释放奥赛尔，七星、仙人与旅行者联合保卫璃月港。", "Childe used the Sigils of Permission to release Osial, bringing the Qixing, adepti, and Traveler together to defend the harbor.") },
        { title: text("契约交付", "A contractual transfer"), body: text("钟离以一场考验确认璃月能够迈向人的时代，并按与冰之女皇的契约交出岩神之心。", "Zhongli confirmed through a test that Liyue could enter an age of humanity, then handed over the Geo Gnosis under his contract with the Tsaritsa.") },
      ],
      hooks: [
        text("冰之女皇用什么条件，换来了被钟离视为公平的最后契约？", "What did the Tsaritsa offer to make Zhongli consider their final contract fair?"),
        text("愚人众既能强夺也能依约取得神之心，这两种方式反映了怎样的计划？", "What does the Fatui's ability to take one Gnosis by force and another by contract reveal about their plan?"),
      ],
    },
  },
  inazuma: {
    region: "inazuma",
    timelineNodeId: "inazuma-gnosis",
    relationGraphId: "inazuma-gnosis-graph",
    newPlayer: {
      overview: text("稻妻是追求永恒的雷之国，由海岛、幕府与不同立场的居民共同构成。旅行者抵达时，封闭与变革的矛盾已经影响到许多普通人的生活。", "Inazuma is the nation of lightning and eternity, formed by islands, the shogunate, and people with competing views. When the Traveler arrives, the tension between isolation and change already affects everyday lives."),
      factions: [
        { name: text("稻妻幕府", "Inazuma Shogunate"), role: text("执行将军意志并管理国家的统治体系。", "The ruling system that administers the nation under the Shogun's will.") },
        { name: text("海祇岛反抗军", "Watatsumi resistance"), role: text("反对眼狩令、保护受影响民众的力量。", "A force opposing the Vision Hunt Decree and protecting those affected by it.") },
        { name: text("鸣神大社", "Grand Narukami Shrine"), role: text("守护稻妻传统，也掌握许多幕后的信息。", "A guardian of Inazuman tradition that also holds knowledge behind the scenes.") },
      ],
      storySteps: [
        text("旅行者穿过封锁来到稻妻，希望见到雷电将军。", "The Traveler crosses the closed border hoping to meet the Raiden Shogun."),
        text("眼狩令使拥有神之眼的人付出代价，幕府与反抗军的冲突不断升级。", "The Vision Hunt Decree harms Vision bearers as conflict grows between the shogunate and resistance."),
        text("旅行者将接触不同人对永恒的理解，并寻找让国家重新面对变化的方法。", "The Traveler encounters competing ideas of eternity and looks for a way for the nation to face change again."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("锁国与眼狩令", "Isolation and the Vision Hunt"), body: text("幕府执行锁国令与眼狩令，旅行者在见证受害者后加入反抗行动。", "The shogunate enforced isolation and the Vision Hunt Decree, and the Traveler joined the resistance after witnessing their cost.") },
        { title: text("愚人众介入", "Fatui intervention"), body: text("愚人众通过邪眼等手段扩大冲突，女士与散兵分别参与稻妻行动。", "The Fatui intensified the conflict through Delusions, with Signora and Scaramouche taking separate roles in the operation.") },
        { title: text("雷神之心易手", "The Electro Gnosis changes hands"), body: text("雷电影早已把神之心交给八重神子保管，神子后来用它换回旅行者，散兵则带着神之心离开。", "Ei had already entrusted the Gnosis to Yae Miko, who later traded it to save the Traveler; Scaramouche departed with it.") },
      ],
      hooks: [
        text("散兵脱离愚人众并带走雷神之心后，他真正想用它完成什么？", "After leaving the Fatui with the Electro Gnosis, what did Scaramouche truly intend to accomplish with it?"),
        text("雷电影不再需要神之心的选择，会怎样影响其他神明对神之心的态度？", "How might Ei's choice not to rely on a Gnosis shape how other Archons view their own?"),
      ],
    },
  },
  sumeru: {
    region: "sumeru",
    timelineNodeId: "sumeru-gnoses",
    relationGraphId: "sumeru-gnoses-graph",
    newPlayer: {
      overview: text("须弥是围绕智慧、学术与记忆展开的草之国。旅行者来到这里时，知识由庞大的学术体系管理，而不同群体对何为真正的智慧有着截然不同的答案。", "Sumeru is the nation of wisdom, scholarship, and memory. When the Traveler arrives, knowledge is governed by a powerful academic system, while different groups disagree on what true wisdom means."),
      factions: [
        { name: text("须弥教令院", "Sumeru Akademiya"), role: text("管理学术研究与知识秩序的核心机构。", "The central institution governing scholarship and the order of knowledge.") },
        { name: text("小吉祥草王", "Lesser Lord Kusanali"), role: text("须弥现任草神，与人民和知识体系有独特联系。", "Sumeru's current Dendro Archon, with a unique bond to its people and knowledge system.") },
        { name: text("愚人众", "Fatui"), role: text("由执行官推动计划的外来力量，对须弥的研究与神明抱有目的。", "An outside force led by Harbingers with its own interest in Sumeru's research and Archon.") },
      ],
      storySteps: [
        text("旅行者为寻找智慧之神进入须弥，并发现城市对知识的依赖远超想象。", "The Traveler enters Sumeru seeking the God of Wisdom and discovers how deeply the city depends on controlled knowledge."),
        text("学者、神明与外来执行官围绕知识、权力和人的意志展开角力。", "Scholars, an Archon, and foreign Harbingers struggle over knowledge, power, and human will."),
        text("旅行者需要理解雨林与沙漠的不同处境，帮助须弥重新决定如何使用智慧。", "The Traveler must understand both rainforest and desert communities as Sumeru reconsiders how wisdom should be used."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("虚空与轮回", "The Akasha and the samsara"), body: text("旅行者发现教令院利用虚空控制信息，并在花神诞祭的轮回中追查异常。", "The Traveler discovered the Akademiya's control of information through the Akasha and investigated the Sabzeruz Festival samsara.") },
        { title: text("造神计划", "The god-creation project"), body: text("教令院贤者与博士合作，试图让散兵借助雷神之心成为新的神明。", "The Akademiya sages cooperated with Dottore in an attempt to elevate Scaramouche with the Electro Gnosis.") },
        { title: text("两次交换", "Two exchanges"), body: text("纳西妲取回雷神之心后与博士谈判：一枚换取销毁切片，一枚换取关于提瓦特的重要情报。", "After recovering the Electro Gnosis, Nahida negotiated with Dottore, trading one for the destruction of his segments and one for critical information about Teyvat.") },
      ],
      hooks: [
        text("博士带走雷、草两枚神之心后，它们会在至冬计划中承担什么作用？", "After Dottore took the Electro and Dendro Gnoses, what role will they serve in Snezhnaya's plan?"),
        text("关于虚假之天的情报为什么值得纳西妲交出一枚神之心？", "Why was information about the false sky worth a Gnosis to Nahida?"),
      ],
    },
  },
  fontaine: {
    region: "fontaine",
    timelineNodeId: "fontaine-gnosis",
    relationGraphId: "fontaine-gnosis-graph",
    newPlayer: {
      overview: text("枫丹是重视正义、审判与技术的水之国。华丽的公开审判背后，城市同时面对一场与所有枫丹人有关的长期危机。", "Fontaine is the nation of justice, trials, and technology. Behind its theatrical public courtrooms, the nation faces a long-running crisis tied to every Fontainian."),
      factions: [
        { name: text("枫丹廷与审判体系", "Court of Fontaine"), role: text("通过公开审判与法律维持国家秩序。", "The institutions that maintain national order through law and public trials.") },
        { name: text("梅洛彼得堡", "Fortress of Meropide"), role: text("位于水下、拥有独立规则的管理区域。", "An underwater institution with its own rules and community.") },
        { name: text("壁炉之家", "House of the Hearth"), role: text("由愚人众经营、与枫丹孤儿及情报网络相连的组织。", "A Fatui-run organization tied to Fontainian orphans and an intelligence network.") },
      ],
      storySteps: [
        text("旅行者来到枫丹，希望从水神与公开审判中寻找新的线索。", "The Traveler arrives in Fontaine seeking new clues from its Archon and famous trials."),
        text("连续案件与一则古老预言逐渐显示，国家的危机并非普通犯罪。", "A chain of cases and an old prophecy reveal that the nation's crisis is larger than ordinary crime."),
        text("旅行者需要在法庭、地下设施与不同势力之间寻找事实。", "The Traveler must pursue the truth across courtrooms, underground facilities, and competing factions."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("预言与案件", "Prophecy and cases"), body: text("旅行者通过少女失踪案等事件追查枫丹预言，并逐步确认危机与原始胎海有关。", "Through cases including the missing women investigation, the Traveler traced Fontaine's prophecy to a crisis involving the Primordial Sea.") },
        { title: text("神座与权能", "Divine throne and authority"), body: text("芙卡洛斯的计划让水神神座归还其力量，枫丹的命运由此发生根本改变。", "Focalors' plan returned the Hydro authority and fundamentally changed Fontaine's fate.") },
        { title: text("水神之心交付", "The Hydro Gnosis handed over"), body: text("危机后，那维莱特将水神之心交给仆人；这一交接也把枫丹线索重新连接到愚人众。", "After the crisis, Neuvillette handed the Hydro Gnosis to Arlecchino, reconnecting Fontaine's story to the Fatui campaign.") },
      ],
      hooks: [
        text("仆人完成水神之心任务后，她与至冬其他执行官的目标仍然一致吗？", "After completing the Hydro Gnosis mission, do Arlecchino's goals still align with those of the other Harbingers?"),
        text("古龙权能回归后，七神与提瓦特旧秩序之间会出现怎样的新关系？", "After a sovereign authority returned, what new relationship might emerge between the Seven and Teyvat's older order?"),
      ],
    },
  },
  natlan: {
    region: "natlan",
    timelineNodeId: "natlan-gnosis",
    relationGraphId: "natlan-gnosis-graph",
    newPlayer: {
      overview: text("纳塔是以部族、竞技与传承共同面对战争的火之国。旅行者抵达时，真正威胁这片土地的并非普通对手，而是长期侵蚀世界的深渊力量。", "Natlan is the nation of fire, where tribes, contests, and inherited traditions face war together. When the Traveler arrives, the real threat is not an ordinary rival but the Abyss that has eroded the land for generations."),
      factions: [
        { name: text("纳塔六部族", "Six tribes of Natlan"), role: text("拥有不同传统与伙伴，却共同承担保卫纳塔的责任。", "Communities with distinct traditions and companions that share responsibility for defending Natlan.") },
        { name: text("火神与战士", "Pyro Archon and warriors"), role: text("组织对抗深渊、维系纳塔传承的核心力量。", "The central force organizing resistance to the Abyss and preserving Natlan's legacy.") },
        { name: text("愚人众与队长", "Fatui and Capitano"), role: text("带着神之心任务进入纳塔，也有自己对危机的判断。", "An outside force that enters Natlan on a Gnosis mission while holding its own view of the crisis.") },
      ],
      storySteps: [
        text("旅行者进入纳塔并参与当地竞技，由此认识不同部族。", "The Traveler enters Natlan and meets its tribes through local contests."),
        text("部族之间的竞争逐渐汇入对抗深渊的共同战线。", "Rivalries between tribes gradually become a shared front against the Abyss."),
        text("旅行者会在火神、战士与外来执行官之间理解纳塔如何延续自己的历史。", "Through the Archon, warriors, and a foreign Harbinger, the Traveler learns how Natlan preserves its history."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("巡夜者战争", "War against the Abyss"), body: text("纳塔各部族通过古名、竞技与共同作战维系对深渊的抵抗。", "Natlan's tribes sustained their resistance to the Abyss through Ancient Names, contests, and collective battle.") },
        { title: text("队长的任务", "Capitano's mission"), body: text("队长最初肩负取得火神之心的任务，却在了解纳塔危机后采取了更复杂的立场。", "Capitano initially carried a mission to obtain the Pyro Gnosis, but took a more complex position after confronting Natlan's crisis.") },
        { title: text("火神之心留存", "The Pyro Gnosis remains"), body: text("纳塔主线收束时，火神之心没有被队长带走，而是继续与应对深渊的计划相连。", "At the close of Natlan's main conflict, Capitano did not take the Pyro Gnosis, leaving it connected to the continuing response to the Abyss.") },
      ],
      hooks: [
        text("队长没有完成最初的神之心任务，这会怎样改变他与至冬的关系？", "How will Capitano's failure to complete his original Gnosis mission change his relationship with Snezhnaya?"),
        text("火神之心继续留在对抗深渊的计划中，它最终会被如何使用？", "With the Pyro Gnosis still tied to the fight against the Abyss, how will it ultimately be used?"),
      ],
    },
  },
  nodkrai: {
    region: "nodkrai",
    timelineNodeId: "nodkrai-gnosis",
    relationGraphId: "nodkrai-gnosis-graph",
    newPlayer: {
      overview: text("挪德卡莱位于至冬边缘，是月之力量、地方组织与愚人众活动交汇的区域。旅行者来到这里时，会发现通往至冬核心的道路并不只由一个势力掌控。", "Nod-Krai lies on Snezhnaya's frontier, where lunar powers, local groups, and Fatui operations intersect. The Traveler discovers that no single faction controls the road toward Snezhnaya's center."),
      factions: [
        { name: text("挪德卡莱地方势力", "Nod-Krai local groups"), role: text("在自治传统与外部压力之间维护当地生活。", "Local organizations preserving their way of life between autonomous traditions and outside pressure.") },
        { name: text("愚人众", "Fatui"), role: text("在至冬边境拥有广泛行动网络与执行任务。", "A broad operational network carrying out missions across Snezhnaya's frontier.") },
        { name: text("月之相关力量", "Lunar-aligned powers"), role: text("与当地历史、异常现象和更古老的力量相连。", "Powers connected to local history, anomalies, and something older.") },
      ],
      storySteps: [
        text("旅行者从纳塔之后的线索进入挪德卡莱，继续追踪至冬与深渊相关事件。", "Following leads from Natlan, the Traveler enters Nod-Krai and continues tracing events tied to Snezhnaya and the Abyss."),
        text("地方势力、愚人众与月之力量围绕各自目标发生碰撞。", "Local groups, the Fatui, and lunar powers collide over different goals."),
        text("这里的事件会把此前分散的神之心、世界树与执行官线索重新连接起来。", "Events here reconnect earlier threads involving Gnoses, Irminsul, and the Harbingers."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("边境线索汇合", "Frontier threads converge"), body: text("挪德卡莱把纳塔之后的深渊威胁、愚人众行动与月之力量带到同一条主线上。", "Nod-Krai brought the post-Natlan Abyss threat, Fatui operations, and lunar powers into one storyline.") },
        { title: text("世界树危机", "The Irminsul crisis"), body: text("博士造成的破坏让世界树体系面临无法修复的威胁，纳西妲需要借助新的力量处理危机。", "Damage caused by Dottore left the Irminsul system facing an irreparable threat, forcing Nahida to seek new power to address it.") },
        { title: text("火神之心下落", "The Pyro Gnosis disappears"), body: text("火神之心被用于焚毁受腐蚀的世界树，并在释放力量后无法寻回。", "The Pyro Gnosis was used to burn the corrupted Irminsul and could not be recovered after releasing its power.") },
      ],
      hooks: [
        text("火神之心消失后，至冬收集七枚神之心的计划还剩下怎样的缺口？", "After the Pyro Gnosis vanished, what gap remains in Snezhnaya's plan to gather all seven?"),
        text("月之力量与世界树危机在挪德卡莱交汇，背后是否指向同一个更大问题？", "When lunar powers and the Irminsul crisis converge in Nod-Krai, do they point to the same larger problem?"),
      ],
    },
  },
  snezhnaya: {
    region: "snezhnaya",
    newPlayer: {
      overview: text("至冬是冰之女皇统治的国度，也是愚人众与执行官的大本营。此前各国出现的神之心、外交与执行官行动，会在这里汇入同一个核心问题。", "Snezhnaya is ruled by the Tsaritsa and serves as the home of the Fatui and its Harbingers. Threads involving Gnoses, diplomacy, and Harbinger missions from every nation converge here."),
      factions: [
        { name: text("冰之女皇与至冬政权", "The Tsaritsa and Snezhnayan state"), role: text("决定国家方向，也是收集神之心计划的最高意志。", "The authority directing the nation and the campaign to collect the Gnoses.") },
        { name: text("愚人众", "Fatui"), role: text("遍布提瓦特的外交、军事与情报组织。", "A diplomatic, military, and intelligence organization active across Teyvat.") },
        { name: text("愚人众执行官", "Fatui Harbingers"), role: text("各自拥有不同经历与手段，负责推进至冬的重要任务。", "Powerful agents with different histories and methods who advance Snezhnaya's major missions.") },
      ],
      storySteps: [
        text("旅行者沿着此前七国留下的神之心与执行官线索接近至冬。", "The Traveler approaches Snezhnaya by following Gnosis and Harbinger threads left across the nations."),
        text("曾经分散行动的执行官与至冬目标将在本土环境中重新被理解。", "Harbingers previously seen on separate missions can now be understood within their homeland and shared command."),
        text("旅行者需要面对冰之女皇的计划，并判断它与天理及提瓦特未来的关系。", "The Traveler must confront the Tsaritsa's plan and decide how it relates to the Heavenly Principles and Teyvat's future."),
      ],
    },
    returningPlayer: {
      recapPoints: [
        { title: text("神之心收集", "The Gnosis campaign"), body: text("愚人众先后通过强夺、契约、交换与交接取得多枚神之心，手段随地区与执行官而变化。", "Across the nations, the Fatui obtained multiple Gnoses through force, contract, negotiation, and transfer, adapting their methods to each mission.") },
        { title: text("执行官并非一体", "The Harbingers are not uniform"), body: text("女士、公子、散兵、博士、仆人与队长展现了不同目标、立场和对命令的理解。", "Signora, Childe, Scaramouche, Dottore, Arlecchino, and Capitano revealed different motives, loyalties, and interpretations of their orders.") },
        { title: text("旧线索汇入至冬", "Old threads converge"), body: text("虚假之天、深渊、世界树和七枚神之心逐渐从地区事件变成同一场更大冲突的组成部分。", "The false sky, the Abyss, Irminsul, and the seven Gnoses gradually shifted from regional incidents into parts of one larger conflict.") },
      ],
      hooks: [
        text("冰之女皇收集神之心的最终目标，究竟要对抗什么？", "What does the Tsaritsa ultimately intend to confront by gathering the Gnoses?"),
        text("当执行官的个人选择与至冬命令冲突时，他们最终会站在哪一边？", "When a Harbinger's personal choices conflict with Snezhnaya's orders, which side will they ultimately take?"),
        text("失去或下落不明的神之心，会怎样改变至冬原本的计划？", "How will lost or missing Gnoses change Snezhnaya's original plan?"),
      ],
    },
  },
};

export function getPreheatRegionGuide(
  region: NamedProgress,
  language: Language,
) {
  const guide = preheatRegionGuides[region];
  return {
    region,
    timelineNodeId: guide.timelineNodeId,
    relationGraphId: guide.relationGraphId,
    newPlayer: {
      overview: guide.newPlayer.overview[language],
      factions: guide.newPlayer.factions.map((item) => ({
        name: item.name[language],
        role: item.role[language],
      })),
      storySteps: guide.newPlayer.storySteps.map((item) => item[language]) as [
        string,
        string,
        string,
      ],
    },
    returningPlayer: {
      recapPoints: guide.returningPlayer.recapPoints.map((item) => ({
        title: item.title[language],
        body: item.body[language],
      })),
      hooks: guide.returningPlayer.hooks.map((item) => item[language]),
    },
  };
}

export function validatePreheatRegionGuides() {
  const errors: string[] = [];
  for (const region of namedProgress) {
    const guide = preheatRegionGuides[region];
    if (!guide) {
      errors.push(`region-guide:${region}:missing`);
      continue;
    }
    if (guide.newPlayer.factions.length < 3) {
      errors.push(`region-guide:${region}:factions`);
    }
    if (guide.newPlayer.storySteps.length !== 3) {
      errors.push(`region-guide:${region}:story-steps`);
    }
    if (guide.returningPlayer.recapPoints.length < 3) {
      errors.push(`region-guide:${region}:recap-points`);
    }
    if (guide.returningPlayer.hooks.length < 2) {
      errors.push(`region-guide:${region}:hooks`);
    }
    for (const hook of guide.returningPlayer.hooks) {
      if (!/[？?]$/.test(hook["zh-CN"]) || !/[?]$/.test(hook.en)) {
        errors.push(`region-guide:${region}:hook-format`);
      }
    }
  }
  return errors;
}
