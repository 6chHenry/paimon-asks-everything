"use client";

import type { Language } from "@/lib/domain";
import type { LlmApiStyle } from "@/lib/llm-api-style";

type Props = {
  value: LlmApiStyle;
  onChange: (value: LlmApiStyle) => void;
  disabled?: boolean;
  language: Language;
};

export function SearchModeToggle({
  value,
  onChange,
  disabled = false,
  language,
}: Props) {
  const options: Array<{
    value: LlmApiStyle;
    label: string;
    detail: string;
  }> = [
    {
      value: "openai",
      label: language === "zh-CN" ? "自研检索" : "Designed Search",
      detail: language === "zh-CN" ? "OpenAI · 我的流程" : "OpenAI · My flow",
    },
    {
      value: "anthropic",
      label: language === "zh-CN" ? "原生 Web Search" : "Native Web Search",
      detail: "Anthropic",
    },
  ];

  return (
    <div className="search-mode-toggle" role="radiogroup" aria-label={language === "zh-CN" ? "搜索方式" : "Search mode"}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          <strong>{option.label}</strong>
          <small>{option.detail}</small>
        </button>
      ))}
    </div>
  );
}
