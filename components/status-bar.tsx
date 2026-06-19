"use client";

import { Settings2 } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import type { Progress, SpoilerPreference } from "@/lib/domain";
import { labels, t } from "@/lib/i18n";

export function StatusBar() {
  const { preferences, setPreferences } = usePreferences();
  const language = preferences.language;
  return (
    <details className="status-bar">
      <summary>
        <span className="status-dot" />
        <span>{labels.profile[preferences.profile][language]}</span>
        <i />
        <span>{labels.progress[preferences.progress][language]}</span>
        <i />
        <span>{labels.spoiler[preferences.spoilerPreference][language]}</span>
        <Settings2 size={15} />
      </summary>
      <div className="status-editor">
        <label>
          <span>{t(language, "进度", "Progress")}</span>
          <select
            value={preferences.progress}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                progress: event.target.value as Progress,
              }))
            }
          >
            {(Object.keys(labels.progress) as Progress[]).map((value) => (
              <option key={value} value={value}>
                {labels.progress[value][language]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t(language, "剧透深度", "Spoiler depth")}</span>
          <select
            value={preferences.spoilerPreference}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                spoilerPreference: event.target.value as SpoilerPreference,
              }))
            }
          >
            {(Object.keys(labels.spoiler) as SpoilerPreference[]).map((value) => (
              <option key={value} value={value}>
                {labels.spoiler[value][language]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={preferences.allowQuestionTextStorage}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                allowQuestionTextStorage: event.target.checked,
              }))
            }
          />
          <span>{t(language, "保存问题文本授权", "Question-text consent")}</span>
        </label>
      </div>
    </details>
  );
}
