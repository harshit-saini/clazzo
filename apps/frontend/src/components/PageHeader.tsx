import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {i > 0 && <span aria-hidden="true"> › </span>}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/**
 * The one page header every screen uses: optional breadcrumbs, a title,
 * an optional subtitle, and an actions slot on the right. Pages used to
 * hand-roll six different versions, so the primary action moved around and
 * the vertical rhythm differed page to page. The h1 is focusable so the app
 * can move focus to it after a route change.
 */
export function PageHeader({
  breadcrumbs,
  title,
  subtitle,
  actions,
}: {
  breadcrumbs?: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 20 }}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-header-text">
          <h1 className="page-title" tabIndex={-1}>
            {title}
          </h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}

/** An h2 with an optional action on the right — the section-level counterpart of PageHeader. */
export function SectionHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="row-between" style={{ marginBottom: 10 }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        {title}
      </h2>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
