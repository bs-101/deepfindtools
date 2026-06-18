# DeepFind Tools Docker 部署

后台数据默认写入 Docker Compose 里的 MySQL。应用启动时会优先连接 `DB_ENGINE=django.db.backends.mysql` 指向的数据库；如果数据库不可用，才会回退到 `data/db.json`。

应用也保留 PostgreSQL 支持，但当前 `docker-compose.yml` 默认使用 MySQL 8.4，不需要另外购买云数据库。

## 上线前同步本地数据

如果你已经在本地后台新增或编辑过工具/资讯，先导出当前数据库到 `data/seed.json`：

```bash
python scripts/export_seed.py
```

然后提交并推送最新的 `data/seed.json`。服务器首次启动时，如果 MySQL 里的 `deepfind_tools` 为空，会自动建表并导入 `data/seed.json`。

如果服务器 MySQL 已经启动过并产生了数据，`data/seed.json` 不会自动覆盖线上数据库，避免误删线上内容。

## 服务器部署

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 修改 `.env`：

```bash
DB_PASSWORD=你的数据库强密码
MYSQL_ROOT_PASSWORD=你的 MySQL root 强密码
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

MySQL 数据保存在 Docker volume：`deepfindtools_mysql_data`。不要随意删除这个 volume，否则后台新增的工具和资讯会丢失。

## 常用维护

```bash
docker compose ps
docker compose restart app
docker compose down
docker compose up -d --build
```

## 重新用 seed 初始化

只有在你确定要清空线上数据时才执行：

```bash
docker compose down -v
docker compose up -d --build
```

`down -v` 会删除 MySQL volume，线上后台新增的数据会丢失。
