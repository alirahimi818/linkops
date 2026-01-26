import Card from "../components/ui/Card";
import DismissibleAnnouncementModal from "../components/ui/DismissibleAnnouncementModal";

type MenuItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  external?: boolean;
};

function IconList(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className ?? "h-6 w-6"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 6h13M8 12h13M8 18h13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconHashtag(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className ?? "h-6 w-6"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 3 8 21M16 3l-2 18M4 8h18M3 16h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMail(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className ?? "h-6 w-6"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m4 8 8 6 8-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMap(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className ?? "h-6 w-6"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 22s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconExternal(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className ?? "h-6 w-6"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 3h7v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 14 21 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const content = (
    <Card className="group p-5 transition hover:bg-zinc-50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-800 group-hover:bg-zinc-100">
          {item.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold text-zinc-900">
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
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className="block">
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
  const items: MenuItem[] = [
    {
      title: "لیست فعالیت‌ها",
      description:
        "فعالیت‌های امروز اینستاگرام، توییتر و... رو ببین و هدفمند انجامشون بده.",
      icon: <IconList className="h-12 w-12" />,
      href: "/todos",
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
        "بررسی مکان‌ها و مسیرهای تجمع و راهپیمایی شهر های مختلف دنبا.",
      icon: <IconMap className="h-12 w-12" />,
      href: "https://www.iranmonitor.org/protests",
      external: true,
    },
  ];

  return (
    <div dir="rtl" className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="text-xl font-semibold text-zinc-900">داشبورد</div>
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
    </div>
  );
}
