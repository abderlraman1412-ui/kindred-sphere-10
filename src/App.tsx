import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import TextPosts from "./pages/TextPosts.tsx";
import ImagePosts from "./pages/ImagePosts.tsx";
import VideoPosts from "./pages/VideoPosts.tsx";
import Reels from "./pages/Reels.tsx";
import Favorites from "./pages/Favorites.tsx";
import Admin from "./pages/Admin.tsx";
import AdminProfile from "./pages/AdminProfile.tsx";
import CreatePost from "./pages/CreatePost.tsx";
import Messages from "./pages/Messages.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BrandingProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/super-secret-admin-portal"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/profile"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/text" element={<TextPosts />} />
                <Route path="/images" element={<ImagePosts />} />
                <Route path="/videos" element={<VideoPosts />} />
                <Route path="/reels" element={<Reels />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/create-post" element={<CreatePost />} />
                <Route path="/messages" element={<Messages />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </BrandingProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
