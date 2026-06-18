# DeepFind Tools Docker 部署

后台数据默认写入 PostgreSQL。应用启动时会优先连接 `DB_ENGINE=django.db.backends.postgresql` 指向的数据库；如果 PostgreSQL 不可用，才会回退到 `data/db.json`。

## 服务器部署

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 修改 `.env`：

```bash
DB_PASSWORD=你的数据库强密码
ADMIN_PASSWORD=你的后台强密码
APP_PORT=4173
```

3. 启动：

```bash
docker compose up -d --build
```

4. 查看日志：

```bash
docker compose logs -f app
```

访问：

- 前台：`http://服务器IP:4173/`
- 后台：`http://服务器IP:4173/login`

## 数据持久化

PostgreSQL 数据保存在 Docker volume：`deepfindtools_postgres_data`。不要随意删除这个 volume，否则后台新增的工具和资讯会丢失。

## 常用维护

```bash
docker compose ps
docker compose restart app
docker compose down
docker compose up -d --build
```
