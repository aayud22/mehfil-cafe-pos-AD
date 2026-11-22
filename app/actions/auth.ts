"use server"

import { createClient } from "@/lib/supabase/server"
import { loginSchema, LoginInput } from "@/schemas/login"
import { ROLE_HOMES } from "@/lib/auth/roles"
import { UserRole } from "@/types/database"
import { redirect } from "next/navigation"

export async function loginAction(input: LoginInput) {
  const result = loginSchema.safeParse(input)
  if (!result.success) {
    return { error: result.error.errors[0]?.message || "Invalid login data" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error || !data.user) {
    return { error: error?.message || "Invalid credentials" }
  }

  // Get user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single()

  const role = (profile?.role as UserRole) || "waiter"
  const redirectTo = ROLE_HOMES[role] || "/waiter"

  return { success: true, redirectTo }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
