// frontend/src/pages/Home.tsx
import React, { useEffect, useState } from "react";

import InstallPwaCard from "../components/ops/InstallPwaCard";
import Card from "../components/ui/Card";
import DismissibleAnnouncementModal from "../components/ui/DismissibleAnnouncementModal";
import OfflineBanner from "../components/ui/OfflineBanner";

import {
  IconExternal,
  IconHashtag,
  IconList,
  IconMail,
  IconMap,
} from "../components/ui/icons";
import { isIOSStandalonePWA } from "../lib/openExternal";
import { getTodoRemainingCount } from "../lib/homeBadge";

type MenuItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  external?: boolean;
  badgeCount?: number | null;
  badgeLabel?: string;
};

function BadgeCorner(props: { count: number; title?: string }) {
  const c = props.count;
  if (!Number.isFinite(c) || c <= 0) return null;

  const text = c > 99 ? "99+" : String(c);

  return (
    <div
      className="absolute -top-2 -left-2 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs  text-rose-700 shadow-sm"
      title={props.title}
      aria-label={props.title ?? `${c} remaining`}
    >
      {text}
    </div>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const isPwaIOS = isIOSStandalonePWA();
  const content = (
    <div className="relative">
      {typeof item.badgeCount === "number" ? (
        <BadgeCorner count={item.badgeCount} title={item.badgeLabel} />
      ) : null}

      <Card className="group p-5 transition hover:bg-zinc-50">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-800 group-hover:bg-zinc-100">
            {item.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-base  text-zinc-900">
                {item.title}
              </div>

              {item.external ? (
                <span className="text-zinc-500" title="لینک خارجی">
                  <IconExternal className="h-4 w-4" />
                </span>
              ) : null}
            </div>

            <div className="mt-1 text-sm text-zinc-600" dir="auto">
              {item.description}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target={isPwaIOS ? undefined : "_blank"}
        onClick={(e) => {
          if (isPwaIOS) {
            return;
          }
          e.preventDefault();
          window.open(item.href, "_blank", "noopener,noreferrer");
        }}
        rel="noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return (
    <a href={item.href} className="block">
      {content}
    </a>
  );
}

export default function Home() {
  const [todoRemaining, setTodoRemaining] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const r = await getTodoRemainingCount({ days: 7 });
        if (!alive) return;
        setTodoRemaining(r.remaining);
      } catch {
        if (!alive) return;
        setTodoRemaining(null);
      }
    }

    // initial
    void refresh();

    // listen to status changes from other pages
    const onStatusChanged = (ev: Event) => {
      void ev;
      void refresh();
    };
    window.addEventListener("status:changed", onStatusChanged);

    // refresh when returning to tab/page
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.removeEventListener("status:changed", onStatusChanged);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const items: MenuItem[] = [
    {
      title: "لیست فعالیت‌ها",
      description:
        "فعالیت‌های امروز اینستاگرام، توییتر و... رو ببین و هدفمند انجامشون بده.",
      icon: <IconList className="h-12 w-12" />,
      href: "/todos",
      badgeCount: todoRemaining,
      badgeLabel:
        todoRemaining != null
          ? `کارهای باقی‌مانده در ۷ روز اخیر: ${todoRemaining}`
          : undefined,
    },
    {
      title: "ابزار بررسی هشتگ‌ها",
      description: "متن رو وارد کن تا هشتگ‌های اشتباه/ناشناخته مشخص بشن.",
      icon: <IconHashtag className="h-12 w-12" />,
      href: "/hashtags-checker",
    },
    {
      title: "کمپین ایمیلی",
      description: "ارسال ایمیل‌های هماهنگ به وزرا، پارلمان‌ها و...",
      icon: <IconMail className="h-12 w-12" />,
      href: "https://iranian-diaspora.com/",
      external: true,
    },
    {
      title: "نقشه و مکان‌های تجمع",
      description:
        "بررسی مکان‌ها و مسیرهای تجمع و راهپیمایی شهرهای مختلف دنیا.",
      icon: <IconMap className="h-12 w-12" />,
      href: "https://www.iranmonitor.org/protests",
      external: true,
    },
  ];

  return (
    <div dir="rtl" className="mx-auto w-full">
      <div dir="rtl" className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="text-xl  text-zinc-900">داشبورد</div>
            <a href="/">
              <img src="/assets/flags/flag-ir-640.png" className="h-6" alt="" />
            </a>
          </div>

          <div className="mt-1 text-sm text-zinc-600">
            برای شروع فعالیت، یک بخش رو انتخاب کن.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <MenuCard key={it.title} item={it} />
          ))}
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          نکته: لینک‌های خارجی در تب جدید باز میشن.
        </div>

        <DismissibleAnnouncementModal
          scopeKey="/"
          id="welcome-2026-01"
          title="خوش آمدید!"
          description="در نبرد روایت‌ها و جنگ رسانه‌ای که رژیم با صرف بودجه‌های کلان و ارتش سایبری‌اش راه انداخته، ما هم باید از ابزارهای پیشرفته و هوشمند استفاده کنیم تا بتوانیم مؤثرتر عمل کنیم، دروغ‌ها رو افشا کنیم و حقیقت رو به گوش جهان برسانیم."
          imageUrl="/assets/flags/flag-ir-640.png"
        />

        <div className="my-4">
          <InstallPwaCard scopeKey="/" id="pwa-install" />
        </div>
      </div>

      <OfflineBanner />
    </div>
  );
}
