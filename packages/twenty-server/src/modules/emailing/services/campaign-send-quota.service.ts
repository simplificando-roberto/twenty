import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FeatureFlagKey } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { MoreThan, Not, IsNull, Repository } from 'typeorm';

import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import {
  MAX_CAMPAIGN_EMAILS_SENDABLE,
  MAX_CAMPAIGN_EMAILS_SENDABLE_UNVERIFIED,
  CAMPAIGN_QUOTA_WINDOW_MS,
} from 'src/engine/core-modules/emailing-domain/constants/campaign.constant';
import { EmailingDomainStatus } from 'src/engine/core-modules/emailing-domain/drivers/types/emailing-domain-status.type';
import { EmailingDomainEntity } from 'src/engine/core-modules/emailing-domain/emailing-domain.entity';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

export type CampaignSendQuota = {
  dailyLimit: number;
  used: number;
  remaining: number;
};

@Injectable()
export class CampaignSendQuotaService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly billingService: BillingService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly featureFlagService: FeatureFlagService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectWorkspaceScopedRepository(EmailingDomainEntity)
    private readonly emailingDomainRepository: WorkspaceScopedRepository<EmailingDomainEntity>,
  ) {}

  async getQuota(workspaceId: string): Promise<CampaignSendQuota> {
    const dailyLimit = await this.getDailyLimit(workspaceId);
    const used = await this.countRecentlySentEmails(workspaceId);

    return { dailyLimit, used, remaining: Math.max(0, dailyLimit - used) };
  }

  private async getDailyLimit(workspaceId: string): Promise<number> {
    if (!this.billingService.isBillingEnabled()) {
      return Number.POSITIVE_INFINITY;
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, messageCampaignDailySendLimit: true },
    });

    // An admin panel override outranks every tier, so support can raise a
    // workspace without waiting on a release.
    if (isDefined(workspace?.messageCampaignDailySendLimit)) {
      return workspace.messageCampaignDailySendLimit;
    }

    const { currentBillingSubscription } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'currentBillingSubscription',
      ]);

    const isTrialing =
      currentBillingSubscription === NO_BILLING_SUBSCRIPTION ||
      currentBillingSubscription.status === SubscriptionStatus.Trialing;

    if (isTrialing) {
      // Trials send nothing by default: a free trial that can email strangers
      // is the cheapest spam infrastructure there is.
      const isTrialSendingEnabled =
        await this.featureFlagService.isFeatureEnabled(
          FeatureFlagKey.IS_EMAIL_CAMPAIGN_TRIAL_SENDING_ENABLED,
          workspaceId,
        );

      if (!isTrialSendingEnabled) {
        return 0;
      }
    }

    const verifiedDomainCount = await this.emailingDomainRepository.count(
      workspaceId,
      { where: { status: EmailingDomainStatus.VERIFIED } },
    );

    return verifiedDomainCount > 0
      ? MAX_CAMPAIGN_EMAILS_SENDABLE
      : MAX_CAMPAIGN_EMAILS_SENDABLE_UNVERIFIED;
  }

  private async countRecentlySentEmails(workspaceId: string): Promise<number> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const messageRepository =
          await this.globalWorkspaceOrmManager.getRepository(
            workspaceId,
            MessageWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

        return messageRepository.count({
          where: {
            messageCampaignId: Not(IsNull()),
            createdAt: MoreThan(
              new Date(Date.now() - CAMPAIGN_QUOTA_WINDOW_MS).toISOString(),
            ),
          },
        });
      },
      buildSystemAuthContext(workspaceId),
    );
  }
}
