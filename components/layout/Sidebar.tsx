"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/models";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    label: "Calendar",
    href: "/calendar",
    icon: Calendar,
  },
  {
    label: "My Bookings",
    href: "/my-bookings",
    icon: CalendarDays,
  },
  {
    label: "Classrooms",
    href: "/classrooms",
    icon: Building2,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: ClipboardCheck,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [UserRole.SUPER_ADMIN],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  const handleSignOut = async () => {
    await signOut();
  };

  // `isCollapsed` only applies to the desktop sidebar — mobile always renders full width.
  const NavContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <>
      <div className={cn("border-b flex items-center gap-2", isCollapsed ? "p-2 justify-center" : "p-4 justify-between")}>
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">ClassScheduler</h1>
            {user && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {user.displayName}
              </p>
            )}
          </div>
        )}
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex shrink-0"
            onClick={onToggleCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
          </Button>
        )}
      </div>

      <nav className={cn("flex-1 space-y-2", isCollapsed ? "p-2" : "p-4")}>
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg transition-colors",
                isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t", isCollapsed ? "p-2" : "p-4")}>
        <Button
          variant="ghost"
          className={cn("w-full", isCollapsed ? "justify-center px-0" : "justify-start gap-3")}
          onClick={handleSignOut}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out md:hidden flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-background border-r transition-[width] duration-200 ease-in-out",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <NavContent isCollapsed={collapsed} />
      </aside>
    </>
  );
}
