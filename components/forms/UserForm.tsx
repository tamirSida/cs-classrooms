"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IUser, IUserCreate, UserRole } from "@/lib/models";

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  displayName: z.string().min(1, "Name is required"),
  role: z.enum(["super_admin", "admin", "student"]),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  user?: IUser | null;
  onSave: (
    data: IUserCreate & { password?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  currentUserId: string;
}

export function UserForm({
  isOpen,
  onClose,
  user,
  onSave,
  currentUserId,
}: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(
      user
        ? userSchema.omit({ password: true })
        : userSchema.extend({
            password: z.string().min(6, "Password must be at least 6 characters"),
          })
    ),
    defaultValues: {
      email: "",
      displayName: "",
      role: "student",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
    } else {
      reset({
        email: "",
        displayName: "",
        role: "student",
        password: "",
      });
    }
    setError(null);
  }, [user, reset, isOpen]);

  const onSubmit = async (data: UserFormData) => {
    setLoading(true);
    setError(null);

    const result = await onSave({
      email: data.email,
      displayName: data.displayName,
      role: data.role as UserRole,
      createdBy: currentUserId,
      password: data.password,
    });

    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Failed to save user");
    }
  };

  const role = watch("role");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "New User"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update user details and role"
              : "Create a new user account"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Full Name *</Label>
            <Input
              id="displayName"
              {...register("displayName")}
              placeholder="John Doe"
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="john@example.com"
              disabled={!!user}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setValue("role", value as UserFormData["role"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : user ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
