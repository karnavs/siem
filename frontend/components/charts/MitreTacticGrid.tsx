interface Props {
  data: { tacticId: string; tacticName: string; count: number }[];
}

// Renders the kill-chain as an ordered row of cells, intensity-shaded by
// alert volume — this is the thing a generic admin dashboard wouldn't have,
// because it only makes sense for a tool that actually thinks in ATT&CK.
export function MitreTacticGrid({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));

  function intensity(count: number): string {
    if (count === 0) return 'bg-base-raised border-base-border';
    const ratio = count / max;
    if (ratio > 0.66) return 'bg-severity-critical/80 border-severity-critical text-white';
    if (ratio > 0.33) return 'bg-signal-amber/70 border-signal-amber text-base';
    return 'bg-signal-amber/25 border-signal-amber/40 text-ink';
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[760px] gap-1.5">
        {data.map((tactic, i) => (
          <div key={tactic.tacticId} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`flex h-16 w-full items-center justify-center rounded-md border font-display text-lg font-bold tabular-nums transition-colors ${intensity(
                tactic.count,
              )}`}
              title={`${tactic.tacticName}: ${tactic.count} alert(s)`}
            >
              {tactic.count}
            </div>
            <span className="font-mono text-[10px] text-ink-faint">{tactic.tacticId}</span>
            <span className="px-0.5 text-center text-[10px] leading-tight text-ink-muted">{tactic.tacticName}</span>
            {i < data.length - 1 && (
              <span className="absolute hidden" aria-hidden />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        Kill-chain order, left to right: Reconnaissance → Impact. Cell intensity reflects observed alert volume per tactic.
      </p>
    </div>
  );
}
