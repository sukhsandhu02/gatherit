import { pgTable, pgEnum, uuid, text, boolean, timestamp, bigint, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

export const guestStatusEnum = pgEnum('guest_status', ['pending', 'active', 'blocked']);
export const visibilityEnum = pgEnum('visibility', ['host', 'selected', 'all']);
export const kindEnum = pgEnum('kind', ['photo', 'video']);

export const event = pgTable('event', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  date: text('date'),
  slug: text('slug').notNull().unique(),               // short code in the join QR, e.g. "rohan-7k2x"
  hostPwHash: text('host_pw_hash').notNull(),
  joinOpen: boolean('join_open').notNull().default(true),
  requireApproval: boolean('require_approval').notNull().default(false),

  // Join page custom copy
  joinPageTitle: text('join_page_title'),
  joinPageSubtitle: text('join_page_subtitle'),
  joinPageInstructions: text('join_page_instructions'),
  joinPageJoinButton: text('join_page_join_button'),
  joinPageLoginButton: text('join_page_login_button'),
  joinPageNamePlaceholder: text('join_page_name_placeholder'),
  joinPagePhonePlaceholder: text('join_page_phone_placeholder'),
  joinPagePasswordPlaceholder: text('join_page_password_placeholder'),
  joinPageNameRequired: boolean('join_page_name_required').notNull().default(true),
  joinPagePhoneRequired: boolean('join_page_phone_required').notNull().default(true),
  joinPagePasswordRequired: boolean('join_page_password_required').notNull().default(true),
  joinPagePendingNote: text('join_page_pending_note'),
  joinPageBlockedNote: text('join_page_blocked_note'),
});

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),                       // digits only, with country code
  passwordHash: text('password_hash').notNull(),
  status: guestStatusEnum('status').notNull().default('active'),
  canDownload: boolean('can_download').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at'),
}, (t) => [uniqueIndex('guests_event_phone_idx').on(t.eventId, t.phone)]);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  kind: kindEnum('kind').notNull(),
  path: text('path').notNull(),
  thumbPath: text('thumb_path'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  visibility: visibilityEnum('visibility').notNull().default('host'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const shares = pgTable('shares', {
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.mediaId, t.guestId] })]);

export const guestShares = pgTable('guest_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  title: text('title'),
  isAllMyUploads: boolean('is_all_my_uploads').notNull().default(false),
  passwordHash: text('password_hash'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const guestShareItems = pgTable('guest_share_items', {
  shareId: uuid('share_id').notNull().references(() => guestShares.id, { onDelete: 'cascade' }),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.shareId, t.mediaId] })]);

