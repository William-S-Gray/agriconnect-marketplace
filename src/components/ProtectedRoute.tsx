import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type UserRole } from '@/stores/auth-store';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Protected Route ──────────────────────────────────────────────────────────
interface ProtectedRouteProps {
  role: UserRole;
  children: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ role, children, redirectTo = '/login' }: ProtectedRouteProps) {
  const { isAuthenticated, role: userRole } = useAuth();

  if (!isAuthenticated || userRole !== role) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production, send to error tracking (Sentry, LogRocket, etc.)
    console.error('[AgriConnect] Unhandled render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="neo-card p-10 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl neo-inset flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please refresh the page or try again.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-muted rounded-lg p-3 text-left overflow-auto max-h-32 text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} className="neo-btn bg-primary text-primary-foreground">
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
              </Button>
              <Button variant="outline" className="neo-flat border-none" onClick={() => window.location.href = '/'}>
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
