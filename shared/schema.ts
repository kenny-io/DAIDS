import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const auditEntries = pgTable("audit_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  domain: text("domain").notNull().unique(),
  score: integer("score").notNull(),
  crawledPages: integer("crawled_pages").notNull(),
  categoryScores: jsonb("category_scores").$type<Record<string, number>>().notNull(),
  durationMs: integer("duration_ms").notNull(),
  errorCount: integer("error_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditResults = pgTable("audit_results", {
  entryId: uuid("entry_id").primaryKey().references(() => auditEntries.id, { onDelete: "cascade" }),
  resultJson: jsonb("result_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AuditEntry = typeof auditEntries.$inferSelect;
export type AuditResultRow = typeof auditResults.$inferSelect;
