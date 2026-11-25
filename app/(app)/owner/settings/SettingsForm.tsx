'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppSettings } from '@/types/database';
import { appSettingsSchema, AppSettingsInput } from '@/schemas/settings';
import { updateAppSettingsAction } from '@/app/actions/settings';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Settings, Save, Loader2, Percent, Store, ShieldCheck } from 'lucide-react';

interface SettingsFormProps {
  initialSettings: AppSettings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AppSettingsInput>({
    resolver: zodResolver(appSettingsSchema),
    defaultValues: {
      cafe_name: initialSettings.cafe_name || 'Mehfil Cafe',
      cafe_address: initialSettings.cafe_address || '',
      gstin: initialSettings.gstin || '',
      gst_enabled: initialSettings.gst_enabled ?? true,
      gst_rate: Number(initialSettings.gst_rate ?? 5),
      cashier_max_discount_percent: Number(initialSettings.cashier_max_discount_percent ?? 10),
      manager_max_discount_percent: Number(initialSettings.manager_max_discount_percent ?? 25),
    },
  });

  const onSubmit = async (values: AppSettingsInput) => {
    setIsSaving(true);
    try {
      const res = await updateAppSettingsAction(values);
      if (!res.ok) {
        toast.error('Failed to save settings', { description: res.error });
      } else {
        toast.success('Settings saved successfully!');
      }
    } catch {
      toast.error('Unexpected error saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-primary" />
          <span>Cafe & Billing Settings</span>
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Configure receipt header details, GST tax rates, and role-based discount caps
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Cafe Identity */}
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span>Cafe Profile & Receipt Header</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Printed at the top of every customer thermal receipt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="cafe_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Cafe Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Mehfil Cafe" className="h-11 text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cafe_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Shop 12, Artisanal Square, CG Road, Ahmedabad"
                        className="text-sm resize-none"
                        rows={2}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">GSTIN (Optional, 15 characters)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 24AAACM1234F1Z5"
                        maxLength={15}
                        className="h-11 text-sm uppercase font-mono"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      Leave blank if unregistered. Must be 15 alphanumeric characters (A-Z, 0-9).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* GST Configuration */}
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-500" />
                <span>GST & Tax Rules</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Applied server-side on discounted subtotals and split equally into CGST + SGST
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="gst_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div>
                      <FormLabel className="text-sm font-semibold">Enable GST Billing</FormLabel>
                      <FormDescription className="text-xs">
                        Charge GST on every settled bill
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gst_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Total GST Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        max={28}
                        className="h-11 text-sm font-bold"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      Standard Indian restaurant rate is 5% (2.5% CGST + 2.5% SGST).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Discount Limits */}
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <span>Role Discount Caps</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Enforced securely in the database. Owners always have up to 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cashier_max_discount_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Cashier Max Discount (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        className="h-11 text-sm font-bold"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manager_max_discount_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Manager Max Discount (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        className="h-11 text-sm font-bold"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" disabled={isSaving} className="w-full sm:w-auto h-11 px-8 font-bold gap-2">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Settings</span>
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
