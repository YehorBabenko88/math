# Math Universe: full CI coverage audit

Дата: 2026-10-19. Ветка: `audit/book-full-ci-coverage`.
База: `1a0c26f7a3cb5f341c3ea9ad8a87009ef33c7b90`.
Реализация: `83d979d7ccb80667aaa014a994d46bbc9d5389f9`.

## Подтверждённое исходное состояние

GitHub API подтвердил открытый PR #8 с указанным HEAD и четыре успешных workflow: Native PDF (39228050054), Validate (39228048255), PostgreSQL Integration (39228048438), Browser (39228048107). Эти результаты относятся к старому CI-контракту, а не к полному покрытию.

Обнаруженные пробелы:

1. PostgreSQL workflow запускал только `tests/*-live.test.mjs`. Например, `book-cutover-controller.test.mjs` и `book-cutover-hardening-postgres.test.mjs` не попадали в матрицу, хотя требуют БД.
2. Общий `npm test` не получал PostgreSQL URL и PDF runtime, поэтому условные skip могли давать зелёный статус без выполнения профильных проверок.
3. Branch/path-фильтры PostgreSQL и Native PDF могли не запускать проверки на новой audit-ветке или изменениях journal/controller/helper.
4. Playwright имел `retries:1`, общий workflow не имел job timeout; checkout сохранял credentials по умолчанию.
5. PostgreSQL client устанавливался отдельно от manifest. В репозитории отсутствует package-lock; `npm ci` использовать без него нельзя.

## Изменения и RED/GREEN

- `tests/ci-coverage.test.mjs`: сначала получены RED для старых workflow и отсутствующего strict runner; затем GREEN. Проверяются матрица, отсутствие branch/path/test-name фильтров, bounded/read-only jobs и отсутствие browser retries.
- `scripts/test-full-ci.mjs`: обнаруживает ВСЕ верхнеуровневые `tests/*.test.mjs` через readdir, сортирует и передаёт Node без shell/glob/name-фильтров. Полный inventory — 77 файлов. Требует Node 22/24, реальный PostgreSQL 16/18 и доступные pypdf/pypdfium2/Pillow. Разрешены только loopback, пользователь math_test и отдельные math_universe_test/math_universe_integration базы. URL/пароли не выводятся.
- Runner проверяет код/сигнал завершения и финальный TAP summary. Любой fail/cancelled/skip/todo, пустой inventory, пустой файл, отсутствие summary или неполное число passed означает отказ. Fixture subprocesses независимо воспроизводят skip/todo/fail/empty/pass. Негативные fixture suites ожидаемы и не являются пропусками основного набора.
- Дополнительный RED показал, что `NODE_OPTIONS=--test-only` мог пройти первоначальную узкую проверку selectors. GREEN запрещает унаследованные Node test flags; CLI не принимает selectors/дополнительные аргументы. Для вложенных fixtures удаляется только внутренний `NODE_TEST_CONTEXT`, чтобы Node действительно запускал отдельный runner.
- `.github/workflows/postgres-integration.yml`: все push/PR без path/branch-фильтров; Node 22/24 × PostgreSQL 16/18; Python/PDF во всех ячейках; fail-fast:false, по четыре параллельных test-файла, 120 секунд на файл и 20 минут на job. Никаких test retries. Healthcheck retries относятся только к готовности одноразового PostgreSQL service.
- Стабильный aggregate check **Full CI coverage** с `if: always()` допускает только success всей матрицы, поэтому failed/cancelled/skipped matrix не становится зелёной агрегацией.
- Native PDF и Browser E2E сохранены отдельными workflows, также без branch/path-фильтров. Playwright retries=0. Validate теперь проверяет CI-контракт, а не выдаёт частичный suite без БД за общую валидацию.
- Все workflows: contents:read, checkout persist-credentials:false, job timeouts. Нет pull_request_target, production secrets, environments, deployment или миграции внешней БД. Известный пароль math_test_ci_only применяется только к эфемерному service container.
- `package.json`: pg@8.16.3 закреплён явно, Playwright остаётся 1.56.1; npm lifecycle scripts отключены в install шагах. Исходный проект не имел lockfile; оставлен обычный install, без выдуманного или непроверенного lockfile.
- `tests/ci-postgres-isolation.test.mjs`: три одновременных callback создают одинаковые имена таблиц в разных UUID-схемах; один callback завершается ошибкой. Проверяется независимость данных и отсутствие всех трёх схем после cleanup. Удаление выполняет существующий helper только для принадлежащих ему схем.

Новых дефектов runtime Book backend в полном прогоне не обнаружено; assertions существующих научных/миграционных тестов не ослаблялись. SQL 001–005, production gate, backend routing и scientific review не изменялись.

## Локальные результаты

| Runtime | Файлы | Passed | Failed | Skipped / todo |
| --- | ---: | ---: | ---: | ---: |
| Node 22.23.3 × PostgreSQL 16.15 | 77 | 372 | 0 | 0 / 0 |
| Node 22.23.3 × PostgreSQL 18.1 | 77 | 372 | 0 | 0 / 0 |
| Node 24.20.0 × PostgreSQL 16.15 | 77 | 372 | 0 | 0 / 0 |
| Node 24.20.0 × PostgreSQL 18.1 | 77 | 372 | 0 | 0 / 0 |
| Отдельный Native PDF | профиль | 76 | 0 | 0 / 0 |
| Browser E2E Chromium, localhost | 6 spec-файлов | 14 | 0 | retries=0 |

