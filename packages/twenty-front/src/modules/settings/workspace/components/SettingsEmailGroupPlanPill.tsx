import { useLingui } from '@lingui/react/macro';

import { billingState } from '@/client-config/states/billingState';
import { useCurrentBillingFlags } from '@/settings/billing/hooks/useCurrentBillingFlags';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { Pill } from 'twenty-ui/data-display';
import { IconLock } from 'twenty-ui/icon';

export const SettingsEmailGroupPlanPill = () => {
  const { t } = useLingui();
  const billing = useAtomStateValue(billingState);
  const { isEnterprisePlan } = useCurrentBillingFlags();

  const isBillingEnabled = billing?.isBillingEnabled ?? false;

  // Self-hosted instances unlock this behind an enterprise licence, while cloud
  // workspaces unlock it on their paid plan, so the pill names the actual plan.
  const label =
    !isBillingEnabled || isEnterprisePlan ? t`Enterprise` : t`Pro`;

  return <Pill Icon={IconLock} label={label} />;
};
