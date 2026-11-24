'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { Vendor, VendorInvoice } from '@/types/database';
import {
  vendorSchema,
  vendorInvoiceSchema,
  vendorPaymentSchema,
  VendorInput,
  VendorInvoiceInput,
  VendorPaymentInput,
  VENDOR_CATEGORIES,
} from '@/schemas/vendor';
import {
  createVendorAction,
  updateVendorAction,
  deleteVendorAction,
  createVendorInvoiceAction,
  recordVendorPaymentAction,
} from '@/app/actions/vendors';
import { formatMoney, formatDate, todayInIndia } from '@/lib/format';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Truck,
  Plus,
  CreditCard,
  Building2,
  Receipt,
  CheckCircle2,
  Trash2,
  Edit,
  Loader2,
  Calendar,
  AlertCircle,
  Clock,
  Phone,
  User,
  Banknote,
  Search,
} from 'lucide-react';

export default function VendorsPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'vendors'>('invoices');
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialogs
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoice | null>(null);

  const supabase = createClient();
  const today = todayInIndia();

  const loadData = async () => {
    setLoading(true);
    const [invRes, venRes] = await Promise.all([
      supabase
        .from('vendor_invoices')
        .select('*, vendor:vendors(*)')
        .order('invoice_date', { ascending: false }),
      supabase.from('vendors').select('*').order('name', { ascending: true }),
    ]);

    if (invRes.data) setInvoices(invRes.data as VendorInvoice[]);
    if (venRes.data) setVendors(venRes.data as Vendor[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Realtime listeners
    const channel = supabase
      .channel('vendors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_invoices' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Forms
  const vendorForm = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      category: VENDOR_CATEGORIES[0],
    },
  });

  const invoiceForm = useForm<VendorInvoiceInput>({
    resolver: zodResolver(vendorInvoiceSchema),
    defaultValues: {
      vendor_id: '',
      invoice_number: '',
      invoice_date: today,
      total_amount: 0,
      paid_amount: 0,
      notes: '',
    },
  });

  const paymentForm = useForm<VendorPaymentInput>({
    resolver: zodResolver(vendorPaymentSchema),
    defaultValues: {
      invoice_id: '',
      amount: 0,
      mode: 'upi',
      notes: '',
    },
  });

  // Handlers
  const handleOpenCreateVendor = () => {
    setEditingVendor(null);
    vendorForm.reset({
      name: '',
      contact_person: '',
      phone: '',
      category: VENDOR_CATEGORIES[0],
    });
    setVendorDialogOpen(true);
  };

  const handleOpenEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    vendorForm.reset({
      name: vendor.name,
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      category: vendor.category,
    });
    setVendorDialogOpen(true);
  };

  const handleOpenCreateInvoice = () => {
    invoiceForm.reset({
      vendor_id: vendors[0]?.id || '',
      invoice_number: `INV-${Date.now().toString().slice(-4)}`,
      invoice_date: today,
      total_amount: 0,
      paid_amount: 0,
      notes: '',
    });
    setInvoiceDialogOpen(true);
  };

  const handleOpenPayment = (inv: VendorInvoice) => {
    const dueAmount = Number(inv.total_amount) - Number(inv.paid_amount);
    setSelectedInvoice(inv);
    paymentForm.reset({
      invoice_id: inv.id,
      amount: dueAmount,
      mode: 'upi',
      notes: `Settled balance for Invoice #${inv.invoice_number || 'bill'}`,
    });
    setPaymentDialogOpen(true);
  };

  const onSubmitVendor = async (values: VendorInput) => {
    if (editingVendor) {
      const res = await updateVendorAction(editingVendor.id, values);
      if (res?.error) {
        toast.error('Failed to update vendor', { description: res.error });
      } else {
        toast.success('Vendor profile updated');
        setVendorDialogOpen(false);
        loadData();
      }
    } else {
      const res = await createVendorAction(values);
      if (res?.error) {
        toast.error('Failed to add vendor', { description: res.error });
      } else {
        toast.success('New vendor partner registered');
        setVendorDialogOpen(false);
        loadData();
      }
    }
  };

  const onSubmitInvoice = async (values: VendorInvoiceInput) => {
    const res = await createVendorInvoiceAction(values);
    if (res?.error) {
      toast.error('Failed to log invoice', { description: res.error });
    } else {
      toast.success('Vendor invoice recorded');
      setInvoiceDialogOpen(false);
      loadData();
    }
  };

  const onSubmitPayment = async (values: VendorPaymentInput) => {
    const res = await recordVendorPaymentAction(values);
    if (res?.error) {
      toast.error('Failed to record payment', { description: res.error });
    } else {
      toast.success(`Payment of ${formatMoney(values.amount)} recorded & logged to expenses`);
      setPaymentDialogOpen(false);
      loadData();
    }
  };

  const handleDeleteVendor = async (id: string, name: string) => {
    const res = await deleteVendorAction(id);
    if (res?.error) {
      toast.error('Failed to delete vendor', { description: res.error });
    } else {
      toast.success(`Removed vendor ${name}`);
      loadData();
    }
  };

  // Metrics
  const totalPendingDues = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const pending = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount));
      return sum + pending;
    }, 0);
  }, [invoices]);

  const activeInvoicesCount = useMemo(() => {
    return invoices.filter((i) => i.status !== 'paid').length;
  }, [invoices]);

  // Filtered views
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const vendorName = inv.vendor?.name?.toLowerCase() || '';
      const invNum = inv.invoice_number?.toLowerCase() || '';
      const q = search.toLowerCase();
      return vendorName.includes(q) || invNum.includes(q);
    });
  }, [invoices, search]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = search.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        (v.contact_person && v.contact_person.toLowerCase().includes(q))
      );
    });
  }, [vendors, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Truck className="h-6 w-6 text-primary" />
            <span>Vendors & Purchase Dues</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Track supplier partners, incoming stock invoices and pending accounts payable
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'invoices' ? (
            <Button onClick={handleOpenCreateInvoice} className="h-11 font-bold gap-2">
              <Plus className="h-4 w-4" />
              <span>Log Purchase Invoice</span>
            </Button>
          ) : (
            <Button onClick={handleOpenCreateVendor} className="h-11 font-bold gap-2">
              <Plus className="h-4 w-4" />
              <span>Register Vendor</span>
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          className={`border-border p-4 ${
            totalPendingDues > 0 ? 'border-rose-500/50 bg-rose-500/10' : 'bg-card/60'
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Outstanding Dues
          </span>
          <div
            className={`text-2xl md:text-3xl font-black mt-1 ${
              totalPendingDues > 0 ? 'text-rose-500' : 'text-emerald-500'
            }`}
          >
            {formatMoney(totalPendingDues)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Accounts payable pending settlement
          </p>
        </Card>

        <Card className="border-border bg-card/60 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Invoices Awaiting Payment
          </span>
          <div className="text-2xl md:text-3xl font-black text-amber-500 mt-1">
            {activeInvoicesCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pending or partially settled bills
          </p>
        </Card>

        <Card className="border-border bg-card/60 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Registered Vendor Partners
          </span>
          <div className="text-2xl md:text-3xl font-black text-foreground mt-1">
            {vendors.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Active cafe suppliers & roasters
          </p>
        </Card>
      </div>

      {/* Tab Switcher & Search Bar */}
      <Card className="border-border bg-card/60 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border self-start sm:self-auto">
            <Button
              size="sm"
              variant={activeTab === 'invoices' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('invoices')}
              className="h-9 px-3.5 text-xs font-bold gap-1.5"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Invoices & Dues</span>
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'vendors' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('vendors')}
              className="h-9 px-3.5 text-xs font-bold gap-1.5"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Vendors Directory ({vendors.length})</span>
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === 'invoices' ? 'Search by vendor or invoice...' : 'Search vendor partners...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-2">Loading supplier records...</p>
        </Card>
      ) : activeTab === 'invoices' ? (
        /* Invoices Tab */
        filteredInvoices.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-bold text-foreground">No purchase invoices</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Log an incoming bill or delivery receipt to track vendor dues.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Invoice #</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Vendor</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Total Bill</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Paid</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Balance Due</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const total = Number(inv.total_amount);
                    const paid = Number(inv.paid_amount);
                    const due = Math.max(0, total - paid);

                    return (
                      <TableRow key={inv.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground py-3">
                          {formatDate(inv.invoice_date)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-foreground py-3">
                          {inv.invoice_number || 'N/A'}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground py-3">
                          {inv.vendor?.name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-xs font-bold py-3">
                          {formatMoney(total)}
                        </TableCell>
                        <TableCell className="text-xs text-emerald-400 py-3">
                          {formatMoney(paid)}
                        </TableCell>
                        <TableCell className="text-xs font-black py-3">
                          <span className={due > 0 ? 'text-rose-400 font-bold' : 'text-muted-foreground'}>
                            {formatMoney(due)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant={
                              inv.status === 'paid'
                                ? 'success'
                                : inv.status === 'partial'
                                ? 'warning'
                                : 'destructive'
                            }
                            className="text-[10px] uppercase font-bold"
                          >
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          {due > 0 ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPayment(inv)}
                              className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground"
                            >
                              <CreditCard className="h-3 w-3" />
                              <span>Settle Due</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-emerald-500 font-bold flex items-center justify-end gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Settled</span>
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredInvoices.map((inv) => {
                const total = Number(inv.total_amount);
                const paid = Number(inv.paid_amount);
                const due = Math.max(0, total - paid);

                return (
                  <Card key={inv.id} className="p-4 border-border bg-card/60 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div>
                        <h4 className="font-bold text-base text-foreground">{inv.vendor?.name || 'Vendor'}</h4>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Invoice #{inv.invoice_number || 'N/A'} • {formatDate(inv.invoice_date)}
                        </p>
                      </div>

                      <Badge
                        variant={
                          inv.status === 'paid'
                            ? 'success'
                            : inv.status === 'partial'
                            ? 'warning'
                            : 'destructive'
                        }
                        className="text-[10px] uppercase font-bold"
                      >
                        {inv.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs border-b border-border/40 pb-2.5">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Total Bill</span>
                        <span className="font-bold text-foreground">{formatMoney(total)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Paid</span>
                        <span className="font-bold text-emerald-400">{formatMoney(paid)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Balance Due</span>
                        <span className={`font-black ${due > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                          {formatMoney(due)}
                        </span>
                      </div>
                    </div>

                    {due > 0 && (
                      <Button
                        onClick={() => handleOpenPayment(inv)}
                        className="w-full h-10 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Settle Due ({formatMoney(due)})</span>
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* Vendors Directory Tab */
        filteredVendors.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-bold text-foreground">No vendor partners found</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Register dairy, bakery, coffee roasters and equipment partners above.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => {
              // Calculate vendor's active dues across all invoices
              const vendorDues = invoices
                .filter((i) => i.vendor_id === vendor.id)
                .reduce((s, i) => s + Math.max(0, Number(i.total_amount) - Number(i.paid_amount)), 0);

              return (
                <Card key={vendor.id} className="p-4 border-border bg-card/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div>
                        <h4 className="font-bold text-base text-foreground">{vendor.name}</h4>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground mt-0.5">
                          {vendor.category}
                        </Badge>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block uppercase">Active Dues</span>
                        <span className={`text-sm font-black ${vendorDues > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {formatMoney(vendorDues)}
                        </span>
                      </div>
                    </div>

                    <div className="my-3 space-y-1.5 text-xs text-muted-foreground">
                      {vendor.contact_person && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary" />
                          <span>Contact: <strong className="text-foreground">{vendor.contact_person}</strong></span>
                        </div>
                      )}
                      {vendor.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          <span>Phone: <strong className="text-foreground">{vendor.phone}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/40 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditVendor(vendor)}
                      className="flex-1 h-9 text-xs font-semibold gap-1"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 px-2 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {vendor.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the vendor profile and cascade delete all associated invoices and items.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Register / Edit Vendor Dialog */}
      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor Profile' : 'Register New Vendor'}</DialogTitle>
            <DialogDescription>
              Supplier information, category, contact representative, and phone.
            </DialogDescription>
          </DialogHeader>

          <Form {...vendorForm}>
            <form onSubmit={vendorForm.handleSubmit(onSubmitVendor)} className="space-y-4">
              <FormField
                control={vendorForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Company / Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Amul Fresh Dairy Dist." className="h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={vendorForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Supply Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VENDOR_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={vendorForm.control}
                  name="contact_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Rajesh Kumar" className="h-10 text-xs" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={vendorForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 98765 43210" className="h-10 text-xs" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full h-11 font-bold">
                {editingVendor ? 'Save Changes' : 'Register Vendor'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Log Purchase Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Purchase Invoice / Bill</DialogTitle>
            <DialogDescription>
              Record an incoming supplier bill, delivery slip, or stock purchase order.
            </DialogDescription>
          </DialogHeader>

          <Form {...invoiceForm}>
            <form onSubmit={invoiceForm.handleSubmit(onSubmitInvoice)} className="space-y-4">
              <FormField
                control={invoiceForm.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Vendor / Supplier</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue placeholder="Select Vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs">
                            {v.name} ({v.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={invoiceForm.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Invoice / Bill #</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. INV-8891" className="h-10 text-xs" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={invoiceForm.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Invoice Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-10 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={invoiceForm.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Total Bill Amount (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" placeholder="e.g. 4500" className="h-10 text-xs font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={invoiceForm.control}
                  name="paid_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Initial Amount Paid (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" placeholder="0 if pending" className="h-10 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={invoiceForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Notes / Particulars</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 50L Full Cream Milk & Curd" className="h-10 text-xs" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold">
                Save Invoice Record
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Settle Due / Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Vendor Due</DialogTitle>
            <DialogDescription>
              Record a payment to {selectedInvoice?.vendor?.name} for Invoice #{selectedInvoice?.invoice_number || 'bill'}.
            </DialogDescription>
          </DialogHeader>

          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Amount to Pay (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" className="h-11 text-base font-bold text-emerald-500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Payment Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue placeholder="Select Method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="upi" className="text-xs">UPI / QR Transfer</SelectItem>
                        <SelectItem value="bank_transfer" className="text-xs">Bank Transfer (NEFT/IMPS)</SelectItem>
                        <SelectItem value="cash" className="text-xs">Cash Outflow</SelectItem>
                        <SelectItem value="cheque" className="text-xs">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reference Note / Transaction ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. GPay UPI Ref 981240" className="h-10 text-xs" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Settle Due</span>
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
