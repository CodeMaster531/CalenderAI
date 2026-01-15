"use client"

import { Card } from "@/components/ui/card"
import { Calendar, CheckSquare, Star, Clock } from "lucide-react"
import { SessionData, formatDuration } from "@/lib/focus-mode-utils"
import { format } from "date-fns"

type TodayStatsPanelProps = {
  recentSessions: SessionData[];
  dailyGoalMinutes?: number;
};

export function TodayStatsPanel({
  recentSessions,
  dailyGoalMinutes = 180,
}: TodayStatsPanelProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySessions = recentSessions.filter((session) => {
    const sessionDate = new Date(session.endedAt);
    sessionDate.setHours(0, 0, 0, 0);
    return sessionDate.getTime() === today.getTime();
  });

  const totalMinutes = todaySessions.reduce(
    (sum, session) => sum + Math.floor(session.actualDuration / 60),
    0
  );

  const progress = Math.min((totalMinutes / dailyGoalMinutes) * 100, 100);

  return (
    <div className="space-y-4">
      <Card className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">
          Today's Focus
        </h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <div className="text-3xl font-semibold text-gray-900">
                {formatDuration(totalMinutes)}
              </div>
              <div className="text-sm text-gray-500">
                of {formatDuration(dailyGoalMinutes)}
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mb-2">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {Math.round(progress)}% of daily goal
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900">
                {todaySessions.length}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">Sessions</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-semibold text-gray-900">
                {todaySessions.length > 0
                  ? (
                      todaySessions.reduce(
                        (sum, s) => sum + (s.focusRating || 0),
                        0
                      ) / todaySessions.length
                    ).toFixed(1)
                  : "—"}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">Avg Focus</div>
            </div>
          </div>
        </div>
      </Card>

      {todaySessions.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            Recent Sessions
          </h3>
          <div className="divide-y divide-gray-200">
            {todaySessions
              .slice()
              .reverse()
              .slice(0, 5)
              .map((session, index) => {
                const SourceIcon =
                  session.itemType === "event" ? Calendar : CheckSquare;
                return (
                  <div
                    key={index}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <SourceIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {session.itemTitle}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(
                              Math.floor(session.actualDuration / 60)
                            )}
                          </span>
                          {session.focusRating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {session.focusRating}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {format(session.endedAt, "h:mm a")}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                        {session.notes}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {todaySessions.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Recent Sessions
          </h3>
          <p className="text-sm text-gray-500">
            No sessions completed today yet
          </p>
        </Card>
      )}
    </div>
  );
}
