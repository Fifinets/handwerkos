export const createSentOfferUpdate = (nowIso = new Date().toISOString()) => ({
  status: "sent" as const,
  sent_at: nowIso,
  share_token_created_at: nowIso,
});
