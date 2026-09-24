import { AppShell } from "../components/AppShell";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", end: true },
  { to: "/dashboard/students", label: "Students" },
  { to: "/dashboard/structure", label: "Structure" },
  { to: "/dashboard/courses", label: "Subjects" },
  { to: "/dashboard/fees", label: "Fees" },
  { to: "/dashboard/staff", label: "Staff" },
];

export function DashboardLayout() {
  return <AppShell brand="Clazzo" navItems={NAV_ITEMS} />;
}
