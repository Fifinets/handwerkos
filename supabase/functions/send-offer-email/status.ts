export const createSentOfferUpdate = (nowIso = new Date().toISOString()) => ({
  status: "sent" as const,
  sent_at: nowIso,
  share_token_created_at: nowIso,
});

export const createReminderOfferUpdate = (
  currentFollowupCount: number,
  nowIso = new Date().toISOString()
) => ({
  last_followup_at: nowIso,
  followup_count: currentFollowupCount + 1,
});
