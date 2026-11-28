import PropTypes from "prop-types";
import { CapacityBadges } from "@/shared/components";

export default function ModelRow({ model, fullModel, alias, copied, onCopy, testStatus, isCustom, isFree, onDeleteAlias, onTest, isTesting, onDisable, caps, thinkingSuffix, rank, score }) {
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

  // Fixed height keeps every card in the grid the same size, whatever the id length.
  return (
    <div className={`group flex h-[68px] min-w-0 overflow-hidden rounded-lg border ${borderColor} hover:bg-sidebar/50`}>
      {/* Full-height rank column; fixed width keeps names aligned across cards, ranked or not. */}
      <span className="flex w-12 shrink-0 items-center justify-center self-stretch border-r border-border bg-sidebar/60 font-mono text-lg font-bold text-text-main" title={rank != null ? "Local rank by benchmark score" : undefined}>
        {rank != null && `#${rank}`}
      </span>
      {/* Two rows split the full card height, lined up with the Test / Disable rows on the right. */}
      <div className="flex min-w-0 flex-1 px-3 py-1.5">
        <div className="grid min-w-0 flex-1 grid-rows-2 items-center">
          <span className="flex min-w-0 items-center gap-1">
            <span className="material-symbols-outlined shrink-0 text-text-muted/70" style={{ fontSize: "16px", color: iconColor }}>
              {testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"}
            </span>
            {/* One line, ellipsis when too long (full id in the tooltip) so the card stays 2 clean rows. */}
            <code className="min-w-0 truncate rounded bg-sidebar px-1.5 py-0.5 font-mono text-sm text-text-muted" title={displayModel}>{displayModel}</code>
            {/* Copy sits next to the id it copies. */}
            <button
              onClick={() => onCopy(displayModel, `model-${model.id}`)}
              className="flex shrink-0 rounded p-px text-text-muted hover:bg-sidebar hover:text-primary"
              title={copied === `model-${model.id}` ? "Copied!" : "Copy"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {copied === `model-${model.id}` ? "check" : "content_copy"}
              </span>
            </button>
          </span>
          <span className="flex min-h-5 min-w-0 items-center gap-1.5 pl-5">
            {score != null && (
              <span className="inline-flex h-5 shrink-0 items-center justify-center gap-px rounded bg-primary/10 px-1.5 font-mono text-xs font-semibold leading-none text-primary" title="Estimated benchmark score (modelgrep / Artificial Analysis)">
                <span className="text-[10px]">⚡</span>{score}
              </span>
            )}
            {showName && <span className="min-w-0 truncate text-xs italic text-text-muted/70" title={model.name}>{model.name}</span>}
            <CapacityBadges caps={caps} colorOverride="text-text-muted/70" size={15} />
          </span>
        </div>
      </div>
      {/* Full-height action column, mirrors the rank column: Test on top, Disable/Delete below. */}
      <div className="grid w-12 shrink-0 grid-rows-2 place-items-center self-stretch border-l border-border bg-sidebar/60 py-1.5 leading-none">
        <span className="flex gap-0.5">
          {onTest && (
            <button
              onClick={onTest}
              disabled={isTesting}
              className={`flex rounded p-px text-text-muted transition-opacity hover:bg-sidebar hover:text-primary ${isTesting ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}
              title={isTesting ? "Testing..." : "Test"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px", ...(isTesting ? { animation: "spin 1s linear infinite" } : {}) }}>
                {isTesting ? "progress_activity" : "science"}
              </span>
            </button>
          )}
        </span>
        <span className="flex gap-0.5">
        {onDisable && (
          <button
            onClick={onDisable}
            className="flex rounded p-px text-text-muted opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Disable this model"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
          </button>
        )}
        {isCustom && (
          <button
            onClick={onDeleteAlias}
            className="flex rounded p-px text-text-muted opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Remove custom model"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{onDisable ? "delete" : "close"}</span>
          </button>
        )}
        </span>
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
};
