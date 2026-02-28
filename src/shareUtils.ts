/**
 * Share utilities — Web Share API with fallbacks.
 *
 * CRITICAL: navigator.share() requires user activation (transient).
 * It MUST be called synchronously from the click handler — no await before it.
 * All data must be pre-prepared; no upload or async work before share.
 */

export function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ShareImageOptions = {
  title?: string;
  text?: string;
  filename?: string;
  hostedUrl?: string | null;
  dataUrl?: string;
  onLinkCopied?: () => void;
};

/**
 * Share using Web Share API. Call this directly from click handler.
 * All data must be pre-prepared — no async before share (user gesture is lost).
 */
export function shareImage(
  blob: Blob,
  options: ShareImageOptions = {}
): void {
  const { title = '', text = '', filename = 'image.png', hostedUrl, dataUrl, onLinkCopied } = options;
  const file = new File([blob], filename, { type: blob.type || 'image/png' });

  if (typeof navigator.share !== 'function') {
    if (hostedUrl) {
      navigator.clipboard?.writeText(`${text}\n${hostedUrl}`.trim()).then(() => onLinkCopied?.()).catch(() => downloadBlob(blob, filename));
    } else {
      downloadBlob(blob, filename);
    }
    return;
  }

  // Build payload — try URL first (Safari prefers it), then files. Minimal payload for compatibility.
  const payloads: { url?: string; files?: File[]; title?: string; text?: string }[] = [];
  if (hostedUrl) payloads.push({ url: hostedUrl, title, text }, { url: hostedUrl });
  if (dataUrl && dataUrl.length < 500_000) payloads.push({ url: dataUrl });
  payloads.push({ files: [file], title, text }, { files: [file] });

  for (const payload of payloads) {
    if (navigator.canShare && !navigator.canShare(payload)) continue;
    try {
      navigator.share(payload)
        .then(() => {})
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          if (hostedUrl) {
            navigator.clipboard?.writeText(`${text}\n${hostedUrl}`.trim()).then(() => onLinkCopied?.()).catch(() => downloadBlob(blob, filename));
          } else {
            downloadBlob(blob, filename);
          }
        });
      return;
    } catch {
      continue;
    }
  }

  if (hostedUrl) {
    navigator.clipboard?.writeText(`${text}\n${hostedUrl}`.trim()).then(() => onLinkCopied?.()).catch(() => downloadBlob(blob, filename));
  } else {
    downloadBlob(blob, filename);
  }
}
