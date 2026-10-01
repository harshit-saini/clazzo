import { AppShell } from "../components/AppShell";
import { SchoolIcon } from "../icons";

const NAV_ITEMS = [{ to: "/portal", label: "My institutes", end: true, icon: <SchoolIcon size={17} /> }];

export function PortalLayout() {
  return <AppShell brand="Clazzo" navItems={NAV_ITEMS} settingsTo="/portal/settings" />;
}
