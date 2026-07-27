"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Flame,
  MessageCircleMore,
  PanelLeftClose,
  PanelLeftOpen,
  Snowflake,
  Sparkles,
  Target,
  TestTube2,
  X,
} from "lucide-react";
import { PAIMON_EGG_PENDING_KEY } from "@/lib/traveler-discoveries";
import { useDiscoveries } from "@/components/discoveries-provider";
import { usePreferences } from "@/components/preferences-provider";
import { clientPath } from "@/lib/client-path";

const navigation = [
  { href: "/", labelZh: "版本情报", labelEn: "Intel", icon: Sparkles },
  { href: "/preheat", labelZh: "版本预热", labelEn: "Preheat", icon: Flame },
  { href: "/ask", labelZh: "问派蒙", labelEn: "Ask", icon: MessageCircleMore },
  { href: "/insights", labelZh: "发行洞察", labelEn: "Insights", icon: BarChart3 },
  { href: "/release-lab", labelZh: "增量实验", labelEn: "Uplift", icon: Target },
];

const pageChrome = {
  "/": {
    code: "VERSION INTELLIGENCE · 07",
    labelZh: "版本情报总览",
    labelEn: "Version Intelligence",
    icon: Sparkles,
  },
  "/preheat": {
    code: "TRAVELER BRIEF · 01",
    labelZh: "旅行者预热档案",
    labelEn: "Traveler Preheat Brief",
    icon: Flame,
  },
  "/ask": {
    code: "PAIMON DIALOGUE · 03",
    labelZh: "派蒙调查台",
    labelEn: "Paimon Inquiry Desk",
    icon: MessageCircleMore,
  },
  "/insights": {
    code: "RELEASE COMMISSION · 04",
    labelZh: "发行行动简报",
    labelEn: "Release Commission Brief",
    icon: BarChart3,
  },
  "/preview": {
    code: "TRIAL ARCHIVE · 06",
    labelZh: "能力验收试炼",
    labelEn: "Capability Trial Archive",
    icon: TestTube2,
  },
  "/about": {
    code: "TRAVEL NOTES · 00",
    labelZh: "旅行手册扉页",
    labelEn: "Traveler Field Notes",
    icon: BookOpenText,
  },
} as const;

const NAV_COLLAPSED_STORAGE_KEY = "paimon-nav-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePath = pathname.replace(/^.*\/proxy\/\d+/u, "") || "/";
  const chrome = pageChrome[activePath as keyof typeof pageChrome] ?? pageChrome["/"];
  const ChromeIcon = chrome.icon;
  const routeSlug = activePath === "/" ? "home" : activePath.slice(1).replaceAll("/", "-");
  const { preferences, setPreferences } = usePreferences();
  const { registerPaimonTap } = useDiscoveries();
  const isZh = preferences.language === "zh-CN";
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [easterEggOpen, setEasterEggOpen] = useState(false);

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

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(PAIMON_EGG_PENDING_KEY) === "true") {
        window.sessionStorage.removeItem(PAIMON_EGG_PENDING_KEY);
        setEasterEggOpen(true);
      }
    } catch {
      // The immediate in-page reveal remains available without session storage.
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
    <div className={`site-shell game-shell route-${routeSlug}${navCollapsed ? " nav-collapsed" : ""}`}>
      <a className="skip-link" href="#game-main-content">
        {isZh ? "跳到主要内容" : "Skip to main content"}
      </a>
      <aside className="game-nav-rail" aria-label="Global navigation">
        <div className="game-nav-head">
          <div className="game-nav-brand-slot">
            <a
              href={clientPath("/")}
              className="game-brand"
              aria-label="Paimon Asks Everything"
              onClick={() => {
                if (registerPaimonTap()) {
                  try {
                    window.sessionStorage.removeItem(PAIMON_EGG_PENDING_KEY);
                  } catch {
                    // The same-page dialog does not need storage.
                  }
                  setEasterEggOpen(true);
                }
              }}
            >
              <span className="brand-sigil">
                <img src="/icon.png" alt="" aria-hidden="true" />
              </span>
              <span>
                <strong lang={isZh ? "zh-CN" : "en"}>
                  {isZh ? "派蒙三千问" : "Paimon Asks Everything"}
                </strong>
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
          <div className="game-nav-secondary-links">
            <a
              className={`game-nav-about${activePath === "/about" ? " active" : ""}`}
              href={clientPath("/about")}
              aria-current={activePath === "/about" ? "page" : undefined}
              title={isZh ? "关于" : "About"}
            >
              <BookOpenText size={14} aria-hidden="true" />
              <span>{isZh ? "关于" : "About"}</span>
            </a>
            <a
              className={`game-nav-preview${activePath === "/preview" ? " active" : ""}`}
              href={clientPath("/preview")}
              aria-current={activePath === "/preview" ? "page" : undefined}
              title={isZh ? "能力预览" : "Preview"}
            >
              <TestTube2 size={14} aria-hidden="true" />
              <span>{isZh ? "能力预览" : "Preview"}</span>
            </a>
          </div>
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
        <div className="game-world-backdrop" aria-hidden="true">
          <span className="game-world-orbit game-world-orbit-one" />
          <span className="game-world-orbit game-world-orbit-two" />
          <Snowflake className="game-world-sigil" />
        </div>
        <header className="game-status-bar" aria-label={isZh ? "当前位置" : "Current location"}>
          <div className="game-status-location">
            <span className="game-status-emblem"><ChromeIcon size={17} aria-hidden="true" /></span>
            <span className="game-status-copy">
              <small>{chrome.code}</small>
              <strong>{isZh ? chrome.labelZh : chrome.labelEn}</strong>
            </span>
          </div>
          <span className="game-status-rule" aria-hidden="true" />
          <div className="game-status-archive">
            <span className="game-status-live" aria-hidden="true" />
            <span>{isZh ? "至冬观测档案" : "Snezhnaya Archive"}</span>
            <b>VII</b>
          </div>
        </header>
        <main className="game-content" id="game-main-content" tabIndex={-1}>{children}</main>
      </div>
      <nav className="game-bottom-nav" aria-label="Mobile navigation">{renderNavigation()}</nav>
      {easterEggOpen ? (
        <div className="paimon-easter-overlay" role="presentation">
          <section className="paimon-easter-card" role="dialog" aria-modal="true" aria-labelledby="paimon-easter-title">
            <button type="button" onClick={() => setEasterEggOpen(false)} aria-label={isZh ? "关闭派蒙彩蛋" : "Close Paimon easter egg"}>
              <X size={17} />
            </button>
            <Sparkles size={24} />
            <span>PAIMON NOTE</span>
            <h2 id="paimon-easter-title">{isZh ? "派蒙才不是搜索按钮！" : "Paimon is not a search button!"}</h2>
            <p>{isZh ? "不过……既然旅行者这么认真，派蒙就再帮你翻一页线索册吧。" : "But… since the Traveler is this determined, Paimon will turn one more page in the clue book."}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
