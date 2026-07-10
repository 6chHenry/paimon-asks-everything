import type { JSX } from "react";
import type { PreheatView } from "@/lib/preheat";

type LocalizedBreakpoint = PreheatView["breakpoint"];

type Props = {
  breakpoint: LocalizedBreakpoint;
  askHref: string;
};

export function PreheatBreakpointCard({ breakpoint, askHref }: Props): JSX.Element {
  return (
    <article className="preheat-breakpoint" aria-labelledby="preheat-breakpoint-question">
      <div className="preheat-breakpoint-kicker">未解断点 / UNRESOLVED BREAKPOINT</div>
      <h2 id="preheat-breakpoint-question">{breakpoint.question}</h2>
      <p className="preheat-breakpoint-clue">{breakpoint.clueSummary}</p>
      <div className="preheat-breakpoint-boundary">
        <strong>当前边界</strong>
        <p>{breakpoint.boundary}</p>
      </div>
      <div className="preheat-breakpoint-footer">
        <span>{breakpoint.unlockLabel}</span>
        <a href={askHref}>继续问派蒙 →</a>
      </div>
    </article>
  );
}
