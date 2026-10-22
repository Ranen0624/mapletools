# MapleTools website and public release repository

- When starting a new chat or working on another machine, read `docs/PROJECT-CONTEXT.md` before changes. Treat the checked-in files and current GitHub state as the source of truth rather than assuming access to another chat or computer.
- Verify the current workspace, available private tools, credentials and live collector lock. A shared conversation does not prove that local files, API keys, checkpoints or scheduled jobs moved to this machine.

- This repository holds the website, web simulations and verified public binary packages.
- The user requested plaintext developer sources to be maintained separately. Implement tool changes in the developer workspace first.
- Build and publish PC/APK packages only when the user explicitly requests a release. An ordinary feature or bug-fix request does not authorize an automatic release.
- Never add developer Python sources, private API configuration, signing keys, generated C, R8 mappings, encrypted source backups or recovery keys to this repository.
- Public PC application code must be compiled; public Android Python business logic must be native-compiled. Keep required third-party notices.
- Confirm runtime behavior, package integrity and absence of private material before changing download links.
- Current public version labels are PC 2.0.5 and Android 1.0.6. Android's internal versionCode must increase for upgrade compatibility.
- Historical patch-note dates are explicitly editorial feature milestones, not verified historical release dates. Preserve that distinction.
