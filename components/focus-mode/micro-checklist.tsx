"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { ChecklistItem, calculateChecklistCompletion } from "@/lib/focus-mode-utils"

type MicroChecklistProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
};

export function MicroChecklist({ items, onChange }: MicroChecklistProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const completion = calculateChecklistCompletion(items);

  const handleToggle = (id: string) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleEdit = (id: string, text: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleAdd = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newItemText.trim(),
        completed: false,
      };
      onChange([...items, newItem]);
      setNewItemText("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Checklist</h3>
        <span className="text-xs text-gray-500">{completion}%</span>
      </div>

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-2 py-1.5 rounded hover:bg-gray-50"
          >
            <Checkbox
              id={item.id}
              checked={item.completed}
              onCheckedChange={() => handleToggle(item.id)}
              className="mt-0.5"
            />
            {editingId === item.id ? (
              <Input
                autoFocus
                defaultValue={item.text}
                onBlur={(e) => handleEdit(item.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEdit(item.id, e.currentTarget.value);
                  }
                  if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
                className="flex-1 h-8 text-sm"
              />
            ) : (
              <label
                htmlFor={item.id}
                className={`flex-1 text-sm cursor-pointer ${
                  item.completed
                    ? "line-through text-gray-400"
                    : "text-gray-700"
                }`}
                onDoubleClick={() => setEditingId(item.id)}
              >
                {item.text}
              </label>
            )}
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Add a step..."
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAdd();
            }
          }}
          className="flex-1 h-9 text-sm"
        />
        <Button
          onClick={handleAdd}
          disabled={!newItemText.trim()}
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
