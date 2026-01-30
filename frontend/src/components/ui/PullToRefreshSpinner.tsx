export default function PullToRefreshSpinner(props: {
  visible: boolean;
}) {
  if (!props.visible) return null;

  return (
    <div className="fixed top-2 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <svg
        className="h-5 w-5 animate-spin text-zinc-400"
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
