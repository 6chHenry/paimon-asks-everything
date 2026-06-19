"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, CircleAlert, LoaderCircle, Send, Stars } from "lucide-react";
import { AnswerCard } from "@/components/answer-card";
import { usePreferences } from "@/components/preferences-provider";
import { StatusBar } from "@/components/status-bar";
import type { ChatResult } from "@/lib/domain";
import { t } from "@/lib/i18n";

const questions = {
  "zh-CN": [
    "我停在枫丹，现在还能看懂目标版本吗？",
    "桑多涅目前有哪些已经公开的信息？",
    "桑多涅和阿兰之间有官方确认的直接关系吗？",
    "这个机械机关我卡住了，先给一点提示。",
    "直接告诉我桑多涅是不是阿兰，她的真身到底是谁？",
  ],
  en: [
    "I stopped after Fontaine. What context do I actually need?",
    "What is officially known about Sandrone?",
    "Is there a confirmed link between Sandrone and Alain?",
    "I am stuck on this mechanical puzzle. Give me a small hint first.",
    "Is Sandrone really Alain? Tell me her true identity.",
  ],
};

export default function AskPage() {
  const { preferences, sessionId } = usePreferences();
  const language = preferences.language;
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitQuestion(
    text: string,
    confirmationToken?: string,
  ) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    if (!confirmationToken) {
      setResult(null);
      setLastQuestion(text);
    }
    try {
      const response = await fetch(
        confirmationToken ? "/api/chat/confirm-spoiler" : "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            ...preferences,
            sessionId,
            ...(confirmationToken ? { confirmationToken } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error("request_failed");
      setResult((await response.json()) as ChatResult);
      setQuestion("");
    } catch {
      setError(
        t(
          language,
          "这次连接没有成功。请稍后重试；你的原始问题没有因此被保存。",
          "The request did not complete. Try again in a moment; your question text was not stored because of this failure.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(question);
  }

  return (
    <div className="ask-page page-wrap">
      <section className="ask-intro">
        <div>
          <span className="eyebrow"><Stars size={14} />{t(language, "自由提问 · 证据可追溯", "Ask freely · Trace the evidence")}</span>
          <h1>{t(language, "把你卡住的那一小段，交给派蒙。", "Give Paimon the one part that’s blocking you.")}</h1>
          <p>{t(language, "不需要写成标准问题。说你记得什么、担心什么，或者只想知道到哪一步就够了。", "It does not need to be a perfect prompt. Say what you remember, what you worry about, or how much context is enough.")}</p>
        </div>
        <StatusBar />
      </section>

      <div className="ask-layout">
        <section className="conversation-panel">
          {!result && !loading ? (
            <div className="empty-conversation">
              <img src="/compass-mark.svg" alt="" />
              <h2>{t(language, "先从一个真实困惑开始", "Start with a real point of confusion")}</h2>
              <p>{t(language, "受控语料会优先回答；覆盖不到时才去白名单 Wiki 寻找外部资料。", "Controlled knowledge answers first. Only long-tail gaps fall back to the whitelisted wiki.")}</p>
            </div>
          ) : null}
          {loading ? (
            <div className="loading-card" role="status">
              <LoaderCircle className="spin" size={28} />
              <div>
                <strong>{t(language, "派蒙正在整理证据", "Paimon is arranging the evidence")}</strong>
                <span>{t(language, "检索、检查剧透边界、绑定来源……", "Retrieving, checking spoiler boundaries, binding sources…")}</span>
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="error-card"><CircleAlert size={20} /><span>{error}</span></div>
          ) : null}
          {result ? (
            <AnswerCard
              result={result}
              language={language}
              onConfirmSpoiler={() =>
                result.confirmationToken
                  ? void submitQuestion(lastQuestion, result.confirmationToken)
                  : undefined
              }
            />
          ) : null}

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t(language, "例如：我停在枫丹，现在还看得懂吗？", "For example: I stopped after Fontaine — can I still follow?")}
              rows={3}
              maxLength={800}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!loading) void submitQuestion(question);
                }
              }}
            />
            <div className="composer-meta">
              <span>
                {preferences.allowQuestionTextStorage
                  ? t(language, "原始问题：已授权保存", "Question text: consented")
                  : t(language, "原始问题：不保存", "Question text: not stored")}
              </span>
              <span>{question.length}/800</span>
              <button type="submit" disabled={loading || question.trim().length < 2}>
                <Send size={17} />
                {t(language, "发送", "Send")}
              </button>
            </div>
          </form>
        </section>

        <aside className="suggestions-panel">
          <div className="aside-heading">
            <span>FIELD NOTES</span>
            <h2>{t(language, "试试这些问法", "Try one of these")}</h2>
          </div>
          <div className="suggestion-list">
            {questions[language].map((item, index) => (
              <button
                type="button"
                key={item}
                onClick={() => {
                  setQuestion(item);
                  void submitQuestion(item);
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
                <ArrowUp size={16} />
              </button>
            ))}
          </div>
          <div className="privacy-note">
            <strong>{t(language, "数据最小化", "Data minimization")}</strong>
            <p>{t(language, "默认只记录语言、画像、类别、困惑主题和回答状态。不会记录 UID、账号、IP 或完整会话。", "By default we only record language, profile, category, confusion topic, and response status — never UID, account, IP, or full conversations.")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
