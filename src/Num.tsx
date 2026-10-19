import { useEffect, useState } from "react";
export function Num({
  label,
  value,
  onChange,
  unit = "",
  step = 0.1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="number">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          value={text}
          step={step}
          min={min}
          max={max}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = Number(text);
            if (
              text !== "" &&
              Number.isFinite(n) &&
              (min === undefined || n >= min) &&
              (max === undefined || n <= max)
            ) {
              if (n !== value) onChange(n);
            } else setText(String(value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}
