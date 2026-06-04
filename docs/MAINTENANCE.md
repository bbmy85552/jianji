# GitHub 发布与维护计划 / GitHub Release And Maintenance Plan

## 中文

### 首次发布

1. 在服务器或本机确认：
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `bash -n scripts/install.sh`
2. 确认 `git status --short --untracked-files=all` 中没有：
   - `.env` / `server/.env`
   - SQLite 数据库
   - `server/uploads/`
   - `node_modules/`
   - `dist/` / `server/dist/`
3. 创建 GitHub 仓库：`https://github.com/staklab/jianji`
4. 添加远程并推送：
   ```bash
   git remote add origin https://github.com/staklab/jianji.git
   git branch -M main
   git push -u origin main
   ```
5. 打第一个标签：
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

### 每次发布前

- 更新 README、配置说明和一键部署脚本。
- 检查 Docker Compose 是否仍能保留数据卷并成功迁移数据库。
- 检查 `server/.env.example` 是否包含所有新增环境变量。
- 运行完整测试和构建。
- 写 Release Notes：新增功能、修复、迁移注意事项、部署注意事项。

### 安全维护

- 不提交真实 `.env`、SMTP 密码、JWT 密钥、数据库、上传文件。
- 定期轮换管理员密码和 SMTP 授权码。
- 如果必须更换 `JWT_SECRET`，先评估邮箱聚合凭据是否会失效。
- 定期备份 `jianji-data` 与 `jianji-uploads`。

## English

### First Release

1. Verify locally or on a server:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `bash -n scripts/install.sh`
2. Make sure Git does not include:
   - `.env` / `server/.env`
   - SQLite databases
   - `server/uploads/`
   - `node_modules/`
   - `dist/` / `server/dist/`
3. Create the GitHub repository: `https://github.com/staklab/jianji`
4. Add remote and push:
   ```bash
   git remote add origin https://github.com/staklab/jianji.git
   git branch -M main
   git push -u origin main
   ```
5. Tag the first version:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

### Before Each Release

- Update README, deployment docs, and the installer script.
- Verify Docker Compose keeps persistent volumes and runs database migrations.
- Check `server/.env.example` for new environment variables.
- Run the full test and build pipeline.
- Write release notes: features, fixes, migrations, and deployment notes.

### Security Maintenance

- Never commit real `.env` files, SMTP passwords, JWT secrets, databases, or uploads.
- Rotate admin passwords and SMTP app passwords periodically.
- Be careful when changing `JWT_SECRET`; encrypted mail credentials depend on it.
- Back up `jianji-data` and `jianji-uploads` regularly.
