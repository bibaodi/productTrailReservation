# syntax=docker/dockerfile:1
# 产品预约试用服务 — 单文件 Node 应用（无需安装任何依赖）
# 构建镜像:  docker build -t reservation .
# 运行方式见 docker-compose.yml（推荐），或:
#   docker run -d --name reservation --restart unless-stopped \
#     -p 127.0.0.1:8787:8787 -v /opt/reservation/data:/data \
#     -e ADMIN_PASS=你的强密码 reservation
FROM node:24-alpine

WORKDIR /app
# 构建上下文是仓库根目录，因此 COPY 路径带 src/
COPY --chown=node:node src/server.js server.js

# 生产配置：监听容器内所有地址，SQLite 放在挂载卷 /data 中
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    DB_PATH=/data/reservations.db

# 以非 root 的 node 用户运行
USER node
VOLUME /data
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz > /dev/null || exit 1

CMD ["node", "server.js"]
