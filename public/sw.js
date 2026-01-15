// Service Worker for Push Notifications
// Handles background push notifications for upcoming events and tasks

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  
  const options = {
    title: data.title || 'Calendar Reminder',
    body: data.body || 'You have an upcoming event',
    icon: data.icon || '/placeholder-logo.png',
    badge: '/placeholder-logo.png',
    tag: data.tag || 'calendar-reminder',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
      .catch((error) => {
        console.error('[SERVICE WORKER] Failed to show notification:', error)
      })
  )
})

self.addEventListener('notificationclick', (event) => {
  const action = event.action
  const data = event.notification.data || {}
  const { type, id, userId, url } = data

  // Handle action buttons
  if (action && action.startsWith('snooze-')) {
    event.notification.close()
    
    const minutes = parseInt(action.replace('snooze-', ''), 10)
    
    event.waitUntil(
      fetch('/api/email/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          id,
          snoozeMinutes: minutes,
          userId
        })
      })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            // Show confirmation notification
            return self.registration.showNotification('Reminder Snoozed', {
              body: `Reminder snoozed for ${minutes} minutes`,
              icon: '/placeholder-logo.png',
              tag: `snooze-${id}`,
              silent: true
            })
          }
        })
        .catch(error => {
          console.error('[SERVICE WORKER] Snooze error:', error)
        })
    )
    return
  }

  if (action === 'reschedule') {
    event.notification.close()
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          const rescheduleUrl = url ? `${url}?reschedule=${type}-${id}` : `/?reschedule=${type}-${id}`
          
          // Check if there's already a window open
          for (const client of clientList) {
            if (client.url && 'focus' in client) {
              return client.focus().then(() => {
                // Send message to client to open reschedule dialog
                return client.postMessage({
                  type: 'reschedule',
                  itemType: type,
                  itemId: id
                })
              })
            }
          }
          // If no window is open, open a new one
          if (clients.openWindow) {
            return clients.openWindow(rescheduleUrl)
          }
        })
    )
    return
  }

  // Default: open the URL
  event.notification.close()
  const urlToOpen = url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

self.addEventListener('notificationclose', (event) => {
  // Handle notification dismissed
})

// Background sync for checking upcoming events
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-upcoming-events') {
    event.waitUntil(
      fetch('/api/notifications/check')
        .then(response => response.json())
        .catch(error => {
          console.error('Background sync failed:', error)
        })
    )
  }
})
