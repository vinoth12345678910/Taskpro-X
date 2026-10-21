"use client";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./Toast";

/**
 * Motion is loaded lazily (domAnimation only) and respects the OS "reduce motion" setting
 * everywhere (`reducedMotion="user"` disables transform/layout animation, keeps opacity).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
