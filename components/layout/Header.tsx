"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, User as UserIcon } from "lucide-react";
import { User, UserRole } from "@/lib/models";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { user, signOut } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return "destructive";
      case UserRole.ADMIN:
        return "default";
      default:
        return "secondary";
    }
  };

  const formatRole = (role: UserRole) => {
    return role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        <div className="md:hidden w-10" /> {/* Spacer for mobile menu button */}
        {title && <h1 className="text-lg font-semibold">{title}</h1>}
      </div>

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 outline-none">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user.displayName}</span>
              <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                {formatRole(user.role)}
              </Badge>
            </div>
            <Avatar>
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="sm:hidden">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>{formatRole(user.role)}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
