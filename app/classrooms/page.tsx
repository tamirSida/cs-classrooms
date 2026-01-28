"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ClassroomForm } from "@/components/forms/ClassroomForm";
import { useClassrooms } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { IClassroom, ClassroomPermission, UserRole } from "@/lib/models";
import { Plus, Pencil, Trash2, Users, Clock, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClassroomsPage() {
  const { user } = useAuth();
  const {
    classrooms,
    loading,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    toggleActive,
  } = useClassrooms();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<IClassroom | null>(null);

  const handleCreate = () => {
    setSelectedClassroom(null);
    setModalOpen(true);
  };

  const handleEdit = (classroom: IClassroom) => {
    setSelectedClassroom(classroom);
    setModalOpen(true);
  };

  const handleSave = async (data: Parameters<typeof createClassroom>[0]) => {
    if (selectedClassroom) {
      return updateClassroom(selectedClassroom.id, data);
    }
    return createClassroom(data);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this classroom?")) {
      await deleteClassroom(id);
    }
  };

  const canManage = user?.role === UserRole.SUPER_ADMIN;

  if (loading) {
    return (
      <DashboardLayout title="Classrooms">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Classrooms">
      <div className="space-y-6">
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Classroom
            </Button>
          </div>
        )}

        {classrooms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold">No Classrooms</h3>
              <p className="text-muted-foreground mt-2">
                {canManage
                  ? "Get started by creating your first classroom."
                  : "No classrooms have been assigned to you."}
              </p>
              {canManage && (
                <Button className="mt-4" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Classroom
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((classroom) => (
              <Card key={classroom.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{classroom.name}</CardTitle>
                      {classroom.description && (
                        <CardDescription className="mt-1">
                          {classroom.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge
                      variant={classroom.config.isActive ? "success" : "secondary"}
                    >
                      {classroom.config.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {classroom.config.permissions === ClassroomPermission.STUDENT
                          ? "Open to all students"
                          : "Admins only"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {classroom.config.maxTimePerDay === -1
                          ? "Unlimited"
                          : classroom.config.maxTimePerDay > 0
                          ? `${classroom.config.maxTimePerDay} min/day limit`
                          : "Uses global limit"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        {classroom.config.requiresApproval
                          ? "Requires approval"
                          : "Instant booking"}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={classroom.config.isActive}
                          onCheckedChange={() => toggleActive(classroom.id)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {classroom.config.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(classroom)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(classroom.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ClassroomForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        classroom={selectedClassroom}
        onSave={handleSave}
      />
    </DashboardLayout>
  );
}
