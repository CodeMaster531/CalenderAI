"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, CheckSquare } from "lucide-react"
import { FocusItem } from "@/lib/focus-mode-utils"
import { format } from "date-fns"

type ItemPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  items: FocusItem[];
  currentItemId: string;
  onSelectItem: (item: FocusItem) => void;
};

export function ItemPicker({
  isOpen,
  onClose,
  items,
  currentItemId,
  onSelectItem,
}: ItemPickerProps) {
  const handleSelect = (item: FocusItem) => {
    onSelectItem(item);
    onClose();
  };

  const events = items.filter((item) => item.type === "event");
  const tasks = items.filter((item) => item.type === "task");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[540px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change Focus Item</DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {events.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Events
              </h3>
              <div className="space-y-2">
                {events.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    disabled={item.id === currentItemId}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      item.id === currentItemId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{item.title}</h4>
                      {item.id === currentItemId && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(item.start, "h:mm a")} - {format(item.end, "h:mm a")}
                    </div>
                    {item.source && (
                      <div className="text-xs text-gray-500 mt-1">
                        {item.source}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </h3>
              <div className="space-y-2">
                {tasks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    disabled={item.id === currentItemId}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      item.id === currentItemId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{item.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          P{item.priority}
                        </Badge>
                        {item.id === currentItemId && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Due: {format(item.end, "MMM d, yyyy")}
                    </div>
                    {item.source && (
                      <div className="text-xs text-gray-500 mt-1">
                        {item.source}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No items available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
