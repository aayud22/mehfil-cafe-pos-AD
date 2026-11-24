'use client';

import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { InventoryItem, Vendor } from '@/types/database';
import {
  inventoryItemSchema,
  restockSchema,
  InventoryItemInput,
  RestockInput,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
} from '@/schemas/inventory';
import {
  createInventoryItemAction,
  updateInventoryItemAction,
  deleteInventoryItemAction,
  restockInventoryAction,
} from '@/app/actions/inventory';
import { formatMoney } from '@/lib/format';
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
  DialogTrigger,
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
  Package,
  Plus,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Edit,
  Loader2,
  TrendingDown,
  Building2,
  ArrowUpRight,
} from 'lucide-react';

export default function StockInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Dialog states
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [selectedRestockItem, setSelectedRestockItem] = useState<InventoryItem | null>(null);

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    const [itemsRes, vendorsRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('*, vendor:vendors(*)')
        .order('name', { ascending: true }),
      supabase.from('vendors').select('*').order('name', { ascending: true }),
    ]);

    if (itemsRes.data) setItems(itemsRes.data as InventoryItem[]);
    if (vendorsRes.data) setVendors(vendorsRes.data as Vendor[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Realtime listener on inventory items
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Forms
  const itemForm = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: '',
      category: INVENTORY_CATEGORIES[0],
      current_stock: 0,
      unit: 'kg',
      min_threshold: 5,
      cost_per_unit: 0,
      vendor_id: '',
    },
  });

  const restockForm = useForm<RestockInput>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      item_id: '',
      quantity: 1,
      cost_per_unit: undefined,
      notes: '',
    },
  });

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    itemForm.reset({
      name: '',
      category: INVENTORY_CATEGORIES[0],
      current_stock: 0,
      unit: 'kg',
      min_threshold: 5,
      cost_per_unit: 0,
      vendor_id: '',
    });
    setItemDialogOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    itemForm.reset({
      name: item.name,
      category: item.category,
      current_stock: Number(item.current_stock),
      unit: item.unit,
      min_threshold: Number(item.min_threshold),
      cost_per_unit: Number(item.cost_per_unit),
      vendor_id: item.vendor_id || '',
    });
    setItemDialogOpen(true);
  };

  const handleOpenRestock = (item: InventoryItem) => {
    setSelectedRestockItem(item);
    restockForm.reset({
      item_id: item.id,
      quantity: 5,
      cost_per_unit: Number(item.cost_per_unit) || undefined,
      notes: `Replenished stock`,
    });
    setRestockDialogOpen(true);
  };

  const onSubmitItem = async (values: InventoryItemInput) => {
    if (editingItem) {
      const res = await updateInventoryItemAction(editingItem.id, values);
      if (res?.error) {
        toast.error('Failed to update item', { description: res.error });
      } else {
        toast.success('Inventory item updated successfully');
        setItemDialogOpen(false);
        loadData();
      }
    } else {
      const res = await createInventoryItemAction(values);
      if (res?.error) {
        toast.error('Failed to add item', { description: res.error });
      } else {
        toast.success('New inventory item added');
        setItemDialogOpen(false);
        loadData();
      }
    }
  };

  const onSubmitRestock = async (values: RestockInput) => {
    const res = await restockInventoryAction(values);
    if (res?.error) {
      toast.error('Restock failed', { description: res.error });
    } else {
      toast.success(
        `Added +${values.quantity} ${selectedRestockItem?.unit} to ${selectedRestockItem?.name}!`
      );
      setRestockDialogOpen(false);
      loadData();
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    const res = await deleteInventoryItemAction(id);
    if (res?.error) {
      toast.error('Failed to delete item', { description: res.error });
    } else {
      toast.success(`Deleted ${name} from inventory`);
      loadData();
    }
  };

  // Metrics
  const lowStockItems = useMemo(
    () => items.filter((i) => Number(i.current_stock) <= Number(i.min_threshold)),
    [items]
  );
  const totalStockValue = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.current_stock) * Number(item.cost_per_unit || 0),
        0
      ),
    [items]
  );

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesLowStock = !showLowStockOnly || Number(item.current_stock) <= Number(item.min_threshold);
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [items, search, categoryFilter, showLowStockOnly]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Package className="h-6 w-6 text-primary" />
            <span>Stock & Inventory Management</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Track ingredients, raw consumables, low-stock thresholds and reorders
          </p>
        </div>

        <Button onClick={handleOpenCreateItem} className="h-11 font-bold gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Stock Item</span>
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card/60 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Inventory Items
          </span>
          <div className="text-2xl md:text-3xl font-black text-foreground mt-1">
            {items.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Active supplies monitored
          </p>
        </Card>

        <Card
          className={`border-border p-4 ${
            lowStockItems.length > 0
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'bg-card/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Low Stock Alerts
            </span>
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="animate-pulse text-[10px] uppercase">
                Needs Reorder
              </Badge>
            )}
          </div>
          <div
            className={`text-2xl md:text-3xl font-black mt-1 ${
              lowStockItems.length > 0 ? 'text-amber-500' : 'text-emerald-500'
            }`}
          >
            {lowStockItems.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Items at or below safety threshold
          </p>
        </Card>

        <Card className="border-border bg-card/60 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Estimated Inventory Valuation
          </span>
          <div className="text-2xl md:text-3xl font-black text-emerald-500 mt-1">
            {formatMoney(totalStockValue)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Current stock × unit procurement cost
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border bg-card/60 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-xs bg-background"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48 h-10 text-xs bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                {INVENTORY_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={showLowStockOnly ? 'default' : 'outline'}
            onClick={() => setShowLowStockOnly((prev) => !prev)}
            className="h-10 text-xs gap-1.5 shrink-0"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Low Stock Only ({lowStockItems.length})</span>
          </Button>
        </div>
      </Card>

      {/* Inventory Items List */}
      {loading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-2">Loading inventory records...</p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-bold text-foreground">No inventory items found</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {search || categoryFilter !== 'all' || showLowStockOnly
              ? 'Try resetting your search or filter parameters.'
              : 'Add your first cafe ingredient or raw consumable above.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Item Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Current Stock</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Threshold</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Cost / Unit</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Preferred Vendor</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const stockNum = Number(item.current_stock);
                  const minNum = Number(item.min_threshold);
                  const isLow = stockNum <= minNum;
                  const isZero = stockNum === 0;

                  return (
                    <TableRow key={item.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-bold text-foreground py-3">
                        {item.name}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="text-xs font-semibold text-muted-foreground">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm ${isZero ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {stockNum} {item.unit}
                          </span>
                          {isZero ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Out of Stock
                            </Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] px-1.5 py-0">
                              Low
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">
                        {minNum} {item.unit}
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-semibold py-3">
                        {formatMoney(Number(item.cost_per_unit || 0))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">
                        {item.vendor?.name ? (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Building2 className="h-3 w-3 text-primary" />
                            {item.vendor.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right py-3 space-x-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleOpenRestock(item)}
                          className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Restock</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditItem(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the inventory tracking item and its historical logs.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteItem(item.id, item.name)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredItems.map((item) => {
              const stockNum = Number(item.current_stock);
              const minNum = Number(item.min_threshold);
              const isLow = stockNum <= minNum;
              const isZero = stockNum === 0;

              return (
                <Card key={item.id} className="p-4 border-border bg-card/60 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{item.name}</h4>
                      <Badge variant="outline" className="text-[10px] mt-0.5 text-muted-foreground">
                        {item.category}
                      </Badge>
                    </div>

                    <div className="text-right">
                      <span className={`text-base font-black ${isZero ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {stockNum} {item.unit}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        Min: {minNum} {item.unit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Cost: {formatMoney(Number(item.cost_per_unit || 0))}/{item.unit}</span>
                    <span>
                      Vendor: <strong className="text-foreground">{item.vendor?.name || 'None'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      onClick={() => handleOpenRestock(item)}
                      className="flex-1 h-10 text-xs font-bold gap-1 bg-primary text-primary-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Restock Batch</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenEditItem(item)}
                      className="h-10 px-3 text-xs"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Item Create / Edit Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
            <DialogDescription>
              Configure consumable name, category, unit, safety threshold and cost.
            </DialogDescription>
          </DialogHeader>

          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onSubmitItem)} className="space-y-4">
              <FormField
                control={itemForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Arabica Coffee Beans" className="h-10 text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={itemForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INVENTORY_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-xs">
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={itemForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Measurement Unit</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select Unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INVENTORY_UNITS.map((u) => (
                            <SelectItem key={u} value={u} className="text-xs">
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={itemForm.control}
                  name="current_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" className="h-10 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={itemForm.control}
                  name="min_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Min Threshold</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" className="h-10 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={itemForm.control}
                  name="cost_per_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Cost / Unit (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" className="h-10 text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={itemForm.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Preferred Supplier (Optional)</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue placeholder="Select Preferred Vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">No vendor assigned</SelectItem>
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

              <Button type="submit" className="w-full h-11 font-bold">
                {editingItem ? 'Save Changes' : 'Create Item'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Quick Restock Dialog */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restock {selectedRestockItem?.name}</DialogTitle>
            <DialogDescription>
              Add newly procured quantity to current stock ({selectedRestockItem?.current_stock} {selectedRestockItem?.unit}).
            </DialogDescription>
          </DialogHeader>

          <Form {...restockForm}>
            <form onSubmit={restockForm.handleSubmit(onSubmitRestock)} className="space-y-4">
              <FormField
                control={restockForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Quantity to Add ({selectedRestockItem?.unit})
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.5" className="h-11 text-base font-bold" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={restockForm.control}
                name="cost_per_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Cost per unit (₹, Optional update)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={String(selectedRestockItem?.cost_per_unit || 0)}
                        className="h-10 text-xs"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={restockForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Procurement Note / Invoice #</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Received fresh delivery" className="h-10 text-xs" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Stock In</span>
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
