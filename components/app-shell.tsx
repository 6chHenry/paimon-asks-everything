"use client";

import { useEffect, useState } from "react";
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

const NAV_COLLAPSED_STORAGE_KEY = "paimon-nav-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePath = pathname.replace(/^.*\/proxy\/\d+/u, "") || "/";
  const { preferences, setPreferences } = usePreferences();
  const isZh = preferences.language === "zh-CN";
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    try {
      const storedCollapsed =
        window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "true";
      setNavCollapsed(storedCollapsed);
      if (storedCollapsed) {
        document.documentElement.dataset.navCollapsed = "true";
      } else {
        delete document.documentElement.dataset.navCollapsed;
      }
    } catch {
      // Ignore private browsing or storage restrictions.
    }
  }, []);

  function toggleNavCollapsed() {
    setNavCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      try {
        window.localStorage.setItem(
          NAV_COLLAPSED_STORAGE_KEY,
          String(nextCollapsed),
        );
        if (nextCollapsed) {
          document.documentElement.dataset.navCollapsed = "true";
        } else {
          delete document.documentElement.dataset.navCollapsed;
        }
      } catch {
        // Ignore private browsing or storage restrictions.
      }
      return nextCollapsed;
    });
  }


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
          <span className="game-nav-icon">
            <Icon size={17} />
          </span>
          <span className="game-nav-label">{isZh ? item.labelZh : item.labelEn}</span>
        </a>
      );
    });

  return (
    <div className={`site-shell game-shell${navCollapsed ? " nav-collapsed" : ""}`}>
      <aside className="game-nav-rail" aria-label="Global navigation">
        <div className="game-nav-head">
          <div className="game-nav-brand-slot">
            <a href={clientPath("/")} className="game-brand" aria-label="Paimon Asks Everything">
              <span className="brand-sigil">
                <img src="/icon.png" alt="" aria-hidden="true" />
              </span>
              <span>
                <strong>{isZh ? "派蒙三千问" : "Paimon Asks Everything"}</strong>
                <small>{isZh ? "版本理解 Agent" : "Version understanding agent"}</small>
              </span>
            </a>
          </div>
          <div className="game-nav-collapse-slot">
            <button
              className="game-nav-collapse"
              type="button"
              onClick={toggleNavCollapsed}
              aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!navCollapsed}
            >
              <PanelLeftOpen className="game-nav-collapse-open" size={17} aria-hidden="true" />
              <PanelLeftClose className="game-nav-collapse-close" size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav className="game-nav-list" aria-label="Main navigation">{renderNavigation()}</nav>
        <div className="game-nav-tools" aria-label={isZh ? "偏好设置" : "Preferences"}>
          <span className="game-nav-language-label">{isZh ? "语言" : "Language"}</span>
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
            title={isZh ? "切换语言" : "Switch language"}
          >
            <span className={isZh ? "selected" : ""}>中</span>
            <span className={!isZh ? "selected" : ""}>EN</span>
          </button>
        </div>
      </aside>
      <div className="game-frame">
        <main className="game-content">{children}</main>
      </div>
      <nav className="game-bottom-nav" aria-label="Mobile navigation">{renderNavigation()}</nav>
    </div>
  );
}
