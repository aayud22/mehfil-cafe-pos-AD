'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { Expense } from '@/types/database';
import { expenseSchema, ExpenseInput } from '@/schemas/expense';
import { createExpenseAction } from '@/app/actions/expenses';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Wallet, Plus, Loader2, Calendar as CalendarIcon } from 'lucide-react';

export default function ManagerExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_date: new Date().toISOString().split('T')[0],
      category: '',
      amount: 0,
      note: '',
    },
  });

  const loadExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const onSubmit = async (values: ExpenseInput) => {
    setIsSubmitting(true);
    try {
      const res = await createExpenseAction(values);
      if (res?.error) {
        toast.error('Could not log expense', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Logged ₹${values.amount} under ${values.category}`);
      form.reset({
        expense_date: new Date().toISOString().split('T')[0],
        category: '',
        amount: 0,
        note: '',
      });
      loadExpenses();
    } catch {
      toast.error('Unexpected error logging expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Daily Expenses Log
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Record daily dairy, beans, produce, and operational supplies
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>Log New Expense</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Every expense reduces today's net profit card in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="expense_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="h-11 text-base md:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Milk & Dairy, Coffee Beans"
                          className="h-11 text-base md:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="h-11 text-base md:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor / Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Paid in cash to Amul supplier (20L)"
                          rows={2}
                          className="text-base md:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 text-base font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging Entry...
                    </>
                  ) : (
                    'Record Expense Entry'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Expenses List: Card List on mobile instead of wide scrolling table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Wallet className="h-4 w-4 text-rose-500" />
              <span>Recent Expenditures</span>
            </CardTitle>
            <CardDescription className="text-xs">
              History of cafe outgoings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading expenses...</p>
            ) : expenses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No expense entries found.
              </p>
            ) : (
              <div className="space-y-3">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-card/60 p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {exp.category}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exp.expense_date} {exp.note ? `• ${exp.note}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-rose-500">
                        ₹{Number(exp.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
