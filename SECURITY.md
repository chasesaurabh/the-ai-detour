# Security boundaries

This is synthetic teaching software, not a production service. Run exercises in disposable workspaces with synthetic data. The unauthenticated teaching MongoDB instance is bound to loopback; do not expose it or put private data in it. The separately authenticated permissions fixture uses deliberately public example credentials.

The coding launcher targets Windows MXC. Ordinary host tests, verifiers and browser servers do not inherit that sandbox. The joined coordinator requires explicit candidate-bound execution permission before host verification; it is not containment. Inspect source, tests, package scripts, lockfiles and installed dependencies before granting it. Use an isolated verifier for untrusted code. Approval files assume trusted local storage and do not authenticate an organizational approver.

Do not include credentials, workplace tickets, personal paths or private logs in an issue. For a non-sensitive defect, provide a minimal synthetic reproduction and the release version. For a sensitive report, use GitHub's private vulnerability reporting if enabled; do not post exploit details containing private information publicly.

MIT applies to this companion's source and original synthetic fixtures. The book text and cover are not included or licensed by this repository. Dependencies and model downloads retain their own licenses.
