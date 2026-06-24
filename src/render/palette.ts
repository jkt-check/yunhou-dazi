/**
 * Centralized palette constants for Canvas 2D drawing.
 * Canvas cannot read CSS variables at draw time without getComputedStyle,
 * so we mirror the design tokens from src/styles/variables.css here as
 * named constants. Keep both files in sync — update variables.css AND
 * this file when changing a color.
 *
 * Token names mirror variables.css.
 */

export const PAPER = '#F5EBD7';
export const PAPER_WARM = '#FAF3E0';
export const PAPER_SHADOW = '#E8DAB8';
export const INK = '#2C1810';
export const INK_MUTED = '#7A5C3F';
export const VERMILION = '#C44536';
export const OCHRE = '#D4673A';
export const MOSS = '#5A8068';
export const HAZE = '#7BA7BC';
export const HONEY = '#DAA520';
export const EARTH = '#8B6F47';
