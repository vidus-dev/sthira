import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@components/ui/button";

type Props = { children: ReactNode };

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            {this.state.error.message}
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
