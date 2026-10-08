import { createInsertSchema } from "drizzle-zod";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const accessTypeEnum = pgEnum("smartlock_access_type", [
  "standard",
  "premium",
]);

export const passStatusEnum = pgEnum("smartlock_pass_status", [
  "active",
  "used",
  "revoked",
]);

export const accessPassesTable = pgTable(
  "smartlock_access_passes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    visitorName: text("visitor_name").notNull(),
    unit: text("unit").notNull(),
    accessType: accessTypeEnum("access_type").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: passStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("smartlock_access_passes_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    uniqueIndex("smartlock_access_passes_token_uidx").on(table.token),
  ],
);

export const insertAccessPassSchema = createInsertSchema(accessPassesTable).omit(
  {
    id: true,
    ownerId: true,
    token: true,
    createdAt: true,
    status: true,
    usedAt: true,
    revokedAt: true,
  },
);

export type InsertAccessPass = z.infer<typeof insertAccessPassSchema>;
export type AccessPass = typeof accessPassesTable.$inferSelect;
