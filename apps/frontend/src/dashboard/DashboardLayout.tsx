import { useAuth } from "../auth/AuthContext";
import { AppShell, type NavItem } from "../components/AppShell";

const NAV_ITEMS: (NavItem & { hideFor?: Array<"TEACHER"> })[] = [
  { to: "/dashboard", label: "Home", end: true },
  { to: "/dashboard/students", label: "Students" },
  { to: "/dashboard/structure", label: "Structure" },
  { to: "/dashboard/courses", label: "Subjects" },
  // Fees are OWNER/ACCOUNTANT-only on the backend now — hide the link
  // entirely for a TEACHER rather than let them land on a 403.
  { to: "/dashboard/fees", label: "Fees", hideFor: ["TEACHER"] },
  { to: "/dashboard/staff", label: "Staff" },
];

export function DashboardLayout() {
  const { identity } = useAuth();
  const role = identity?.kind === "STAFF" ? identity.role : null;
  const navItems = NAV_ITEMS.filter((item) => !(role && item.hideFor?.includes(role as "TEACHER")));

  return <AppShell brand="Clazzo" navItems={navItems} />;
}
