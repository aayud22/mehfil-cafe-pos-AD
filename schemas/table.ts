import { z } from "zod";

export const tableSchema = z.object({
  label: z.string().trim().min(1, "Table label is required (e.g. T1, T2)"),
  seats: z.coerce.number().int().min(1, "Seats must be at least 1").max(20, "Maximum seats is 20"),
  status: z.enum(["free", "occupied"]).default("free"),
});

export const transferTableSchema = z
  .object({
    from_table_id: z.string().uuid("Invalid source table"),
    to_table_id: z.string().uuid("Invalid destination table"),
  })
  .refine((d) => d.from_table_id !== d.to_table_id, {
    message: "Source and destination tables cannot be the same",
    path: ["to_table_id"],
  });

export const requestBillSchema = z.object({
  table_id: z.string().uuid("Invalid table"),
});

export type TableInput = z.infer<typeof tableSchema>;
export type TransferTableInput = z.infer<typeof transferTableSchema>;
export type RequestBillInput = z.infer<typeof requestBillSchema>;
