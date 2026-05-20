"use client";

import { usePlayerConfigStore } from "@/store/usePlayerConfigStore";

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-xs text-fg">
          {value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-5 text-right font-mono text-[10px] text-muted">
          {min}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-accent"
        />
        <span className="w-5 font-mono text-[10px] text-muted">{max}</span>
      </div>
    </div>
  );
}

export default function VideoControls() {
  const padding = usePlayerConfigStore((s) => s.padding);
  const borderRadius = usePlayerConfigStore((s) => s.borderRadius);
  const setPadding = usePlayerConfigStore((s) => s.setPadding);
  const setBorderRadius = usePlayerConfigStore((s) => s.setBorderRadius);

  return (
    <div className="space-y-4 border-t border-edge px-4 py-4">
      <SliderRow
        label="Padding"
        value={padding}
        min={0}
        max={64}
        onChange={setPadding}
      />
      <SliderRow
        label="Rounding"
        value={borderRadius}
        min={0}
        max={48}
        onChange={setBorderRadius}
      />
    </div>
  );
}
