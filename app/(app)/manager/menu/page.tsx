'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { MenuItem, MenuCategory } from '@/types/database';
import { menuItemSchema, MenuItemInput } from '@/schemas/menu-item';
import {
  createMenuItemAction,
  updateMenuItemAction,
  toggleMenuItemAvailabilityAction,
} from '@/app/actions/menu';
import { formatMoney } from '@/lib/format';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
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
import { Plus, Coffee, Loader2, Edit3 } from 'lucide-react';

export default function ManagerMenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const createForm = useForm<MenuItemInput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      category_id: '',
      name: '',
      price: '' as any,
      is_available: true,
    },
  });

  const editForm = useForm<MenuItemInput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      category_id: '',
      name: '',
      price: '' as any,
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

  // Optimistic toggle for availability badge
  const handleOptimisticToggle = async (item: MenuItem) => {
    const nextState = !item.is_available;

    // 1. Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: nextState } : i))
    );

    // 2. Server mutation
    const res = await toggleMenuItemAvailabilityAction(item.id, nextState);
    if (res?.error) {
      toast.error('Failed to update status', { description: res.error });
      loadMenu(); // Rollback on error
    } else {
      toast.success(
        `${item.name} is now ${nextState ? 'Available' : 'Marked Sold Out'}`
      );
    }
  };

  const onCreateSubmit = async (values: MenuItemInput) => {
    setIsSubmitting(true);
    try {
      const res = await createMenuItemAction(values);
      if (res?.error) {
        toast.error('Could not save item', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Added ${values.name} to menu!`);
      createForm.reset();
      setCreateDialogOpen(false);
      setCreateDrawerOpen(false);
      loadMenu();
    } catch {
      toast.error('Unexpected error while adding item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (values: MenuItemInput) => {
    if (!editingItem) return;
    setIsSubmitting(true);
    try {
      const res = await updateMenuItemAction(editingItem.id, values);
      if (res?.error) {
        toast.error('Failed to update item', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Updated ${values.name}!`);
      setEditingItem(null);
      loadMenu();
    } catch {
      toast.error('Unexpected error updating item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    editForm.reset({
      category_id: item.category_id,
      name: item.name,
      price: item.price,
      is_available: item.is_available,
    });
  };

  const MenuItemFormContent = ({
    formInstance,
    onSubmitHandler,
  }: {
    formInstance: typeof createForm;
    onSubmitHandler: (values: MenuItemInput) => Promise<void>;
  }) => (
    <Form {...formInstance}>
      <form onSubmit={formInstance.handleSubmit(onSubmitHandler)} className="space-y-4">
        <FormField
          control={formInstance.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
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
          control={formInstance.control}
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
          control={formInstance.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  placeholder="150"
                  className="h-11 text-base md:text-sm font-semibold"
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

        {/* Add Item Trigger */}
        <div>
          <div className="hidden sm:block">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                    Add a new beverage or food item with category and pricing.
                  </DialogDescription>
                </DialogHeader>
                <MenuItemFormContent
                  formInstance={createForm}
                  onSubmitHandler={onCreateSubmit}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="block sm:hidden">
            <Drawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
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
                  <MenuItemFormContent
                    formInstance={createForm}
                    onSubmitHandler={onCreateSubmit}
                  />
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline" className="h-11">
                      Cancel
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit {editingItem.name}</DialogTitle>
              <DialogDescription>
                Modify item name, price, or change category.
              </DialogDescription>
            </DialogHeader>
            <MenuItemFormContent
              formInstance={editForm}
              onSubmitHandler={onEditSubmit}
            />
          </DialogContent>
        </Dialog>
      )}

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
                            {formatMoney(item.price)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Optimistic Availability Toggle Badge */}
                          <Badge
                            variant={item.is_available ? 'success' : 'destructive'}
                            className="cursor-pointer text-[11px] select-none hover:opacity-80 active:scale-95 transition"
                            onClick={() => handleOptimisticToggle(item)}
                            title="Click to toggle availability"
                          >
                            {item.is_available ? 'Available' : 'Sold Out'}
                          </Badge>

                          {/* Edit Item Dialog Trigger */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(item)}
                            title="Edit menu item"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
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
