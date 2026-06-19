export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

export function ChoiceGrid({
  items,
  value,
  onChange,
  columns = 3,
}: {
  items: Array<{ value: string; label: string; description?: string }>;
  value: string;
  onChange: (value: string) => void;
  columns?: number;
}) {
  return (
    <div className="choice-grid" style={{ "--columns": columns } as React.CSSProperties}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          className={value === item.value ? "choice active" : "choice"}
          onClick={() => onChange(item.value)}
          aria-pressed={value === item.value}
        >
          <strong>{item.label}</strong>
          {item.description ? <small>{item.description}</small> : null}
        </button>
      ))}
    </div>
  );
}
