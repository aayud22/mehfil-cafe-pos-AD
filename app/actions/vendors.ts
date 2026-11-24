'use server';

import { createClient } from '@/lib/supabase/server';
import {
  vendorSchema,
  vendorInvoiceSchema,
  vendorPaymentSchema,
  VendorInput,
  VendorInvoiceInput,
  VendorPaymentInput,
} from '@/schemas/vendor';
import { revalidatePath } from 'next/cache';

export async function createVendorAction(input: VendorInput) {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid vendor payload' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name: parsed.data.name,
      contact_person: parsed.data.contact_person || null,
      phone: parsed.data.phone || null,
      category: parsed.data.category,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/vendors');
  revalidatePath('/manager/stock');
  return { success: true, vendor: data };
}

export async function updateVendorAction(id: string, input: VendorInput) {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid vendor payload' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('vendors')
    .update({
      name: parsed.data.name,
      contact_person: parsed.data.contact_person || null,
      phone: parsed.data.phone || null,
      category: parsed.data.category,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/vendors');
  revalidatePath('/manager/stock');
  return { success: true };
}

export async function deleteVendorAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('vendors').delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/vendors');
  return { success: true };
}

export async function createVendorInvoiceAction(input: VendorInvoiceInput) {
  const parsed = vendorInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid invoice payload' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const status =
    parsed.data.paid_amount >= parsed.data.total_amount
      ? 'paid'
      : parsed.data.paid_amount > 0
      ? 'partial'
      : 'pending';

  const { data, error } = await supabase
    .from('vendor_invoices')
    .insert({
      vendor_id: parsed.data.vendor_id,
      invoice_number: parsed.data.invoice_number || null,
      invoice_date: parsed.data.invoice_date,
      total_amount: parsed.data.total_amount,
      paid_amount: parsed.data.paid_amount,
      status,
      notes: parsed.data.notes || null,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/vendors');
  return { success: true, invoice: data };
}

export async function recordVendorPaymentAction(input: VendorPaymentInput) {
  const parsed = vendorPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid payment payload' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_vendor_payment', {
    p_invoice_id: parsed.data.invoice_id,
    p_amount: parsed.data.amount,
    p_mode: parsed.data.mode,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/manager/vendors');
  revalidatePath('/manager/expenses');
  revalidatePath('/owner');
  return { success: true };
}
