import { ArrowRight, Feather } from "lucide-react";
import { paimonNotes } from "@/data/paimon-notes";
import { clientPath } from "@/lib/client-path";
import type { Language } from "@/lib/domain";
import { noteIndexForDate } from "@/lib/traveler-discoveries";

export function TodayPaimonNote({ language }: { language: Language }) {
  const note = paimonNotes[noteIndexForDate(new Date(), paimonNotes.length)];
  if (!note) return null;

  return (
    <aside className="today-paimon-note reveal" aria-label={language === "zh-CN" ? "今日派蒙小纸条" : "Today's Paimon note"}>
      <div className="today-paimon-note-mark"><Feather size={18} /></div>
      <div className="today-paimon-note-copy">
        <span>{language === "zh-CN" ? "今日派蒙小纸条" : "TODAY'S PAIMON NOTE"}</span>
        <strong>{note.title[language]}</strong>
        <p>{note.body[language]}</p>
      </div>
      <a href={clientPath(note.href)} aria-label={language === "zh-CN" ? `查看：${note.title[language]}` : `Explore: ${note.title[language]}`}>
        <span>{language === "zh-CN" ? "顺着线索看" : "Follow the clue"}</span>
        <ArrowRight size={16} />
      </a>
    </aside>
  );
}
