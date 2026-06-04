# 简记 Jianji

![Jianji logo](public/logo.svg)

简记是一个轻量、自托管、多设备可用的开源知识工作台，集合文档、数据表、日历、邮箱聚合、通知、分享协作和管理后台。它适合个人、家庭服务器、小团队和希望掌控自己数据的自托管用户。

Jianji is a lightweight self-hosted knowledge workspace for documents, structured tables, calendars, mail aggregation, notifications, sharing, collaboration, and admin operations. It is designed for personal servers, small teams, and anyone who wants to own their data.

> GitHub repository: `https://github.com/staklab/jianji`

---

## 中文说明

### 功能亮点

- 文档中心：私人/公共/共享/收藏视图，树形与网格布局，TipTap 富文本，附件上传，Markdown/Word/HTML/PDF 导出，评论与版本恢复。
- 数据表：字段管理、模板、表格/看板/日历/甘特图、公式字段、CSV/XLSX 导入导出、公开表单视图。
- 日历：月/周/日视图，重复日程，待办拖入日历，站内与邮件提醒。
- 邮箱聚合：IMAP/SMTP 一键绑定，多文件夹同步，站内写信，附件发送，邮件转待办。
- 用户与安全：注册邮箱验证码、找回密码、换绑邮箱、登录设备留痕与远程注销、管理员禁用用户。
- 个性化：深色模式、主题色调色盘、默认首页、编辑器字号、邮箱同步偏好、字体管理。
- 管理后台：用户管理、用户组、系统设置、SMTP 测试邮件、备份恢复、审计日志。
- 自托管部署：单容器 Docker Compose，SQLite 数据卷，前端与后端同源 `/api`，支持一键部署、无损更新和完整迁移包。

### 界面预览

以下截图以 1920x1080 桌面浏览器比例生成。

![工作台](docs/images/screenshot-dashboard.png)

![邮箱聚合](docs/images/screenshot-mail.png)

![系统设置](docs/images/screenshot-admin-settings.png)

### 一键部署

推荐在服务器上使用 Docker Compose。脚本会生成运行所需的 `.env`、强随机 `JWT_SECRET` 和私密首次配置链接；管理员账号、SMTP、注册策略等敏感配置会在第一次通过域名访问时，于网页初始化向导中完成。

#### 方式 A：curl 直接安装

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash
```

指定域名并尽量减少交互：

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash -s -- \
  --app-url https://jianji.example.com \
  --yes
```

指定仓库、目录或分支：

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash -s -- \
  --repo https://github.com/staklab/jianji.git \
  --dir jianji \
  --branch main \
  --app-url https://jianji.example.com \
  --yes
```

#### 方式 B：git clone 后安装

```bash
git clone https://github.com/staklab/jianji.git
cd jianji
bash scripts/install.sh
```

安装完成后：

```bash
docker compose ps
docker compose logs -f jianji
cat ./SETUP_URL.txt
```

脚本会输出一个类似下面的私密链接：

```text
https://jianji.example.com/setup?token=...
```

请只由部署管理员打开该链接。普通访客访问未初始化实例时只会看到锁定提示，不会看到配置表单；初始化完成后该表单会自动关闭。

### 必须配置的内容

部署脚本会写入根目录 `.env`。请不要提交 `.env` 到 Git。网页初始化向导会把 SMTP 授权码加密后保存到后端数据库。

| 配置 | 说明 |
| --- | --- |
| `APP_URL` | 用户访问地址，例如 `https://jianji.example.com` |
| `JWT_SECRET` | 自动生成，登录会话和邮箱凭据加密依赖它，部署后不要随意更换 |
| `SETUP_TOKEN` | 自动生成的一次性初始化密钥，用于打开首次配置页面 |
| `COOKIE_SECURE` | HTTPS 部署建议为 `true` |
| 管理员账号 | 在网页初始化向导中创建 |
| SMTP 配置 | 在网页初始化向导中填写并验证 |
| `ALLOW_PUBLIC_REGISTER` | 初始化向导中选择是否允许公开注册 |

验证码不会打印到终端。注册、找回密码、换绑邮箱都依赖 SMTP。常见邮箱需要先开启 SMTP，并使用授权码或应用专用密码，而不是网页登录密码。

