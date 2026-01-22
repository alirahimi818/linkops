import React from "react";
import Card from "../ui/Card";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
};

export default function AdminTable<T>(props: Props<T>) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{props.title}</div>
          {props.subtitle ? <div className="mt-1 text-sm text-zinc-500">{props.subtitle}</div> : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {props.rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            {props.emptyText ?? "No records."}
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                {props.columns.map((c) => (
                  <th key={c.key} className={`text-left text-xs font-semibold text-zinc-600 ${c.className ?? ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r, idx) => (
                <tr key={idx} className="bg-white">
                  {props.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`rounded-xl border border-zinc-200 px-3 py-2 align-top text-sm text-zinc-800 ${c.className ?? ""}`}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
