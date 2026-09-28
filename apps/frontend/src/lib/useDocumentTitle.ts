import { useEffect } from "react";

/** The tab title never changed across ~20 routes — every page read
 * whatever index.html hard-coded, so a screen-reader user (or anyone with
 * several tabs open) got no confirmation that navigating actually changed
 * the page. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Clazzo` : "Clazzo";
  }, [title]);
}
