import { z } from 'zod';

export const modifierGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(60),
  selection_type: z.enum(['single', 'multiple']).default('single'),
  is_required: z.boolean().default(false),
  max_select: z.coerce.number().int().min(1).max(20).nullable().optional(),
});

export type ModifierGroupInput = z.infer<typeof modifierGroupSchema>;

export const modifierOptionSchema = z.object({
  group_id: z.string().uuid('Valid group is required'),
  name: z.string().trim().min(1, 'Option name is required').max(60),
  price_delta: z.coerce
    .number()
    .min(0, 'Extra charge must be at least 0')
    .max(500, 'Extra charge cannot exceed 500'),
  is_available: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type ModifierOptionInput = z.infer<typeof modifierOptionSchema>;

export const itemModifierAssignmentSchema = z.object({
  menu_item_id: z.string().uuid(),
  group_ids: z.array(z.string().uuid()),
});
