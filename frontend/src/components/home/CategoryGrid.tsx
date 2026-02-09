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
                <div className="text-lg  text-zinc-900">{c.name}</div>
                <div className="mt-1 text-sm text-zinc-600">{c.count} آیتم</div>
              </div>

              {c.image ? (
                <img
                  src={c.image}
                  alt={c.name}
                  className="h-20 w-20 rounded-xl border border-zinc-200 bg-white object-contain p-2"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center">
                    <svg className="w-16 h-16" viewBox="0 0 52 52" data-name="Layer 1" id="Layer_1" xmlns="http://www.w3.org/2000/svg"><path d="M50,15.52H2a2,2,0,0,1-2-2V2A2,2,0,0,1,2,0H50a2,2,0,0,1,2,2V13.52A2,2,0,0,1,50,15.52Zm-46-4H48V4H4Z"/><path d="M50,33.76H2a2,2,0,0,1-2-2V20.24a2,2,0,0,1,2-2H50a2,2,0,0,1,2,2V31.76A2,2,0,0,1,50,33.76Zm-46-4H48V22.24H4Z"/><path d="M50,52H2a2,2,0,0,1-2-2V38.48a2,2,0,0,1,2-2H50a2,2,0,0,1,2,2V50A2,2,0,0,1,50,52ZM4,48H48V40.48H4Z"/></svg>
                </div>
              )}
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}
