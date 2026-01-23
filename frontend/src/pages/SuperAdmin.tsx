import { useState } from "react";

import PageShell from "../components/layout/PageShell";
import TopBar from "../components/layout/TopBar";

import SuperAdminUsers from "../components/ops/SuperAdminUsers";
import SuperAdminCategories from "../components/ops/SuperAdminCategories";
import SuperAdminHashtags from "../components/ops/SuperAdminHashtags";
import SuperAdminActions from "../components/ops/SuperAdminActions";

type Tab = "users" | "categories" | "actions" | "hashtags";

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={[
        "rounded-full px-4 py-2 text-sm transition border",
        props.active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

export default function SuperAdmin() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <PageShell
      header={<TopBar title="Super Admin" subtitle="Manage users, categories, actions, and hashtags." />}
      footer={
        <>
          Back to{" "}
          <a className="underline" href="/admin">
            admin
          </a>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>
          Users
        </TabButton>

        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          Categories
        </TabButton>

        <TabButton active={tab === "actions"} onClick={() => setTab("actions")}>
          Actions
        </TabButton>

        <TabButton active={tab === "hashtags"} onClick={() => setTab("hashtags")}>
          Hashtags
        </TabButton>
      </div>

      {tab === "users" ? <SuperAdminUsers /> : null}
      {tab === "categories" ? <SuperAdminCategories /> : null}
      {tab === "actions" ? <SuperAdminActions /> : null}
      {tab === "hashtags" ? <SuperAdminHashtags /> : null}
    </PageShell>
  );
}
