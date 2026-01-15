"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Pause, Square } from "lucide-react"

type TimerControlsProps = {
  isRunning: boolean;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  elapsedSeconds: number;
  totalSeconds: number;
};

export function TimerControls({
  isRunning,
  onStart,
  onPause,
  onResume,
  onEnd,
  elapsedSeconds,
  totalSeconds,
}: TimerControlsProps) {
  const [customMinutes, setCustomMinutes] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const presets = [25, 50, 90];

  const hasStarted = totalSeconds > 0;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progress = totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePresetClick = (minutes: number) => {
    if (!hasStarted) {
      setSelectedPreset(minutes);
      onStart(minutes * 60);
    }
  };

  const handleCustomStart = () => {
    const minutes = parseInt(customMinutes, 10);
    if (minutes > 0 && minutes <= 999) {
      setSelectedPreset(null);
      onStart(minutes * 60);
      setCustomMinutes("");
    }
  };

  return (
    <div>
      {!hasStarted ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {presets.map((minutes) => (
              <button
                key={minutes}
                onClick={() => handlePresetClick(minutes)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                {minutes}m
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Input
                type="number"
                placeholder="Custom"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                min="1"
                max="999"
                className="w-24 h-10 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomStart();
                  }
                }}
              />
              <Button
                onClick={handleCustomStart}
                disabled={!customMinutes || parseInt(customMinutes) <= 0}
                className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Start
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="text-5xl font-semibold text-gray-900 tabular-nums mb-2">
              {formatTime(remainingSeconds)}
            </div>
            <div className="text-sm text-gray-500">remaining</div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-2 justify-center">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onPause}
                className="flex items-center gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onResume}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onEnd}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <Square className="h-3.5 w-3.5" />
              End
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
