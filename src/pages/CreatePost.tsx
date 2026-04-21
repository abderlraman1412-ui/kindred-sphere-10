import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";
import { Loader2 } from "lucide-react";

const CreatePost = () => {
  const { isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (isAdmin) return <Navigate to="/super-secret-admin-portal" replace />;
  return <AccessDenied />;
};

export default CreatePost;
