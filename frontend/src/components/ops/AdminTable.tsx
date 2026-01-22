import React from "react";
import Card from "../ui/Card";

export type AdminColumn<T> = {
  key: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  title?: string;
  subtitle?: string;

  rows: T[];
  rowKey: (row: T) => string;

  /**
   * The main row content (left side) - you can pass multiple blocks via columns.
   */
  columns: AdminColumn<T>[];

  /**
   * Optional actions area per row (right side)
   */
  rowActions?: (row: T) => React.ReactNode;

  emptyText?: string;

  /**
   * Optional header right content (e.g. buttons)
   */
  headerRight?: React.ReactNode;

  /**
   * Row container classes
   */
  rowClassName?: string;
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
            {props.rows.map((r) => (
              <div
                key={props.rowKey(r)}
                className={[
                  "rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm",
                  props.rowClassName ?? "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2">
                      {props.columns.map((c) => (
                        <div key={c.key} className={c.className ?? ""}>
                          {c.render(r)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {props.rowActions ? (
                    <div className="shrink-0 md:pl-4">
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        {props.rowActions(r)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
