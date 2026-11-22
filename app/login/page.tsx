'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Coffee, ShieldCheck, ChefHat, Receipt, Smartphone } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const setDemoCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo1234');
    setErrorMessage(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600/20 text-amber-500 ring-1 ring-amber-500/30">
            <Coffee className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Mehfil Cafe</h1>
          <p className="mt-1 text-sm text-slate-400">Operations & Point-of-Sale System</p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. owner@mehfilcafe.demo"
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white shadow-lg transition hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Mehfil POS'}
          </button>
        </form>

        <div className="mt-8 border-t border-slate-800 pt-6">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
            Quick Demo Logins (Click to autofill)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDemoCredentials('owner@mehfilcafe.demo')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/50 p-2 text-left text-xs font-medium text-slate-200 hover:border-amber-500/50 hover:bg-slate-800"
            >
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>Owner</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('kitchen@mehfilcafe.demo')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/50 p-2 text-left text-xs font-medium text-slate-200 hover:border-amber-500/50 hover:bg-slate-800"
            >
              <ChefHat className="h-4 w-4 text-emerald-400" />
              <span>Kitchen Screen</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('cashier@mehfilcafe.demo')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/50 p-2 text-left text-xs font-medium text-slate-200 hover:border-amber-500/50 hover:bg-slate-800"
            >
              <Receipt className="h-4 w-4 text-blue-400" />
              <span>Cashier / POS</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('waiter@mehfilcafe.demo')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/50 p-2 text-left text-xs font-medium text-slate-200 hover:border-amber-500/50 hover:bg-slate-800"
            >
              <Smartphone className="h-4 w-4 text-purple-400" />
              <span>Waiter Phone</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
