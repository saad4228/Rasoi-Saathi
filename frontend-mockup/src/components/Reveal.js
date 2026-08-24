"use client";
import { useEffect, useRef, useState } from "react";

export default function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: delay + "ms" }}
      className={
        "transition-all duration-700 ease-out " +
        (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8")
      }
    >
      {children}
    </div>
  );
}