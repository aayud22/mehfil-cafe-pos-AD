'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory } from '@/types/database';
import { menuItemSchema, MenuItemInput } from '@/schemas/menu-item';
import {
  createMenuItemAction,
  toggleMenuItemAvailabilityAction,
} from '@/app/actions/menu';
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
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Coffee, Loader2 } from 'lucide-react';

export default function ManagerMenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const form = useForm<MenuItemInput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      category_id: '',
      name: '',
      price: 0,
      is_available: true,
    },
  });

  const loadMenu = async () => {
    setLoading(true);
    const { data: catData } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order');
    if (catData) setCategories(catData as MenuCategory[]);

    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*, category:menu_categories(*)')
      .order('name');
    if (itemsData) setItems(itemsData as MenuItem[]);
    setLoading(false);
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleToggle = async (item: MenuItem) => {
    const nextState = !item.is_available;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: nextState } : i))
    );

    const res = await toggleMenuItemAvailabilityAction(item.id, nextState);
    if (res?.error) {
      toast.error('Failed to update status', { description: res.error });
      loadMenu();
    } else {
      toast.success(
        `${item.name} is now ${nextState ? 'Available' : 'Marked Sold Out'}`
      );
    }
  };

  const onSubmit = async (values: MenuItemInput) => {
    setIsSubmitting(true);
    try {
      const res = await createMenuItemAction(values);
      if (res?.error) {
        toast.error('Could not save item', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Added ${values.name} to menu!`);
      form.reset();
      setDialogOpen(false);
      setDrawerOpen(false);
      loadMenu();
    } catch {
      toast.error('Unexpected error while adding item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const MenuItemFormContent = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11 text-base md:text-sm">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Hazelnut Latte"
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
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price (₹)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  placeholder="150"
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
              Saving Item...
            </>
          ) : (
            'Save Menu Item'
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
            Menu Catalog
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage categories, item pricing, and kitchen availability
          </p>
        </div>

        {/* Responsive Dialog (Desktop) & Drawer (Mobile) */}
        <div>
          {/* Desktop Dialog */}
          <div className="hidden sm:block">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 gap-2 font-semibold shadow">
                  <Plus className="h-4 w-4" />
                  <span>Add New Item</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Menu Item</DialogTitle>
                  <DialogDescription>
                    Add a new beverage or food item to the cafe catalog.
                  </DialogDescription>
                </DialogHeader>
                <MenuItemFormContent />
              </DialogContent>
            </Dialog>
          </div>

          {/* Mobile Drawer */}
          <div className="block sm:hidden">
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button className="w-full h-11 gap-2 font-semibold shadow">
                  <Plus className="h-4 w-4" />
                  <span>Add New Item</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-4">
                <DrawerHeader className="text-left">
                  <DrawerTitle>Add Menu Item</DrawerTitle>
                  <DrawerDescription>
                    Add a new beverage or food item to the cafe catalog.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 py-2">
                  <MenuItemFormContent />
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
        <p className="text-sm text-muted-foreground">Loading menu catalog...</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            return (
              <Card key={cat.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg text-primary flex items-center gap-2">
                    <Coffee className="h-4 w-4" />
                    <span>{cat.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {catItems.length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-3.5 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="text-xs font-bold text-primary mt-0.5">
                            ₹{item.price}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={item.is_available ? 'success' : 'destructive'}
                            className="cursor-pointer text-[11px]"
                            onClick={() => handleToggle(item)}
                          >
                            {item.is_available ? 'Available' : 'Sold Out'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
