import type { MergedFileNode } from "../graph/model.js";

export const statusLabels = {
  added: "+ Added",
  modified: "~ Modified",
  deleted: "− Deleted",
  renamed: "↗ Renamed",
  unchanged: "· Unchanged",
};

export function StatusBadge({ status }: { status: MergedFileNode["status"] }) {
  return <span className={`status-badge ${status}`}>{statusLabels[status]}</span>;
}
