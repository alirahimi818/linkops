import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Portal(props: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return createPortal(props.children, document.body);
}
