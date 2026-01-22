import React from "react";
import Card from "../ui/Card";

export type AdminColumn<T> = {
  key: string;
  header?: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  title?: string;
  subtitle?: string;
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;

  /**
   * Optional right-side actions area per row (outside the "content card")
   */
  rowActions?: (row: T) => React.ReactNode;

  /**
   * Optional header right content (e.g. buttons)
   */
  headerRight?: React.ReactNode;
};

export default function AdminTable<T>(props: Props<T>) {
  return (
    <Card>
      {(props.title || props.subtitle || props.headerRight) ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            {props.title ? <div className="text-lg font-semibold">{props.title}</div> : null}
            {props.subtitle ? <div className="mt-1 text-sm text-zinc-500">{props.subtitle}</div> : null}
          </div>
          {props.headerRight ? <div className="shrink-0">{props.headerRight}</div> : null}
        </div>
      ) : null}

      <div className="mt-4">
        {props.rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            {props.emptyText ?? "No records."}
          </div>
        ) : (
          <div className="grid gap-2">
            {/* "Header" row */}
            <div className="hidden md:grid md:grid-cols-12 gap-3 px-3">
              {props.columns.map((c) => (
                <div key={c.key} className={`text-xs font-semibold text-zinc-600 ${c.className ?? ""}`}>
                  {c.header ?? ""}
                </div>
              ))}
              {props.rowActions ? <div className="text-xs font-semibold text-zinc-600 text-right">Actions</div> : null}
            </div>

            {/* Rows */}
            {props.rows.map((r) => (
              <div key={props.rowKey(r)} className="flex items-start gap-3">
                <div className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {props.columns.map((c) => (
                      <div key={c.key} className={c.className ?? ""}>
                        {/* Mobile label */}
                        {c.header ? <div className="md:hidden text-xs text-zinc-500 mb-1">{c.header}</div> : null}
                        <div className="text-sm text-zinc-800">{c.render(r)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {props.rowActions ? (
                  <div className="shrink-0 pt-1">
                    {props.rowActions(r)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
