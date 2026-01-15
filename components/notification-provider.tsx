"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { 
  registerServiceWorker, 
  requestNotificationPermission,
  startNotificationChecker,
  isNotificationSupported,
  type NotificationPermission 
} from "@/lib/notifications"

type NotificationContextValue = {
  permission: NotificationPermission
  isSupported: boolean
  isEnabled: boolean
  enableNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const supported = isNotificationSupported()
    setIsSupported(supported)
    
    if (supported && 'Notification' in window) {
      const currentPermission = Notification.permission as NotificationPermission
      setPermission(currentPermission)
    } else {
      console.warn('[NOTIFICATION PROVIDER] Notifications not supported or Notification API not available')
    }
  }, [isSupported])

  useEffect(() => {
    // Register service worker on mount
    if (isSupported) {
      registerServiceWorker()
        .then((registration) => {
          if (!registration) {
            console.error('[NOTIFICATION PROVIDER] Service worker registration returned null')
          }
        })
        .catch((error) => {
          console.error('[NOTIFICATION PROVIDER] Service worker registration failed:', error)
        })
    }
  }, [isSupported])

  useEffect(() => {
    // Start notification checker when user is logged in and permission is granted
    if (user && permission === 'granted' && isSupported) {
      const cleanup = startNotificationChecker(user.id, 5, 15) // Check every 5 minutes, 15 min look-ahead
      cleanupRef.current = cleanup

      return () => {
        if (cleanupRef.current) {
          cleanupRef.current()
        }
      }
    }
  }, [user, permission, isSupported])

  const enableNotifications = async () => {
    if (!isSupported) {
      console.warn('[NOTIFICATION PROVIDER] Cannot enable - not supported')
      return
    }

    try {
      // Register service worker
      const registration = await registerServiceWorker()
      if (!registration) {
        throw new Error('Failed to register service worker')
      }

      // Request permission
      const newPermission = await requestNotificationPermission()
      setPermission(newPermission)
    } catch (error) {
      console.error('[NOTIFICATION PROVIDER] Failed to enable notifications:', error)
      throw error
    }
  }

  const value: NotificationContextValue = {
    permission,
    isSupported,
    isEnabled: permission === 'granted',
    enableNotifications,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
