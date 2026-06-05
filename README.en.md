# Jianji

<p align="center">
  <img src="public/logo.svg" width="88" alt="Jianji logo" />
</p>

<p align="center">
  A lightweight, self-hosted, multi-device open-source knowledge workspace.
</p>

<p align="center">
  <a href="README.md">简体中文</a>
  ·
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/staklab/jianji/releases"><img alt="Version" src="https://img.shields.io/badge/version-0.1.0-5E5CE6"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Linux%20%7C%20Docker%20%7C%20macOS-lightgrey">
  <img alt="Built with React and Express" src="https://img.shields.io/badge/built%20with-React%20%2B%20Express-61DAFB">
  <img alt="Database" src="https://img.shields.io/badge/database-SQLite-003B57">
  <img alt="Deploy" src="https://img.shields.io/badge/deploy-Docker%20Compose-2496ED">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

Jianji brings documents, structured tables, calendars, mail aggregation, notifications, sharing, collaboration, and admin operations into one self-hosted workspace. It is designed for personal servers, home labs, small teams, and anyone who wants to own their data.

## Preview

<table>
  <tr>
    <td><img src="docs/images/screenshot-dashboard.png" width="420" alt="Dashboard" /></td>
    <td><img src="docs/images/screenshot-doc-editor.png" width="420" alt="Document editor" /></td>
  </tr>
  <tr>
    <td align="center">Dashboard</td>
    <td align="center">Document Editor</td>
  </tr>
  <tr>
    <td><img src="docs/images/screenshot-mail.png" width="420" alt="Mail aggregation" /></td>
    <td><img src="docs/images/screenshot-admin-settings.png" width="420" alt="Admin settings" /></td>
  </tr>
  <tr>
    <td align="center">Mail</td>
    <td align="center">Admin Console</td>
  </tr>
</table>

## Highlights

| Area | Features |
| --- | --- |
| Documents | Private/public/shared/favorite views, tree and grid layouts, TipTap rich text, attachments, export, comments, and version restore |
| Tables | Custom fields, templates, table/kanban/calendar/Gantt views, formulas, CSV/XLSX import and export, and public forms |
| Calendar | Month/week/day views, recurring events, todo scheduling, in-app and email reminders |
| Mail | IMAP/SMTP binding, folder sync, in-app compose, attachments, sent cache, and mail-to-todo |
| Users and security | Email-code registration, password reset, email change, login history, remote session revocation, and admin user control |
| Preferences | Dark mode, custom theme color palette, default home page, editor font size, mail sync preferences, and font management |
| Admin console | Users, groups, system settings, SMTP test mail, backup/restore, audit logs, and version updates |
| Self-hosting | One-container Docker Compose, SQLite volume, same-origin `/api`, one-click install, safe updates, and full migration packages |

## Quick Deploy

Docker Compose is the recommended production setup. The installer generates `.env`, a strong `JWT_SECRET`, a private first-run setup link, and starts the container. The administrator account, SMTP settings, and registration policy are configured in the web setup wizard.

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash -s -- \
  --app-url https://jianji.example.com \
  --yes
```

You can also clone first:

```bash
git clone https://github.com/staklab/jianji.git
cd jianji
bash scripts/install.sh
```

Check the service and the setup link:

```bash
docker compose ps
docker compose logs -f jianji
cat ./SETUP_URL.txt
```

For environment variables, SMTP, Nginx, certificates, and migration details, see [配置说明.md](配置说明.md).

## Updates

Jianji does not require GitHub Releases for updates. By default, the admin version panel reads the latest commit on GitHub `main`; deployed instances write their current commit to `.env`, so a push to `main` is enough for instances to detect a newer build.

Safe server update:

```bash
bash scripts/update.sh
```

For low-memory servers with host-side builds and a runtime image:

```bash
bash scripts/update-runtime.sh
```

The update scripts back up `.env` and `SETUP_URL.txt`, preserve SQLite and upload Docker volumes, pull the latest source, rebuild the container, and wait for the health check to pass. If the deployment directory is not a Git checkout, the scripts refresh source from the GitHub branch archive defined by `JIANJI_UPDATE_REPO` / `JIANJI_UPDATE_BRANCH` while still protecting runtime config and data. A single-container deployment can still have a very short restart window; strict zero-downtime deployments should use blue-green release behind Nginx.

If your deployment environment cannot reliably reach GitHub repository APIs or source archive endpoints, server-side automatic fetch updates will not be available. Run a push update from a local machine that can obtain the latest source:

```bash
git pull
bash scripts/push-update.sh --host root@example.com --dir /opt/jianji --runtime
```

Push updates sync source over SSH/rsync and ask the server to skip remote fetching before rebuilding safely. The server-side `.env`, setup link, certificates, database, uploads, and backups are preserved.

## Local Development

```bash
npm run setup
npm run dev
```

Default development URLs:

| Service | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000` |

## Test And Build

```bash
npm run lint
npm run test
npm run build
```

## Data And Security

Docker deployment uses two persistent volumes:

| Volume | Content |
| --- | --- |
| `jianji-data` | SQLite database at `/app/data` |
| `jianji-uploads` | Avatars, attachments, and uploaded files at `/app/uploads` |

The repository and Docker build context exclude `.env`, `SETUP_URL.txt`, SQLite databases, uploads, certificates, private keys, and local caches. Migration packages can include encrypted mail credentials and user-uploaded files, so treat them as private backups.

## License

Jianji application code is open sourced under the [MIT License](LICENSE). Bundled font references follow their own OFL licenses; see [LICENSES/FONTS.md](LICENSES/FONTS.md).
