import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
} from "react";

export function FormField({
  label,
  children,
  required,
  error,
}: {
  label: string;
  children: ReactElement;
  /** Renders a required-field marker; purely visual, doesn't add browser validation. */
  required?: boolean;
  /** A field-level validation message — shown under the input and linked to
   * it via aria-describedby, instead of only ever appearing in one generic
   * banner at the bottom of the form. */
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      } as Record<string, unknown>)
    : children;

  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: "var(--color-danger)" }}>
            {" "}*
          </span>
        )}
      </label>
      {child}
      {error && (
        <p id={errorId} role="alert" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}
