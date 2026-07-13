(function (root) {
  "use strict";

  const EPSILON = 0.001;

  function rectWidth(rect) {
    return Math.max(0, Number(rect.maxX) - Number(rect.minX));
  }

  function rectHeight(rect) {
    return Math.max(0, Number(rect.maxY) - Number(rect.minY));
  }

  function rectArea(rect) {
    return rectWidth(rect) * rectHeight(rect);
  }

  function rectContains(outer, inner) {
    return (
      outer.minX <= inner.minX + EPSILON &&
      outer.minY <= inner.minY + EPSILON &&
      outer.maxX >= inner.maxX - EPSILON &&
      outer.maxY >= inner.maxY - EPSILON
    );
  }

  function rectEquals(first, second) {
    return (
      Math.abs(first.minX - second.minX) <= EPSILON &&
      Math.abs(first.minY - second.minY) <= EPSILON &&
      Math.abs(first.maxX - second.maxX) <= EPSILON &&
      Math.abs(first.maxY - second.maxY) <= EPSILON
    );
  }

  function rectOverlaps(first, second) {
    return !(
      first.maxX <= second.minX + EPSILON ||
      first.minX >= second.maxX - EPSILON ||
      first.maxY <= second.minY + EPSILON ||
      first.minY >= second.maxY - EPSILON
    );
  }

  function expandedRect(rect, amount) {
    const value = Math.max(0, Number(amount) || 0);
    return {
      minX: rect.minX - value,
      minY: rect.minY - value,
      maxX: rect.maxX + value,
      maxY: rect.maxY + value,
    };
  }

  function pruneFreeRects(rects) {
    const filtered = rects.filter((rect) => rectWidth(rect) > EPSILON && rectHeight(rect) > EPSILON);
    return filtered.filter((rect, index) => {
      for (let otherIndex = 0; otherIndex < filtered.length; otherIndex += 1) {
        if (index === otherIndex) continue;
        const other = filtered[otherIndex];
        if (!rectContains(other, rect)) continue;
        if (!rectEquals(other, rect) || otherIndex < index) return false;
      }
      return true;
    });
  }

  function splitFreeRects(freeRects, usedRect) {
    const next = [];
    for (const free of freeRects) {
      if (!rectOverlaps(free, usedRect)) {
        next.push(free);
        continue;
      }
      if (usedRect.minX > free.minX + EPSILON) {
        next.push({ minX: free.minX, minY: free.minY, maxX: usedRect.minX, maxY: free.maxY });
      }
      if (usedRect.maxX < free.maxX - EPSILON) {
        next.push({ minX: usedRect.maxX, minY: free.minY, maxX: free.maxX, maxY: free.maxY });
      }
      if (usedRect.minY > free.minY + EPSILON) {
        next.push({ minX: free.minX, minY: free.minY, maxX: free.maxX, maxY: usedRect.minY });
      }
      if (usedRect.maxY < free.maxY - EPSILON) {
        next.push({ minX: free.minX, minY: usedRect.maxY, maxX: free.maxX, maxY: free.maxY });
      }
    }
    return pruneFreeRects(next);
  }

  function normalizeRotation(value) {
    return ((Math.round(Number(value) || 0) % 360) + 360) % 360;
  }

  function itemOptions(item, allowRotate) {
    const width = Number(item?.part?.width);
    const height = Number(item?.part?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= EPSILON || height <= EPSILON) return [];
    if (item.fixedRotation) {
      const rotation = normalizeRotation(item.rotation);
      const swapped = rotation === 90 || rotation === 270;
      return [{ rotation, width: swapped ? height : width, height: swapped ? width : height }];
    }
    const options = [{ rotation: 0, width, height }];
    if (allowRotate && Math.abs(width - height) > EPSILON) {
      options.push({ rotation: 90, width: height, height: width });
    }
    return options;
  }

  function compareScores(first, second) {
    const length = Math.max(first.length, second.length);
    for (let index = 0; index < length; index += 1) {
      const difference = Number(first[index] || 0) - Number(second[index] || 0);
      if (Math.abs(difference) > EPSILON) return difference;
    }
    return 0;
  }

  function rectsBounds(rects) {
    if (!rects.length) return null;
    return {
      minX: Math.min(...rects.map((rect) => rect.minX)),
      minY: Math.min(...rects.map((rect) => rect.minY)),
      maxX: Math.max(...rects.map((rect) => rect.maxX)),
      maxY: Math.max(...rects.map((rect) => rect.maxY)),
    };
  }

  function boundsWithRect(bounds, rect) {
    if (!bounds) return { ...rect };
    return {
      minX: Math.min(bounds.minX, rect.minX),
      minY: Math.min(bounds.minY, rect.minY),
      maxX: Math.max(bounds.maxX, rect.maxX),
      maxY: Math.max(bounds.maxY, rect.maxY),
    };
  }

  function scorePlacementBounds(rect, usedBounds, option = {}, preferRotated = false) {
    const bounds = boundsWithRect(usedBounds, rect);
    const width = rectWidth(bounds);
    const height = rectHeight(bounds);
    const quarterTurn = normalizeRotation(option.rotation) % 180 !== 0;
    const rotationPenalty = quarterTurn === Boolean(preferRotated) ? 0 : 1;
    return [
      width * height,
      2 * (width + height),
      Math.max(width, height),
      Math.abs(width - height),
      rotationPenalty,
      rect.minY,
      rect.minX,
    ];
  }

  function scorePlacement(rect, usedRects, option = {}, preferRotated = false) {
    return scorePlacementBounds(rect, rectsBounds(usedRects), option, preferRotated);
  }

  function freeRectAnchors(free, width, height, usedBounds) {
    const xs = [free.minX, free.maxX - width];
    const ys = [free.minY, free.maxY - height];
    if (usedBounds) {
      xs.push(usedBounds.minX, usedBounds.maxX - width);
      ys.push(usedBounds.minY, usedBounds.maxY - height);
    }
    const anchors = [];
    for (const x of xs) {
      for (const y of ys) {
        if (x < free.minX - EPSILON || x + width > free.maxX + EPSILON) continue;
        if (y < free.minY - EPSILON || y + height > free.maxY + EPSILON) continue;
        if (anchors.some((point) => Math.abs(point.x - x) <= EPSILON && Math.abs(point.y - y) <= EPSILON)) continue;
        anchors.push({ x, y });
      }
    }
    return anchors;
  }

  function bestPosition(item, freeRects, usedRects, allowRotate, preferRotated) {
    let best = null;
    const usedBounds = rectsBounds(usedRects);
    for (const option of itemOptions(item, allowRotate)) {
      for (const free of freeRects) {
        if (option.width > rectWidth(free) + EPSILON || option.height > rectHeight(free) + EPSILON) continue;
        for (const anchor of freeRectAnchors(free, option.width, option.height, usedBounds)) {
          const rect = {
            minX: anchor.x,
            minY: anchor.y,
            maxX: anchor.x + option.width,
            maxY: anchor.y + option.height,
          };
          const score = scorePlacementBounds(rect, usedBounds, option, preferRotated);
          if (!best || compareScores(score, best.score) < 0) best = { ...option, rect, score };
        }
      }
    }
    return best;
  }

  function itemMetrics(item) {
    const width = Math.max(0, Number(item?.part?.width) || 0);
    const height = Math.max(0, Number(item?.part?.height) || 0);
    return {
      width,
      height,
      area: width * height,
      longSide: Math.max(width, height),
      shortSide: Math.min(width, height),
      perimeter: 2 * (width + height),
    };
  }

  function sortItems(items, strategy = "area") {
    return items
      .map((item, index) => ({ item, index, metrics: itemMetrics(item) }))
      .sort((first, second) => {
        const a = first.metrics;
        const b = second.metrics;
        let scoreA;
        let scoreB;
        if (strategy === "long-side") {
          scoreA = [a.longSide, a.area, a.shortSide];
          scoreB = [b.longSide, b.area, b.shortSide];
        } else if (strategy === "height") {
          scoreA = [a.height, a.width, a.area];
          scoreB = [b.height, b.width, b.area];
        } else if (strategy === "width") {
          scoreA = [a.width, a.height, a.area];
          scoreB = [b.width, b.height, b.area];
        } else if (strategy === "perimeter") {
          scoreA = [a.perimeter, a.area, a.longSide];
          scoreB = [b.perimeter, b.area, b.longSide];
        } else {
          scoreA = [a.area, a.longSide, a.shortSide];
          scoreB = [b.area, b.longSide, b.shortSide];
        }
        for (let index = 0; index < scoreA.length; index += 1) {
          if (Math.abs(scoreA[index] - scoreB[index]) > EPSILON) return scoreB[index] - scoreA[index];
        }
        return first.index - second.index;
      })
      .map((entry) => entry.item);
  }

  function resultScore(packed, overflowItems, occupiedRects) {
    const bounds = rectsBounds([...occupiedRects, ...packed.map((entry) => entry.rect)]);
    const width = bounds ? rectWidth(bounds) : 0;
    const height = bounds ? rectHeight(bounds) : 0;
    const quarterTurns = packed.filter((entry) => normalizeRotation(entry.rotation) % 180 !== 0).length;
    return [
      overflowItems.length,
      width * height,
      2 * (width + height),
      Math.max(width, height),
      Math.abs(width - height),
      quarterTurns,
      bounds?.minY || 0,
      bounds?.minX || 0,
    ];
  }

  function packingStrategies(itemCount) {
    const strategies = [
      { order: "area", preferRotated: false },
      { order: "area", preferRotated: true },
      { order: "long-side", preferRotated: false },
      { order: "long-side", preferRotated: true },
      { order: "height", preferRotated: false },
      { order: "width", preferRotated: false },
      { order: "perimeter", preferRotated: false },
    ];
    if (itemCount > 250) return strategies.slice(0, 2);
    if (itemCount > 80) return strategies.slice(0, 4);
    return strategies;
  }

  function packAttempt(items, usableRect, occupiedRects, gap, allowRotate, strategy) {
    let freeRects = [usableRect];
    for (const rect of occupiedRects) freeRects = splitFreeRects(freeRects, expandedRect(rect, gap));
    const usedRects = [...occupiedRects];
    const packed = [];
    const overflowItems = [];
    for (const item of sortItems(items, strategy.order)) {
      const best = bestPosition(item, freeRects, usedRects, allowRotate, strategy.preferRotated);
      if (!best) {
        overflowItems.push(item);
        continue;
      }
      const packedItem = {
        item,
        x: best.rect.minX,
        y: best.rect.minY,
        rotation: best.rotation,
        rect: best.rect,
        overflow: false,
      };
      packed.push(packedItem);
      usedRects.push(best.rect);
      freeRects = splitFreeRects(freeRects, expandedRect(best.rect, gap));
    }
    return {
      packed,
      overflowItems,
      envelope: rectsBounds([...occupiedRects, ...packed.map((entry) => entry.rect)]),
      score: resultScore(packed, overflowItems, occupiedRects),
      strategy,
    };
  }

  function packRectangles({ items, usableRect, occupiedRects = [], gap = 0, allowRotate = true }) {
    const sourceItems = Array.isArray(items) ? items : [];
    if (!usableRect || rectWidth(usableRect) <= EPSILON || rectHeight(usableRect) <= EPSILON) {
      return { packed: [], overflowItems: [...sourceItems], envelope: rectsBounds(occupiedRects), score: [sourceItems.length] };
    }
    let best = null;
    for (const strategy of packingStrategies(sourceItems.length)) {
      const result = packAttempt(sourceItems, usableRect, occupiedRects, Math.max(0, Number(gap) || 0), Boolean(allowRotate), strategy);
      if (!best || compareScores(result.score, best.score) < 0) best = result;
    }
    return best || { packed: [], overflowItems: [...sourceItems], envelope: rectsBounds(occupiedRects), score: [sourceItems.length] };
  }

  root.LaserPacking = {
    compareScores,
    itemOptions,
    packRectangles,
    rectsBounds,
    scorePlacement,
    scorePlacementBounds,
    sortItems,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).LaserPacking;
}
