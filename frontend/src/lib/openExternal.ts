function isIOS(): boolean {
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";
  const maxTouch = (navigator as any).maxTouchPoints || 0;

  // Covers iPhone/iPad/iPod + iPadOS desktop UA
  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = platform === "MacIntel" && maxTouch > 1;

  return iOSUA || iPadOS;
}

export function isIOSStandalonePWA(): boolean {
  if (!isIOS()) return false;

  const nav: any = navigator;
  const standaloneFlag = !!nav?.standalone;

  const mql =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;

  return standaloneFlag || mql;
}

export function openExternal(url: string) {
  if (isIOSStandalonePWA()) {
    // In iOS installed PWA: avoid window.open/_blank to prevent the blank overlay
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
