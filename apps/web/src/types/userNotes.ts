import { z } from 'zod';

/**
 * Schema for UserNote entity
 */
export const UserNoteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  note: z.string(),
  createdById: z.string(),
  creatorFirstName: z.string().optional(),
  creatorLastName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

/**
 * UserNote type derived from the schema
 */
export type UserNote = z.infer<typeof UserNoteSchema>;
export const UserNotesArraySchema = z.array(UserNoteSchema);

/**
 * Schema for creating a new user note
 */
export const CreateUserNoteSchema = z.object({
  note: z.string().min(1).max(1024)
});

/**
 * CreateUserNoteDTO type derived from the schema
 */
export type CreateUserNoteDTO = z.infer<typeof CreateUserNoteSchema>;