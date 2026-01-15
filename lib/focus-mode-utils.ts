export type FocusItem = {
  id: string;
  type: "event" | "task";
  title: string;
  start: Date;
  end: Date;
  priority: number;
  source?: string;
  category?: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type SessionData = {
  itemId: string;
  itemTitle: string;
  itemType: "event" | "task";
  plannedDuration: number;
  actualDuration: number;
  checklistCompletion: number;
  focusRating?: number;
  notes?: string;
  endedAt: Date;
};

export const mockFocusItems: FocusItem[] = [
  {
    id: "1",
    type: "event",
    title: "Team standup meeting",
    start: new Date(new Date().setHours(10, 0, 0, 0)),
    end: new Date(new Date().setHours(10, 30, 0, 0)),
    priority: 3,
    category: "meeting",
    source: "Google Calendar"
  },
  {
    id: "2",
    type: "event",
    title: "Design review session",
    start: new Date(new Date().setHours(14, 0, 0, 0)),
    end: new Date(new Date().setHours(15, 30, 0, 0)),
    priority: 4,
    category: "meeting",
    source: "Google Calendar"
  },
  {
    id: "3",
    type: "task",
    title: "Finish Q4 report",
    start: new Date(),
    end: new Date(new Date().setHours(23, 59, 59, 999)),
    priority: 5,
    source: "Tasks"
  },
  {
    id: "4",
    type: "task",
    title: "Review pull requests",
    start: new Date(),
    end: new Date(new Date().setHours(23, 59, 59, 999)),
    priority: 4,
    source: "Tasks"
  },
  {
    id: "5",
    type: "task",
    title: "Update documentation",
    start: new Date(),
    end: new Date(new Date().setHours(23, 59, 59, 999)),
    priority: 3,
    source: "Tasks"
  },
  {
    id: "6",
    type: "event",
    title: "Coffee chat with Sarah",
    start: new Date(new Date().setHours(11, 0, 0, 0)),
    end: new Date(new Date().setHours(11, 30, 0, 0)),
    priority: 2,
    category: "personal",
    source: "Google Calendar"
  }
];

export function getRecommendedItem(items: FocusItem[]): FocusItem | null {
  if (items.length === 0) return null;

  const now = new Date();

  const activeEvents = items
    .filter(item => item.type === "event")
    .filter(item => item.start <= now && item.end >= now)
    .sort((a, b) => a.end.getTime() - b.end.getTime());

  if (activeEvents.length > 0) {
    return activeEvents[0];
  }

  const todayTasks = items
    .filter(item => item.type === "task")
    .filter(item => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const itemDate = new Date(item.end);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === today.getTime();
    })
    .sort((a, b) => b.priority - a.priority);

  return todayTasks.length > 0 ? todayTasks[0] : items[0];
}

export function generateDefaultChecklist(title: string): ChecklistItem[] {
  return [
    {
      id: "1",
      text: `Warm up: review what "${title}" is about`,
      completed: false
    },
    {
      id: "2",
      text: "Main work: push the task forward",
      completed: false
    },
    {
      id: "3",
      text: "Wrap up: summarize what you did",
      completed: false
    }
  ];
}

export function calculateChecklistCompletion(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const completed = items.filter(item => item.completed).length;
  return Math.round((completed / items.length) * 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
