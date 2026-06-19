import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
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
    <html lang="zh-CN">
      <body>
        <PreferencesProvider>
          <AppShell>{children}</AppShell>
        </PreferencesProvider>
      </body>
    </html>
  );
}
