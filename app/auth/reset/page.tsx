"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

export default function PasswordResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return
      if (!data.session) {
        toast.error("Recovery link expired or invalid. Request a new one.")
      }
      setIsSessionReady(true)
    }
    checkSession()
    return () => {
      isMounted = false
    }
  }, [])

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    try {
      setIsSubmitting(true)
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success("Password updated! Sign in with your new credentials.")
      router.push("/")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-2xl border-border/60">
        <CardHeader className="space-y-3">
          <div className="inline-flex items-center gap-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            Password recovery
          </div>
          <CardTitle className="text-2xl font-semibold text-foreground">Set a new password</CardTitle>
          <CardDescription>
            Choose a strong password to secure your account. You&apos;ll be signed in automatically once we update it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleReset}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                disabled={!isSessionReady || isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                disabled={!isSessionReady || isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!isSessionReady || isSubmitting}>
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </span>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

