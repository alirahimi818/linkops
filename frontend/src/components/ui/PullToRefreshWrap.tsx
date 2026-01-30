import type React from "react";

export default function PullToRefreshWrap(props: {
  offset: number;
  isAnimatingBack: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        transform: `translateY(${props.offset}px)`,
        transition: props.isAnimatingBack ? "transform 200ms ease-out" : "none",
        willChange: "transform",
      }}
    >
      {props.children}
    </div>
  );
}
