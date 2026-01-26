import { useEffect, useMemo, useState } from "react";

type AnyEvent = any;

function isStandalone(): boolean {
  // iOS Safari uses navigator.standalone
  const nav: any = navigator as any;
  const iosStandalone = !!nav?.standalone;

  // Modern browsers
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return iosStandalone || mq;
}

function isIOS(): boolean {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua);
}

function isSafari(): boolean {
  const ua = navigator.userAgent || "";
  const isSafariLike = /safari/i.test(ua) && !/chrome|crios|fxios|edgios|opr\//i.test(ua);
  return isSafariLike;
}

export type InstallState = {
  canPrompt: boolean;
  isInstalled: boolean;
  isIOSAddToHome: boolean; // true => show iOS instructions instead of install button
};

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<AnyEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);

  useEffect(() => {
    setInstalled(isStandalone());

    function onBeforeInstallPrompt(e: AnyEvent) {
      // Chrome/Edge/Android
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const state: InstallState = useMemo(() => {
    const ios = isIOS() && isSafari();
    const isInstalled = installed || isStandalone();
    return {
      canPrompt: !!deferredPrompt && !isInstalled,
      isInstalled,
      isIOSAddToHome: ios && !isInstalled,
    };
  }, [deferredPrompt, installed]);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferredPrompt) return "unavailable";
    try {
      deferredPrompt.prompt();
      const res = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return res?.outcome === "accepted" ? "accepted" : "dismissed";
    } catch {
      return "unavailable";
    }
  }

  return { state, promptInstall };
}
