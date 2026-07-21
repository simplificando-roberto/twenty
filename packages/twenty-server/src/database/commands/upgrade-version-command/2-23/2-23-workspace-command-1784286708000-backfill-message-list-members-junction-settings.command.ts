import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

// messageList.members points at the messageListMember junction. Without junction
// settings on the field, the record page renders a plain relation card over the
// junction rows, so members can be listed but never picked or added. The standard
// definition already carries junctionTargetFieldUniversalIdentifier, but standard
// field metadata is only written at workspace creation, so workspaces created
// before it was added are stuck with the unusable card.
const MESSAGE_LIST_MEMBERS_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.messageList.fields.members.universalIdentifier;

@RegisteredWorkspaceCommand('2.23.0', 1784286708000)
@Command({
  name: 'upgrade:2-23:backfill-message-list-members-junction-settings',
  description:
    'Backfills junction settings on the message list members field so members can be added from the list record page',
})
export class BackfillMessageListMembersJunctionSettingsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatFieldMetadataMaps: existingFlatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatFieldMetadataMaps',
      ]);

    const existingMembersField =
      existingFlatFieldMetadataMaps.byUniversalIdentifier[
        MESSAGE_LIST_MEMBERS_UNIVERSAL_IDENTIFIER
      ];

    if (!isDefined(existingMembersField)) {
      this.logger.log(
        `Message list members field not found for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const existingSettings = (existingMembersField.universalSettings ??
      {}) as Record<string, unknown>;

    if (
      isDefined(existingSettings.junctionTargetFieldUniversalIdentifier) ||
      isDefined(existingSettings.junctionTargetFieldId)
    ) {
      this.logger.log(
        `Message list members junction settings already set for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const now = new Date().toISOString();

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now,
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const standardMembersField =
      standardAllFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier[
        MESSAGE_LIST_MEMBERS_UNIVERSAL_IDENTIFIER
      ];

    if (!isDefined(standardMembersField)) {
      this.logger.warn(
        `Message list members field missing from the standard application for workspace ${workspaceId}`,
      );

      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would backfill message list members junction settings for workspace ${workspaceId}`,
      );

      return;
    }

    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: [
                {
                  ...existingMembersField,
                  universalSettings: standardMembersField.universalSettings,
                  updatedAt: now,
                },
              ],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          isSystemBuild: true,
        },
      );

    if (result.status === 'fail') {
      this.logger.error(
        `Failed to backfill message list members junction settings:\n${JSON.stringify(result, null, 2)}`,
      );

      throw new Error(
        `Failed to backfill message list members junction settings for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Backfilled message list members junction settings for workspace ${workspaceId}`,
    );
  }
}
