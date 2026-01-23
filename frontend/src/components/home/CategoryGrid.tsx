import Card from "../ui/Card";

export type CategoryCard = {
  id: string;
  name: string;
  image: string | null;
  count: number;
  isAll?: boolean;
};

export default function CategoryGrid(props: {
  categories: CategoryCard[];
  onSelect: (c: CategoryCard) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {props.categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => props.onSelect(c)}
          className="text-right"
        >
          <Card className="transition hover:shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">{c.name}</div>
                <div className="mt-1 text-sm text-zinc-600">{c.count} آیتم</div>
              </div>

              {c.image ? (
                <img
                  src={c.image}
                  alt={c.name}
                  className="h-10 w-10 rounded-xl border border-zinc-200 bg-white object-contain p-2"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl border border-zinc-200 bg-zinc-50" />
              )}
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}
