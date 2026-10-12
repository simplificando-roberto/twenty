# Nightly dependency migrations, 2026-10-12

The recovery continues PR #9. Its input is the existing 353-alert GitHub snapshot; the report records vulnerable ranges and every candidate lock version. This is dependency evidence, not a successful CI scan or runtime approval.

| Migration | Compatibility work | Jenkins verification needed |
| --- | --- | --- |
| Sharp 0.35.5 | Upgrade direct SDK/seed ranges and scope pins to each locked parent. Node 24 satisfies the new minimum. | Native images, SDK/app packaging, favicons and Next image optimization. |
| simple-git 4.0.2 | Yeoman uses the supported named `simpleGit` import. This release includes argv-parser 2.0.1. No unsafe Git options are enabled. | Zapier generators and their inherited Git environment. |
| Nodemailer 10.0.16 | Upgrade server and seed declarations together with the ImapFlow consumer. The selected version retains legacy subpaths and restores type layout. | SMTP authentication, mail delivery and ImapFlow proxy handling. |
| Electron 41.10.6 | Upgrade the desktop dependency; preserve sandbox/context isolation and application code. | Native desktop installation, recording SDK and packaged app smoke checks. |
| adm-zip 0.6.1 | Scope pins to four consumers. Directory extraction preserves subdirectories; no permissive extraction switches are added. | Documentation, federation type archives and Zapier archives. |
| basic-ftp 6.2.1 | Scope the upgrade to get-uri. Keep the stricter transfer-host default. | Proxy/FTP retrieval behavior. |
| image-size 2.0.3 | Patch appdmg to call `imageSizeFromFile` and adapt its Promise to the existing callback. A bounded local test checks a real PNG, missing-file errors and exactly one callback. | macOS DMG packaging. |
| Faker 10.5.0 | Existing uses avoid removed APIs. Add `@faker-js` to both existing SWC/Jest transform allowlists for its ESM distribution. | Server TypeScript and unit/integration tests, including seed-dependent values. |
| GraphQL utils 12.0.3 | Align executor 2.0.1, delegate 12.2.1 and wrap 11.2.1 with the new variable-values API. These published releases retain GraphQL 16 support. Keep the current Nest framework. | GraphQL schema generation, execution/delegation and code generation. |
| Next 16.3.8 | Reuse the two dependency changes from PR #7, commit `f10add27deab0572d509181efdf04dd427161c1d`, instead of implementing them again. Regenerate the combined lock. | Website build and image optimizer behavior. |

Yarn constraints, hardened mode, minimal package age and disabled lifecycle scripts remain unchanged. No scanner, severity, grace, CI or merge gate is weakened. Only lock generation and the bounded callback check ran locally; builds, complete suites, database tests, e2e, Docker and desktop packaging belong to Jenkins. Push this combined candidate once through the existing PR flow, then collect `jenkins/pr-head` for that exact SHA. A missing job does not authorize local full verification or merging.

Sources: [Sharp 0.35 migration](https://sharp.pixelplumbing.com/changelog/v0.35.0/), [simple-git v4](https://github.com/steveukx/git-js/releases/tag/simple-git@4.0.0), [Nodemailer changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md), [Faker migration](https://fakerjs.dev/guide/upgrading), [GraphQL utilities changelog](https://the-guild.dev/graphql/tools/changelogs/utils), [basic-ftp releases](https://github.com/patrickjuchli/basic-ftp/releases), [adm-zip 0.6](https://github.com/cthackers/adm-zip/releases/tag/v0.6.0). Exact npm metadata and consumer review are retained in `results/Q-7eae3e311c/recovery-*.json` on the executor workspace.

Job-Id: BS-CONTINUATION-d2e4eeacd14dc44bdf55dc60
Agent-Thread: 27904387-409e-423c-93f9-ac0a9c87a43f
Request-Id: BS-CONTINUATION-d2e4eeacd14dc44bdf55dc60
Recovery-Request-Id: RECUP-8d1aa81ea283b2e2260f-R1
