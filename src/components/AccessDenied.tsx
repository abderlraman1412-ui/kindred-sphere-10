import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldOff, ArrowLeft } from "lucide-react";

export const AccessDenied = ({
  message = "You don't have permission to access this page. Only administrators can create posts.",
}: { message?: string }) => (
  <div className="flex min-h-[60vh] items-center justify-center p-6">
    <div className="max-w-md rounded-2xl border bg-surface p-8 text-center shadow-elevated animate-scale-in">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldOff className="h-7 w-7" />
      </div>
      <h1 className="mb-2 text-xl font-bold text-surface-foreground">Access denied</h1>
      <p className="mb-6 text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to feed</Link>
      </Button>
    </div>
  </div>
);
