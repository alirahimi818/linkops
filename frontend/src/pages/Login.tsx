import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminLogin } from "../lib/api";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";

const TOKEN_KEY = "admin:jwt";

function useNextParam(): string {
  const loc = useLocation();
  return useMemo(() => {
    const p = new URLSearchParams(loc.search);
    const next = p.get("next");
    return next && next.startsWith("/") ? next : "/admin";
  }, [loc.search]);
}

export default function Login() {
  const navigate = useNavigate();
  const next = useNextParam();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function onSubmit() {
    setState("loading");
    try {
      const res = await adminLogin(username.trim(), password);
      localStorage.setItem(TOKEN_KEY, res.token);
      navigate(next, { replace: true });
    } catch {
      setState("error");
    } finally {
      setState("idle");
    }
  }

  return (
    <PageShell
      maxWidthClassName="max-w-md"
      header={<TopBar title="Login" subtitle="Sign in to continue." />}
      footer={
        <>
          Back to{" "}
          <a className="underline" href="/">
            home
          </a>
        </>
      }
    >
      <Card>
        <div className="grid gap-3">
          <Input value={username} onChange={setUsername} placeholder="Username" autoComplete="username" />
          <Input
            value={password}
            onChange={setPassword}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />

          <Button
            onClick={onSubmit}
            disabled={!username.trim() || !password || state === "loading"}
          >
            {state === "loading" ? "Signing in…" : "Sign in"}
          </Button>

          {state === "error" ? <Alert variant="error">Invalid username or password.</Alert> : null}
        </div>
      </Card>
    </PageShell>
  );
}
