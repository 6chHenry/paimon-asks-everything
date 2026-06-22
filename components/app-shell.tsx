"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Flame, MessageCircleMore, Sparkles, TestTube2 } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { clientPath } from "@/lib/client-path";

const navigation = [
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

  return (
    <div className="site-shell">
      <header className="topbar">
        <a href={clientPath("/")} className="brand" aria-label="Paimon Asks Everything">
          <span className="brand-sigil">
            <Sparkles size={16} />
          </span>
          <span>
            <strong>{isZh ? "派蒙三千问" : "Paimon Asks Everything"}</strong>
            <small>{isZh ? "版本理解 Agent" : "Version understanding agent"}</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <a
                href={clientPath(item.href)}
                key={item.href}
                className={activePath === item.href ? "active" : undefined}
              >
                <Icon size={16} />
                <span>{isZh ? item.labelZh : item.labelEn}</span>
              </a>
            );
          })}
        </nav>
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
      <main>{children}</main>
      <footer className="footer">
        <span>
          {isZh
            ? "非官方概念 Demo · 不读取游戏账号"
            : "Unofficial concept demo · No game account access"}
        </span>
      </footer>
    </div>
  );
}
