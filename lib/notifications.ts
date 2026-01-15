/**
 * Browser Push Notifications Service
 * Handles notification permissions, registration, and sending notifications
 */

export type NotificationPermission = 'default' | 'granted' | 'denied'

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
  requireInteraction?: boolean
  silent?: boolean
  actions?: NotificationAction[]
}

export interface NotificationAction {
  action: string
  title: string
  icon?: string
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[NOTIFICATIONS] This browser does not support notifications')
    return 'denied'
  }

  const currentPermission = Notification.permission

  if (currentPermission === 'granted') {
    return 'granted'
  }

  if (currentPermission === 'denied') {
    console.warn('[NOTIFICATIONS] Permission already denied')
    return 'denied'
  }

  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

/**
 * Register service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[NOTIFICATIONS] Service Workers are not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready
    
    return registration
  } catch (error) {
    console.error('[NOTIFICATIONS] Service Worker registration failed:', error)
    return null
  }
}

/**
 * Send a browser notification
 */
export async function sendNotification(options: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) {
    console.warn('[NOTIFICATIONS] Notifications not supported')
    return
  }

  const permission = await requestNotificationPermission()
  
  if (permission !== 'granted') {
    console.warn('[NOTIFICATIONS] Notification permission not granted, cannot send notification')
    return
  }

  try {
    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.ready

    const notificationOptions: NotificationOptions = {
      body: options.body,
      icon: options.icon || '/placeholder-logo.png',
      badge: options.badge || '/placeholder-logo.png',
      tag: options.tag,
      data: options.data || {},
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      actions: options.actions || [],
    }

    // Add default snooze/reschedule actions if type is event or task
    if (options.data?.type && ['event', 'task'].includes(options.data.type) && !options.actions) {
      notificationOptions.actions = [
        { action: 'snooze-5', title: 'Snooze 5 min' },
        { action: 'snooze-15', title: 'Snooze 15 min' },
        { action: 'snooze-60', title: 'Snooze 1 hour' },
        { action: 'reschedule', title: 'Reschedule' },
      ]
    }

    await registration.showNotification(options.title, notificationOptions as any)
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to send notification:', error)
    throw error
  }
}

/**
 * Get upcoming events and tasks that need notifications
 */
export async function getUpcomingItemsForNotification(
  userId: string,
  lookAheadMinutes: number = 15
): Promise<{ events: any[], tasks: any[] }> {
  const now = new Date()
  const lookAhead = new Date(now.getTime() + lookAheadMinutes * 60 * 1000)

  try {
    // Get upcoming events
    const eventsUrl = `/api/notifications/upcoming?userId=${userId}&type=events&lookAhead=${lookAheadMinutes}`
    const eventsResponse = await fetch(eventsUrl)
    
    let events: any[] = []
    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json()
      events = Array.isArray(eventsData.events) ? eventsData.events : (Array.isArray(eventsData) ? eventsData : [])
    } else {
      const errorText = await eventsResponse.text()
      console.error('[NOTIFICATIONS] Events fetch failed:', eventsResponse.status, errorText)
    }

    // Get upcoming tasks
    const tasksUrl = `/api/notifications/upcoming?userId=${userId}&type=tasks&lookAhead=${lookAheadMinutes}`
    const tasksResponse = await fetch(tasksUrl)
    
    let tasks: any[] = []
    if (tasksResponse.ok) {
      const tasksData = await tasksResponse.json()
      tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : (Array.isArray(tasksData) ? tasksData : [])
    } else {
      const errorText = await tasksResponse.text()
      console.error('[NOTIFICATIONS] Tasks fetch failed:', tasksResponse.status, errorText)
    }

    return { events, tasks }
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to fetch upcoming items:', error)
    return { events: [], tasks: [] }
  }
}

/**
 * Format notification message for event
 */
export function formatEventNotification(event: any): NotificationOptions {
  const eventDate = new Date(`${event.event_date}T${event.start_time || '00:00:00'}`)
  const timeStr = event.start_time 
    ? new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'All day'

  return {
    title: `Upcoming: ${event.title}`,
    body: `${timeStr}${event.location ? ` • ${event.location}` : ''}${event.description ? `\n${event.description}` : ''}`,
    tag: `event-${event.id}`,
    data: {
      type: 'event',
      id: event.id,
      userId: event.user_id,
      url: '/calendar',
    },
    requireInteraction: event.priority === 'critical' || event.priority === 'high',
    actions: [
      { action: 'snooze-5', title: 'Snooze 5 min' },
      { action: 'snooze-15', title: 'Snooze 15 min' },
      { action: 'snooze-60', title: 'Snooze 1 hour' },
      { action: 'reschedule', title: 'Reschedule' },
    ],
  }
}

/**
 * Format notification message for task
 */
export function formatTaskNotification(task: any): NotificationOptions {
  const dueDate = task.due_date ? new Date(task.due_date) : null
  const dueTime = task.due_time 
    ? new Date(`2000-01-01T${task.due_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null

  let body = task.notes || ''
  if (dueDate) {
    const dateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    body = dueTime ? `${dateStr} at ${dueTime}` : dateStr
  }

  return {
    title: `Task Due: ${task.title}`,
    body: body || 'No description',
    tag: `task-${task.id}`,
    data: {
      type: 'task',
      id: task.id,
      userId: task.user_id,
      url: '/tasks',
    },
    requireInteraction: task.priority === 'critical' || task.priority === 'high',
    actions: [
      { action: 'snooze-5', title: 'Snooze 5 min' },
      { action: 'snooze-15', title: 'Snooze 15 min' },
      { action: 'snooze-60', title: 'Snooze 1 hour' },
      { action: 'reschedule', title: 'Reschedule' },
    ],
  }
}

/**
 * Start periodic notification checking
 */
export function startNotificationChecker(
  userId: string,
  intervalMinutes: number = 5,
  lookAheadMinutes: number = 15
): () => void {
  let intervalId: NodeJS.Timeout | null = null
  const notifiedIds = new Set<string>()

  const checkAndNotify = async () => {
    try {
      const { events, tasks } = await getUpcomingItemsForNotification(userId, lookAheadMinutes)

      // Notify for events
      for (const event of events) {
        const notificationId = `event-${event.id}`
        if (!notifiedIds.has(notificationId)) {
          const notification = formatEventNotification(event)
          await sendNotification(notification)
          notifiedIds.add(notificationId)
        }
      }

      // Notify for tasks
      for (const task of tasks) {
        const notificationId = `task-${task.id}`
        if (!notifiedIds.has(notificationId)) {
          const notification = formatTaskNotification(task)
          await sendNotification(notification)
          notifiedIds.add(notificationId)
        }
      }

      // Clean up old notification IDs (older than 1 hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      // This is simplified - in production, track timestamps per ID
    } catch (error) {
      console.error('[NOTIFICATIONS] Notification check failed:', error)
    }
  }

  // Check immediately
  checkAndNotify()

  // Then check periodically
  intervalId = setInterval(() => {
    checkAndNotify()
  }, intervalMinutes * 60 * 1000)

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  }
}
