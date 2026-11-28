"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/shared/components";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";
import { useModelBenchmarks } from "@/shared/hooks/useModelBenchmarks";
import { rankModelList } from "@/shared/utils/modelRanking";
import ModelRow from "./ModelRow";

export default function CompatibleModelsSection({ providerStorageAlias, providerDisplayAlias, modelAliases, customModels, copied, onCopy, onDeleteAlias, onAddCustomModel, onDeleteCustomModel, connections, isAnthropic, disabledModelIds = [], onSetModelsDisabled }) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("");
  const [testingModelId, setTestingModelId] = useState(null);
  const [modelTestResults, setModelTestResults] = useState({});

  const handleTestModel = async (modelId) => {
    if (testingModelId) return;
    setTestingModelId(modelId);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `${providerStorageAlias}/${modelId}` }),
      });
      const data = await res.json();
      setModelTestResults((prev) => ({ ...prev, [modelId]: data.ok ? "ok" : "error" }));
    } catch {
      setModelTestResults((prev) => ({ ...prev, [modelId]: "error" }));
    } finally {
      setTestingModelId(null);
    }
  };

  const allModels = getProviderCustomModelRows({
    customModels,
    modelAliases,
    providerAlias: providerStorageAlias,
    type: "llm",
  });
  const benchmarks = useModelBenchmarks();
  const modelRanks = rankModelList(allModels, providerStorageAlias, benchmarks);

  const query = filter.trim().toLowerCase();
  const visibleModels = query
    ? allModels.filter((model) => model.id.toLowerCase().includes(query))
    : allModels;
  const enabledModels = visibleModels.filter((model) => !disabledModelIds.includes(model.id));
  const disabledModels = visibleModels.filter((model) => disabledModelIds.includes(model.id));
  const enableIds = disabledModels.map((model) => model.id);
  const disableIds = enabledModels.map((model) => model.id);

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    if (allModels.some((model) => model.id === modelId)) {
      alert("Model already exists for this provider.");
      return;
    }

    setAdding(true);
    try {
      await onAddCustomModel(modelId);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    const activeConnection = connections.find((conn) => conn.isActive !== false);
    if (!activeConnection) return;

    setImporting(true);
    try {
      const res = await fetch(`/api/providers/${activeConnection.id}/models`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to import models");
        return;
      }
      const models = data.models || [];
      if (models.length === 0) {
        alert("No models returned from /models.");
        return;
      }
      const newIds = [...new Set(models.map((m) => m.id || m.name || m.model).filter(Boolean))]
        .filter((modelId) => !allModels.some((entry) => entry.id === modelId));
      // Imported models start disabled; the user enables the ones they want.
      // Disable first so none is briefly exposed.
      if (newIds.length) await onSetModelsDisabled(newIds, true);
      for (const modelId of newIds) await onAddCustomModel(modelId);
      if (newIds.length === 0) {
        alert("No new models were added.");
      }
    } catch (error) {
      console.log("Error importing models:", error);
    } finally {
      setImporting(false);
    }
  };

  const canImport = connections.some((conn) => conn.isActive !== false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Add {isAnthropic ? "Anthropic" : "OpenAI"}-compatible models manually or import them from the /models endpoint (imported models start disabled).
      </p>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="new-compatible-model-input" className="text-xs text-text-muted mb-1 block">Model ID</label>
          <input
            id="new-compatible-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={isAnthropic ? "claude-3-opus-20240229" : "gpt-4o"}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? "Adding..." : "Add"}
        </Button>
        <Button size="sm" variant="secondary" icon="download" onClick={handleImport} disabled={!canImport || importing}>
          {importing ? "Importing..." : "Import from /models"}
        </Button>
      </div>

      {!canImport && (
        <p className="text-xs text-text-muted">
          Add a connection to enable importing models.
        </p>
      )}

      {(allModels.length > 5 || filter) && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter models..."
              aria-label="Filter models"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon="done"
            onClick={() => onSetModelsDisabled(enableIds, false)}
            disabled={!enableIds.length}
          >
            Enable shown ({enableIds.length})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="block"
            onClick={() => onSetModelsDisabled(disableIds, true)}
            disabled={!disableIds.length}
          >
            Disable shown ({disableIds.length})
          </Button>
        </div>
      )}

      {allModels.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
          {visibleModels.length === 0 && (
            <p className="col-span-full text-xs text-text-muted">No model matches this filter.</p>
          )}
          {enabledModels.map(({ id, alias, source }) => (
            <ModelRow
              key={`${source}-${providerStorageAlias}/${id}`}
              model={{ id }}
              fullModel={`${providerDisplayAlias}/${id}`}
              copied={copied}
              onCopy={onCopy}
              isCustom
              onDeleteAlias={() => source === "custom" ? onDeleteCustomModel(id) : onDeleteAlias(alias)}
              onTest={connections.length > 0 ? () => handleTestModel(id) : undefined}
              testStatus={modelTestResults[id]}
              isTesting={testingModelId === id}
              rank={modelRanks.get(id)?.rank}
              score={modelRanks.get(id)?.score}
              onDisable={() => onSetModelsDisabled([id], true)}
            />
          ))}
          {disabledModels.length > 0 && (
            <div className="col-span-full mt-2">
              <p className="text-xs text-text-muted mb-2">Disabled models ({disabledModels.length}):</p>
              <div className="flex flex-wrap gap-2">
                {disabledModels.map(({ id, source }) => (
                  <button
                    key={`${source}-${providerStorageAlias}/${id}`}
                    onClick={() => onSetModelsDisabled([id], false)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-black/10 dark:border-white/10 text-xs text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    title="Enable model"
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

CompatibleModelsSection.propTypes = {
  providerStorageAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  customModels: PropTypes.arrayOf(PropTypes.object),
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onAddCustomModel: PropTypes.func.isRequired,
  onDeleteCustomModel: PropTypes.func.isRequired,
  connections: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    isActive: PropTypes.bool,
  })).isRequired,
  isAnthropic: PropTypes.bool,
  disabledModelIds: PropTypes.arrayOf(PropTypes.string),
  onSetModelsDisabled: PropTypes.func.isRequired,
};
