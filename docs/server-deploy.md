# Server Deploy

Автодеплой для Vibro настроен через GitHub Actions workflow
[`server-deploy.yml`](../.github/workflows/server-deploy.yml).

## Что происходит при каждом push в `main`

1. GitHub Actions подключается к серверу по SSH.
2. На сервере запускается [`scripts/deploy_server.sh`](../scripts/deploy_server.sh).
3. Скрипт делает backup текущего `runtime/`.
4. Подтягивает новую ревизию через `git pull --ff-only`.
5. Пересобирает и перезапускает `web` через `docker compose up -d --build web`.
6. Проверяет локальный healthcheck `http://127.0.0.1/api/health`.
7. При ошибке откатывает код на предыдущий commit и поднимает сервис обратно.

## Что должно быть на сервере

- установлен `git`
- установлен `docker`
- установлен `docker compose`
- репозиторий уже один раз склонирован, например в `~/vibro`
- для пользователя деплоя есть доступ к Docker

## GitHub Secrets

В репозитории должны быть настроены:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PORT`
- `DEPLOY_PATH`
- `DEPLOY_BRANCH`
- `DEPLOY_SSH_KEY`
- `DEPLOY_HEALTHCHECK_URL` — опционально

## Первый запуск

```bash
git clone <your-repo-url> ~/vibro
cd ~/vibro
docker compose up -d --build web
```

## Полезные server-side команды

Ручной deploy:

```bash
cd ~/vibro
bash scripts/deploy_server.sh ~/vibro
```

Ручной backup runtime:

```bash
cd ~/vibro
bash scripts/backup_runtime.sh ~/vibro
```

Ручной rollback на предыдущую ревизию:

```bash
cd ~/vibro
bash scripts/rollback_release.sh ~/vibro
```

Rollback на конкретный commit:

```bash
cd ~/vibro
bash scripts/rollback_release.sh ~/vibro <commit_sha>
```

Восстановление runtime из backup-архива:

```bash
cd ~/vibro
bash scripts/restore_runtime_backup.sh ~/vibro /root/vibro_backups/<archive>.tgz
```

## Где лежат служебные артефакты

- runtime backup archives: `/root/vibro_backups`
- deploy logs: `runtime/infra/logs/deploy.log`
- deploy history: `runtime/infra/logs/deploy-history.log`
