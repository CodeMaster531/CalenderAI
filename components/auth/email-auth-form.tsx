"use client"

import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Lock, Mail } from "lucide-react"

type Mode = "signIn" | "signUp"

export function EmailAuthForm() {
  const [mode, setMode] = useState<Mode>("signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  const cta = mode === "signIn" ? "Sign in to Cali" : "Create your account"
  const helper =
    mode === "signIn"
      ? "Use your email and password to access your workspace."
      : "Start organizing your calendar with a secure account."

  const passwordHint = useMemo(
    () => (mode === "signUp" ? "Use at least 8 characters with a mix of letters & numbers." : "Enter your account password."),
    [mode],
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      toast.error("Email and password are required")
      return
    }

    try {
      setIsSubmitting(true)
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
        if (error) throw error
        toast.success("Welcome back! Redirecting…")
      } else {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}` : undefined,
          },
        })
        if (error) throw error
        toast.success("Account created. Check your inbox to confirm your email.")
      }
    } catch (error) {
      const message = parseAuthError(error)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = resetEmail.trim()
    if (!trimmed) {
      toast.error("Please enter the email you used to sign up.")
      return
    }

    try {
      setIsResetting(true)
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/reset` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      if (error) throw error
      toast.success("Reset link sent! Check your inbox for further instructions.")
      setIsResetOpen(false)
      setResetEmail("")
    } catch (error) {
      toast.error(parseAuthError(error))
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <>
      <Card className="max-w-md w-full border-border/80 shadow-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold">{cta}</CardTitle>
          <CardDescription>{helper}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`rounded-full py-2 transition ${mode === "signIn" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`rounded-full py-2 transition ${mode === "signUp" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10"
                  minLength={8}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">{passwordHint}</p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating…
                </span>
              ) : mode === "signIn" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="text-sm flex flex-col items-center gap-2 text-muted-foreground">
            {mode === "signIn" ? (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setMode("signUp")}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setMode("signIn")}
                >
                  Sign in instead
                </button>
              </>
            )}
            {mode === "signIn" && (
              <button
                type="button"
                onClick={() => setIsResetOpen(true)}
                className="text-xs text-primary/80 hover:text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>Enter your account email and we&apos;ll send you a secure reset link.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleForgotPassword}>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isResetting}>
                {isResetting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function parseAuthError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message)
    if (message.includes("Invalid login credentials")) return "Invalid email or password."
    if (message.includes("Email not confirmed")) return "Please confirm your email before signing in."
    return message
  }
  return "Authentication failed. Please try again."
}

