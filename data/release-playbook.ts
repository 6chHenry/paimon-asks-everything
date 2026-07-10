/**
 * Release-meeting copy, deliberately separated from the deterministic
 * release-insight scoring engine.
 */

export interface ReleasePlaybookEntry {
  topicId: string;
  actionZh: string;
  actionEn: string;
  verificationZh: string;
  verificationEn: string;
}

export const releasePlaybook: Record<string, ReleasePlaybookEntry> = {
  gnosis_journey: {
    topicId: "gnosis_journey",
    actionZh:
      "制作只呈现已确认事件的神之心流转时间线；明确标注尚未公开的结局，不以推测补全故事。",
    actionEn:
      "Create a Gnosis journey timeline using confirmed events only; clearly mark the ending as undisclosed instead of filling it with speculation.",
    verificationZh:
      "发布后观察时间线节点完成率，以及关于结局的重复提问是否下降。",
    verificationEn:
      "After publishing, track timeline-node completion and whether repeated questions about the ending decline.",
  },
  gnosis_purpose: {
    topicId: "gnosis_purpose",
    actionZh:
      "发布“已知 / 未知”FAQ：区分愚人众收集神之心这一已确认行动，与其尚未公开的目的。",
    actionEn:
      "Publish a known / unknown FAQ that separates the confirmed Gnosis-collection campaign from its undisclosed purpose.",
    verificationZh:
      "发布后观察FAQ阅读完成率，以及将行动误当作目的的重复提问是否下降。",
    verificationEn:
      "After publishing, track FAQ completion and whether repeated questions conflating the campaign with its purpose decline.",
  },
  tsaritsa_goal: {
    topicId: "tsaritsa_goal",
    actionZh:
      "发布证据阶梯FAQ，分别标注明确文本、合理暗示与玩家推测，避免把冰之女皇的目标写成已公开结论。",
    actionEn:
      "Publish an evidence-ladder FAQ that separates explicit text, supported implications, and player speculation; do not present the Tsaritsa's goal as disclosed fact.",
    verificationZh:
      "发布后观察FAQ阅读完成率，以及关于目标边界的重复提问是否下降。",
    verificationEn:
      "After publishing, track FAQ completion and whether repeated questions about the goal's factual boundary decline.",
  },
};

export const fallbackReleasePlaybookEntry: ReleasePlaybookEntry = {
  topicId: "default",
  actionZh: "整理已确认信息与仍待公开的边界，先用简明说明回应玩家关切。",
  actionEn:
    "Organize confirmed information and the boundaries of what remains undisclosed, then address player interest with a concise explainer.",
  verificationZh: "发布后观察内容阅读完成率和相关重复提问是否下降。",
  verificationEn:
    "After publishing, track content completion and whether related repeated questions decline.",
};

export function getReleasePlaybookEntry(topicId: string): ReleasePlaybookEntry {
  return releasePlaybook[topicId] ?? fallbackReleasePlaybookEntry;
}
