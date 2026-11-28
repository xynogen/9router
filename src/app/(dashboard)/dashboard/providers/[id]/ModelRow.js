import PropTypes from "prop-types";
import { CapacityBadges, Toggle } from "@/shared/components";

export default function ModelRow({ model, fullModel, alias, copied, onCopy, testStatus, isCustom, isFree, onDeleteAlias, onTest, isTesting, onDisable, caps, thinkingSuffix, rank, score, enabled = true, onToggle }) {
  const displayModel = thinkingSuffix ? `${fullModel}(${thinkingSuffix})` : fullModel;
  // "GPT 6.2 Sol" just restates "gpt-6.2-sol"; show the name only when it adds information.
  const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const showName = model.name && squash(model.name) !== squash(model.id);
  const borderColor = testStatus === "ok"
    ? "border-green-500/40"
    : testStatus === "error"
    ? "border-red-500/40"
    : "border-border";

  const iconColor = testStatus === "ok"
    ? "#22c55e"
    : testStatus === "error"
    ? "#ef4444"
    : undefined;

  return (
    <div className={`group h-full min-w-0 rounded-lg border px-3 py-2 ${borderColor} hover:bg-sidebar/50 ${enabled ? "" : "opacity-60"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="material-symbols-outlined shrink-0 text-base"
          style={iconColor ? { color: iconColor } : undefined}
        >
          {testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <code className="w-fit max-w-full truncate rounded bg-sidebar px-1.5 py-0.5 font-mono text-xs text-text-muted" title={displayModel}>{displayModel}</code>
          <span className="flex min-h-5 min-w-0 items-center gap-1.5 pl-0.5">
            {(rank != null || score != null) && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-px font-mono text-[11px] leading-4" title="Local rank · estimated benchmark score (modelgrep / Artificial Analysis)">
                {rank != null && <span className="text-text-muted">#{rank}</span>}
                {score != null && <span className="font-semibold text-primary">{score}</span>}
              </span>
            )}
            {showName && <span className="min-w-0 truncate text-[11px] italic text-text-muted/70" title={model.name}>{model.name}</span>}
            <CapacityBadges caps={caps} colorOverride="text-text-muted/70" size={14} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {onTest && (
            <div className="relative shrink-0 group/btn">
              <button
                onClick={onTest}
                disabled={isTesting}
                className={`rounded p-0.5 text-text-muted transition-opacity hover:bg-sidebar hover:text-primary ${isTesting ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}
              >
                <span className="material-symbols-outlined text-sm" style={isTesting ? { animation: "spin 1s linear infinite" } : undefined}>
                  {isTesting ? "progress_activity" : "science"}
                </span>
              </button>
              <span className="pointer-events-none absolute mt-1 top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
                {isTesting ? "Testing..." : "Test"}
              </span>
            </div>
          )}
          <div className="relative shrink-0 group/btn">
            <button
              onClick={() => onCopy(displayModel, `model-${model.id}`)}
              className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary"
            >
              <span className="material-symbols-outlined text-sm">
                {copied === `model-${model.id}` ? "check" : "content_copy"}
              </span>
            </button>
            <span className="pointer-events-none absolute mt-1 top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
              {copied === `model-${model.id}` ? "Copied!" : "Copy"}
            </span>
          </div>
          {onToggle && <Toggle size="sm" checked={enabled} onChange={onToggle} />}
          {isCustom ? (
            <button
              onClick={onDeleteAlias}
              className="rounded p-0.5 text-text-muted opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
              title="Remove custom model"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ) : onDisable ? (
            <button
              onClick={onDisable}
              className="rounded p-0.5 text-text-muted opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
              title="Disable this model"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

ModelRow.propTypes = {
  model: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
  }).isRequired,
  fullModel: PropTypes.string.isRequired,
  alias: PropTypes.string,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  testStatus: PropTypes.oneOf(["ok", "error"]),
  isCustom: PropTypes.bool,
  isFree: PropTypes.bool,
  onDeleteAlias: PropTypes.func,
  onTest: PropTypes.func,
  isTesting: PropTypes.bool,
  onDisable: PropTypes.func,
  caps: PropTypes.object,
  thinkingSuffix: PropTypes.string,
  rank: PropTypes.number,
  score: PropTypes.number,
  enabled: PropTypes.bool,
  onToggle: PropTypes.func,
};
