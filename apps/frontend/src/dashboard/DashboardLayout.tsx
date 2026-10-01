import { useAuth } from "../auth/AuthContext";
import { AppShell, type NavItem } from "../components/AppShell";
import { HomeIcon, UsersIcon, GraduationCapIcon, BookIcon, FeeIcon, ShieldCheckIcon } from "../icons";

type Role = "OWNER" | "TEACHER" | "ACCOUNTANT";

const ICON_SIZE = 17;

// Each role only gets the screens it can actually use. A TEACHER can't see
// fees or manage staff; an ACCOUNTANT has no attendance/structure role.
// Linking people to pages that 403 or 404 was the old behaviour.
const NAV_ITEMS: (NavItem & { roles: Role[] })[] = [
  { to: "/dashboard", label: "Home", end: true, icon: <HomeIcon size={ICON_SIZE} />, roles: ["OWNER", "TEACHER", "ACCOUNTANT"] },
  { to: "/dashboard/students", label: "Students", icon: <UsersIcon size={ICON_SIZE} />, roles: ["OWNER", "TEACHER", "ACCOUNTANT"] },
  { to: "/dashboard/structure", label: "Structure", icon: <GraduationCapIcon size={ICON_SIZE} />, roles: ["OWNER", "TEACHER"] },
  { to: "/dashboard/courses", label: "Subjects", icon: <BookIcon size={ICON_SIZE} />, roles: ["OWNER", "TEACHER"] },
  { to: "/dashboard/fees", label: "Fees", icon: <FeeIcon size={ICON_SIZE} />, roles: ["OWNER", "ACCOUNTANT"] },
  { to: "/dashboard/staff", label: "Staff", icon: <ShieldCheckIcon size={ICON_SIZE} />, roles: ["OWNER"] },
];

export function DashboardLayout() {
  const { identity } = useAuth();
  const role = identity?.kind === "STAFF" ? identity.role : null;
  const navItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role));

  return <AppShell brand="Clazzo" navItems={navItems} settingsTo="/dashboard/settings" />;
}
