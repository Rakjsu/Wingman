import { t } from "../i18n";
import { api } from "../lib/api";
import type { WingetError } from "../lib/types";
import { IconRefresh } from "./Icons";

const STORE_URL = "https://apps.microsoft.com/detail/9NBLGGH4NNS1";

/** Shown instead of the app when winget is missing or too old to drive. */
export function Onboarding({
  error,
  onRetry,
  checking,
}: {
  error: WingetError;
  onRetry: () => void;
  checking: boolean;
}) {
  const body =
    error.kind === "Unsupported"
      ? t("onboarding.outdated", {
          found: error.detail.found,
          minimum: error.detail.minimum,
        })
      : t("onboarding.body");

  return (
    <main className="onboarding">
      <img src="/wingman.svg" alt="" width={72} height={72} className="onboarding-logo" />
      <h1>{t("onboarding.title")}</h1>
      <p>{body}</p>
      <div className="onboarding-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void api.openUrl(STORE_URL)}
        >
          {t("onboarding.action")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRetry}
          disabled={checking}
        >
          <IconRefresh /> {t("onboarding.retry")}
        </button>
      </div>
    </main>
  );
}
