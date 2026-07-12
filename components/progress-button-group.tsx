import type { Progress } from "@/lib/domain";

export function ProgressButtonGroup({ items, value, onChange }: {
  items: Array<{ value: Progress; label: string }>;
  value: Progress;
  onChange: (value: Progress) => void;
}) {
  return (
    <div className="progress-button-grid" role="group" aria-label="Main quest progress">
      {items.map((item) => (
        <button type="button" key={item.value}
          className={item.value === value ? "progress-button active" : "progress-button"}
          aria-pressed={item.value === value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