Матрица выполнялась одновременно против двух локальных одноразовых тестовых кластеров; каждый callback владеет отдельной схемой. Прогоны завершились примерно за 25–26 секунд, без зависаний. Реальные временные Ed25519 ключи/NOLOGIN роли создаются исключительно синтетическими fixtures и не являются production credentials. Crash/restart сценарии завершают только созданные ими дочерние процессы.

`git diff --check` прошёл. Журналы вне Git: `outputs/book-full-ci-final-node{22,24}-pg{16,18}.log`, `book-full-ci-native-pdf.log`, `book-full-ci-browser.log`, `book-full-ci-red.log`, `book-full-ci-selector-red.log`.

## Проверенные области

| Контракт | Основные тесты, включённые во ВСЕ ячейки |
| --- | --- |
| Book SQL 001–005, checksums, повторное применение, конкурентные runner, COMMIT uncertainty | book-migration-integrity-live; book-postgres-schema-live; book-cutover-hardening-postgres |
| Controller states, crash между effect/commit, rotation/stale snapshot, закрытый production gate | book-cutover-controller; book-cutover-postgres-live |
| Journal chain, stale owner, clock rollback | book-cutover-journal |
| Signed sessions, подпись/scope/run/resource/expiry | book-cutover-auth |
| SQLite freeze, старые подключения, WAL reader/writer | book-cutover-source; book-cutover-hardening-sqlite |
| Backup/restore, целостность и snapshot | book-cutover-backup; book-cutover-hardening-sqlite; book-postgres-transfer-live |
| Fencing, retries, checkpoints, worker crash | postgres-checkpoint-live; postgres-fencing-live; postgres-pr3-audit-live; book-postgres-queue-live |
| Provenance, receipts, отсутствие proven promotion | book-postgres-scientific-live; book-ingestion-review; book-postgres-lossless-live |

Все test-файлы включаются автоматически, таблица не является дополнительным селектором. Native PDF не исполняет содержимое PDF; внешний AI не вызывается. Полные повторные прогоны теперь включают локальные security-регрессии, разрешённые новым заданием.

## Измеренное покрытие и ограничения

Отдельный unfiltered Node 24 / PostgreSQL 18 запуск с `--experimental-test-coverage` также прошёл: 372 tests, 0 fail/skip/todo. Node сообщил для загруженных файлов 98.77% line, 86.79% branch, 96.46% functions. В знаменателе есть helpers; это НЕ метрика всех файлов репозитория или browser/Python/SQL покрытия. Лог: `outputs/book-full-ci-coverage-node24-pg18.log`.

| Загруженный Book модуль | Line % | Branch % |
| --- | ---: | ---: |
| postgres-migrations | 100 | 93.02 |
| postgres-queue | 100 | 98.63 |
| queue (SQLite) | 100 | 97.33 |
| cutover-controller | 98.61 | 82.98 |
| cutover-journal | 100 | 92.65 |
| cutover-postgres | 100 | 81.48 |
| cutover-source | 100 | 82.35 |
| cutover-backup | 100 | 84.48 |
| operator-session | 100 | 90.91 |
| postgres-transfer | 89.33 | 89.33 |
| postgres-gate | 69.23 | 40.00 |

Не загружены Node coverage: app, benchmark-ui, book-ui, cross-domain-ui, equation-ui, geometry-pde-ui, geometry-ui, graph-ui, local-server, torus-ui. Browser E2E проверяет отдельные пользовательские сценарии, но не измеряет покрытие этих файлов. Нет mutation testing, power-loss/серверных crash тестов, production role/identity-provider attestation, live API проверки научных провайдеров или полной проверки всех внешних ошибок. Не добавлялись фиктивные тесты только ради процентов.

Проект пока не имеет lockfile, поэтому транзитивные npm зависимости не полностью воспроизводимы. В локальной среде registry-запрос npm не завершился; установка остановлена, offline metadata cache отсутствует. Полный suite использовал уже установленные версии; чистая установка отдельно проверяется GitHub Actions. Actions version tags и ubuntu-latest также не фиксируют неизменяемый образ. Это документированные риски, не основание скрывать ошибки.

## Обязательность и публикация

Workflow выполняет обязательный полный контракт и предоставляет стабильный check **Full CI coverage**. Чтобы запретить merge без него, администратору нужно назначить его required status check в branch protection/ruleset вместе с Native PDF и Browser. Repository settings не изменялись: без такой настройки workflow сам по себе не запрещает ручной merge.

GitHub публикация/Actions текущего HEAD фиксируются в финальном delivery report после обычного push. Никакой Draft PR автоматически не создаётся. Для публикации вручную:

```powershell
git -C 'C:\Users\Administrator\Documents\Codex\2026-10-14\https-github-com-yehorbabenko88-math-actions\work\book-postgres-cutover-controller' push --set-upstream origin audit/book-full-ci-coverage
```

Production gate закрыт. Main, существующие PR #1–#8, Cluster Grid и production PostgreSQL не изменялись; production migration/cutover/merge не выполнялись.
