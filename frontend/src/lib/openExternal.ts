export function isIOSStandalonePWA(): boolean {
  const nav: any = navigator;
  return !!nav?.standalone;
}

export function openExternal(url: string) {
  if (isIOSStandalonePWA()) {
    // Avoid iOS PWA SFSafari overlay by not using window.open/_blank
    window.location.href = url;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
