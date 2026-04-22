import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Image as ImageIcon, Video, FileText, User as UserIcon, Moon, Sun, LogOut } from "lucide-react";
import { TierBadge } from "@/components/TierBadge";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandLogo } from "@/components/BrandLogo";

const navItems = [
  { to: "/", label: "Feed", icon: Home, end: true },
  { to: "/text", label: "Text", icon: FileText },
  { to: "/images", label: "Images", icon: ImageIcon },
  { to: "/videos", label: "Videos", icon: Video },
];

export const AppLayout = () => {
  const { profile, signOut, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const initials = profile?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "U";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
          <BrandLogo hideTextOnMobile size="md" />

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {navItems.map((n) => {
              const active = n.end ? location.pathname === n.to : location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-muted"
                  aria-label="Open profile menu"
                >
                  <Avatar className={`h-8 w-8 ${isAdmin ? "ring-2 ring-vip ring-offset-2 ring-offset-surface" : ""}`}>
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  {profile && (
                    <span className="hidden max-w-[120px] truncate text-sm font-medium md:inline">
                      {profile.name}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <button
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => navigate("/profile")}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{profile?.name}</span>
                        {isAdmin && <span title="Admin" aria-label="Admin">👑</span>}
                      </div>
                      <p className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</p>
                      <div className="mt-1 flex items-center gap-1">
                        {profile && <TierBadge tier={profile.tier} size="xs" />}
                      </div>
                    </div>
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/super-secret-admin-portal")}>
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-gradient-to-br from-warning to-vip text-[10px] font-bold text-warning-foreground">A</span>
                    Admin portal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { signOut(); navigate("/auth"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex items-center justify-around border-t md:hidden">
          {navItems.map((n) => {
            const active = n.end ? location.pathname === n.to : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
};