更多配置细节见：[配置说明.md](配置说明.md)

### 升级与静默更新

服务器代码更新推荐使用：

```bash
bash scripts/update.sh
```

脚本会先备份 `.env` 和 `SETUP_URL.txt`，然后拉取最新代码并用 Docker Compose 重建容器。SQLite 数据卷和上传文件卷不会被删除。

如果服务器采用宿主机构建、`jianji:runtime` 镜像运行的低内存优化部署，可使用：

```bash
bash scripts/update-runtime.sh
```

管理员也可以在【管理后台】-【系统设置】-【版本更新】中检查版本并发起更新通知。安装和更新脚本会把当前 Git commit 写入 `.env`，后台默认查询 `staklab/jianji` 的 `main` 分支最新 commit；所以后续维护时只要 push 到 `main`，已部署实例就能检测到远端有新提交。更新开始时，所有活跃用户会收到右上角消息中心通知和邮件；更新完成后会收到“感谢您的支持与理解，文档中心已更新完毕，可以继续使用”。邮件使用首次初始化时配置的同一套 SMTP。

如果希望后台按钮自动执行更新命令，请在服务器 `.env` 中配置：

```env
JIANJI_UPDATE_CHECK_URL=https://api.github.com/repos/staklab/jianji/commits/main
JIANJI_UPDATE_COMMAND=bash /opt/jianji/scripts/update.sh
```

版本检测不需要 DNS API；默认读取 GitHub main 分支最新提交，也可以换成返回 `{"sha":"..."}`、`{"version":"0.2.0"}` 或纯文本版本号的自定义地址。如果未配置 `JIANJI_UPDATE_COMMAND`，后台会进入手动模式：先发送维护通知，再提示管理员通过 SSH 执行更新脚本。

### 本地开发

```bash
npm run setup
npm run dev
```

默认开发地址：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:4000`

开发用 `.env` 路径：

- 后端：`server/.env`
- 模板：`server/.env.example`

### 测试与构建

```bash
npm run lint
npm run test
npm run build
```

当前自动化测试覆盖后端主要业务链路：鉴权、防刷、文档、数据表、公共知识库、导出、日历、评论、备份、邮箱聚合、发送邮件、登录设备、管理后台等。

重新生成 README 截图：

```bash
JIANJI_SCREENSHOT_PASSWORD=你的本地演示管理员密码 node scripts/capture-readme-screenshots.mjs
```

截图脚本默认生成 1920x1080 图片，不会把密码写入文件。

### 数据与备份

Docker 部署使用两个持久化卷：

- `jianji-data`：SQLite 数据库，挂载到 `/app/data`
- `jianji-uploads`：头像、附件等上传文件，挂载到 `/app/uploads`

请定期备份这两个卷。升级时不要删除数据卷。

管理后台提供两种备份：

- 数据库备份：导出和恢复核心业务数据。
- 完整迁移包：导出数据库、上传文件和脱敏后的配置摘要，用于换服务器迁移。

迁移包可能包含加密后的邮箱凭据和用户上传文件，请按私密备份保存。仓库和 Docker 构建上下文默认排除 `.env`、`SETUP_URL.txt`、SQLite 数据库、上传目录、证书和本地缓存。

### 生产排障

常用命令：

```bash
docker compose ps
docker compose logs -f jianji
cat /opt/jianji/SETUP_URL.txt
curl -fsS https://jianji.example.com/api/health
```

如果 Docker 构建在低内存服务器上很慢，可以先确认是否连到正确机器：

```bash
nproc
free -h
hostname -I
```

如果 npm 下载缓慢，优先检查服务器网络、Docker 镜像源和 npm registry；如果已经有可用数据卷，重新部署前先备份 `.env`、`SETUP_URL.txt`、数据库卷和上传卷。

### 开源提交前检查

本仓库已提供 `.gitignore` 和 `.dockerignore`，默认排除：

- `.env`、`server/.env`
- `SETUP_URL.txt`
- `certs/`、`.acme.sh/`、`*.pem`、`*.key`
- SQLite 数据库与 journal 文件
- `server/uploads/`、`uploads/`
- `node_modules/`
- `dist/`、`server/dist/`
- 日志、临时文件、编辑器缓存

提交到 GitHub 前建议执行：

```bash
git status --short --untracked-files=all
npm run lint
npm run test
npm run build
```

### 后续维护规划

1. 发布节奏：先打 `v0.1.0` 初始版本，后续按 `v0.x.y` 迭代。
2. 安全维护：定期轮查依赖更新、SMTP 配置、JWT 密钥强度、上传目录权限。
3. 数据维护：记录数据库迁移变更，发布前验证 `prisma migrate deploy`。
4. 部署维护：保持 `scripts/install.sh`、`docker-compose.yml`、`配置说明.md` 同步。
5. 测试维护：每次功能变更至少运行 `npm run lint && npm run test && npm run build`。
6. GitHub 维护：建议补充 Issues 模板、Release Notes、贡献指南和演示截图。

---

## English

### Highlights

- Documents: private/public/shared/favorite views, tree and grid layouts, TipTap editor, attachments, Markdown/Word/HTML/PDF export, comments, snapshots, and restore.
- Tables: templates, custom fields, table/kanban/calendar/Gantt views, formula fields, CSV/XLSX import and export, and public form views.
- Calendar: month/week/day views, recurring events, todo scheduling, in-app and email reminders.
- Mail aggregation: IMAP/SMTP quick binding, folder sync, in-app compose, attachments, sent cache, and mail-to-todo.
- Users and security: email-code registration, password reset, email change, login history, remote session revocation, and admin user control.
- Preferences: dark mode, custom theme color palette, default home page, editor font size, mail sync preferences, and font management.
- Admin console: users, groups, system settings, SMTP test mail, backup/restore, and audit logs.
- Deployment: one-container Docker Compose, SQLite volume, same-origin frontend and `/api` backend, safe updates, and full migration packages.

### Screenshots

The screenshots below are captured at a 1920x1080 desktop browser size.

![Dashboard](docs/images/screenshot-dashboard.png)

![Mail](docs/images/screenshot-mail.png)

![Admin settings](docs/images/screenshot-admin-settings.png)

### One-Click Deployment

The recommended production setup is Docker Compose. The installer writes a local `.env`, generates a strong `JWT_SECRET`, and prints a private first-run setup link. The administrator account, SMTP settings, and registration policy are configured in the web setup wizard after you open the deployed domain.

#### Option A: Install with curl

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash
```

