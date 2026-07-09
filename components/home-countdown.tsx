"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import type { Language } from "@/lib/domain";
import { t } from "@/lib/i18n";
import styles from "./home-countdown.module.css";

const TARGET_BJT_TIMESTAMP = Date.UTC(2026, 7, 11, 16, 0, 0);

type CountdownSnapshot = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  beijingNow: string;
};

function snapshot(): CountdownSnapshot {
  const now = Date.now();
  const remaining = Math.max(0, TARGET_BJT_TIMESTAMP - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    beijingNow: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now),
  };
}

function formatUnit(value: number, minLength = 2) {
  return String(value).padStart(minLength, "0");
}

export function HomeCountdown({ language }: { language: Language }) {
  const [time, setTime] = useState<CountdownSnapshot | null>(null);
  const isZh = language === "zh-CN";

  useEffect(() => {
    setTime(snapshot());
    const timer = window.setInterval(() => setTime(snapshot()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const units = [
    {
      key: "days",
      value: time ? formatUnit(time.days) : "--",
      label: t(language, "日", "Days"),
    },
    {
      key: "hours",
      value: time ? formatUnit(time.hours) : "--",
      label: t(language, "时", "Hours"),
    },
    {
      key: "minutes",
      value: time ? formatUnit(time.minutes) : "--",
      label: t(language, "分", "Minutes"),
    },
    {
      key: "seconds",
      value: time ? formatUnit(time.seconds) : "--",
      label: t(language, "秒", "Seconds"),
    },
  ];

  return (
    <section
      className={`${styles.countdown} reveal`}
      aria-label={t(
        language,
        "距离 2026 年 8 月 12 日北京时间零点的倒计时",
        "Countdown to August 12, 2026 at midnight Beijing time",
      )}
    >
      <div className={styles.inner}>
        <div className={styles.copy}>
          <div>
            <span className={styles.eyebrow}>
              <Clock3 size={14} />
              {t(language, "北京时间倒计时", "Beijing time countdown")}
            </span>
            <h2>
              {t(
                language,
                "距离 8 月 12 日还有",
                "Until August 12",
              )}
            </h2>
            <p>
              {t(
                language,
                "以北京时间 2026 年 8 月 12 日 00:00 为目标，每秒校准当前时间。",
                "Counting down to August 12, 2026 00:00 Beijing time, updated every second.",
              )}
            </p>
          </div>
          <span className={styles.timeNote}>
            {time
              ? isZh
                ? `当前北京时间 ${time.beijingNow}`
                : `Current Beijing time ${time.beijingNow}`
              : t(language, "正在校准北京时间", "Calibrating Beijing time")}
          </span>
        </div>

        <div className={styles.flipGrid} aria-live="polite">
          {units.map((unit) => (
            <div className={styles.unit} key={unit.key}>
              <div className={styles.card}>
                <span className={styles.value} key={unit.value}>
                  {unit.value}
                </span>
              </div>
              <span className={styles.label}>{unit.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
