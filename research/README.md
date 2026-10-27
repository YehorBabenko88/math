# AIM Research Lab (experimental)

This module implements an **original, offline-first integration adapter**, not a vendored copy of AIM. The upstream [TheoryFoundry/AIM](https://github.com/TheoryFoundry/AIM) is MIT licensed. Upstream version reviewed: commit `28fc052310b84ba7af58e7aa2f9d9a79145fe6a4`.

The default operation **does not run AIM**, access the network, or require API credentials. It creates a versioned research request with a SHA-256 digest and an explicit `UNVERIFIED` status.

Example:

```sh
python research/aim_bridge.py --problem-file problem.md --context-file context.md
```

To opt into running AIM, compile and independently review a pinned upstream Rust binary, then pass `--aim-binary /absolute/path/to/aim`. This starts a subprocess with a bounded wall-clock timeout and temporary session directory. AIM may use an external LLM API and incur charges if configured; **never feed it secrets or private market data**. The adapter does not provide OS-level sandboxing, resource isolation, network blocking, or a formal proof checker. Run untrusted binaries only inside a separately secured environment.

Results are advisory and always `UNVERIFIED`, even on exit code zero. Numerical, symbolic, and out-of-sample validation must be independent. Do not connect to Grid runtime, PostgreSQL, trade execution, or physical hosts.

This is a first integration stage; it does not yet expose a browser UI or implement automatic theorem verification.

## Offline browser composer

Open `research/aim_research.html` in a secure context (HTTPS or localhost; Web Crypto may not be available from `file://`). It prepares a compatible JSON research request without executing AIM or contacting a network service. This is a separate UI, not yet wired into the main Math Universe page.