With a public URL and fewer prompts:

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash -s -- \
  --app-url https://jianji.example.com \
  --yes
```

With explicit repository, directory, and branch:

```bash
curl -fsSL https://raw.githubusercontent.com/staklab/jianji/main/scripts/install.sh | bash -s -- \
  --repo https://github.com/staklab/jianji.git \
  --dir jianji \
  --branch main \
  --app-url https://jianji.example.com \
  --yes
```

#### Option B: Clone first

```bash
git clone https://github.com/staklab/jianji.git
cd jianji
bash scripts/install.sh
```

Check the service:

```bash
docker compose ps
docker compose logs -f jianji
cat ./SETUP_URL.txt
```

The installer prints a private link like:

```text
https://jianji.example.com/setup?token=...
```

Only the deployment administrator should open this link. Visitors to an uninitialized instance see a locked notice instead of the configuration form. After setup is completed, the form is closed automatically.

### Required Configuration

The installer writes `.env` in the repository root. Never commit `.env`. The web setup wizard encrypts the SMTP app password before saving it to the backend database.

| Variable | Description |
| --- | --- |
| `APP_URL` | Public URL, for example `https://jianji.example.com` |
| `JWT_SECRET` | Auto-generated secret for sessions and encrypted mail credentials |
| `SETUP_TOKEN` | Auto-generated first-run setup secret |
| `COOKIE_SECURE` | Use `true` behind HTTPS |
| Administrator account | Created in the web setup wizard |
| SMTP settings | Entered and verified in the web setup wizard |
| `ALLOW_PUBLIC_REGISTER` | Chosen in the setup wizard |

Email verification codes are sent through SMTP and are not printed to the terminal. Registration, password reset, and email change require a working SMTP configuration.

More details: [配置说明.md](配置说明.md)

### Updates

Use the safe update script on the server:

```bash
bash scripts/update.sh
```

The script backs up `.env` and `SETUP_URL.txt`, pulls the latest source when the deployment is a Git checkout, and rebuilds the Docker Compose service without deleting SQLite or upload volumes.

