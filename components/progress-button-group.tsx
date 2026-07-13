import type { Progress } from "@/lib/domain";
import { isNamedRegion, regionEmblemSources } from "@/data/region-emblems";

export function ProgressButtonGroup({ items, value, onChange }: {
  items: Array<{ value: Progress; label: string }>;
  value: Progress;
  onChange: (value: Progress) => void;
}) {
  const namedItems = items.filter((item) => isNamedRegion(item.value));
  const unknownItem = items.find((item) => item.value === "unknown");
  return (
    <div className="progress-region-picker" role="group" aria-label="Main quest progress">
      <div className="progress-button-grid">
        {namedItems.map((item) => {
          const region = item.value;
          if (!isNamedRegion(region)) return null;
          return (
            <button type="button" key={region}
              className={`region-button region-${region}${region === value ? " is-selected" : ""}`}
              aria-pressed={region === value} onClick={() => onChange(region)}>
              <span>{item.label}</span>
              <img className="region-button-emblem" src={regionEmblemSources[region]}
                alt="" aria-hidden />
            </button>
          );
        })}
      </div>
      {unknownItem ? (
        <button type="button" className={value === "unknown" ? "progress-unknown is-selected" : "progress-unknown"}
          aria-pressed={value === "unknown"} onClick={() => onChange("unknown")}>
          {unknownItem.label}
        </button>
      ) : null}
    </div>
  );
}
