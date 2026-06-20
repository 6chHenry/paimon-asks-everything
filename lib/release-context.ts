export const RELEASE_CONTEXT = {
  asOfDate: "2026-06-20",
  liveVersion: "月之七",
  liveVersionTitle: "空月之歌·行律",
  nextVersion: "月之八",
  nextVersionTitle: "空月之歌·谐谑",
  nextVersionReleaseDate: "2026-07-01",
} as const;

export function releaseContextPrompt() {
  return [
    `Current date: ${RELEASE_CONTEXT.asOfDate}.`,
    `The currently released live version is ${RELEASE_CONTEXT.liveVersion}「${RELEASE_CONTEXT.liveVersionTitle}」.`,
    `${RELEASE_CONTEXT.nextVersion}「${RELEASE_CONTEXT.nextVersionTitle}」releases on ${RELEASE_CONTEXT.nextVersionReleaseDate}.`,
    `Facts from ${RELEASE_CONTEXT.liveVersion} and earlier are released content.`,
    `Officially published previews for ${RELEASE_CONTEXT.nextVersion} may be discussed, but every such claim must be labeled “官方前瞻／尚未实装” in Chinese or “official preview / not yet released” in English.`,
    "Do not use or repeat leaks, datamines, private-test information, or unpublished material.",
  ].join(" ");
}
