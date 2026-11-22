"use server"

import { createClient } from "@/lib/supabase/server"
import { loginSchema, LoginInput } from "@/schemas/login"
import { HOME_BY_ROLE, Role } from "@/lib/auth/roles"
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

  // Fetch role on the server from the profiles table
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single()

  if (profileErr || !profile || profile.is_active === false) {
    return { error: "User profile not found or account is deactivated" }
  }

  const role = (profile.role as Role) || "waiter"
  const redirectTo = HOME_BY_ROLE[role] || "/waiter"

  return { success: true, redirectTo }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
