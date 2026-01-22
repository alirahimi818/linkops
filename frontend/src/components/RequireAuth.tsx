import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminMe } from "../lib/api";

type Props = {
  allowRoles?: string[];
  children: React.ReactNode;
};

export default function RequireAuth({ allowRoles, children }: Props) {
  const navigate = useNavigate();
  const loc = useLocation();

  const [status, setStatus] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const me = await adminMe();

        if (!alive) return;

        if (allowRoles && !allowRoles.includes(me.role)) {
          navigate(`/login?next=${encodeURIComponent(loc.pathname)}`, { replace: true });
          return;
        }

        setStatus("ok");
      } catch {
        if (!alive) return;
        navigate(`/login?next=${encodeURIComponent(loc.pathname)}`, { replace: true });
      }
    })();

    return () => {
      alive = false;
    };
  }, [allowRoles, loc.pathname, navigate]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-10 text-zinc-500">Checking session…</div>
      </div>
    );
  }

  return <>{children}</>;
}
