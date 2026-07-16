(function initLaserCanvasSelection(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserCanvasSelection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserCanvasSelection() {
  "use strict";

  function sortedObjectCandidates(candidates) {
    return (candidates || [])
      .filter((candidate) => candidate?.id)
      .slice()
      .sort((first, second) => {
        const priority = Number(first.priority) - Number(second.priority);
        if (priority) return priority;
        const area = Number(first.area) - Number(second.area);
        if (area) return area;
        return Number(second.z) - Number(first.z);
      });
  }

  function chooseObjectCandidate(candidates, options = {}) {
    const sorted = sortedObjectCandidates(candidates);
    if (!sorted.length) return null;
    if (!options.cycle || sorted.length === 1) return sorted[0];
    const selectedId = String(options.selectedId || "");
    const selectedIndex = sorted.findIndex((candidate) => String(candidate.id) === selectedId);
    return sorted[(selectedIndex + 1 + sorted.length) % sorted.length];
  }

  return Object.freeze({
    sortedObjectCandidates,
    chooseObjectCandidate,
  });
});
