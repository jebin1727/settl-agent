"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { logger } from "@/lib/logger";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

/**
 * A reusable boundary for wrapping a SPECIFIC subtree (e.g. the dashboard's
 * AG Grid panel) so a render crash there shows a local fallback instead of
 * taking down the whole page. Next.js's error.tsx/global-error.tsx (App
 * Router convention) handle route-level crashes — this is for finer-grained
 * sections within a route. Both are "global error handling," at different
 * granularity.
 */
export class ErrorBoundaryProvider extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error({ error: error.message, componentStack: info.componentStack }, "render_error");
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <p role="alert">Something went wrong rendering this section.</p>;
    }
    return this.props.children;
  }
}
