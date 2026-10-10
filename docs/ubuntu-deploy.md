# 预约功能部署指南（Ubuntu + HTTPS）

前提：域名已备案、HTTPS 证书已就绪（以下假设由 nginx 终结 TLS，应用只监听本机回环地址）。

## 方式一：Docker 部署（推荐）

### 1. 安装 Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # 重新登录后可免 sudo 使用 docker
```

### 2. 准备目录

按仓库结构把整个项目放到 `/opt/reservation/`（Dockerfile 已按 `src/server.js` 路径编写，无需改动）：

```bash
sudo mkdir -p /opt/reservation/data
sudo chown -R 1000:1000 /opt/reservation/data   # 容器内以 uid=1000(node) 运行
```

> 已有旧数据时，把根目录的 `reservations.db`、`reservations.db-shm`、`reservations.db-wal` 三个文件一起复制到 `data/`，即完成数据迁移。

### 3. docker-compose.yml

放在仓库根目录（与 `Dockerfile` 同级），配置从 `src/reservation.env` 注入：

```yaml
services:
  reservation:
    build: .
    container_name: reservation
    restart: unless-stopped
    env_file: ./src/reservation.env   # ADMIN_PASS 等敏感配置
    environment:                       # 容器专属运行配置（同名项覆盖 env_file）
      HOST: 0.0.0.0
      PORT: 8787
      DB_PATH: /data/reservations.db
    ports:
      - "127.0.0.1:8787:8787"   # 只暴露给本机，对外仍由 nginx + HTTPS 反代
    volumes:
      - ./data:/data
```

同时在根目录建一个 `.dockerignore`（防止数据库文件和 env 配置进入构建上下文）：

```
data/
docs/
*.db
*.db-shm
*.db-wal
src/reservation.env
```

### 4. 启动

```bash
cd /opt/reservation
sudo docker compose up -d --build
sudo docker compose logs -f              # 确认出现 listening on 0.0.0.0:8787
curl -s http://127.0.0.1:8787/healthz     # 应返回 {"ok":true}
```

说明：

- `restart: unless-stopped` 使容器**开机自启、崩溃自动重启**，无需再配 systemd。
- 数据落在宿主机 `/opt/reservation/data/reservations.db`，重建/升级容器不丢数据。
- 改了 `server.js` 后执行 `sudo docker compose up -d --build` 即完成更新。
- 端口只绑定 `127.0.0.1`，公网无法直接访问，与裸机部署的安全模型一致。

## 方式二：裸机部署（备选）

### A1. 安装 Node.js 24 LTS

`server.js` 使用 Node 内置的 `node:sqlite`，需要 **Node ≥ 23.4**（推荐 24 LTS）。Ubuntu 自带的 node 版本太旧，不要用 `apt install nodejs` 直接装。

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 确认 >= 23.4
```

### A2. 部署代码

```bash
sudo mkdir -p /opt/reservation
sudo cp src/server.js /opt/reservation/server.js
sudo chown -R www-data:www-data /opt/reservation
```

### A3. 配置环境变量

创建 `/etc/reservation.env`（可基于 `src/reservation.env` 复制后修改；只 root 可读）：

```ini
PORT=8787
ADMIN_USER=admin
ADMIN_PASS=换成你自己的强密码
# 可选：企业微信群机器人 Webhook，有新预约时自动推送到群
WECOM_WEBHOOK_URL=
```

```bash
sudo chmod 600 /etc/reservation.env
```

> 企业微信机器人获取方式：群聊右键 → 添加群机器人 → 复制 Webhook 地址。不配置也能正常使用，只是无群通知。

### A4. systemd 服务

创建 `/etc/systemd/system/reservation.service`：

```ini
[Unit]
Description=Reservation H5 server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/reservation
ExecStart=/usr/bin/node server.js
EnvironmentFile=/etc/reservation.env
Restart=always
RestartSec=3
User=www-data
Group=www-data
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/reservation

[Install]
WantedBy=multi-user.target
```

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now reservation
curl -s http://127.0.0.1:8787/healthz   # 应返回 {"ok":true}
```

## nginx 反向代理（两种部署方式通用）

在你已有的 HTTPS server 块中加入：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    # ……你已有的 ssl_certificate 配置保持不变……

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

浏览器访问 `https://your-domain.com/` 应看到预约表单页。

## 挂到公众号菜单

1. 登录 [微信公众平台](https://mp.weixin.qq.com)（订阅号/服务号均可）
2. 「自定义菜单」→ 添加一级或二级菜单，名称如「试用预约」
3. 菜单内容选「跳转网页」，URL 填 `https://your-domain.com/`
4. 保存发布（一般几分钟后全量生效）

## 日常使用

| 操作 | 方式 |
|------|------|
| 查看预约列表 | 浏览器打开 `https://your-domain.com/admin`，输入 Basic Auth 账号密码 |
| 导出 Excel | 管理页点「导出 CSV」，或直接访问 `/admin/export.csv` |
| 群通知 | 配置 `WECOM_WEBHOOK_URL` 后，每条新预约自动推送到企业微信群 |
| 数据备份 | 单文件即可（建议 crontab 每日复制）：Docker 部署在 `/opt/reservation/data/reservations.db`；裸机部署在 `/opt/reservation/reservations.db` |

## 维护备注

- **改科室列表**：编辑 `server.js` 顶部的 `DEPARTMENTS` 数组后重启：Docker `sudo docker compose up -d --build`；裸机 `sudo systemctl restart reservation`。
- **IP 频率限制**：同一 IP 每小时最多 10 次提交，防刷够用；如需调整改 `RATE_LIMIT`。
- **隐私合规**：表单页已附简要隐私说明；电话为个人信息，请勿将 `/admin` 地址或数据库文件外泄，密码务必用强密码。
- **无需申请**：此方案不调用微信 JS-SDK、不做网页授权，不涉及公众号开发资质要求；后续若想识别用户（openid 防重复提交），再评估接入网页授权（需要已认证服务号）。
- **日志**：Docker `sudo docker compose logs -f`；裸机 `sudo journalctl -u reservation -f`。