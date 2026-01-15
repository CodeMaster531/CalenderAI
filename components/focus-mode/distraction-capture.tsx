"use client"

import { Textarea } from "@/components/ui/textarea"

type DistractionCaptureProps = {
  notes: string;
  onChange: (notes: string) => void;
};

export function DistractionCapture({ notes, onChange }: DistractionCaptureProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700">Later Notes</h3>
      <Textarea
        placeholder="Jot down thoughts or tasks that come up during this session..."
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] resize-none text-sm"
      />
      <p className="text-xs text-gray-500">
        Capture ideas without losing focus
      </p>
    </div>
  );
}
