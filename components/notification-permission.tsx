"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Bell, BellOff, CheckCircle2, AlertCircle } from "lucide-react"
import { 
  requestNotificationPermission, 
  registerServiceWorker, 
  isNotificationSupported,
  type NotificationPermission 
} from "@/lib/notifications"
import { toast } from "sonner"

export function NotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(isNotificationSupported())
    
    if (isSupported && 'Notification' in window) {
      setPermission(Notification.permission as NotificationPermission)
    }
  }, [isSupported])

  async function handleEnableNotifications() {
    try {
      setIsRegistering(true)

      // Register service worker first
      const registration = await registerServiceWorker()
      if (!registration) {
        toast.error('Failed to register service worker')
        return
      }

      // Request notification permission
      const newPermission = await requestNotificationPermission()
      setPermission(newPermission)

      if (newPermission === 'granted') {
        toast.success('Notifications enabled! You\'ll receive reminders for upcoming events and tasks.')
      } else if (newPermission === 'denied') {
        toast.error('Notification permission denied. Please enable it in your browser settings.')
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error)
      toast.error('Failed to enable notifications')
    } finally {
      setIsRegistering(false)
    }
  }

  if (!isSupported) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Your browser does not support push notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (permission === 'granted') {
    return (
      <Card className="border-[color:var(--priority-low)]/30 bg-[color:var(--priority-low)]/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--priority-low)]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Notifications Enabled</p>
              <p className="text-xs text-muted-foreground">
                You'll receive browser notifications for upcoming events and tasks.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-strong border-border/50 backdrop-blur-xl rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">Push Notifications</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Get browser notifications for upcoming events and tasks. We'll remind you 15 minutes before they're due.
        </p>
        <Button
          onClick={handleEnableNotifications}
          disabled={isRegistering || permission === 'denied'}
          className="w-full"
          size="sm"
        >
          {isRegistering ? (
            <>
              <Bell className="h-4 w-4 mr-2 animate-pulse" />
              Enabling...
            </>
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </>
          )}
        </Button>
        {permission === 'denied' && (
          <p className="text-xs text-destructive">
            Notifications are blocked. Please enable them in your browser settings.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
