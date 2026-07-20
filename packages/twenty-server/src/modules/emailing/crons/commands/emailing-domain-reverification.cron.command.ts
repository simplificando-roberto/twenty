import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  EMAILING_DOMAIN_REVERIFICATION_CRON_PATTERN,
  EmailingDomainReverificationCronJob,
} from 'src/modules/emailing/crons/jobs/emailing-domain-reverification.cron.job';

@Command({
  name: 'cron:emailing:domain-reverification',
  description:
    'Starts a cron job to periodically re-verify sending domains so a stale verified status cannot keep sending',
})
export class EmailingDomainReverificationCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: EmailingDomainReverificationCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: EMAILING_DOMAIN_REVERIFICATION_CRON_PATTERN,
        },
      },
    });
  }
}
