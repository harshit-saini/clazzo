import { AppShell } from "../components/AppShell";

const NAV_ITEMS = [{ to: "/portal", label: "My institutes", end: true }];

export function PortalLayout() {
  return <AppShell brand="Clazzo" navItems={NAV_ITEMS} />;
}
