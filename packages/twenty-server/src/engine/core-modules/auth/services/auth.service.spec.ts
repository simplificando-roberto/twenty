import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { type EntityManager, type Repository } from 'typeorm';

import {
  AppTokenEntity,
  AppTokenType,
} from 'src/engine/core-modules/app-token/app-token.entity';
import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AuthSsoService } from 'src/engine/core-modules/auth/services/auth-sso.service';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { LoginTokenService } from 'src/engine/core-modules/auth/token/services/login-token.service';
import { RefreshTokenService } from 'src/engine/core-modules/auth/token/services/refresh-token.service';
import { WorkspaceAgnosticTokenService } from 'src/engine/core-modules/auth/token/services/workspace-agnostic-token.service';
import { type ExistingUserOrNewUser } from 'src/engine/core-modules/auth/types/signInUp.type';
import { DomainServerConfigService } from 'src/engine/core-modules/domain/domain-server-config/services/domain-server-config.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceInvitationService } from 'src/engine/core-modules/workspace-invitation/services/workspace-invitation.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { ApplicationRegistrationService } from 'src/engine/core-modules/application/application-registration/application-registration.service';
import { CreateSSOConnectedAccountService } from 'src/engine/core-modules/auth/services/create-sso-connected-account.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

import { AuthService } from './auth.service';

jest.mock('bcrypt');

