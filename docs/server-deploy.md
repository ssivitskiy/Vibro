# Server Deploy

Автодеплой настроен через GitHub Actions workflow [`server-deploy.yml`](../.github/workflows/server-deploy.yml).

## Что делает workflow

1. Подключается к серверу по SSH.
2. Переходит в директорию проекта на сервере.
3. Делает `git pull --ff-only origin main`.
4. Пересобирает и перезапускает web-сервис через `docker compose up -d --build web`.

## Что должно быть на сервере

- установлен `git`
- установлен `docker`
- установлен `docker compose`
- репозиторий уже один раз склонирован, например в `~/vibro`

## GitHub Secrets

Добавьте в настройках репозитория:

- `DEPLOY_HOST` — IP или домен сервера
- `DEPLOY_USER` — SSH-пользователь
- `DEPLOY_PORT` — SSH-порт, обычно `22`
- `DEPLOY_PATH` — путь до репозитория на сервере, например `/home/deploy/vibro`
- `DEPLOY_BRANCH` — ветка для деплоя, обычно `main`
- `DEPLOY_SSH_KEY` — приватный SSH-ключ GitHub Actions
- `DEPLOY_HEALTHCHECK_URL` — необязательно, URL для проверки после деплоя

## Первый запуск на сервере

```bash
git clone <your-repo-url> ~/vibro
cd ~/vibro
docker compose up -d --build web
```

После этого каждый push в `main` будет подтягиваться на сервер автоматически.
