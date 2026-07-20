import { InjectRepository } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Raw, Repository } from 'typeorm';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { EmailingDomainEntity } from 'src/engine/core-modules/emailing-domain/emailing-domain.entity';
import { EmailingDomainService } from 'src/engine/core-modules/emailing-domain/services/emailing-domain.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

export const EMAILING_DOMAIN_REVERIFICATION_CRON_PATTERN = '0 * * * *';

// A sending domain is verified once and then trusted forever. If its DKIM
// records are removed, or the Cloudflare unsubscribe hostname stops resolving,
// nothing notices and the workspace keeps sending on a stale VERIFIED status.
// Re-verify periodically. Workspaces are sharded across the 24 hourly runs by
// their creation hour, the same way custom domains are re-checked, so the
// provider APIs never see the whole estate at once.
@Processor(MessageQueue.cronQueue)
export class EmailingDomainReverificationCronJob {
  private readonly logger = new Logger(
    EmailingDomainReverificationCronJob.name,
  );

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(EmailingDomainEntity)
    private readonly emailingDomainRepository: Repository<EmailingDomainEntity>,
    private readonly emailingDomainService: EmailingDomainService,
  ) {}

  @Process(EmailingDomainReverificationCronJob.name)
  @SentryCronMonitor(
    EmailingDomainReverificationCronJob.name,
    EMAILING_DOMAIN_REVERIFICATION_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const workspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
        createdAt: Raw(
          (alias) => `EXTRACT(HOUR FROM ${alias}) = EXTRACT(HOUR FROM NOW())`,
        ),
      },
      select: ['id'],
    });

    for (const workspace of workspaces) {
      const emailingDomains = await this.emailingDomainRepository.find({
        where: { workspaceId: workspace.id },
        select: ['id'],
      });

      for (const emailingDomain of emailingDomains) {
        try {
          await this.emailingDomainService.verifyEmailingDomain(
            workspace,
            emailingDomain.id,
          );
        } catch (error) {
          // One unreachable domain must not stop the rest of the estate.
          this.logger.error(
            `[${EmailingDomainReverificationCronJob.name}] Cannot re-verify emailing domain ${emailingDomain.id} for workspace ${workspace.id}: ${error.message}`,
          );
        }
      }
    }
  }
}
