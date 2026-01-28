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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IClassroom, IClassroomCreate, ClassroomPermission, CLASSROOM_COLOR_OPTIONS, ClassroomColorId } from "@/lib/models";
import { cn } from "@/lib/utils";

const colorIds = CLASSROOM_COLOR_OPTIONS.map(c => c.id) as [string, ...string[]];

const classroomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.enum(colorIds).optional(),
  permissions: z.enum(["admin_only", "student"]),
  maxTimeMode: z.enum(["default", "custom", "unlimited"]),
  customMaxTime: z.number().min(1).optional(),
  requiresApproval: z.boolean(),
  isActive: z.boolean(),
});

type ClassroomFormData = z.infer<typeof classroomSchema>;

interface ClassroomFormProps {
  isOpen: boolean;
  onClose: () => void;
  classroom?: IClassroom | null;
  existingClassrooms?: IClassroom[]; // To know which colors are already in use
  onSave: (data: IClassroomCreate) => Promise<{ success: boolean; error?: string }>;
}

// Get a random available color that's not already used
function getRandomAvailableColor(usedColors: (ClassroomColorId | undefined)[]): ClassroomColorId {
  const usedSet = new Set(usedColors.filter(Boolean));
  const availableColors = CLASSROOM_COLOR_OPTIONS.filter(c => !usedSet.has(c.id));

  if (availableColors.length === 0) {
    // All colors used, just pick a random one
    return CLASSROOM_COLOR_OPTIONS[Math.floor(Math.random() * CLASSROOM_COLOR_OPTIONS.length)].id;
  }

  return availableColors[Math.floor(Math.random() * availableColors.length)].id;
}

export function ClassroomForm({
  isOpen,
  onClose,
  classroom,
  existingClassrooms = [],
  onSave,
}: ClassroomFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ClassroomFormData>({
    resolver: zodResolver(classroomSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "blue",
      permissions: "student",
      maxTimeMode: "default",
      customMaxTime: 60,
      requiresApproval: false,
      isActive: true,
    },
  });

  useEffect(() => {
    if (classroom) {
      const maxTime = classroom.config.maxTimePerDay;
      let mode: "default" | "custom" | "unlimited" = "default";
      let customValue = 60;

      if (maxTime === -1) {
        mode = "unlimited";
      } else if (maxTime > 0) {
        mode = "custom";
        customValue = maxTime;
      }

      reset({
        name: classroom.name,
        description: classroom.description || "",
        color: classroom.color || "blue",
        permissions: classroom.config.permissions,
        maxTimeMode: mode,
        customMaxTime: customValue,
        requiresApproval: classroom.config.requiresApproval,
        isActive: classroom.config.isActive,
      });
    } else {
      // For new classroom, pick a random available color
      const usedColors = existingClassrooms.map(c => c.color);
      const randomColor = getRandomAvailableColor(usedColors);

      reset({
        name: "",
        description: "",
        color: randomColor,
        permissions: "student",
        maxTimeMode: "default",
        customMaxTime: 60,
        requiresApproval: false,
        isActive: true,
      });
    }
    setError(null);
  }, [classroom, reset, isOpen, existingClassrooms]);

  const onSubmit = async (data: ClassroomFormData) => {
    setLoading(true);
    setError(null);

    let maxTimePerDay = 0; // default
    if (data.maxTimeMode === "unlimited") {
      maxTimePerDay = -1;
    } else if (data.maxTimeMode === "custom") {
      maxTimePerDay = data.customMaxTime || 60;
    }

    const result = await onSave({
      name: data.name,
      description: data.description,
      color: data.color as ClassroomColorId,
      config: {
        permissions: data.permissions as ClassroomPermission,
        maxTimePerDay,
        requiresApproval: data.requiresApproval,
        isActive: data.isActive,
      },
    });

    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Failed to save classroom");
    }
  };

  const permissions = watch("permissions");
  const maxTimeMode = watch("maxTimeMode");
  const requiresApproval = watch("requiresApproval");
  const isActive = watch("isActive");
  const selectedColor = watch("color");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {classroom ? "Edit Classroom" : "New Classroom"}
          </DialogTitle>
          <DialogDescription>
            {classroom
              ? "Update the classroom configuration"
              : "Create a new classroom for scheduling"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Room 101"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Computer lab with 30 seats"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {CLASSROOM_COLOR_OPTIONS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setValue("color", color.id)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color.bg,
                    selectedColor === color.id
                      ? "ring-2 ring-offset-2 ring-foreground scale-110"
                      : "hover:scale-105"
                  )}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Who Can Book</Label>
            <Select
              value={permissions}
              onValueChange={(value) =>
                setValue("permissions", value as "admin_only" | "student")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Anyone (Students & Admins)</SelectItem>
                <SelectItem value="admin_only">Admins Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Daily Time Limit</Label>
            <RadioGroup
              value={maxTimeMode}
              onValueChange={(v) => setValue("maxTimeMode", v as "default" | "custom" | "unlimited")}
            >
              <RadioGroupItem value="default" id="time-default">
                <span className="text-sm">Use global default</span>
              </RadioGroupItem>
              <RadioGroupItem value="custom" id="time-custom">
                <span className="text-sm">Custom limit</span>
              </RadioGroupItem>
              <RadioGroupItem value="unlimited" id="time-unlimited">
                <span className="text-sm">Unlimited</span>
              </RadioGroupItem>
            </RadioGroup>

            {maxTimeMode === "custom" && (
              <div className="ml-7">
                <Input
                  type="number"
                  min="1"
                  className="w-32"
                  {...register("customMaxTime", { valueAsNumber: true })}
                  placeholder="Minutes"
                />
                <p className="text-xs text-muted-foreground mt-1">minutes per day</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Requires Approval</Label>
              <p className="text-xs text-muted-foreground">
                Bookings need admin approval before confirmation
              </p>
            </div>
            <Switch
              checked={requiresApproval}
              onCheckedChange={(checked) => setValue("requiresApproval", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">
                Classroom is available for booking
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
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
              {loading ? "Saving..." : classroom ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
