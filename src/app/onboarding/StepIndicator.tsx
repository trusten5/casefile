const TOTAL_STEPS = 4;

export function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-4 flex items-center gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-ink" : "bg-paper-line"}`}
        />
      ))}
    </div>
  );
}
