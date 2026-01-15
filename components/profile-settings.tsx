"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Phone, Save, Loader2, CheckCircle2, AlertCircle, User, Mail, Settings, Bell } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/components/auth/auth-provider"
import { getUserProfile, updateUserProfile, type UserProfile } from "@/lib/user-profiles"
import { toast } from "sonner"
import { normalizePhoneNumber, isValidPhoneNumber, formatPhoneNumber } from "@/lib/phone-utils"
import { cn } from "@/lib/utils"
import { NotificationPermission } from "@/components/notification-permission"

export function ProfileSettings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [fullName, setFullName] = useState("")
  const [emailDigestFrequency, setEmailDigestFrequency] = useState<'daily' | 'weekly' | 'off'>('off')

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  async function loadProfile() {
    if (!user) return
    
    try {
      setLoading(true)
      const profileData = await getUserProfile(user.id)
      if (profileData) {
        setProfile(profileData)
        setPhoneNumber(profileData.phone_number || "")
        setFullName(profileData.full_name || "")
        setEmailDigestFrequency(profileData.email_digest_frequency || 'off')
      }
    } catch (error) {
      console.error("Failed to load profile", error)
      toast.error("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!user) return

    // Validate phone number format
    if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
      toast.error("Please enter a valid phone number (10-15 digits with country code)")
      return
    }

    try {
      setSaving(true)
      // Normalize phone number before saving
      const normalizedPhone = phoneNumber.trim() ? normalizePhoneNumber(phoneNumber.trim()) : null
      
      await updateUserProfile(user.id, {
        phone_number: normalizedPhone,
        full_name: fullName.trim() || null,
        email_digest_frequency: emailDigestFrequency,
      })
      
      toast.success("Profile updated successfully")
      await loadProfile()
    } catch (error) {
      console.error("Failed to update profile", error)
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="relative h-full bg-gradient-to-br from-background via-background to-muted/30 overflow-auto">
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your profile…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-gradient-to-br from-background via-background to-muted/30 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Profile Settings</h1>
              <p className="text-muted-foreground mt-1">
                Manage your account information and connect your phone for AI bot features
              </p>
            </div>
          </div>
        </div>

        {/* Main Profile Card */}
        <Card className="glass-strong border-border/50 backdrop-blur-xl rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 max-w-2xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Account Information
            </CardTitle>
            <CardDescription>
              Update your personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted/50 border-border/50 cursor-not-allowed font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground px-1">
                Your email address cannot be changed. This is your login identifier.
              </p>
            </div>

            {/* Full Name Field */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="border-border/50 focus-visible:ring-primary/20 transition-all duration-200"
              />
            </div>

            {/* Phone Number Field */}
            <div className="space-y-3">
              <Label htmlFor="phoneNumber" className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone Number
                {phoneNumber && isValidPhoneNumber(phoneNumber) && (
                  <Badge variant="secondary" className="ml-auto bg-[color:var(--priority-low)]/20 text-[color:var(--priority-low)] border-[color:var(--priority-low)]/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                )}
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className={cn(
                  "font-mono border-border/50 focus-visible:ring-primary/20 transition-all duration-200",
                  phoneNumber && !isValidPhoneNumber(phoneNumber) && "border-destructive/50 focus-visible:ring-destructive/20"
                )}
              />
              <p className="text-xs text-muted-foreground px-1 leading-relaxed">
                Add your phone number to receive SMS notifications and connect with the AI bot.
                Format: <span className="font-mono text-foreground/80">+[country code] [number]</span> (e.g., +1 5551234567)
              </p>
              
              {/* Validation Messages */}
              {phoneNumber && isValidPhoneNumber(phoneNumber) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[color:var(--priority-low)]/10 border border-[color:var(--priority-low)]/30 backdrop-blur-sm">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--priority-low)] flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Valid format: <span className="font-mono font-medium text-foreground">{formatPhoneNumber(phoneNumber) || phoneNumber}</span>
                  </p>
                </div>
              )}
              {phoneNumber && !isValidPhoneNumber(phoneNumber) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 backdrop-blur-sm">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">
                    Invalid phone number format. Please enter 10-15 digits with country code.
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-3 pt-4 border-t border-border/50">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Phone Connection Status - Shown below main card if connected */}
        {profile?.phone_number && (
          <Card className="glass-strong border-[color:var(--priority-low)]/30 bg-[color:var(--priority-low)]/5 backdrop-blur-xl rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 max-w-2xl mx-auto">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[color:var(--priority-low)]/20">
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--priority-low)]" />
                </div>
                <CardTitle className="text-base">Phone Connected</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Phone Number</p>
                <p className="text-sm font-mono text-muted-foreground">
                  {formatPhoneNumber(profile.phone_number) || profile.phone_number}
                </p>
              </div>
              <div className="pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your phone is connected. You can now send messages to the AI bot to make changes to your calendar and tasks.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Reminders */}
        <Card className="glass-strong border-border/50 backdrop-blur-xl rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 max-w-2xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Email Reminders
            </CardTitle>
            <CardDescription>
              Choose how often you want to receive email digests of upcoming events and tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailDigest" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Digest Frequency
              </Label>
              <Select
                value={emailDigestFrequency}
                onValueChange={(value: 'daily' | 'weekly' | 'off') => setEmailDigestFrequency(value)}
              >
                <SelectTrigger id="emailDigest" className="border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off - No email reminders</SelectItem>
                  <SelectItem value="daily">Daily - Every morning at 8 AM</SelectItem>
                  <SelectItem value="weekly">Weekly - Every Monday at 8 AM</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground px-1">
                {emailDigestFrequency === 'off' && 'You won\'t receive email reminders.'}
                {emailDigestFrequency === 'daily' && 'You\'ll receive a daily email digest every morning with your upcoming events and tasks for the day.'}
                {emailDigestFrequency === 'weekly' && 'You\'ll receive a weekly email digest every Monday with your upcoming events and tasks for the week.'}
              </p>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border/50">
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="outline"
                className="flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Email Preferences
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications */}
        <div className="max-w-2xl mx-auto">
          <NotificationPermission />
        </div>
      </div>
    </div>
  )
}
