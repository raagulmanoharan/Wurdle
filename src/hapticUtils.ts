/**
 * Haptic feedback for typing and reveal.
 * Uses ios-haptics: works on iOS Safari 17.4+ (checkbox toggle trick) and Android (Vibration API).
 */
import { haptic } from 'ios-haptics';

export function vibrateHapticTyping(): void {
  try {
    haptic();
  } catch {
    // Silently ignore
  }
}

export function vibrateHapticReveal(): void {
  try {
    haptic.confirm();
  } catch {
    // Silently ignore
  }
}
