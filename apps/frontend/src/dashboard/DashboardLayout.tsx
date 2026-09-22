import { AppShell } from "../components/AppShell";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", end: true },
  { to: "/dashboard/students", label: "Students" },
  { to: "/dashboard/batches", label: "Batches" },
  { to: "/dashboard/grades", label: "Grades" },
  { to: "/dashboard/fees", label: "Fees" },
  { to: "/dashboard/staff", label: "Staff" },
];

export function DashboardLayout() {
  return <AppShell brand="Clazzo" navItems={NAV_ITEMS} />;
}
