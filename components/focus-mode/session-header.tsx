"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, CheckSquare, RefreshCw } from "lucide-react"
import { FocusItem } from "@/lib/focus-mode-utils"
import { format } from "date-fns"

type SessionHeaderProps = {
  item: FocusItem;
  onChangeItem: () => void;
};

export function SessionHeader({ item, onChangeItem }: SessionHeaderProps) {
  const sourceIcon = item.type === "event" ? Calendar : CheckSquare;
  const SourceIcon = sourceIcon;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-gray-600 border-gray-300"
          >
            <SourceIcon className="h-3 w-3" />
            {item.type === "event" ? "Event" : "Task"}
          </Badge>
          {item.source && (
            <span className="text-xs text-gray-500">{item.source}</span>
          )}
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          {item.title}
        </h2>
        <div className="text-sm text-gray-600">
          {item.type === "event" ? (
            <span>
              {format(item.start, "h:mm a")} - {format(item.end, "h:mm a")}
            </span>
          ) : (
            <span>Due {format(item.end, "MMM d, yyyy")}</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onChangeItem}
        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs">Change</span>
      </Button>
    </div>
  );
}
