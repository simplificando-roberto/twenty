import { Injectable, Type } from '@nestjs/common';

import { FeatureFlagKey } from 'twenty-shared/types';
import { MoreThan, Not, IsNull, type ObjectLiteral } from 'typeorm';

import { NO_BILLING_SUBSCRIPTION } from 'src/engine/core-modules/billing/constants/no-billing-subscription.constant';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import {
  CAMPAIGN_DAILY_SEND_LIMIT,
  CAMPAIGN_QUOTA_WINDOW_MS,
} from 'src/engine/core-modules/emailing-domain/constants/campaign.constant';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
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

    const { currentBillingSubscription } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'currentBillingSubscription',
      ]);

    const isTrialing =
      currentBillingSubscription === NO_BILLING_SUBSCRIPTION ||
      currentBillingSubscription.status === SubscriptionStatus.Trialing;

    if (!isTrialing) {
      return CAMPAIGN_DAILY_SEND_LIMIT;
    }

    // Trials send nothing by default: a free trial that can email strangers is
    // the cheapest spam infrastructure there is. Support lifts it per workspace.
    const isTrialSendingEnabled = await this.featureFlagService.isFeatureEnabled(
      FeatureFlagKey.IS_EMAIL_CAMPAIGN_TRIAL_SENDING_ENABLED,
      workspaceId,
    );

    return isTrialSendingEnabled ? CAMPAIGN_DAILY_SEND_LIMIT : 0;
  }

  private async countRecentlySentEmails(workspaceId: string): Promise<number> {
    const messageRepository = await this.getSystemRepository(
      workspaceId,
      MessageWorkspaceEntity,
    );

    return messageRepository.count({
      where: {
        messageCampaignId: Not(IsNull()),
        createdAt: MoreThan(
          new Date(Date.now() - CAMPAIGN_QUOTA_WINDOW_MS).toISOString(),
        ),
      },
    });
  }

  private getSystemRepository<T extends ObjectLiteral>(
    workspaceId: string,
    entity: Type<T>,
  ) {
    return this.globalWorkspaceOrmManager.getRepository(workspaceId, entity, {
      shouldBypassPermissionChecks: true,
    });
  }
}
