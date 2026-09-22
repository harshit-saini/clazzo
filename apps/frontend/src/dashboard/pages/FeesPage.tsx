import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { Select } from "../../components/FormField";

interface Invoice {
  id: string;
  amount: string;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  student: { id: string; name: string };
  payments: { amount: string }[];
}

export function FeesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.get<Invoice[]>(`/api/invoices${status ? `?status=${status}` : ""}`).then(setInvoices);
  }, [status]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Fees</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partial</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PAID">Paid</option>
        </Select>
      </div>

      {invoices && (
        <DataTable
          rows={invoices}
          rowKey={(i) => i.id}
          emptyMessage="No invoices found."
          columns={[
            { header: "Student", render: (i) => <Link to={`/dashboard/students/${i.student.id}`}>{i.student.name}</Link> },
            { header: "Amount", render: (i) => `₹${i.amount}` },
            { header: "Paid", render: (i) => `₹${i.payments.reduce((s, p) => s + Number(p.amount), 0)}` },
            { header: "Due", render: (i) => new Date(i.dueDate).toLocaleDateString() },
            { header: "Status", render: (i) => i.status },
          ]}
        />
      )}
    </div>
  );
}
