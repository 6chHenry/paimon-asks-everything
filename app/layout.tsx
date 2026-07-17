import type { Metadata } from "next";
import "@/app/globals.css";
import "@/app/game-ui.css";
import "@/app/snezhnaya-atlas.css";
import { AppShell } from "@/components/app-shell";
import { DiscoveriesProvider } from "@/components/discoveries-provider";
import { PreferencesProvider } from "@/components/preferences-provider";

export const metadata: Metadata = {
  title: "派蒙三千问 · Paimon Asks Everything",
  description:
    "A bilingual, evidence-grounded version-understanding agent demo with spoiler control.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  if (window.localStorage.getItem("paimon-nav-collapsed") === "true") {
    document.documentElement.dataset.navCollapsed = "true";
  }
} catch {}
            `.trim(),
          }}
        />
      </head>
      <body>
        <PreferencesProvider>
          <DiscoveriesProvider>
            <AppShell>{children}</AppShell>
          </DiscoveriesProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
