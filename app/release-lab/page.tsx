import { ReleaseIncrementalityLab } from "@/components/release-incrementality-lab";
import { loadReleaseLabReport } from "@/lib/release-lab";

export default function ReleaseLabPage() {
  return <ReleaseIncrementalityLab report={loadReleaseLabReport()} />;
}
