export default function PullToRefreshSpinner(props: {
  progress: number; // 0..1
  refreshing: boolean; // true when refresh started
}) {
  const visible = props.progress > 0 || props.refreshing;
  if (!visible) return null;

  const scale = 0.85 + Math.min(props.progress, 1) * 0.15;
  const opacity = 0.25 + Math.min(props.progress, 1) * 0.75;
  const rotate = props.refreshing ? "animate-spin" : "";

  return (
    <div
      className="fixed top-2 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.min(props.progress, 1) * 18}px) scale(${scale})`,
        opacity,
        transition: props.refreshing ? "opacity 120ms ease-out" : "none",
      }}
    >
      <svg
        className={["h-5 w-5 text-zinc-400", rotate].join(" ")}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
        <path
          d="M21 12a9 9 0 00-9-9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
