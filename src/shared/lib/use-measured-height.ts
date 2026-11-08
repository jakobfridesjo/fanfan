import { useEffect, useRef, useState, type RefObject } from "react";

export function useMeasuredHeight(): {
  containerRef: RefObject<HTMLDivElement | null>;
  height: number;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const observed = entries[0]?.contentRect.height;
      if (observed) setHeight(observed);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerRef, height };
}