For the optimized host-build/runtime-image deployment, use:

```bash
bash scripts/update-runtime.sh
```

Admins can also use the version update panel in Admin Settings. Install and update scripts write the current Git commit to `.env`, and the admin panel checks the latest commit on the `main` branch by default. After you push changes to `main`, deployed instances can detect that a newer commit exists. When an update starts, active users receive an in-app notification and an email. After the update is finished, users receive the completion message through the same notification channels. To let the admin button run the update automatically, set:

```env
JIANJI_UPDATE_CHECK_URL=https://api.github.com/repos/staklab/jianji/commits/main
JIANJI_UPDATE_COMMAND=bash /opt/jianji/scripts/update.sh
```

Version checks do not require DNS API credentials. By default Jianji reads the latest GitHub commit on `main`, and you can replace it with a custom endpoint returning `{"sha":"..."}`, `{"version":"0.2.0"}`, or a plain text version. Without `JIANJI_UPDATE_COMMAND`, the panel stays in manual mode and asks the admin to run the script over SSH.

### Local Development

```bash
npm run setup
npm run dev
```

Default development URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

Development env files:

- Backend env: `server/.env`
- Template: `server/.env.example`

### Test And Build

```bash
npm run lint
npm run test
npm run build
```

The backend test suite covers authentication, rate limiting, documents, tables, public workspaces, export, calendar, comments, backup, mail aggregation, mail sending, login sessions, and admin features.

Regenerate README screenshots:

```bash
JIANJI_SCREENSHOT_PASSWORD=your-local-demo-admin-password node scripts/capture-readme-screenshots.mjs
```

The screenshot helper writes 1920x1080 images by default and does not save the password to disk.

### Data And Backup

Docker deployment uses two persistent volumes:

- `jianji-data`: SQLite database at `/app/data`
- `jianji-uploads`: uploaded files at `/app/uploads`

Back up both volumes regularly. Do not remove them during upgrades.

The admin console provides a database backup and a full migration package. The migration package includes database data, uploaded files, and a sanitized configuration summary for server moves. Treat it as private because it can include encrypted mail credentials and user files. Secrets such as `.env`, `SETUP_URL.txt`, plaintext SMTP passwords, certificate API keys, and local caches are excluded from the repository and Docker build context.

### Production Troubleshooting

Useful commands:

```bash
docker compose ps
docker compose logs -f jianji
cat /opt/jianji/SETUP_URL.txt
curl -fsS https://jianji.example.com/api/health
```

If Docker builds are slow on a small server, first confirm you are on the expected host:

```bash
nproc
free -h
hostname -I
```

Before redeploying a live instance, back up `.env`, `SETUP_URL.txt`, the SQLite volume, and the uploads volume.

### Before Publishing To GitHub

The repository includes `.gitignore` and `.dockerignore` to exclude secrets and runtime data:

- `.env`, `server/.env`
- `SETUP_URL.txt`
- `certs/`, `.acme.sh/`, `*.pem`, `*.key`
- SQLite database and journal files
- `server/uploads/`, `uploads/`
- `node_modules/`
- `dist/`, `server/dist/`
- logs, temp files, and editor cache

Recommended checks:

```bash
git status --short --untracked-files=all
npm run lint
npm run test
npm run build
```

### Maintenance Plan

1. Release `v0.1.0` as the first public version, then iterate with semantic-ish `v0.x.y` tags.
2. Keep dependencies, SMTP settings, JWT secrets, and upload permissions under regular review.
3. Validate Prisma migrations with `prisma migrate deploy` before each release.
4. Keep `scripts/install.sh`, `docker-compose.yml`, and deployment docs in sync.
5. Run lint, tests, and production build before every release.
6. Add GitHub issue templates, release notes, contribution guidelines, and screenshots as the project grows.

---

## License

本仓库尚未选择应用代码开源协议。发布前建议在 GitHub 创建仓库时选择一种协议，并在根目录加入 `LICENSE`：

- 宽松商用：MIT 或 Apache-2.0。
- 要求修改版继续开源：AGPL-3.0。
- 不确定时：先不要添加许可证，等确认后再发布。

内置字体引用遵循各自 OFL 许可；见 [LICENSES/FONTS.md](LICENSES/FONTS.md)。
