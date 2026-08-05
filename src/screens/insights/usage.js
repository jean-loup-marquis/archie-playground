import { renderEmptyState } from "../../components/empty-state.js?v=1";

export function renderUsageTab() {
  return renderEmptyState({
    icon: "ap-icon-sparkles",
    title: "Usage is coming",
    body: "What Archie produced this month, and how you work with it.",
    wrapperClass: "insights-view__empty",
  });
}
