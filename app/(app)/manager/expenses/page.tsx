'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Expense } from '@/types/database';
import { Wallet, Plus } from 'lucide-react';

export default function ManagerExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const loadExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (data) setExpenses(data as Expense[]);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !amount) return;
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('expenses').insert({
        expense_date: new Date().toISOString().split('T')[0],
        category,
        amount: parseFloat(amount),
        note: note || null,
        created_by: user?.id || null,
      });

      setCategory('');
      setAmount('');
      setNote('');
      loadExpenses();
    } catch (err) {
      console.error(err);
      alert('Failed to log expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Daily Expenses Log</h1>
        <p className="text-xs text-slate-400">Record daily milk, produce, bakery, and operational sundries</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <h3 className="mb-4 text-sm font-bold text-white">Log New Cafe Expense</h3>
          <form onSubmit={handleAddExpense} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400">Expense Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Milk & Dairy, Coffee Beans..."
                required
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400">Notes / Vendor</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Paid in cash to Amul vendor"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-amber-500 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{isSubmitting ? 'Recording...' : 'Add Expense Entry'}</span>
            </button>
          </form>
        </div>

        {/* Expenses List */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-white">Recent Cafe Expenses</h3>
          <div className="divide-y divide-slate-800">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <p className="font-semibold text-white">{exp.category}</p>
                  <p className="text-slate-400">{exp.expense_date} {exp.note ? `• ${exp.note}` : ''}</p>
                </div>
                <span className="text-sm font-bold text-rose-400">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
