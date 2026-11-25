'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { ModifierGroup, ModifierOption } from '@/types/database';
import {
  modifierGroupSchema,
  modifierOptionSchema,
  ModifierGroupInput,
  ModifierOptionInput,
} from '@/schemas/modifier';
import {
  createModifierGroupAction,
  updateModifierGroupAction,
  deleteModifierGroupAction,
  createModifierOptionAction,
  updateModifierOptionAction,
  deleteModifierOptionAction,
} from '@/app/actions/modifiers';
import { formatMoney } from '@/lib/format';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { SlidersHorizontal, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

export default function ModifiersManagerPage() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);

  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('modifier_groups')
      .select('*, options:modifier_options(*)')
      .order('name', { ascending: true });

    if (data) {
      const sorted = (data as ModifierGroup[]).map((g) => ({
        ...g,
        options: (g.options || []).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
      }));
      setGroups(sorted);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupForm = useForm<ModifierGroupInput>({
    resolver: zodResolver(modifierGroupSchema),
    defaultValues: {
      name: '',
      selection_type: 'single',
      is_required: false,
      max_select: null,
    },
  });

  const optionForm = useForm<ModifierOptionInput>({
    resolver: zodResolver(modifierOptionSchema),
    defaultValues: {
      group_id: '',
      name: '',
      price_delta: 0,
      is_available: true,
      sort_order: 0,
    },
  });

  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    groupForm.reset({ name: '', selection_type: 'single', is_required: false, max_select: null });
    setGroupDialogOpen(true);
  };

  const handleOpenEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    groupForm.reset({
      name: group.name,
      selection_type: group.selection_type,
      is_required: group.is_required,
      max_select: group.max_select,
    });
    setGroupDialogOpen(true);
  };

  const handleOpenCreateOption = (groupId: string) => {
    setEditingOption(null);
    setTargetGroupId(groupId);
    optionForm.reset({ group_id: groupId, name: '', price_delta: 0, is_available: true, sort_order: 0 });
    setOptionDialogOpen(true);
  };

  const handleOpenEditOption = (opt: ModifierOption) => {
    setEditingOption(opt);
    setTargetGroupId(opt.group_id);
    optionForm.reset({
      group_id: opt.group_id,
      name: opt.name,
      price_delta: Number(opt.price_delta),
      is_available: opt.is_available,
      sort_order: opt.sort_order,
    });
    setOptionDialogOpen(true);
  };

  const onSubmitGroup = async (values: ModifierGroupInput) => {
    const res = editingGroup
      ? await updateModifierGroupAction(editingGroup.id, values)
      : await createModifierGroupAction(values);

    if (res?.error) {
      toast.error('Failed to save group', { description: res.error });
    } else {
      toast.success(editingGroup ? 'Modifier group updated' : 'Modifier group created');
      setGroupDialogOpen(false);
      loadData();
    }
  };

  const onSubmitOption = async (values: ModifierOptionInput) => {
    const res = editingOption
      ? await updateModifierOptionAction(editingOption.id, values)
      : await createModifierOptionAction({ ...values, group_id: targetGroupId });

    if (res?.error) {
      toast.error('Failed to save option', { description: res.error });
    } else {
      toast.success(editingOption ? 'Option updated' : 'Option added');
      setOptionDialogOpen(false);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
            <span>Menu Modifiers & Add-ons</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Configure Size, Milk, Extra Shot, Sugar and extra charges, then attach them to menu items
          </p>
        </div>

        <Button onClick={handleOpenCreateGroup} className="h-11 font-bold gap-2">
          <Plus className="h-4 w-4" />
          <span>New Modifier Group</span>
        </Button>
      </div>

      {loading ? (
        <Card className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground mt-2">Loading modifier groups...</p>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-sm text-muted-foreground">No modifier groups configured yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="border-border bg-card/60">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-bold">{group.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {group.selection_type}
                    </Badge>
                    {group.is_required && (
                      <Badge variant="destructive" className="text-[10px] uppercase">
                        Required
                      </Badge>
                    )}
                    {group.max_select && group.selection_type === 'multiple' && (
                      <Badge variant="secondary" className="text-[10px]">
                        Max {group.max_select}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {(group.options || []).length} options configured
                  </CardDescription>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenCreateOption(group.id)}
                    className="h-9 text-xs font-semibold gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Option</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleOpenEditGroup(group)}
                    className="h-9 w-9"
                  >
                    <Edit className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {group.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the group and its options from all menu items.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            await deleteModifierGroupAction(group.id);
                            loadData();
                          }}
                          className="bg-destructive text-destructive-foreground font-bold"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>

              <CardContent className="pt-3 divide-y divide-border/50">
                {(group.options || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No options added yet.
                  </p>
                ) : (
                  (group.options || []).map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${opt.is_available ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                          {opt.name}
                        </span>
                        {!opt.is_available && (
                          <Badge variant="outline" className="text-[10px]">
                            Disabled
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">
                          {Number(opt.price_delta) > 0 ? `+${formatMoney(Number(opt.price_delta))}` : 'Free'}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEditOption(opt)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await deleteModifierOptionAction(opt.id);
                            loadData();
                          }}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Modifier Group' : 'New Modifier Group'}</DialogTitle>
            <DialogDescription>Configure selection rules for this add-on group.</DialogDescription>
          </DialogHeader>
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(onSubmitGroup)} className="space-y-4">
              <FormField
                control={groupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Size, Milk, Extra shot" className="h-11 text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={groupForm.control}
                  name="selection_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Selection Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single" className="text-xs">Single (Radio)</SelectItem>
                          <SelectItem value="multiple" className="text-xs">Multiple (Checkbox)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={groupForm.control}
                  name="max_select"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Max Select (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          placeholder="e.g. 3"
                          className="h-11 text-sm"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={groupForm.control}
                name="is_required"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border border-border p-3.5">
                    <FormLabel className="text-xs font-semibold">Required selection?</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold">
                {editingGroup ? 'Save Changes' : 'Create Group'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Option Dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOption ? 'Edit Option' : 'Add Modifier Option'}</DialogTitle>
            <DialogDescription>Set option label and extra charge (₹0 – ₹500).</DialogDescription>
          </DialogHeader>
          <Form {...optionForm}>
            <form onSubmit={optionForm.handleSubmit(onSubmitOption)} className="space-y-4">
              <FormField
                control={optionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Option Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Almond Milk, Large" className="h-11 text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={optionForm.control}
                  name="price_delta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Extra Charge (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={500} className="h-11 text-sm font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={optionForm.control}
                  name="sort_order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Sort Order</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} className="h-11 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={optionForm.control}
                name="is_available"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border border-border p-3.5">
                    <FormLabel className="text-xs font-semibold">Available</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11 font-bold">
                {editingOption ? 'Save Option' : 'Add Option'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
