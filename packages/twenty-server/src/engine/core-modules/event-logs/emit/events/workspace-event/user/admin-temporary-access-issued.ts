import { z } from 'zod';

import { registerEvent } from 'src/engine/core-modules/event-logs/emit/events/workspace-event/track';

export const ADMIN_TEMPORARY_ACCESS_ISSUED_EVENT =
  'Admin Temporary Access Issued' as const;

export const adminTemporaryAccessIssuedSchema = z.strictObject({
  event: z.literal(ADMIN_TEMPORARY_ACCESS_ISSUED_EVENT),
  properties: z.strictObject({
    targetUserId: z.string().uuid(),
  }),
});

export type AdminTemporaryAccessIssuedTrackEvent = z.infer<
  typeof adminTemporaryAccessIssuedSchema
>;

registerEvent(
  ADMIN_TEMPORARY_ACCESS_ISSUED_EVENT,
  adminTemporaryAccessIssuedSchema,
);
