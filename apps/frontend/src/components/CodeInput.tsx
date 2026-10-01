import type { InputHTMLAttributes } from "react";
import { TextInput } from "./FormField";

/**
 * A 6-digit emailed-code field. Phones can offer the code straight from the
 * email (autoComplete="one-time-code"), and pasting "123 456" keeps all six
 * digits — `maxLength` used to silently cut that to "123 45". Extra props
 * (id, aria-*) pass through so FormField can wire its label and errors.
 */
export function CodeInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (digits: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <TextInput
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      title="6 digits"
      required
      placeholder="123456"
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}
