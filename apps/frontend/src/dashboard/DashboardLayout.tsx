import { useAuth } from "../auth/AuthContext";
import { AppShell, type NavItem } from "../components/AppShell";
import { HomeIcon, UsersIcon, GraduationCapIcon, BookIcon, FeeIcon, ShieldCheckIcon } from "../icons";

const ICON_SIZE = 17;

const NAV_ITEMS: (NavItem & { hideFor?: Array<"TEACHER"> })[] = [
  { to: "/dashboard", label: "Home", end: true, icon: <HomeIcon size={ICON_SIZE} /> },
  { to: "/dashboard/students", label: "Students", icon: <UsersIcon size={ICON_SIZE} /> },
  { to: "/dashboard/structure", label: "Structure", icon: <GraduationCapIcon size={ICON_SIZE} /> },
  { to: "/dashboard/courses", label: "Subjects", icon: <BookIcon size={ICON_SIZE} /> },
  // Fees are OWNER/ACCOUNTANT-only on the backend now — hide the link
  // entirely for a TEACHER rather than let them land on a 403.
  { to: "/dashboard/fees", label: "Fees", hideFor: ["TEACHER"], icon: <FeeIcon size={ICON_SIZE} /> },
  { to: "/dashboard/staff", label: "Staff", icon: <ShieldCheckIcon size={ICON_SIZE} /> },
];

export function DashboardLayout() {
  const { identity } = useAuth();
  const role = identity?.kind === "STAFF" ? identity.role : null;
  const navItems = NAV_ITEMS.filter((item) => !(role && item.hideFor?.includes(role as "TEACHER")));

  return <AppShell brand="Clazzo" navItems={navItems} />;
}
