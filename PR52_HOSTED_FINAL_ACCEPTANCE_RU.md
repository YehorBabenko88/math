# PR52_HOSTED_FINAL_ACCEPTANCE_RU

Дата: 2026-10-26. Независимый read-only hosted acceptance аудит репозитория `YehorBabenko88/math`. **Вердикт BLOCKED — SOURCE/RUN ID MISMATCH.** Никаких rerun, merge, deployment, native/physical испытаний или production DB изменений.

## 1. Exact identity — API discrepancy

Заданный кандидат: `8a1c20184cbd878097f62530fc07630568fb7f84`.
GitHub `GET PR #52` возвращает **другой** HEAD: `ca5aa89fe3f04f1f43945d113d56a73a6a78939b`. GitHub commit lookup заданного `8a1c2018...` возвращает **422 No commit found for SHA**. Это не доказательство того, что коммит никогда не существовал; он может быть недоступен в текущем repository view или принадлежать другому репозиторию/форку.

| Expected run | API jobs lookup | API run lookup | Verdict |
|---|---|---|---|
| Push `40295973256` | 404 Not Found | 404 Not Found | BLOCKED |
| PR `40295979565` | 404 Not Found | 404 Not Found | BLOCKED |

`fetch_commit_workflow_runs` для указанного SHA вернул пустой список. Невозможно проверить `run_attempt`, runner assignment, exact tree, workflow, job identity или statuses. Не делать вывод о PASS/FAIL/QUEUED по недоступным run IDs.

## 2. Hosted artifacts and test claims

Требуемые шесть artifacts по ID не доступны из проверяемых run IDs. ZIP SHA256, inventory, manifest, source/tree/run/attempt/job binding, raw JUnit и privacy **NOT VERIFIED**. Заявленные 1744 PASS Windows/Linux и 4 PASS disposable PostgreSQL 18.1 на каждом run не могут быть независимо подтверждены и не должны использоваться как hosted acceptance.

Любые legacy `SKIPPED` не являются PASS. Даже подлинный disposable PostgreSQL 18.1 PASS не разрешает physical ADMINIT G1.

## 3. P0/P1/P2

- **P0 BLOCKED:** установить правильный repo/PR/HEAD/tree и authenticated push/PR run IDs; запросить точные artifact IDs. Не подставлять старый SHA или другие runs.
- **P0 BLOCKED:** подтвердить все обязательные jobs terminal SUCCESS и actual JUnit identities/1744 PASS + 4 PG18.1 PASS на каждом run.
- **P1 BLOCKED:** скачать каждый оригинальный ZIP по artifact ID, сверить GitHub digest с SHA256 bytes, manifest exact inventory и provenance, reject symlinks/traversal/duplicate entries/stale attempts.
- **P1 BLOCKED:** независимый JUnit status oracle, privacy projection без hostname/SID/paths/DSN/tokens/traceback и failure-path correctness.
- **P2 OPEN:** при устранении идентификационного расхождения проверить source manifest, branch guards, concurrency, permissions, skip semantics и raw Actions logs.

## 4. Следующий безопасный шаг

Уточнить, относятся ли указанные SHA/runs к другому репозиторию, форку или более новому PR. Получить authenticated API URL каждого run и шесть artifact IDs. После разрешения идентичности повторить read-only hosted acceptance с нуля. При подтверждённом дефекте — отдельный Draft PR; сейчас дефект не доказан.

**Physical G1 BLOCKED · Production NO-GO.**
