import * as dns from 'dns/promises';

import { type VerificationRecord } from 'src/engine/core-modules/emailing-domain/drivers/types/verifications-record';

const RECOMMENDED_DMARC_VALUE = 'v=DMARC1; p=none;';

const resolveTxtRecords = async (
  hostname: string,
  resolveTxt: typeof dns.resolveTxt,
): Promise<string[]> => {
  try {
    const records = await resolveTxt(hostname);

    return records.map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
};

// Microsoft rejects bulk senders above 5k/day without DMARC, and Gmail and
// Yahoo require it outright, so it is surfaced next to the provider's own
// records rather than being checked only at send time.
export const buildEmailAuthenticationRecords = async (
  domain: string,
  resolveTxt: typeof dns.resolveTxt = dns.resolveTxt,
): Promise<VerificationRecord[]> => {
  const [dmarcRecords, spfRecords] = await Promise.all([
    resolveTxtRecords(`_dmarc.${domain}`, resolveTxt),
    resolveTxtRecords(domain, resolveTxt),
  ]);

  const publishedDmarcRecord = dmarcRecords.find((record) =>
    record.trim().toLowerCase().startsWith('v=dmarc1'),
  );

  const publishedSpfRecord = spfRecords.find((record) =>
    record.trim().toLowerCase().startsWith('v=spf1'),
  );

  return [
    {
      type: 'TXT',
      key: `_dmarc.${domain}`,
      value: publishedDmarcRecord ?? RECOMMENDED_DMARC_VALUE,
      status: publishedDmarcRecord === undefined ? 'pending' : 'success',
    },
    {
      type: 'TXT',
      key: domain,
      value: publishedSpfRecord ?? 'v=spf1 include:amazonses.com ~all',
      status: publishedSpfRecord === undefined ? 'pending' : 'success',
    },
  ];
};
