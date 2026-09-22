import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}
