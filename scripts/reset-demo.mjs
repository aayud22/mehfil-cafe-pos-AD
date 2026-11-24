import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase URL or Anon Key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetDemo() {
  console.log('\n🧹 Mehfil Cafe POS — Resetting Demo State...\n');

  // 1. Authenticate as Owner
  console.log('1️⃣ Authenticating as Owner...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'owner@mehfilcafe.demo',
    password: 'demo1234',
  });

  if (authErr || !auth.user) {
    console.error('❌ Failed to authenticate as owner:', authErr?.message);
    process.exit(1);
  }
  console.log('   ✅ Authenticated as Ayushi Diyora (Owner)');

  // 2. Reset All Tables to Free
  console.log('\n2️⃣ Resetting cafe tables to "free"...');
  const { data: tables, error: tableErr } = await supabase
    .from('cafe_tables')
    .update({ status: 'free' })
    .neq('status', 'free')
    .select('label');

  if (tableErr) {
    console.warn('   ⚠️ Could not reset tables:', tableErr.message);
  } else {
    console.log(`   ✅ Tables reset to free: ${tables?.length || 0} updated`);
  }

  // 3. Reset All Menu Items to Available
  console.log('\n3️⃣ Ensuring all menu items are marked available...');
  const { error: menuErr } = await supabase
    .from('menu_items')
    .update({ is_available: true })
    .eq('is_available', false);

  if (menuErr) {
    console.warn('   ⚠️ Could not reset menu availability:', menuErr.message);
  } else {
    console.log('   ✅ Menu items are all available');
  }

  // 4. Verify Demo Logins
  console.log('\n4️⃣ Verifying Demo User Accounts:');
  const demoAccounts = [
    { email: 'owner@mehfilcafe.demo', role: 'Owner' },
    { email: 'kitchen@mehfilcafe.demo', role: 'Kitchen (KDS)' },
    { email: 'cashier@mehfilcafe.demo', role: 'Cashier / POS' },
    { email: 'waiter@mehfilcafe.demo', role: 'Floor Waiter' },
  ];

  for (const acc of demoAccounts) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: 'demo1234',
    });
    if (error) {
      console.log(`   ❌ ${acc.role.padEnd(16)}: ${acc.email} — Failed (${error.message})`);
    } else {
      console.log(`   ✅ ${acc.role.padEnd(16)}: ${acc.email} (Password: demo1234)`);
    }
  }

  console.log('\n✨ Demo state reset successfully! Ready for walkthrough.\n');
}

resetDemo().catch((err) => {
  console.error('Fatal error during reset:', err);
  process.exit(1);
});
