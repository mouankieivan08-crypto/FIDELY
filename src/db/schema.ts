import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const businesses = pgTable('businesses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ownerUid: text('owner_uid').references(() => users.uid).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const programs = pgTable('programs', {
  id: serial('id').primaryKey(),
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  visitsRequired: integer('visits_required').notNull(),
  rewardDescription: text('reward_description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(), // Generated UUID-like or shorter for QR
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  visits: integer('visits').default(0).notNull(),
  programId: integer('program_id').references(() => programs.id).notNull(),
  rewardStatus: text('reward_status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const visits = pgTable('visits', {
  id: serial('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id).notNull(),
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  validatedBy: text('validated_by').references(() => users.uid).notNull(),
});

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  phone: text('phone'),
  status: text('status').default('active').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  category: text('category'),
  duration: integer('duration').notNull(), // in minutes
  price: integer('price').notNull(), // in cents
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  customerId: text('customer_id').references(() => customers.id).notNull(),
  employeeId: integer('employee_id').references(() => employees.id),
  serviceId: integer('service_id').references(() => services.id).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: text('status').default('scheduled').notNull(), // scheduled, completed, cancelled
  createdAt: timestamp('created_at').defaultNow(),
});

export const timeLogs = pgTable('time_logs', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  clockInTime: timestamp('clock_in_time').notNull(),
  clockOutTime: timestamp('clock_out_time'),
  selfieUrl: text('selfie_url'),
  locationLat: text('location_lat'),
  locationLng: text('location_lng'),
  livenessConfirmed: text('liveness_confirmed').default('false'),
});
