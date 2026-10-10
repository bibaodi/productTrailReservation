# 预约功能部署指南（Ubuntu + HTTPS）

前提：域名已备案、HTTPS 证书已就绪（以下假设由 nginx 终结 TLS，应用只监听本机回环地址）。

## 1. 安装 Node.js 24 LTS

`server.js` 使用 Node 内置的 `node:sqlite`，需要 **Node ≥ 23.4**（推荐 24 LTS）。Ubuntu 自带的 node 版本太旧，不要用 `apt install nodejs` 直接装。

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 确认 >= 23.4
```

## 2. 部署代码

```bash
sudo mkdir -p /opt/reservation
# 将 server.js 放入该目录
sudo cp server.js /opt/reservation/server.js
sudo chown -R www-data:www-data /opt/reservation
```

## 3. 配置环境变量

创建 `/etc/reservation.env`（只 root 可读）：

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

## 4. systemd 服务

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

## 5. nginx 反向代理

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

## 6. 挂到公众号菜单

1. 登录 [微信公众平台](https://mp.weixin.qq.com)（订阅号/服务号均可）
2. 「自定义菜单」→ 添加一级或二级菜单，名称如「试用预约」
3. 菜单内容选「跳转网页」，URL 填 `https://your-domain.com/`
4. 保存发布（一般几分钟后全量生效）

## 7. 日常使用

| 操作 | 方式 |
|------|------|
| 查看预约列表 | 浏览器打开 `https://your-domain.com/admin`，输入 Basic Auth 账号密码 |
| 导出 Excel | 管理页点「导出 CSV」，或直接访问 `/admin/export.csv` |
| 群通知 | 配置 `WECOM_WEBHOOK_URL` 后，每条新预约自动推送到企业微信群 |
| 数据备份 | 备份 `/opt/reservation/reservations.db` 单个文件即可（建议加入 crontab 每日复制） |

## 8. 维护备注

- **改科室列表**：编辑 `server.js` 顶部的 `DEPARTMENTS` 数组，然后 `sudo systemctl restart reservation`。
- **IP 频率限制**：同一 IP 每小时最多 10 次提交，防刷够用；如需调整改 `RATE_LIMIT`。
- **隐私合规**：表单页已附简要隐私说明；电话为个人信息，请勿将 `/admin` 地址或数据库文件外泄，密码务必用强密码。
- **无需申请**：此方案不调用微信 JS-SDK、不做网页授权，不涉及公众号开发资质要求；后续若想识别用户（openid 防重复提交），再评估接入网页授权（需要已认证服务号）。
- **日志**：`sudo journalctl -u reservation -f` 查看运行日志。