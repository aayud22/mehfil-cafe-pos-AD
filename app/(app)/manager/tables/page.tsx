'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { CafeTable } from '@/types/database';
import { tableSchema, TableInput } from '@/schemas/table';
import { createTableAction, toggleTableStatusAction } from '@/app/actions/tables';
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
import { Grid, Users, Plus, Loader2 } from 'lucide-react';

export default function ManagerTablesPage() {
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const form = useForm<TableInput>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      label: '',
      seats: 2,
      status: 'free',
    },
  });

  const loadTables = async () => {
    setLoading(true);
    const { data } = await supabase.from('cafe_tables').select('*').order('label');
    if (data) setTables(data as CafeTable[]);
    setLoading(false);
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleToggleStatus = async (table: CafeTable) => {
    const nextStatus = table.status === 'free' ? 'occupied' : 'free';
    setTables((prev) =>
      prev.map((t) => (t.id === table.id ? { ...t, status: nextStatus } : t))
    );

    const res = await toggleTableStatusAction(table.id, table.status);
    if (res?.error) {
      toast.error('Failed to change status', { description: res.error });
      loadTables();
    } else {
      toast.success(`Table ${table.label} marked as ${nextStatus}`);
    }
  };

  const onSubmit = async (values: TableInput) => {
    setIsSubmitting(true);
    try {
      const res = await createTableAction(values);
      if (res?.error) {
        toast.error('Could not create table', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Table ${values.label} created!`);
      form.reset();
      setDialogOpen(false);
      setDrawerOpen(false);
      loadTables();
    } catch {
      toast.error('Error creating table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const TableFormContent = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Table Identifier</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. T9 or Balcony-1"
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
          name="seats"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seating Capacity</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  className="h-11 text-base md:text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Table...
            </>
          ) : (
            'Add Table to Floor'
          )}
        </Button>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-border pb-4 sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Table Layout & Seating
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Floor table setup, guest capacity, and real-time occupancy
          </p>
        </div>

        {/* Dialog / Drawer for Add Table */}
        <div>
          <div className="hidden sm:block">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    Add a new physical dining table to the floor plan.
                  </DialogDescription>
                </DialogHeader>
                <TableFormContent />
              </DialogContent>
            </Dialog>
          </div>

          <div className="block sm:hidden">
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
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
                    Add a new physical dining table to the floor plan.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 py-2">
                  <TableFormContent />
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tables...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <Card
              key={table.id}
              className={`p-4 transition ${
                table.status === 'occupied'
                  ? 'border-primary/60 bg-primary/10'
                  : 'bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg md:text-xl font-black text-foreground">
                  {table.label}
                </span>
                <Badge
                  variant={table.status === 'occupied' ? 'warning' : 'success'}
                  className="cursor-pointer text-[10px] uppercase font-bold"
                  onClick={() => handleToggleStatus(table)}
                >
                  {table.status}
                </Badge>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{table.seats} Seats</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleStatus(table)}
                className="mt-3 w-full h-9 text-xs"
              >
                Mark {table.status === 'free' ? 'Occupied' : 'Free'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
