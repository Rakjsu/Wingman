import type { Package } from "../hooks/useWinget";
import { PackageRow, type RowAction } from "./PackageRow";

export function PackageList({
  packages,
  action,
  busyIds,
  emptyMessage,
  onAction,
}: {
  packages: Package[];
  action: RowAction;
  busyIds: Set<string>;
  emptyMessage: string;
  onAction: (a: RowAction, id: string) => void;
}) {
  if (packages.length === 0) {
    return <div className="empty">{emptyMessage}</div>;
  }
  return (
    <div className="pkg-list">
      {packages.map((p) => (
        <PackageRow
          key={p.id}
          pkg={p}
          action={action}
          busy={busyIds.has(p.id)}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
