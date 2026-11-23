# Permutation Drawdowns Implementation Plan

> For agentic workers: use executing-plans in this session.

**Goal:** deterministic bounded permutation drawdowns matching the legacy shuffle oracle.
**Architecture:** single shared ordered equity helper; standalone closed-input permutation API.
**Tech Stack:** standard-library Python3.11/3.12 and existing offline wheel builder.
**Spec:** ../specs/2026-11-23-permutation-drawdowns-design.md

## Global Constraints
No effects, no new dependencies, no source/API changes outside the necessary kernel/profile/SDK tests and provenance. Maximum4096values,1000runs,1000000visits, seed0..2**31-1.

## Review Focus
Hostile literal subclasses; full snapshot before admission; derived overflow; independent RNG; historical profile custody.

### Task1: Pure kernel and regression proof
- [ ] Add legacy exact-seed, policy, callback, snapshot, overflow and global-state tests; run RED bothPython.
- [ ] Extract the unchanged PnL loop into _ordered_equity_summary; add permutation_drawdowns using fresh list per shuffle.
- [ ] Run GREEN and old PnL/trade/screening/bootstrap numerical oracles bothPython.
### Task2: Source custody and mandatory installed qualification
- [ ] Add exact001 fixture; bind actual v7 statistics SHA and explicit history workflow. Preserve old17 test method roles with necessary active-workflow expectation update.
- [ ] Add mandatory permutation group alongside existing8 groups.
- [ ] Freeze exact Git source, raw export, offline build actual3-file wheel; source/wheel tests bothPython and reviewed pure profile AST against verified immutableGit fixtures.
- [ ] Save inverse/protected/raw/RECORD receipts and unpublished commit for independent review.
