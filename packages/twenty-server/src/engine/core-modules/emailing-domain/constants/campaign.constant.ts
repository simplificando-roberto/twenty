export const CAMPAIGN_MESSAGE_DELIVERY_STATUS = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  BOUNCED: 'BOUNCED',
  COMPLAINED: 'COMPLAINED',
  SKIPPED: 'SKIPPED',
} as const;

export const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  SENT_WITH_ERRORS: 'SENT_WITH_ERRORS',
} as const;

export const MATERIALIZE_CAMPAIGN_JOB = 'MaterializeCampaignJob';
export const SEND_CAMPAIGN_EMAIL_JOB = 'SendCampaignEmailJob';
export const REFRESH_CAMPAIGN_STATS_JOB = 'RefreshCampaignStatsJob';

export const CAMPAIGN_STATS_REFRESH_DEBOUNCE_MS = 10_000;
export const CAMPAIGN_STATS_REFRESH_DELAY_MS =
  CAMPAIGN_STATS_REFRESH_DEBOUNCE_MS + 2_000;

export const MAX_CAMPAIGN_RECIPIENTS = 10000;

// Campaign sends are spread over time so a large campaign cannot exceed the
// provider send rate. A fresh AWS SES production account allows ~14 messages
// per second, so this stays deliberately below that.
export const CAMPAIGN_SEND_RATE_PER_SECOND = 8;
export const CAMPAIGN_SEND_INTERVAL_MS = Math.ceil(
  1000 / CAMPAIGN_SEND_RATE_PER_SECOND,
);

export const CAMPAIGN_MESSAGE_ID_NAMESPACE =
  '0c4b9e7a-3f2d-4b6c-9e1a-7d8f5a2c3b4e';
