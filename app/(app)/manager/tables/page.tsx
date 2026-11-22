'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { CafeTable, Order } from '@/types/database';
import { tableSchema, TableInput } from '@/schemas/table';
import {
  createTableAction,
  updateTableAction,
  deleteTableAction,
} from '@/app/actions/tables';
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
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
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
import { Users, Plus, Loader2, Edit2, Trash2 } from 'lucide-react';

interface TableWithStatus extends CafeTable {
  hasOpenOrders: boolean;
  openOrdersCount: number;
}

export default function ManagerTablesPage() {
  const [tables, setTables] = useState<TableWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableWithStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const createForm = useForm<TableInput>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      label: '',
      seats: 2,
      status: 'free',
    },
  });

  const editForm = useForm<TableInput>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      label: '',
      seats: 2,
      status: 'free',
    },
  });

  const loadTables = async () => {
    setLoading(true);

    // 1. Fetch tables
    const { data: tableData } = await supabase
      .from('cafe_tables')
      .select('*')
      .order('label');

    // 2. Fetch active orders
    const { data: openOrders } = await supabase
      .from('orders')
      .select('table_id')
      .in('status', ['new', 'preparing', 'ready', 'served']);

    const openCountByTable: Record<string, number> = {};
    (openOrders || []).forEach((o) => {
      openCountByTable[o.table_id] = (openCountByTable[o.table_id] || 0) + 1;
    });

    if (tableData) {
      const enriched: TableWithStatus[] = tableData.map((t) => {
        const count = openCountByTable[t.id] || 0;
        return {
          ...t,
          hasOpenOrders: count > 0,
          openOrdersCount: count,
          // Status strictly comes from orders
          status: count > 0 ? 'occupied' : 'free',
        };
      });
      setTables(enriched);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTables();
  }, []);

  const onCreateSubmit = async (values: TableInput) => {
    setIsSubmitting(true);
    try {
      const res = await createTableAction(values);
      if (res?.error) {
        toast.error('Could not create table', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Table ${values.label} created successfully!`);
      createForm.reset();
      setCreateDialogOpen(false);
      setCreateDrawerOpen(false);
      loadTables();
    } catch {
      toast.error('Error creating table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: TableInput) => {
    if (!editingTable) return;
    setIsSubmitting(true);
    try {
      const res = await updateTableAction(editingTable.id, values);
      if (res?.error) {
        toast.error('Update rejected', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Table ${values.label} updated!`);
      setEditingTable(null);
      loadTables();
    } catch {
      toast.error('Error updating table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      const res = await deleteTableAction(id);
      if (res?.error) {
        toast.error('Cannot delete table', { description: res.error });
      } else {
        toast.success('Table deleted from floor');
        loadTables();
      }
    } catch {
      toast.error('Error deleting table');
    }
  };

  const openEditModal = (table: TableWithStatus) => {
    if (table.hasOpenOrders) {
      toast.error('Cannot edit a table with open dining orders.');
      return;
    }
    setEditingTable(table);
    editForm.reset({
      label: table.label,
      seats: table.seats,
      status: table.status,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-border pb-4 sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Table Layout & Seating
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Floor table setup (status is automatically driven by customer orders)
          </p>
        </div>

        {/* Add Table Dialog (Desktop) & Drawer (Mobile) */}
        <div>
          <div className="hidden sm:block">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 gap-2 font-semibold shadow">
                  <Plus className="h-4 w-4" />
                  <span>Add Table</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Cafe Table</DialogTitle>
                  <DialogDescription>
                    Label must be unique (e.g. T9, Garden-1). Seats 1 to 20.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Table Identifier</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. T9" className="h-11 text-base md:text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="seats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity (Seats 1-20)</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" max="20" className="h-11 text-base md:text-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base">
                      {isSubmitting ? 'Saving Table...' : 'Save Table'}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="block sm:hidden">
            <Drawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
              <DrawerTrigger asChild>
                <Button className="w-full h-11 gap-2 font-semibold shadow">
                  <Plus className="h-4 w-4" />
                  <span>Add Table</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-4">
                <DrawerHeader className="text-left">
                  <DrawerTitle>Add Cafe Table</DrawerTitle>
                  <DrawerDescription>
                    Label must be unique. Seats must be between 1 and 20.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 py-2">
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Table Identifier</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. T9" className="h-11 text-base md:text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="seats"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacity (Seats 1-20)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="20" className="h-11 text-base md:text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base">
                        {isSubmitting ? 'Saving...' : 'Save Table'}
                      </Button>
                    </form>
                  </Form>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline" className="h-11">Cancel</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>

      {/* Edit Table Modal */}
      {editingTable && (
        <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Table {editingTable.label}</DialogTitle>
              <DialogDescription>
                Update table label or seat capacity.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table Identifier</FormLabel>
                      <FormControl>
                        <Input className="h-11 text-base md:text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="seats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seats (1-20)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="20" className="h-11 text-base md:text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base">
                  {isSubmitting ? 'Updating...' : 'Update Table'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Tables Grid: Status strictly from orders, no manual "Mark Occupied" button */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tables layout...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <Card
              key={table.id}
              className={`p-4 flex flex-col justify-between transition ${
                table.status === 'occupied'
                  ? 'border-primary/60 bg-primary/10'
                  : 'bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl md:text-2xl font-black text-foreground">
                    {table.label}
                  </span>
                  <Badge
                    variant={table.status === 'occupied' ? 'warning' : 'success'}
                    className="text-[10px] uppercase font-bold"
                  >
                    {table.status}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{table.seats} Seats</span>
                </div>

                {table.hasOpenOrders && (
                  <p className="mt-2 text-[11px] font-semibold text-primary">
                    {table.openOrdersCount} active order{table.openOrdersCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Action Buttons: Disabled when table has open orders */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={table.hasOpenOrders}
                  onClick={() => openEditModal(table)}
                  className="h-9 flex-1 text-xs gap-1 disabled:opacity-40"
                  title={table.hasOpenOrders ? 'Cannot edit with open orders' : 'Edit table'}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={table.hasOpenOrders}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      title={table.hasOpenOrders ? 'Cannot delete with open orders' : 'Delete table'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Table {table.label}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove Table {table.label} from the cafe floor.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        onClick={() => handleDeleteTable(table.id)}
                      >
                        Delete Table
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
