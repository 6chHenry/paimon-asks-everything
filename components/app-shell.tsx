"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Flame,
  MessageCircleMore,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  TestTube2,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { clientPath } from "@/lib/client-path";

const navigation = [
  { href: "/", labelZh: "版本情报", labelEn: "Intel", icon: Sparkles },
  { href: "/preheat", labelZh: "版本预热", labelEn: "Preheat", icon: Flame },
  { href: "/ask", labelZh: "问派蒙", labelEn: "Ask", icon: MessageCircleMore },
  { href: "/preview", labelZh: "能力预览", labelEn: "Preview", icon: TestTube2 },
  { href: "/insights", labelZh: "发行洞察", labelEn: "Insights", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePath = pathname.replace(/^.*\/proxy\/\d+/u, "") || "/";
  const { preferences, setPreferences } = usePreferences();
  const isZh = preferences.language === "zh-CN";
  const [navCollapsed, setNavCollapsed] = useState(false);

  const renderNavigation = () =>
    navigation.map((item) => {
      const Icon = item.icon;
      const isActive = activePath === item.href;

      return (
        <a
          href={clientPath(item.href)}
          key={item.href}
          className={`game-nav-item${isActive ? " active" : ""}`}
          aria-current={isActive ? "page" : undefined}
          title={isZh ? item.labelZh : item.labelEn}
        >
          <Icon size={17} />
          <span>{isZh ? item.labelZh : item.labelEn}</span>
        </a>
      );
    });

  return (
    <div className={`site-shell game-shell${navCollapsed ? " nav-collapsed" : ""}`}>
      <aside className="game-nav-rail" aria-label="Global navigation">
        <div className="game-nav-head">
          <a href={clientPath("/")} className="game-brand" aria-label="Paimon Asks Everything">
            <span className="brand-sigil">
              <Sparkles size={18} />
            </span>
            <span>
              <strong>{isZh ? "派蒙三千问" : "Paimon Asks Everything"}</strong>
              <small>{isZh ? "版本理解 Agent" : "Version understanding agent"}</small>
            </span>
          </a>
          <button
            className="game-nav-collapse"
            type="button"
            onClick={() => setNavCollapsed((collapsed) => !collapsed)}
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!navCollapsed}
          >
            {navCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="game-nav-list" aria-label="Main navigation">{renderNavigation()}</nav>
      </aside>
      <div className="game-frame">
        <header className="game-status-bar">
          <span>
            {isZh
              ? "非官方概念 Demo · 不读取游戏账号"
              : "Unofficial concept demo · No game account access"}
          </span>
          <button
            className="language-toggle"
            type="button"
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                language: current.language === "zh-CN" ? "en" : "zh-CN",
              }))
            }
            aria-label="Switch language"
          >
            <span className={isZh ? "selected" : ""}>中</span>
            <span className={!isZh ? "selected" : ""}>EN</span>
          </button>
        </header>
        <main className="game-content">{children}</main>
      </div>
      <nav className="game-bottom-nav" aria-label="Mobile navigation">{renderNavigation()}</nav>
    </div>
  );
}
