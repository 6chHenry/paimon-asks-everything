"use client";

import { useState } from "react";
import { Copy, Send, Sparkles, X } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import {
  buildClueCardText,
  type TravelerDiscoveries,
} from "@/lib/traveler-discoveries";

export function TravelerClueCard({
  discoveries,
  onDismiss,
}: {
  discoveries: TravelerDiscoveries;
  onDismiss: () => void;
}) {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const text = buildClueCardText(discoveries, language);
  const [shareState, setShareState] = useState<"idle" | "copied" | "fallback">("idle");

  async function shareCard() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: language === "zh-CN" ? "旅行者的至冬线索卡" : "Traveler's Snezhnaya clue card",
          text,
        });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareState("copied");
    } catch {
      setShareState("fallback");
    }
  }

  return (
    <div className="traveler-clue-overlay" role="presentation">
      <section className="traveler-clue-card" role="dialog" aria-modal="true" aria-labelledby="traveler-clue-title" aria-live="polite">
        <button className="traveler-clue-close" type="button" onClick={onDismiss} aria-label={language === "zh-CN" ? "关闭线索卡" : "Close clue card"}>
          <X size={18} />
        </button>
        <div className="traveler-clue-sigil"><Sparkles size={22} /></div>
        <span>{language === "zh-CN" ? "巡游星图完成" : "CONSTELLATION UNLOCKED"}</span>
        <h2 id="traveler-clue-title">{language === "zh-CN" ? "旅行者的至冬线索卡" : "Traveler's Snezhnaya clue card"}</h2>
        <p>{text}</p>
        <div className="traveler-clue-count">
          <strong>{discoveries.visitedNodeIds.length}</strong>
          <span>{language === "zh-CN" ? "已发现节点" : "nodes discovered"}</span>
        </div>
        <div className="traveler-clue-actions">
          <button type="button" onClick={() => void shareCard()}>
            {shareState === "copied" ? <Copy size={16} /> : <Send size={16} />}
            {language === "zh-CN" ? "分享线索卡" : "Share clue card"}
          </button>
          <button type="button" onClick={onDismiss}>
            {language === "zh-CN" ? "继续探索" : "Keep exploring"}
          </button>
        </div>
        {shareState === "copied" ? <small className="traveler-clue-feedback">{language === "zh-CN" ? "线索卡文案已复制。" : "Clue card text copied."}</small> : null}
        {shareState === "fallback" ? (
          <label className="traveler-clue-fallback">
            <span>{language === "zh-CN" ? "复制这段线索" : "Copy this clue"}</span>
            <textarea readOnly value={text} rows={3} onFocus={(event) => event.currentTarget.select()} />
          </label>
        ) : null}
      </section>
    </div>
  );
}
