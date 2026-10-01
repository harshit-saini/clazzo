/** A small "step 2 of 3" indicator for the flows that span several pages
 * and emails (invite → sign in → guardian consent). */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="steps" aria-label="Progress">
      {steps.map((label, i) => (
        <li
          key={label}
          className={`step${i < current ? " step-done" : ""}`}
          aria-current={i === current ? "step" : undefined}
        >
          <span className="step-dot" aria-hidden="true">
            {i < current ? "✓" : i + 1}
          </span>
          <span>{label}</span>
          {i < steps.length - 1 && <span className="step-sep" aria-hidden="true">›</span>}
        </li>
      ))}
    </ol>
  );
}
