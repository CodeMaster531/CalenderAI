"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar, CheckSquare, Star } from "lucide-react"
import { formatDuration } from "@/lib/focus-mode-utils"

type SessionSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rating: number, notes: string) => void;
  itemTitle: string;
  itemType: "event" | "task";
  plannedDuration: number;
  actualDuration: number;
  checklistCompletion: number;
};

export function SessionSummaryModal({
  isOpen,
  onClose,
  onConfirm,
  itemTitle,
  itemType,
  plannedDuration,
  actualDuration,
  checklistCompletion,
}: SessionSummaryModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (rating !== null) {
      onConfirm(rating, notes);
      setRating(null);
      setNotes("");
    }
  };

  const SourceIcon = itemType === "event" ? Calendar : CheckSquare;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Session Complete</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1.5">
                <SourceIcon className="h-3 w-3" />
                {itemType === "event" ? "Event" : "Task"}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{itemTitle}</h3>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatDuration(Math.floor(actualDuration / 60))}
              </div>
              <div className="text-xs text-gray-500 mt-1">Actual time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatDuration(Math.floor(plannedDuration / 60))}
              </div>
              <div className="text-xs text-gray-500 mt-1">Planned time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {checklistCompletion}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Completed</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700">
              How focused were you?
            </label>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={`p-3 rounded-lg transition-all ${
                    rating === value
                      ? "bg-blue-100 border-2 border-blue-500 scale-110"
                      : "bg-gray-50 border-2 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Star
                    className={`h-6 w-6 ${
                      rating !== null && rating >= value
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Session notes (optional)
            </label>
            <Textarea
              placeholder="Any reflections on this session..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={rating === null}>
            Complete Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
