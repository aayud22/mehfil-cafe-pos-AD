'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import {
  StaffMember,
  StaffAttendance,
  StaffSalaryPayment,
  AttendanceStatus,
  ShiftType,
} from '@/types/database';
import {
  staffMemberSchema,
  salaryPaymentSchema,
  StaffMemberInput,
  SalaryPaymentInput,
  STAFF_ROLE_TITLES,
  SHIFT_OPTIONS,
} from '@/schemas/staff';
import {
  createStaffMemberAction,
  updateStaffMemberAction,
  deleteStaffMemberAction,
  markAttendanceAction,
  recordSalaryPaymentAction,
} from '@/app/actions/staff';
import { formatMoney, formatDate, formatTime, todayInIndia } from '@/lib/format';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Users,
  Plus,
  CalendarCheck,
  Clock,
  Banknote,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Loader2,
  Phone,
  Briefcase,
  Sun,
  Moon,
  Calendar,
} from 'lucide-react';

export default function StaffManagementPage() {
  const today = todayInIndia();
  const currentMonth = today.slice(0, 7); // YYYY-MM

  const [activeTab, setActiveTab] = useState<'attendance' | 'payroll' | 'directory'>('attendance');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [dayAttendance, setDayAttendance] = useState<StaffAttendance[]>([]);
  const [monthAttendance, setMonthAttendance] = useState<StaffAttendance[]>([]);
  const [monthPayments, setMonthPayments] = useState<StaffSalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Dialogs
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedStaffForPay, setSelectedStaffForPay] = useState<StaffMember | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const monthStart = `${selectedMonth}-01`;
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(yr, mo, 0).getDate();
    const monthEnd = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    const [staffRes, dayAttRes, monthAttRes, payRes] = await Promise.all([
      supabase.from('staff_members').select('*').order('full_name', { ascending: true }),
      supabase.from('staff_attendance').select('*').eq('attendance_date', selectedDate),
      supabase
        .from('staff_attendance')
        .select('*')
        .gte('attendance_date', monthStart)
        .lte('attendance_date', monthEnd),
      supabase.from('staff_salary_payments').select('*').eq('payment_month', selectedMonth),
    ]);

    if (staffRes.data) setStaffList(staffRes.data as StaffMember[]);
    if (dayAttRes.data) setDayAttendance(dayAttRes.data as StaffAttendance[]);
    if (monthAttRes.data) setMonthAttendance(monthAttRes.data as StaffAttendance[]);
    if (payRes.data) setMonthPayments(payRes.data as StaffSalaryPayment[]);
    setLoading(false);
  }, [supabase, selectedDate, selectedMonth]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('staff-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_members' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_attendance' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_salary_payments' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadData]);

  // Forms
  const staffForm = useForm<StaffMemberInput>({
    resolver: zodResolver(staffMemberSchema),
    defaultValues: {
      full_name: '',
      role_title: STAFF_ROLE_TITLES[0],
      phone: '',
      monthly_salary: 12000,
      shift_type: 'full_day',
      joined_date: today,
      is_active: true,
    },
  });

  const payForm = useForm<SalaryPaymentInput>({
    resolver: zodResolver(salaryPaymentSchema),
    defaultValues: {
      staff_id: '',
      payment_month: currentMonth,
      amount: 0,
      payment_type: 'salary',
      mode: 'bank_transfer',
      notes: '',
    },
  });

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    staffForm.reset({
      full_name: '',
      role_title: STAFF_ROLE_TITLES[0],
      phone: '',
      monthly_salary: 12000,
      shift_type: 'full_day',
      joined_date: today,
      is_active: true,
    });
    setStaffDialogOpen(true);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    staffForm.reset({
      full_name: staff.full_name,
      role_title: staff.role_title,
      phone: staff.phone || '',
      monthly_salary: Number(staff.monthly_salary),
      shift_type: staff.shift_type,
      joined_date: staff.joined_date,
      is_active: staff.is_active,
    });
    setStaffDialogOpen(true);
  };

  const handleOpenPayModal = (staff: StaffMember, suggestedBalance: number) => {
    setSelectedStaffForPay(staff);
    payForm.reset({
      staff_id: staff.id,
      payment_month: selectedMonth,
      amount: Math.max(0, suggestedBalance > 0 ? suggestedBalance : Number(staff.monthly_salary)),
      payment_type: 'salary',
      mode: 'bank_transfer',
      notes: '',
    });
    setPayDialogOpen(true);
  };

  const onSubmitStaff = async (values: StaffMemberInput) => {
    if (editingStaff) {
      const res = await updateStaffMemberAction(editingStaff.id, values);
      if (res?.error) {
        toast.error('Failed to update staff', { description: res.error });
      } else {
        toast.success('Staff profile updated');
        setStaffDialogOpen(false);
        loadData();
      }
    } else {
      const res = await createStaffMemberAction(values);
      if (res?.error) {
        toast.error('Failed to add staff member', { description: res.error });
      } else {
        toast.success('Staff member added to directory');
        setStaffDialogOpen(false);
        loadData();
      }
    }
  };

  const onSubmitPayment = async (values: SalaryPaymentInput) => {
    const res = await recordSalaryPaymentAction(values);
    if (res?.error) {
      toast.error('Payment failed', { description: res.error });
    } else {
      toast.success(
        `Paid ${formatMoney(values.amount)} to ${selectedStaffForPay?.full_name} & logged to Salary Expenses`
      );
      setPayDialogOpen(false);
      loadData();
    }
  };

  const handleMarkAttendance = async (
    staff: StaffMember,
    status: AttendanceStatus,
    shiftOverride?: ShiftType
  ) => {
    setMarkingId(staff.id);
    const res = await markAttendanceAction({
      staff_id: staff.id,
      attendance_date: selectedDate,
      status,
      shift: shiftOverride || staff.shift_type,
    });
    setMarkingId(null);

    if (res?.error) {
      toast.error('Could not mark attendance', { description: res.error });
    } else {
      toast.success(`${staff.full_name} marked ${status.replace('_', ' ')}`);
      loadData();
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    const res = await deleteStaffMemberAction(id);
    if (res?.error) {
      toast.error('Failed to remove staff', { description: res.error });
    } else {
      toast.success(`Removed ${name}`);
      loadData();
    }
  };

  // Computed metrics
  const activeStaff = useMemo(() => staffList.filter((s) => s.is_active), [staffList]);

  const dayAttMap = useMemo(() => {
    const map: Record<string, StaffAttendance> = {};
    dayAttendance.forEach((a) => {
      map[a.staff_id] = a;
    });
    return map;
  }, [dayAttendance]);

  const presentTodayCount = useMemo(
    () => dayAttendance.filter((a) => a.status === 'present' || a.status === 'half_day').length,
    [dayAttendance]
  );

  const absentLeaveCount = useMemo(
    () => dayAttendance.filter((a) => a.status === 'absent' || a.status === 'leave').length,
    [dayAttendance]
  );

  const totalMonthlyPayroll = useMemo(
    () => activeStaff.reduce((sum, s) => sum + Number(s.monthly_salary || 0), 0),
    [activeStaff]
  );

  const totalPaidThisMonth = useMemo(
    () => monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [monthPayments]
  );

  const getShiftBadge = (shift: ShiftType) => {
    switch (shift) {
      case 'morning':
        return (
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10 gap-1">
            <Sun className="h-3 w-3" /> Morning
          </Badge>
        );
      case 'evening':
        return (
          <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10 gap-1">
            <Moon className="h-3 w-3" /> Evening
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1">
            <Clock className="h-3 w-3" /> Full Day
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary" />
            <span>Staff, Shifts & Payroll</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Daily attendance register, shift schedules, salary advances and payouts
          </p>
        </div>

        <Button onClick={handleOpenAddStaff} className="h-11 font-bold gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Staff Member</span>
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border bg-card/60 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Staff
          </span>
          <div className="text-2xl font-black text-foreground mt-1">{activeStaff.length}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">On cafe roster</p>
        </Card>

        <Card className="border-border bg-card/60 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Present ({formatDate(selectedDate)})
          </span>
          <div className="text-2xl font-black text-emerald-500 mt-1">{presentTodayCount}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {absentLeaveCount} absent / on leave
          </p>
        </Card>

        <Card className="border-border bg-card/60 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Monthly Payroll
          </span>
          <div className="text-2xl font-black text-foreground mt-1">
            {formatMoney(totalMonthlyPayroll)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Base salary commitment</p>
        </Card>

        <Card className="border-border bg-card/60 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Paid ({selectedMonth})
          </span>
          <div className="text-2xl font-black text-amber-500 mt-1">
            {formatMoney(totalPaidThisMonth)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Salaries & advances cleared</p>
        </Card>
      </div>

      {/* Tabs & Controls */}
      <Card className="border-border bg-card/60 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5 bg-card p-1 rounded-xl border border-border self-start sm:self-auto">
            <Button
              size="sm"
              variant={activeTab === 'attendance' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('attendance')}
              className="h-9 px-3 text-xs font-bold gap-1.5"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Attendance & Shifts</span>
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'payroll' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('payroll')}
              className="h-9 px-3 text-xs font-bold gap-1.5"
            >
              <Banknote className="h-3.5 w-3.5" />
              <span>Salary & Payroll</span>
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'directory' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('directory')}
              className="h-9 px-3 text-xs font-bold gap-1.5"
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Staff Directory ({staffList.length})</span>
            </Button>
          </div>

          {activeTab === 'attendance' && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 w-44 text-xs bg-background"
              />
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 w-44 text-xs bg-background"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Main Content */}
      {loading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-2">Loading staff records...</p>
        </Card>
      ) : activeStaff.length === 0 && activeTab !== 'directory' ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-bold text-foreground">No active staff members</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add your cafe baristas, chefs, waiters, and helpers to track attendance & payroll.
          </p>
        </Card>
      ) : activeTab === 'attendance' ? (
        /* Tab 1: Daily Attendance & Shifts */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {activeStaff.map((staff) => {
            const record = dayAttMap[staff.id];
            const currentStatus = record?.status;
            const isSaving = markingId === staff.id;

            return (
              <Card key={staff.id} className="p-4 border-border bg-card/60 shadow-sm space-y-3">
                <div className="flex items-start justify-between border-b border-border/60 pb-2.5">
                  <div>
                    <h4 className="font-bold text-base text-foreground">{staff.full_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {staff.role_title}
                      </Badge>
                      {getShiftBadge(record?.shift || staff.shift_type)}
                    </div>
                  </div>

                  {record?.clock_in ? (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      In: {formatTime(record.clock_in)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Not marked</span>
                  )}
                </div>

                {/* 1-Tap Status Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    size="sm"
                    disabled={isSaving}
                    variant={currentStatus === 'present' ? 'default' : 'outline'}
                    onClick={() => handleMarkAttendance(staff, 'present')}
                    className={`h-11 text-xs font-bold ${
                      currentStatus === 'present'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                        : ''
                    }`}
                  >
                    Present
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSaving}
                    variant={currentStatus === 'half_day' ? 'default' : 'outline'}
                    onClick={() => handleMarkAttendance(staff, 'half_day')}
                    className={`h-11 text-xs font-bold ${
                      currentStatus === 'half_day'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-600'
                        : ''
                    }`}
                  >
                    Half Day
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSaving}
                    variant={currentStatus === 'absent' ? 'destructive' : 'outline'}
                    onClick={() => handleMarkAttendance(staff, 'absent')}
                    className="h-11 text-xs font-bold"
                  >
                    Absent
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSaving}
                    variant={currentStatus === 'leave' ? 'secondary' : 'outline'}
                    onClick={() => handleMarkAttendance(staff, 'leave')}
                    className="h-11 text-xs font-bold"
                  >
                    Leave
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : activeTab === 'payroll' ? (
        /* Tab 2: Monthly Payroll & Advances */
        <div className="space-y-4">
          <div className="hidden md:block rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Staff Member</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Base Salary</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Days Worked</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Earned Est.</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Paid / Advances</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Balance Due</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStaff.map((staff) => {
                  const attRecords = monthAttendance.filter((a) => a.staff_id === staff.id);
                  const daysWorked = attRecords.reduce((sum, a) => {
                    if (a.status === 'present') return sum + 1;
                    if (a.status === 'half_day') return sum + 0.5;
                    return sum;
                  }, 0);

                  const baseSalary = Number(staff.monthly_salary || 0);
                  const earnedEst = Math.round((baseSalary / 30) * daysWorked);
                  const paidSum = monthPayments
                    .filter((p) => p.staff_id === staff.id)
                    .reduce((sum, p) => sum + Number(p.amount), 0);
                  const balanceRemaining = Math.max(0, baseSalary - paidSum);

                  return (
                    <TableRow key={staff.id} className="border-border hover:bg-muted/30">
                      <TableCell className="py-3">
                        <div className="font-bold text-foreground">{staff.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{staff.role_title}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold py-3">
                        {formatMoney(baseSalary)}
                      </TableCell>
                      <TableCell className="text-xs font-mono py-3">
                        {daysWorked} days
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">
                        {formatMoney(earnedEst)}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-400 py-3">
                        {formatMoney(paidSum)}
                      </TableCell>
                      <TableCell className="text-xs font-black py-3">
                        <span className={balanceRemaining > 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                          {formatMoney(balanceRemaining)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <Button
                          size="sm"
                          onClick={() => handleOpenPayModal(staff, balanceRemaining)}
                          className="h-9 text-xs font-bold gap-1.5"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          <span>Pay / Advance</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Payroll Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {activeStaff.map((staff) => {
              const attRecords = monthAttendance.filter((a) => a.staff_id === staff.id);
              const daysWorked = attRecords.reduce((sum, a) => {
                if (a.status === 'present') return sum + 1;
                if (a.status === 'half_day') return sum + 0.5;
                return sum;
              }, 0);
              const baseSalary = Number(staff.monthly_salary || 0);
              const paidSum = monthPayments
                .filter((p) => p.staff_id === staff.id)
                .reduce((sum, p) => sum + Number(p.amount), 0);
              const balanceRemaining = Math.max(0, baseSalary - paidSum);

              return (
                <Card key={staff.id} className="p-4 border-border bg-card/60 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{staff.full_name}</h4>
                      <span className="text-xs text-muted-foreground">{staff.role_title}</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {daysWorked} days
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Base</span>
                      <span className="font-bold">{formatMoney(baseSalary)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Paid</span>
                      <span className="font-bold text-emerald-400">{formatMoney(paidSum)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Remaining</span>
                      <span className="font-black text-amber-400">{formatMoney(balanceRemaining)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleOpenPayModal(staff, balanceRemaining)}
                    className="w-full h-11 text-xs font-bold gap-1.5"
                  >
                    <Banknote className="h-4 w-4" />
                    <span>Pay Salary / Advance</span>
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* Tab 3: Staff Directory */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staffList.map((staff) => (
            <Card key={staff.id} className="p-4 border-border bg-card/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between border-b border-border/60 pb-2.5">
                  <div>
                    <h4 className="font-bold text-base text-foreground">{staff.full_name}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {staff.role_title}
                      </Badge>
                      {getShiftBadge(staff.shift_type)}
                    </div>
                  </div>
                  <Badge variant={staff.is_active ? 'success' : 'outline'} className="text-[10px]">
                    {staff.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="my-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Monthly Salary:</span>
                    <strong className="text-foreground">{formatMoney(Number(staff.monthly_salary))}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Joined:</span>
                    <span>{formatDate(staff.joined_date)}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex justify-between">
                      <span>Phone:</span>
                      <span className="flex items-center gap-1 text-foreground">
                        <Phone className="h-3 w-3 text-primary" />
                        {staff.phone}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditStaff(staff)}
                  className="flex-1 h-10 text-xs font-semibold gap-1"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-10 px-3 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {staff.full_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete the staff profile and attendance history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteStaff(staff.id, staff.full_name)}
                        className="bg-destructive text-destructive-foreground font-bold"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Staff Dialog */}
      <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
            <DialogDescription>
              Manage cafe staff details, assigned shift schedule, and monthly salary.
            </DialogDescription>
          </DialogHeader>

          <Form {...staffForm}>
            <form onSubmit={staffForm.handleSubmit(onSubmitStaff)} className="space-y-4">
              <FormField
                control={staffForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Aarav Sharma" className="h-11 text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={staffForm.control}
                  name="role_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Role / Designation</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-xs">
                            <SelectValue placeholder="Select Role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STAFF_ROLE_TITLES.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={staffForm.control}
                  name="shift_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Assigned Shift</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-xs">
                            <SelectValue placeholder="Select Shift" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SHIFT_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={staffForm.control}
                  name="monthly_salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Monthly Salary (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" className="h-11 text-xs font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={staffForm.control}
                  name="joined_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Joining Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-11 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={staffForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" className="h-11 text-xs" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold">
                {editingStaff ? 'Save Changes' : 'Add Staff Member'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Pay Salary / Advance Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Staff Payment</DialogTitle>
            <DialogDescription>
              Pay salary, advance, or bonus to {selectedStaffForPay?.full_name} for {selectedMonth}.
              Automatically logs to Salary Expenses.
            </DialogDescription>
          </DialogHeader>

          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit(onSubmitPayment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={payForm.control}
                  name="payment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Payment Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="salary" className="text-xs">Monthly Salary</SelectItem>
                          <SelectItem value="advance" className="text-xs">Mid-month Advance</SelectItem>
                          <SelectItem value="bonus" className="text-xs">Performance Bonus</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={payForm.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Payment Mode</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bank_transfer" className="text-xs">Bank Transfer</SelectItem>
                          <SelectItem value="upi" className="text-xs">UPI / QR</SelectItem>
                          <SelectItem value="cash" className="text-xs">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={payForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" className="h-11 text-base font-bold text-emerald-500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={payForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Notes / Reference (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Paid via UPI Ref 4812" className="h-11 text-xs" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Salary Payment</span>
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
