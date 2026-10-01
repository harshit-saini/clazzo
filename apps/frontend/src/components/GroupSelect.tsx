import type { SelectHTMLAttributes } from "react";
import { useUnits } from "../lib/useUnits";
import { Select } from "./FormField";

/** A <select> of every group, labelled with its ancestry ("Main › Batch A"). */
export function GroupSelect({
  value,
  onChange,
  emptyLabel,
  ...rest
}: {
  value: string;
  onChange: (id: string) => void;
  /** Label of the "no selection" option (e.g. "All groups", "No group yet"). */
  emptyLabel: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  const { units } = useUnits();

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{emptyLabel}</option>
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label}
        </option>
      ))}
    </Select>
  );
}
