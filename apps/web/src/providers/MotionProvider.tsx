"use client";

import { LazyMotion, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

// LazyMotion + the `m` component (never `motion`) keeps framer-motion's
// bundle cost down — domAnimation covers everything used in this app
// (opacity/transform/scale), so the larger domMax feature set isn't
// needed. `strict` makes a stray `motion.*` import a build-time error
// instead of a silent bundle-size regression.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
