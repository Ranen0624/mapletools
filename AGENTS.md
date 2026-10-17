# MapleTools website and public release repository

- This repository holds the website, web simulations and verified public binary packages.
- The user requested plaintext developer sources to be maintained separately. Implement tool changes in the developer workspace first.
- Build and publish PC/APK packages only when the user explicitly requests a release. An ordinary feature or bug-fix request does not authorize an automatic release.
- Never add developer Python sources, private API configuration, signing keys, generated C, R8 mappings, encrypted source backups or recovery keys to this repository.
- Public PC application code must be compiled; public Android Python business logic must be native-compiled. Keep required third-party notices.
- Confirm runtime behavior, package integrity and absence of private material before changing download links.
- Current public version labels are PC 2.0.3 and Android 1.0.3. Android's internal versionCode must increase for upgrade compatibility.
- Historical patch-note dates are explicitly editorial feature milestones, not verified historical release dates. Preserve that distinction.
