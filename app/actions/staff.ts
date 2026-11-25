'use server';

import { createClient } from '@/lib/supabase/server';
import {
  staffMemberSchema,
  attendanceSchema,
  salaryPaymentSchema,
  StaffMemberInput,
  AttendanceInput,
  SalaryPaymentInput,
} from '@/schemas/staff';
import { revalidatePath } from 'next/cache';

export async function createStaffMemberAction(input: StaffMemberInput) {
  const parsed = staffMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid staff details' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_members')
    .insert({
      full_name: parsed.data.full_name,
      role_title: parsed.data.role_title,
      phone: parsed.data.phone || null,
      monthly_salary: parsed.data.monthly_salary,
      shift_type: parsed.data.shift_type,
      joined_date: parsed.data.joined_date,
      is_active: parsed.data.is_active,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/staff');
  return { success: true, staff: data };
}

export async function updateStaffMemberAction(id: string, input: StaffMemberInput) {
  const parsed = staffMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid staff details' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('staff_members')
    .update({
      full_name: parsed.data.full_name,
      role_title: parsed.data.role_title,
      phone: parsed.data.phone || null,
      monthly_salary: parsed.data.monthly_salary,
      shift_type: parsed.data.shift_type,
      joined_date: parsed.data.joined_date,
      is_active: parsed.data.is_active,
    })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/staff');
  return { success: true };
}

export async function deleteStaffMemberAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('staff_members').delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/staff');
  return { success: true };
}

export async function markAttendanceAction(input: AttendanceInput) {
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid attendance payload' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isWorking = parsed.data.status === 'present' || parsed.data.status === 'half_day';

  const { error } = await supabase.from('staff_attendance').upsert(
    {
      staff_id: parsed.data.staff_id,
      attendance_date: parsed.data.attendance_date,
      status: parsed.data.status,
      shift: parsed.data.shift,
      clock_in: isWorking ? new Date().toISOString() : null,
      notes: parsed.data.notes || null,
      marked_by: user?.id || null,
    },
    { onConflict: 'staff_id,attendance_date' }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/staff');
  return { success: true };
}

export async function recordSalaryPaymentAction(input: SalaryPaymentInput) {
  const parsed = salaryPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid salary payment payload' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_staff_salary_payment', {
    p_staff_id: parsed.data.staff_id,
    p_month: parsed.data.payment_month,
    p_amount: parsed.data.amount,
    p_type: parsed.data.payment_type,
    p_mode: parsed.data.mode,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/staff');
  revalidatePath('/manager/expenses');
  revalidatePath('/owner');
  revalidatePath('/owner/reports');
  return { success: true };
}
