"use client";

import dynamic from "next/dynamic";

const ReleaseDecisionPage = dynamic(
  () => import("@/components/release-decision-center"),
  { ssr: false },
);

export default function InsightsPage() {
  return <ReleaseDecisionPage />;
}
