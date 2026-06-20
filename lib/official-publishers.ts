export interface OfficialPublisher {
  platform: "bilibili" | "youtube" | "miyoushe" | "hoyolab";
  accountId: string;
  canonicalName: string;
  profileUrl: string;
  aliases: string[];
}

export const officialPublishers: OfficialPublisher[] = [
  {
    platform: "bilibili",
    accountId: "401742377",
    canonicalName: "原神",
    profileUrl: "https://space.bilibili.com/401742377/",
    aliases: ["原神", "原神官方账号"],
  },
  {
    platform: "youtube",
    accountId: "UCiS882YPwZt1NfaM0gR0D9Q",
    canonicalName: "Genshin Impact",
    profileUrl: "https://www.youtube.com/c/GenshinImpact",
    aliases: ["Genshin Impact", "@GenshinImpact"],
  },
];

export function officialPublisherById(
  platform: OfficialPublisher["platform"],
  accountId: string | undefined,
) {
  if (!accountId) return undefined;
  return officialPublishers.find(
    (publisher) =>
      publisher.platform === platform && publisher.accountId === accountId,
  );
}
