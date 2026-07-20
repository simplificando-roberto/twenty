export const buildUnsubscribeTextFooter = (
  webUrl: string,
  senderPostalAddress?: string | null,
): string =>
  `\n\n--\nUnsubscribe: ${webUrl}` +
  (senderPostalAddress ? `\n${senderPostalAddress}` : '');
