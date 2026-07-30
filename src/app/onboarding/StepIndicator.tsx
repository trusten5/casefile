const TOTAL_STEPS = 4;

export function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < step ? "bg-ink" : "bg-paper-line"}`}
          />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-soft">
        Step {step} of {TOTAL_STEPS}
      </p>
    </div>
  );
}

