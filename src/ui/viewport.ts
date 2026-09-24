import type { Viewport } from "@xyflow/react";

/** Translate only as far as needed; never change the user's zoom. */
export function revealNode(
  viewport: Viewport,
  node: { x: number; y: number; width: number; height: number },
  size: { width: number; height: number },
): Viewport {
  const shift = (start: number, length: number, available: number) => {
    const margin = 24;
    if (length > available - margin * 2) return (available - length) / 2 - start;
    if (start < margin) return margin - start;
    if (start + length > available - margin) return available - margin - start - length;
    return 0;
  };
  return {
    x:
      viewport.x +
      shift(node.x * viewport.zoom + viewport.x, node.width * viewport.zoom, size.width),
    y:
      viewport.y +
      shift(node.y * viewport.zoom + viewport.y, node.height * viewport.zoom, size.height),
    zoom: viewport.zoom,
  };
}
