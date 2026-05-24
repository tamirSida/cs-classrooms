"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RoomMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoomMapModal({ isOpen, onClose }: RoomMapModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Classroom Map</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[75vh]">
          <img src="/map.jpeg" alt="Classroom map" className="w-full h-auto rounded-md" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
