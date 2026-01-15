import { describe, expect, it } from "vitest"
import { computePriorityStats, normalizePriorityTask, sortPriorityTasks, type PriorityTask } from "../lib/priorities"
import type { TaskWithList } from "../lib/tasks"

const buildTask = (overrides: Partial<PriorityTask> = {}): PriorityTask => {
  const timestamp = new Date().toISOString()
  return {
    id: overrides.id || cryptoRandom(),
    user_id: overrides.user_id || "user_1",
    list_id: overrides.list_id || "list_1",
    title: overrides.title || "Sample task",
    notes: overrides.notes ?? "",
    due_date: overrides.due_date ?? null,
    due_time: overrides.due_time ?? null,
    is_completed: overrides.is_completed ?? false,
    is_starred: overrides.is_starred ?? false,
    position: overrides.position ?? 0,
    priority: overrides.priority || "medium",
    estimated_hours: overrides.estimated_hours ?? null,
    progress: overrides.progress ?? 0,
    goal: overrides.goal ?? null,
    location: overrides.location ?? null,
    metadata: overrides.metadata ?? null,
    created_at: overrides.created_at || timestamp,
    updated_at: overrides.updated_at || timestamp,
    task_lists: overrides.task_lists,
  }
}

const buildTaskWithList = (overrides: Partial<TaskWithList> = {}): TaskWithList => {
  const timestamp = new Date().toISOString()
  return {
    id: overrides.id || cryptoRandom(),
    user_id: overrides.user_id || "user_1",
    list_id: overrides.list_id || "list_1",
    title: overrides.title || "Task",
    notes: overrides.notes ?? "",
    due_date: overrides.due_date ?? null,
    due_time: overrides.due_time ?? null,
    is_completed: overrides.is_completed ?? false,
    is_starred: overrides.is_starred ?? false,
    position: overrides.position ?? 0,
    priority: overrides.priority || "medium",
    estimated_hours: overrides.estimated_hours ?? (null as unknown as number),
    progress: overrides.progress ?? (undefined as unknown as number),
    goal: overrides.goal ?? null,
    location: overrides.location ?? null,
    metadata: overrides.metadata ?? null,
    created_at: overrides.created_at || timestamp,
    updated_at: overrides.updated_at || timestamp,
    task_lists: overrides.task_lists,
  }
}

const cryptoRandom = () => Math.random().toString(36).slice(2)

describe("computePriorityStats", () => {
  it("counts totals, completion, overdue and priority buckets", () => {
    const tasks: PriorityTask[] = [
      buildTask({ priority: "critical", due_date: pastDate(), is_completed: false }),
      buildTask({ priority: "critical", is_completed: true }),
      buildTask({ priority: "high", due_date: futureDate(2) }),
      buildTask({ priority: "medium" }),
    ]

    const stats = computePriorityStats(tasks)

    expect(stats.total).toBe(4)
    expect(stats.completed).toBe(1)
    expect(stats.overdue).toBe(1)
    expect(stats.critical).toBe(1)
    expect(stats.high).toBe(1)
    expect(stats.medium).toBe(1)
    expect(stats.low).toBe(0)
  })
})

describe("sortPriorityTasks", () => {
  it("orders by priority then due date", () => {
    const tasks: PriorityTask[] = [
      buildTask({ id: "low-late", priority: "low", due_date: futureDate(1) }),
      buildTask({ id: "critical-late", priority: "critical", due_date: futureDate(7) }),
      buildTask({ id: "critical-soon", priority: "critical", due_date: futureDate(1) }),
      buildTask({ id: "high-no-date", priority: "high", due_date: null }),
    ]

    const sorted = sortPriorityTasks(tasks).map((task) => task.id)
    expect(sorted).toEqual(["critical-soon", "critical-late", "high-no-date", "low-late"])
  })
})

describe("normalizePriorityTask", () => {
  it("normalizes estimated hours and progress percent fallbacks", () => {
    const raw = buildTaskWithList({
      estimated_hours: "3.25" as unknown as number,
      is_completed: true,
      progress: undefined as unknown as number,
    })

    const normalized = normalizePriorityTask(raw)
    expect(normalized.estimated_hours).toBeCloseTo(3.25)
    expect(normalized.progress).toBe(100)
  })
})

const pastDate = () => {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return d.toISOString().slice(0, 10)
}

const futureDate = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

