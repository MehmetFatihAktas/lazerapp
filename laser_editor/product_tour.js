(function initLaserProductTour(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LaserProductTour = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLaserProductTour() {
  "use strict";

  const TOUR_VERSION = 2;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shouldAutoStart(preferences = {}, version = TOUR_VERSION) {
    return Math.max(0, Math.round(finite(preferences.productTourVersion, 0))) < Math.max(1, Math.round(finite(version, TOUR_VERSION)));
  }

  function progress(index, total) {
    const safeTotal = Math.max(1, Math.round(finite(total, 1)));
    const safeIndex = clamp(Math.round(finite(index, 0)), 0, safeTotal - 1);
    return {
      current: safeIndex + 1,
      total: safeTotal,
      percent: ((safeIndex + 1) / safeTotal) * 100,
      first: safeIndex === 0,
      last: safeIndex === safeTotal - 1,
    };
  }

  function computeCardPosition(targetRect, cardSize, viewport, options = {}) {
    const margin = Math.max(8, finite(options.margin, 16));
    const gap = Math.max(8, finite(options.gap, 16));
    const viewWidth = Math.max(1, finite(viewport?.width, 1));
    const viewHeight = Math.max(1, finite(viewport?.height, 1));
    const cardWidth = Math.min(Math.max(280, finite(cardSize?.width, 380)), Math.max(280, viewWidth - margin * 2));
    const cardHeight = Math.min(Math.max(180, finite(cardSize?.height, 300)), Math.max(180, viewHeight - margin * 2));
    const target = {
      left: finite(targetRect?.left),
      top: finite(targetRect?.top),
      right: finite(targetRect?.right),
      bottom: finite(targetRect?.bottom),
    };
    target.width = Math.max(0, finite(targetRect?.width, target.right - target.left));
    target.height = Math.max(0, finite(targetRect?.height, target.bottom - target.top));
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const candidates = [
      { placement: "bottom", left: centerX - cardWidth / 2, top: target.bottom + gap },
      { placement: "right", left: target.right + gap, top: centerY - cardHeight / 2 },
      { placement: "left", left: target.left - cardWidth - gap, top: centerY - cardHeight / 2 },
      { placement: "top", left: centerX - cardWidth / 2, top: target.top - cardHeight - gap },
    ];

    function visibleArea(candidate) {
      const visibleWidth = Math.max(0, Math.min(candidate.left + cardWidth, viewWidth - margin) - Math.max(candidate.left, margin));
      const visibleHeight = Math.max(0, Math.min(candidate.top + cardHeight, viewHeight - margin) - Math.max(candidate.top, margin));
      return visibleWidth * visibleHeight;
    }

    const fitting = candidates.find((candidate) => (
      candidate.left >= margin
      && candidate.top >= margin
      && candidate.left + cardWidth <= viewWidth - margin
      && candidate.top + cardHeight <= viewHeight - margin
    ));
    const chosen = fitting || candidates.sort((a, b) => visibleArea(b) - visibleArea(a))[0];
    return {
      placement: chosen.placement,
      left: clamp(chosen.left, margin, Math.max(margin, viewWidth - cardWidth - margin)),
      top: clamp(chosen.top, margin, Math.max(margin, viewHeight - cardHeight - margin)),
      width: cardWidth,
      height: cardHeight,
    };
  }

  return Object.freeze({ TOUR_VERSION, shouldAutoStart, progress, computeCardPosition });
});
