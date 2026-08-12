/**
 * Core/Hub compact `mouse_mode` bitmask (u8):
 *   normal=1, any=2, button=4, SGR=8
 * So normal+SGR (the mouse-on fixture) == 9.
 */
export const CORE_MOUSE_NORMAL = 1;
export const CORE_MOUSE_ANY = 2;
export const CORE_MOUSE_BUTTON = 4;
export const CORE_MOUSE_SGR = 8;

/** Restty `rehydrateFromTrackingBits` layout. */
const RESTTY_MOUSE_NORMAL = 1 << 1;
const RESTTY_MOUSE_BUTTON = 1 << 2;
const RESTTY_MOUSE_ANY = 1 << 3;
const RESTTY_MOUSE_SGR = 1 << 5;

export function coreMouseTrackingEnabled(mouseMode: number): boolean {
  return (mouseMode & (CORE_MOUSE_NORMAL | CORE_MOUSE_ANY | CORE_MOUSE_BUTTON)) !== 0;
}

/**
 * Map Core compact bits onto Restty tracking bits.
 * Restty: bit0=x10, bit1=1000 normal, bit2=1002 button, bit3=1003 any, bit5=sgr format.
 * Core has no separate X10 flag in the compact mask.
 */
export function mouseTrackingBitsFromCoreMode(mouseMode: number): number {
  let bits = 0;
  if (mouseMode & CORE_MOUSE_NORMAL) bits |= RESTTY_MOUSE_NORMAL;
  if (mouseMode & CORE_MOUSE_BUTTON) bits |= RESTTY_MOUSE_NORMAL | RESTTY_MOUSE_BUTTON;
  if (mouseMode & CORE_MOUSE_ANY) bits |= RESTTY_MOUSE_NORMAL | RESTTY_MOUSE_BUTTON | RESTTY_MOUSE_ANY;
  if (mouseMode & CORE_MOUSE_SGR) bits |= RESTTY_MOUSE_SGR;
  return bits;
}
