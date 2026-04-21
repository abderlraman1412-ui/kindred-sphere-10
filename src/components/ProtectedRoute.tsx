import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";

export const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) => {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  if (profile?.banned) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border bg-surface p-8 text-center shadow-elevated">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-surface-foreground">Account banned</h1>
          <p className="mb-6 text-muted-foreground">Your account has been banned and you can no longer access the platform.</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <AccessDenied message="هذه الصفحة مخصصة للمسؤول فقط. تأكد أنك مسجل الدخول بحساب الأدمن." />;
  }

  return <>{children}</>;
};