const twentyConfigServiceGetMock = jest.fn();

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let workspaceRepository: Repository<WorkspaceEntity>;
  let userRepository: Repository<UserEntity>;
  let authSsoService: AuthSsoService;
  let userWorkspaceService: UserWorkspaceService;
  let workspaceInvitationService: WorkspaceInvitationService;
  let permissionsService: PermissionsService;
  let signInUpServiceMock: jest.Mocked<
    Pick<SignInUpService, 'validatePassword'>
  >;
  let eventLogEmitterService: EventLogEmitterService;
  let transactionManager: jest.Mocked<Pick<EntityManager, 'save' | 'update'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            create: jest.fn((input) => input),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            manager: {
              transaction: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(AppTokenEntity),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockImplementation(() => null),
            }),
            update: jest.fn(),
          },
        },
        {
          provide: LoginTokenService,
          useValue: {},
        },
        {
          provide: WorkspaceDomainsService,
          useValue: {},
        },
        {
          provide: DomainServerConfigService,
          useValue: {
            getBaseUrl: jest.fn().mockReturnValue(new URL('https://crm.test')),
          },
        },
        {
          provide: WorkspaceAgnosticTokenService,
          useValue: {},
        },
        {
          provide: GuardRedirectService,
          useValue: {},
        },
        {
          provide: SignInUpService,
          useValue: {
            validatePassword: jest.fn().mockResolvedValue(undefined),
            generateHash: jest.fn(),
          },
        },
        {
          provide: TwentyConfigService,
          useValue: {
            get: twentyConfigServiceGetMock,
          },
        },
        {
          provide: EmailService,
          useValue: { send: jest.fn() },
        },
        {
          provide: AccessTokenService,
          useValue: {},
        },
        {
          provide: RefreshTokenService,
          useValue: {},
        },
        {
          provide: UserWorkspaceService,
          useValue: {
            checkUserWorkspaceExists: jest.fn(),
            addUserToWorkspaceIfUserNotInWorkspace: jest.fn(),
            validateRoleForNewMember: jest.fn(),
            findAvailableWorkspacesByEmail: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            hasUserAccessToWorkspaceOrThrow: jest.fn(),
            deleteUser: jest.fn(),
            findUserByIdOrThrow: jest.fn(),
            findUserByEmail: jest.fn(),
          },
        },
        {
          provide: WorkspaceInvitationService,
          useValue: {
            getOneWorkspaceInvitation: jest.fn(),
            invalidateWorkspaceInvitation: jest.fn(),
            validatePersonalInvitation: jest.fn(),
          },
        },
        {
          provide: AuthSsoService,
          useValue: {
            findWorkspaceFromWorkspaceIdOrAuthProvider: jest.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            getI18nInstance: jest.fn().mockReturnValue({
              _: jest.fn().mockReturnValue('mocked-translation'),
            }),
          },
        },
        {
          provide: EventLogEmitterService,
          useValue: {
            createContext: jest.fn().mockReturnValue({
              insertWorkspaceEvent: jest.fn(),
            }),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            userHasWorkspaceSettingPermission: jest
              .fn()
              .mockResolvedValue(false),
          },
        },
        {
          provide: ApplicationRegistrationService,
          useValue: {},
        },
        {
          provide: FeatureFlagService,
          useValue: {
            isFeatureEnabled: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: CreateSSOConnectedAccountService,
          useValue: {
            createOrUpdateSSOConnectedAccount: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    workspaceInvitationService = module.get<WorkspaceInvitationService>(
      WorkspaceInvitationService,
    );
    authSsoService = module.get<AuthSsoService>(AuthSsoService);
    userWorkspaceService =
      module.get<UserWorkspaceService>(UserWorkspaceService);
    workspaceRepository = module.get<Repository<WorkspaceEntity>>(
      getRepositoryToken(WorkspaceEntity),
    );
    userRepository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    permissionsService = module.get<PermissionsService>(PermissionsService);
    eventLogEmitterService = module.get<EventLogEmitterService>(
      EventLogEmitterService,
    );
    signInUpServiceMock = module.get(SignInUpService) as jest.Mocked<
      Pick<SignInUpService, 'validatePassword'>
    >;

    transactionManager = {
      save: jest.fn(),
      update: jest.fn(),
    };
    userRepository.manager.transaction = (async <T>(
      callback: (entityManager: EntityManager) => Promise<T>,
    ) =>
      callback(
        transactionManager as unknown as EntityManager,
      )) as EntityManager['transaction'];
  });

  beforeEach(() => {
    twentyConfigServiceGetMock.mockReturnValue(false);
    signInUpServiceMock.validatePassword.mockClear();
  });

  it('should be defined', async () => {
    expect(service).toBeDefined();
  });

  describe('issueAdminTemporaryAccess', () => {
    it('rotates credentials, revokes sessions and only persists the reset token hash', async () => {
      twentyConfigServiceGetMock.mockImplementation((key) =>
        key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN' ? '1h' : false,
      );
      jest
        .spyOn(userService, 'findUserByIdOrThrow')
        .mockResolvedValue({ id: 'target-user-id' } as UserEntity);

      const result = await service.issueAdminTemporaryAccess({
        actorUserId: 'actor-user-id',
        targetUserId: 'target-user-id',
        workspaceId: 'workspace-id',
      });

      expect(userService.hasUserAccessToWorkspaceOrThrow).toHaveBeenCalledWith(
        'target-user-id',
        'workspace-id',
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        UserEntity,
        'target-user-id',
        expect.objectContaining({ mustChangePassword: true }),
      );
      expect(transactionManager.save).toHaveBeenCalledWith(
        AppTokenEntity,
        expect.objectContaining({
          userId: 'target-user-id',
          workspaceId: 'workspace-id',
          type: AppTokenType.PasswordResetToken,
          value: crypto
            .createHash('sha256')
            .update(result.passwordResetToken)
            .digest('hex'),
        }),
      );
      expect(transactionManager.update).toHaveBeenCalledTimes(3);
      expect(result.passwordResetToken).toHaveLength(64);
      expect(eventLogEmitterService.createContext).toHaveBeenCalledWith({
        workspaceId: 'workspace-id',
        userId: 'actor-user-id',
      });
    });

    it('rejects a target outside the authenticated workspace', async () => {
      jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockRejectedValue(new Error('Access denied'));

      await expect(
        service.issueAdminTemporaryAccess({
          actorUserId: 'actor-user-id',
          targetUserId: 'target-user-id',
          workspaceId: 'workspace-id',
        }),
      ).rejects.toThrow('Access denied');

      expect(userRepository.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('provisionTemporaryWorkspaceMember', () => {
    it('refuses to overwrite a global user resolved only by email', async () => {
      jest.spyOn(userService, 'findUserByEmail').mockResolvedValue({
        id: 'existing-user-id',
        email: 'member@example.com',
      } as UserEntity);

      await expect(
        service.provisionTemporaryWorkspaceMember({
          actorUserId: 'actor-user-id',
          email: 'member@example.com',
          roleId: 'role-id',
          workspace: { id: 'workspace-id' } as WorkspaceEntity,
        }),
      ).rejects.toMatchObject({ code: AuthExceptionCode.USER_ALREADY_EXISTS });

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('creates a new member with the requested role before issuing access', async () => {
      twentyConfigServiceGetMock.mockImplementation((key) =>
        key === 'PASSWORD_RESET_TOKEN_EXPIRES_IN' ? '1h' : false,
      );
      jest.spyOn(userService, 'findUserByEmail').mockResolvedValue(null);
      jest.spyOn(userRepository, 'save').mockResolvedValue({
        id: 'new-user-id',
        email: 'member@example.com',
      } as UserEntity);
      jest
        .spyOn(userService, 'findUserByIdOrThrow')
        .mockResolvedValue({ id: 'new-user-id' } as UserEntity);

      const result = await service.provisionTemporaryWorkspaceMember({
        actorUserId: 'actor-user-id',
        email: 'Member@Example.com',
        roleId: 'role-id',
        workspace: { id: 'workspace-id' } as WorkspaceEntity,
      });

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'member@example.com',
          mustChangePassword: true,
          canImpersonate: false,
          canAccessFullAdminPanel: false,
        }),
      );
      expect(
        userWorkspaceService.validateRoleForNewMember,
      ).toHaveBeenCalledWith(
        'role-id',
        expect.objectContaining({ id: 'workspace-id' }),
      );
      expect(
        userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-user-id' }),
        expect.objectContaining({ id: 'workspace-id' }),
        'role-id',
      );
      expect(result.targetUserId).toBe('new-user-id');
      expect(
        workspaceInvitationService.invalidateWorkspaceInvitation,
      ).toHaveBeenCalledWith('workspace-id', 'member@example.com');
    });

    it('removes the newly created global user if membership creation fails', async () => {
      jest.spyOn(userService, 'findUserByEmail').mockResolvedValue(null);
      jest.spyOn(userRepository, 'save').mockResolvedValue({
        id: 'new-user-id',
        email: 'member@example.com',
      } as UserEntity);
      jest
        .spyOn(userWorkspaceService, 'addUserToWorkspaceIfUserNotInWorkspace')
        .mockRejectedValue(new Error('Membership failed'));

      await expect(
        service.provisionTemporaryWorkspaceMember({
          actorUserId: 'actor-user-id',
          email: 'member@example.com',
          roleId: 'role-id',
          workspace: { id: 'workspace-id' } as WorkspaceEntity,
        }),
      ).rejects.toThrow('Membership failed');

      expect(userService.deleteUser).toHaveBeenCalledWith('new-user-id');
    });
  });

  it('blocks token issuance while a password change is required', async () => {
    jest.spyOn(userService, 'findUserByEmail').mockResolvedValue({
      id: 'target-user-id',
      email: 'member@example.com',
      mustChangePassword: true,
    } as UserEntity);

    await expect(
      service.verify(
        'member@example.com',
        'workspace-id',
        AuthProviderEnum.Password,
      ),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  it('challenge - user already member of workspace', async () => {
    const workspace = { isPasswordAuthEnabled: true } as WorkspaceEntity;
    const user = {
      email: 'email',
      password: 'password',
      captchaToken: 'captchaToken',
    };

    (bcrypt.compare as jest.Mock).mockReturnValueOnce(true);

    jest.spyOn(userRepository, 'findOne').mockReturnValueOnce({
      email: user.email,
      passwordHash: 'passwordHash',
      captchaToken: user.captchaToken,
    } as unknown as Promise<UserEntity>);

    jest
      .spyOn(userWorkspaceService, 'checkUserWorkspaceExists')
      .mockReturnValueOnce({} as any);

    const response = await service.validateLoginWithPassword(
      {
        email: 'email',
        password: 'password',
        captchaToken: 'captchaToken',
      },
      workspace,
    );

    expect(response).toStrictEqual({
      email: user.email,
      passwordHash: 'passwordHash',
      captchaToken: user.captchaToken,
    });
  });

  it('allows password login through SSO bypass when user has permission', async () => {
    const workspace = {
      id: 'workspace-id',
      isPasswordAuthEnabled: false,
      isPasswordAuthBypassEnabled: true,
    } as WorkspaceEntity;

    const userEntity = {
      id: 'user-id',
      email: 'email',
      passwordHash: 'password-hash',
      userWorkspaces: [
        {
          id: 'user-workspace-id',
          workspaceId: workspace.id,
        } as any,
      ],
    } as unknown as UserEntity;

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(userEntity);
    jest
      .spyOn(userWorkspaceService, 'checkUserWorkspaceExists')
      .mockResolvedValueOnce({ id: 'user-workspace-id' } as any);
    jest
      .spyOn(permissionsService, 'userHasWorkspaceSettingPermission')
      .mockResolvedValueOnce(true);

    const response = await service.validateLoginWithPassword(
      {
        email: 'email',
        password: 'password',
        captchaToken: 'captcha-token',
      },
      workspace,
    );

    expect(response).toBe(userEntity);
  });

  it('throws when bypass permission is missing for disabled password auth', async () => {
    const workspace = {
      id: 'workspace-id',
      isPasswordAuthEnabled: false,
      isPasswordAuthBypassEnabled: true,
    } as WorkspaceEntity;

    const userEntity = {
      id: 'user-id',
      email: 'email',
      passwordHash: 'password-hash',
      userWorkspaces: [
        {
          id: 'user-workspace-id',
          workspaceId: workspace.id,
        } as any,
      ],
    } as unknown as UserEntity;

    jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(userEntity);
    jest
      .spyOn(userWorkspaceService, 'checkUserWorkspaceExists')
      .mockResolvedValueOnce(null);
    jest
      .spyOn(permissionsService, 'userHasWorkspaceSettingPermission')
      .mockResolvedValueOnce(false);

    await expect(
      service.validateLoginWithPassword(
        {
          email: 'email',
          password: 'password',
          captchaToken: 'captcha-token',
        },
        workspace,
      ),
    ).rejects.toThrow(
      new AuthException(
        'Email/Password auth is not enabled for this workspace',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      ),
    );
    expect(signInUpServiceMock.validatePassword).not.toHaveBeenCalled();
  });

  it('challenge - user who have an invitation', async () => {
    const user = {
      email: 'email',
      password: 'password',
      captchaToken: 'captchaToken',
    };

    const UserFindOneSpy = jest
      .spyOn(userRepository, 'findOne')
      .mockReturnValueOnce({
        email: user.email,
        passwordHash: 'passwordHash',
        captchaToken: user.captchaToken,
      } as unknown as Promise<UserEntity>);

    (bcrypt.compare as jest.Mock).mockReturnValueOnce(true);
    jest
      .spyOn(userWorkspaceService, 'checkUserWorkspaceExists')
      .mockReturnValueOnce(null as any);

    const getOneWorkspaceInvitationSpy = jest
      .spyOn(workspaceInvitationService, 'getOneWorkspaceInvitation')
      .mockReturnValueOnce({} as any);

    const workspaceInvitationValidatePersonalInvitationSpy = jest
      .spyOn(workspaceInvitationService, 'validatePersonalInvitation')
      .mockReturnValueOnce({} as any);

    const addUserToWorkspaceIfUserNotInWorkspaceSpy = jest
      .spyOn(userWorkspaceService, 'addUserToWorkspaceIfUserNotInWorkspace')
      .mockReturnValueOnce({} as any);

    const response = await service.validateLoginWithPassword(
      {
        email: 'email',
        password: 'password',
        captchaToken: 'captchaToken',
      },
      {
        isPasswordAuthEnabled: true,
      } as WorkspaceEntity,
    );

    expect(response).toStrictEqual({
      email: user.email,
      passwordHash: 'passwordHash',
      captchaToken: user.captchaToken,
    });

    expect(getOneWorkspaceInvitationSpy).toHaveBeenCalledTimes(1);
    expect(
      workspaceInvitationValidatePersonalInvitationSpy,
    ).toHaveBeenCalledTimes(1);
    expect(addUserToWorkspaceIfUserNotInWorkspaceSpy).toHaveBeenCalledTimes(1);
    expect(UserFindOneSpy).toHaveBeenCalledTimes(1);
  });

  describe('checkAccessForSignIn', () => {
    it('checkAccessForSignIn - allow signin for existing user who target a workspace with right access', async () => {
      const spy = jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockResolvedValue();

      await service.checkAccessForSignIn({
        userData: {
          type: 'existingUser',
          existingUser: {
            id: 'user-id',
          },
        } as ExistingUserOrNewUser['userData'],
        invitation: undefined,
        workspaceInviteHash: undefined,
        workspace: {
          id: 'workspace-id',
          isPublicInviteLinkEnabled: true,
          approvedAccessDomains: [],
        } as unknown as WorkspaceEntity,
      });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('checkAccessForSignIn - trigger error on existing user signin in unauthorized workspace', async () => {
      const spy = jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockRejectedValue(new Error('Access denied'));

      await expect(
        service.checkAccessForSignIn({
          userData: {
            type: 'existingUser',
            existingUser: {
              id: 'user-id',
            },
          } as ExistingUserOrNewUser['userData'],
          invitation: undefined,
          workspaceInviteHash: undefined,
          workspace: {
            id: 'workspace-id',
            isPublicInviteLinkEnabled: true,
            approvedAccessDomains: [],
          } as unknown as WorkspaceEntity,
        }),
      ).rejects.toThrow(new Error('Access denied'));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('checkAccessForSignIn - trigger an error when a user attempts to sign up using a public link in a workspace where public links are disabled', async () => {
      const spy = jest.spyOn(userService, 'hasUserAccessToWorkspaceOrThrow');

      await expect(
        service.checkAccessForSignIn({
          userData: {
            type: 'existingUser',
            existingUser: {
              id: 'user-id',
            },
          } as ExistingUserOrNewUser['userData'],
          invitation: undefined,
          workspaceInviteHash: 'workspaceInviteHash',
          workspace: {
            id: 'workspace-id',
            isPublicInviteLinkEnabled: false,
            approvedAccessDomains: [],
          } as unknown as WorkspaceEntity,
        }),
      ).rejects.toThrow(
        new AuthException(
          'Public invite link is disabled for this workspace',
          AuthExceptionCode.FORBIDDEN_EXCEPTION,
        ),
      );

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it("checkAccessForSignIn - allow signup for new user who don't target a workspace", async () => {
      const spy = jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockResolvedValue();

      await service.checkAccessForSignIn({
        userData: {
          type: 'newUser',
          newUserPayload: {},
        } as ExistingUserOrNewUser['userData'],
        invitation: undefined,
        workspaceInviteHash: undefined,
        workspace: undefined,
      });

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it("checkAccessForSignIn - allow signup for existing user who don't target a workspace", async () => {
      const spy = jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockResolvedValue();

      await service.checkAccessForSignIn({
        userData: {
          type: 'existingUser',
          existingUser: {
            id: 'user-id',
          },
        } as ExistingUserOrNewUser['userData'],
        invitation: undefined,
        workspaceInviteHash: undefined,
        workspace: undefined,
      });

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('checkAccessForSignIn - allow signup for new user who target a workspace with invitation', async () => {
      const spy = jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockResolvedValue();

      await service.checkAccessForSignIn({
        userData: {
          type: 'existingUser',
          existingUser: {
            id: 'user-id',
          },
        } as ExistingUserOrNewUser['userData'],
        invitation: {} as AppTokenEntity,
        workspaceInviteHash: undefined,
        workspace: { approvedAccessDomains: [] } as unknown as WorkspaceEntity,
      });

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('checkAccessForSignIn - allow signup for new user who target a workspace with public invitation', async () => {
      const spy = jest
        .spyOn(userService, 'hasUserAccessToWorkspaceOrThrow')
        .mockResolvedValue();

      await service.checkAccessForSignIn({
        userData: {
          type: 'newUser',
          newUserPayload: {},
        } as ExistingUserOrNewUser['userData'],
        invitation: undefined,
        workspaceInviteHash: 'workspaceInviteHash',
        workspace: {
          isPublicInviteLinkEnabled: true,
          approvedAccessDomains: [],
        } as unknown as WorkspaceEntity,
      });

      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('checkAccessForSignIn - allow signup for new user who target a workspace with valid trusted domain', async () => {
      expect(async () => {
        await service.checkAccessForSignIn({
          userData: {
            type: 'newUser',
            newUserPayload: {
              email: 'email@domain.com',
            },
          } as ExistingUserOrNewUser['userData'],
          invitation: undefined,
          workspaceInviteHash: 'workspaceInviteHash',
          workspace: {
            isPublicInviteLinkEnabled: true,
            approvedAccessDomains: [
              { domain: 'domain.com', isValidated: true },
            ],
          } as unknown as WorkspaceEntity,
        });
      }).not.toThrow();
    });
  });

  describe('findWorkspaceForSignInUp', () => {
    it('findWorkspaceForSignInUp - signup password auth', async () => {
      const spyWorkspaceRepository = jest.spyOn(workspaceRepository, 'findOne');
      const spyAuthSsoService = jest.spyOn(
        authSsoService,
        'findWorkspaceFromWorkspaceIdOrAuthProvider',
      );

      const result = await service.findWorkspaceForSignInUp({
        authProvider: AuthProviderEnum.Password,
        workspaceId: 'workspaceId',
      });

      expect(result).toBeUndefined();
      expect(spyWorkspaceRepository).toHaveBeenCalledTimes(1);
      expect(spyAuthSsoService).toHaveBeenCalledTimes(0);
    });
    it('findWorkspaceForSignInUp - signup password auth with workspaceInviteHash', async () => {
      const spyWorkspaceRepository = jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValue({
          approvedAccessDomains: [],
        } as unknown as WorkspaceEntity);
      const spyAuthSsoService = jest.spyOn(
        authSsoService,
        'findWorkspaceFromWorkspaceIdOrAuthProvider',
      );

      const result = await service.findWorkspaceForSignInUp({
        authProvider: AuthProviderEnum.Password,
        workspaceId: 'workspaceId',
        workspaceInviteHash: 'workspaceInviteHash',
      });

      expect(result).toBeDefined();
      expect(spyWorkspaceRepository).toHaveBeenCalledTimes(1);
      expect(spyAuthSsoService).toHaveBeenCalledTimes(0);
    });
    it('findWorkspaceForSignInUp - signup social sso auth with workspaceInviteHash', async () => {
      const spyWorkspaceRepository = jest
        .spyOn(workspaceRepository, 'findOne')
        .mockResolvedValue({
          approvedAccessDomains: [],
        } as unknown as WorkspaceEntity);
      const spyAuthSsoService = jest.spyOn(
        authSsoService,
        'findWorkspaceFromWorkspaceIdOrAuthProvider',
      );

      const result = await service.findWorkspaceForSignInUp({
        authProvider: AuthProviderEnum.Password,
        workspaceId: 'workspaceId',
        workspaceInviteHash: 'workspaceInviteHash',
      });

      expect(result).toBeDefined();
      expect(spyWorkspaceRepository).toHaveBeenCalledTimes(1);
      expect(spyAuthSsoService).toHaveBeenCalledTimes(0);
    });
    it('findWorkspaceForSignInUp - signup social sso auth', async () => {
      const spyWorkspaceRepository = jest.spyOn(workspaceRepository, 'findOne');

      const spyAuthSsoService = jest
        .spyOn(authSsoService, 'findWorkspaceFromWorkspaceIdOrAuthProvider')
        .mockResolvedValue({} as WorkspaceEntity);

      const result = await service.findWorkspaceForSignInUp({
        authProvider: AuthProviderEnum.Google,
        workspaceId: 'workspaceId',
        email: 'email',
      });

      expect(result).toBeDefined();
      expect(spyWorkspaceRepository).toHaveBeenCalledTimes(0);
      expect(spyAuthSsoService).toHaveBeenCalledTimes(1);
    });
    it('findWorkspaceForSignInUp - sso auth', async () => {
      const spyWorkspaceRepository = jest.spyOn(workspaceRepository, 'findOne');

      const spyAuthSsoService = jest
        .spyOn(authSsoService, 'findWorkspaceFromWorkspaceIdOrAuthProvider')
        .mockResolvedValue({} as WorkspaceEntity);

      const result = await service.findWorkspaceForSignInUp({
        authProvider: AuthProviderEnum.SSO,
        workspaceId: 'workspaceId',
        email: 'email',
      });

      expect(result).toBeDefined();
      expect(spyWorkspaceRepository).toHaveBeenCalledTimes(0);
      expect(spyAuthSsoService).toHaveBeenCalledTimes(1);
    });
  });
});
