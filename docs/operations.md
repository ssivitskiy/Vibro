# Operations

Этот документ фиксирует минимальный production-контур для Vibro.

## Runtime

- приложение работает из каталога `~/vibro`
- основной контейнер: `web`
- публичный endpoint: `http://<host>/`
- health endpoint: `http://<host>/api/health`

## Backup policy

- `runtime/` архивируется в `/root/vibro_backups`
- retention по умолчанию: `14` дней
- имя архива содержит UTC timestamp и commit SHA

Ручной запуск:

```bash
cd ~/vibro
bash scripts/backup_runtime.sh ~/vibro
```

## Restore policy

Восстановление runtime выполняется отдельно от rollback кода:

```bash
cd ~/vibro
bash scripts/restore_runtime_backup.sh ~/vibro /root/vibro_backups/<archive>.tgz
```

## Rollback policy

Если deploy не проходит healthcheck, `deploy_server.sh`:

1. сохраняет backup runtime,
2. откатывает код на предыдущий commit,
3. пересобирает `web`,
4. пишет событие в `deploy-history.log`.

Ручной rollback:

```bash
cd ~/vibro
bash scripts/rollback_release.sh ~/vibro
```

## Logs

- deploy log: `runtime/infra/logs/deploy.log`
- deploy history: `runtime/infra/logs/deploy-history.log`
- docker logs ограничены через `json-file` rotation:
  - `max-size=10m`
  - `max-file=3`

## Suggested cron

Ежедневный backup runtime в `03:17 UTC`:

```cron
17 3 * * * cd /root/vibro && BACKUP_DIR=/root/vibro_backups BACKUP_RETENTION_DAYS=14 bash scripts/backup_runtime.sh /root/vibro >> /root/vibro/runtime/infra/logs/backup.log 2>&1
```
