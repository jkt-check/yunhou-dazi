/**
 * Convert a HoleLayout's normalized positions to pixel coordinates
 * for the current canvas size. Pure function — call once per frame
 * with the latest canvas dimensions.
 */
import type { HoleLayout } from '@/scenes/layout';

export function layoutToPixels(
  layout: HoleLayout,
  w: number,
  h: number
): { x: number; y: number }[] {
  return layout.positions.map(p => ({
    x: p.xRatio * w,
    y: p.yRatio * h
  }));
}
