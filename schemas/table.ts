import { z } from "zod";

export const tableSchema = z.object({
  label: z.string().trim().min(1, "Table label is required (e.g. T1, T2)"),
  seats: z.coerce.number().int().min(1, "Seats must be at least 1").max(20, "Maximum seats is 20"),
  status: z.enum(["free", "occupied"]).default("free"),
});

export type TableInput = z.infer<typeof tableSchema>;
