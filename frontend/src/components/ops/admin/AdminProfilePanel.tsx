import { useEffect, useState } from "react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import Alert from "../../ui/Alert";

import { adminMe, adminUpdateMe } from "../../../lib/api";
import type { Me } from "../../../lib/api";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export default function AdminProfilePanel(props: { onClose: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState(""); // optional

  const isLoading = state.status === "loading";

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setState({ status: "loading" });
        const u = await adminMe();
        if (!alive) return;

        setMe(u);
        setEmail(u.email ?? "");
        setName(u.name ?? "");
        setAvatarUrl(u.avatar_url ?? "");
        setBio(u.bio ?? "");
        setPassword("");
        setState({ status: "idle" });
      } catch {
        if (!alive) return;
        setState({ status: "error", message: "بارگذاری پروفایل ناموفق بود." });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function onSave() {
    setState({ status: "idle" });

    if (password.trim() && password.length < 6) {
      setState({ status: "error", message: "پسورد باید حداقل ۶ کاراکتر باشد." });
      return;
    }

    setState({ status: "loading" });

    try {
      const payload: any = {
        email: email.trim() ? email.trim() : null,
        name: name.trim() ? name.trim() : null,
        avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
        bio: bio.trim() ? bio.trim() : null,
      };

      // Only send password if user typed it
      if (password.trim()) payload.password = password;

      await adminUpdateMe(payload);

      setPassword("");
      setState({ status: "success", message: "پروفایل ذخیره شد." });

      // refresh user info (optional)
      const u = await adminMe();
      setMe(u);
    } catch (e: any) {
      setState({ status: "error", message: e?.message ?? "ذخیره پروفایل ناموفق بود." });
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-600">
          ویرایش پروفایل {me ? <span className="font-medium text-zinc-900">{me.username}</span> : null}
        </div>
        <Button variant="secondary" onClick={props.onClose}>
          بستن
        </Button>
      </div>

      {state.status === "error" ? <Alert variant="error">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert variant="success">{state.message}</Alert> : null}

      <div className="mt-3 grid gap-3">
        <Input value={email} onChange={setEmail} placeholder="ایمیل (اختیاری)" />
        <Input value={name} onChange={setName} placeholder="نام (اختیاری)" />
        <Input dir="ltr" value={avatarUrl} onChange={setAvatarUrl} placeholder="Avatar URL (اختیاری)" />
        <Textarea dir="auto" value={bio} onChange={setBio} placeholder="بیو (اختیاری)" rows={4} />

        <Input
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="پسورد جدید (اختیاری، خالی باشد تغییر نمی‌کند)"
        />

        <div className="flex items-center gap-2">
          <Button variant="success" onClick={onSave} disabled={isLoading}>
            {isLoading ? "در حال ذخیره…" : "ذخیره"}
          </Button>
        </div>
      </div>
    </Card>
  );
}