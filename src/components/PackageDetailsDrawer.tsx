import { useEffect, useState } from "react";
import { t } from "../i18n";
import { api } from "../lib/api";
import { errorMessage, toWingetError } from "../lib/errors";
import type { Package, PackageDetails } from "../lib/types";
import { IconExternal } from "./Icons";
import { Modal } from "./Modal";
import { PackageIcon } from "./PackageIcon";

export function PackageDetailsDrawer({
  pkg,
  installed,
  onClose,
  onInstallVersion,
}: {
  pkg: Package;
  installed: boolean;
  onClose: () => void;
  onInstallVersion: (id: string, version?: string) => void;
}) {
  const [details, setDetails] = useState<PackageDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setError(null);
    api
      .show(pkg.id)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(toWingetError(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [pkg.id]);

  const rows: [string, string | null | undefined][] = [
    [t("details.publisher"), details?.publisher],
    [t("details.version"), details?.version ?? pkg.version],
    [t("details.license"), details?.license],
  ];

  return (
    <Modal title={t("details.title")} onClose={onClose} wide>
      <div className="details-head">
        <PackageIcon name={details?.name || pkg.name || pkg.id} id={pkg.id} size={48} />
        <div>
          <h3 className="details-name">{details?.name || pkg.name || pkg.id}</h3>
          <code className="details-id">{pkg.id}</code>
        </div>
      </div>

      {error && <p className="details-error">{error}</p>}
      {!details && !error && <p className="muted">{t("details.loading")}</p>}

      {details && (
        <>
          <dl className="details-grid">
            {rows.map(
              ([label, value]) =>
                value && (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
          </dl>

          {details.description && (
            <section className="details-block">
              <h4>{t("details.description")}</h4>
              <p>{details.description}</p>
            </section>
          )}

          {details.homepage && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void api.openUrl(details.homepage!)}
            >
              <IconExternal /> {t("details.homepage")}
            </button>
          )}

          {details.versions.length > 0 && (
            <section className="details-block">
              <h4>{t("details.versions")}</h4>
              <ul className="version-list">
                {details.versions.slice(0, 15).map((version) => (
                  <li key={version}>
                    <span>{version}</span>
                    {!installed && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          onInstallVersion(pkg.id, version);
                          onClose();
                        }}
                      >
                        {t("details.installVersion")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
