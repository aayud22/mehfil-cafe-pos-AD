import { z } from 'zod';

export const STAFF_ROLE_TITLES = [
  'Barista',
  'Head Chef',
  'Line Cook',
  'Floor Waiter',
  'Cashier',
  'Helper / Cleaner',
  'Branch Manager',
] as const;

export const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Morning (7 AM – 3 PM)' },
  { value: 'evening', label: 'Evening (3 PM – 11 PM)' },
  { value: 'full_day', label: 'Full Day (10 AM – 8 PM)' },
] as const;

export const staffMemberSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(80),
  role_title: z.string().min(1, 'Role title is required'),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  monthly_salary: z.coerce.number().min(0, 'Monthly salary cannot be negative'),
  shift_type: z.enum(['morning', 'evening', 'full_day']).default('full_day'),
  joined_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid joining date required'),
  is_active: z.boolean().default(true),
});

export type StaffMemberInput = z.infer<typeof staffMemberSchema>;

export const attendanceSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required'),
  status: z.enum(['present', 'half_day', 'absent', 'leave']),
  shift: z.enum(['morning', 'evening', 'full_day']).default('full_day'),
  notes: z.string().max(200).optional().nullable().or(z.literal('')),
});

export type AttendanceInput = z.infer<typeof attendanceSchema>;

export const salaryPaymentSchema = z.object({
  staff_id: z.string().uuid('Invalid staff ID'),
  payment_month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  payment_type: z.enum(['salary', 'advance', 'bonus']).default('salary'),
  mode: z.enum(['cash', 'upi', 'bank_transfer']).default('bank_transfer'),
  notes: z.string().max(200).optional().nullable().or(z.literal('')),
});

export type SalaryPaymentInput = z.infer<typeof salaryPaymentSchema>;
