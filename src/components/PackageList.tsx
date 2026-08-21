import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { t } from "../i18n";
import type { Package } from "../lib/types";
import { PackageRow, type RowAction, type RowState } from "./PackageRow";

const ROW_HEIGHT = 76;
/** Below this count the plain list is cheaper than the virtualiser. */
const VIRTUALIZE_THRESHOLD = 40;

export interface PackageListProps {
  packages: Package[];
  action: RowAction;
  rowState: (pkg: Package) => RowState;
  selectable?: boolean;
  showPin?: boolean;
  onAction: (action: RowAction, pkg: Package) => void;
  onCancel: (pkg: Package) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onDetails: (pkg: Package) => void;
}

export function PackageList(props: PackageListProps) {
  const { packages } = props;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: packages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => packages[index]?.id ?? index,
  });

  const renderRow = (pkg: Package) => (
    <PackageRow
      key={pkg.id}
      pkg={pkg}
      action={props.action}
      state={props.rowState(pkg)}
      selectable={props.selectable}
      showPin={props.showPin}
      onAction={props.onAction}
      onCancel={props.onCancel}
      onToggleFavorite={props.onToggleFavorite}
      onTogglePin={props.onTogglePin}
      onToggleSelect={props.onToggleSelect}
      onDetails={props.onDetails}
    />
  );

  if (packages.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className="list" aria-label={t("a11y.packageList")} role="list">
        {packages.map((pkg) => (
          <div role="listitem" key={pkg.id}>
            {renderRow(pkg)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="list list-virtual"
      aria-label={t("a11y.packageList")}
      role="list"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const pkg = packages[item.index];
          if (!pkg) return null;
          return (
            <div
              key={item.key}
              role="listitem"
              ref={virtualizer.measureElement}
              data-index={item.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${item.start}px)`,
              }}
            >
              {renderRow(pkg)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
