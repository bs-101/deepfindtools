# DeepFind Tools 部署说明

后台首次登录账号由环境变量控制：

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=change_this_admin_password
```

`ADMIN_PASSWORD` 是必填项，正式部署前必须在服务器 `.env` 里设置强密码。不要把真实密码提交到 GitHub。

## 数据库

当前 `docker-compose.yml` 已经内置 MySQL 8.4，不需要单独购买云数据库。后台新增的工具、分类、每日快讯都会存进 Docker Compose 里的 MySQL。

MySQL 数据会持久化在 Docker volume：

```bash
deepfindtools_mysql_data
```

正常执行 `docker compose down` 不会删除数据。只有执行 `docker compose down -v` 才会删除数据库 volume。

## 同步本地数据到线上初始化数据

如果你在本地后台新增或编辑了工具、分类、每日快讯，先导出当前本地数据：

```bash
python scripts/export_seed.py
```

然后提交并推送最新的 `data/seed.json`。服务器首次启动时，如果 MySQL 里的 `deepfind_tools` 为空，会自动建表并导入 `data/seed.json`。

注意：如果服务器 MySQL 已经有数据，`data/seed.json` 不会自动覆盖线上数据库，避免误删线上内容。

## 服务器启动

```bash
git clone https://bs-101@github.com/bs-101/deepfindtools.git
cd deepfindtools
cp .env.example .env
nano .env
docker compose up -d --build
```

`.env` 里至少修改这些值：

```bash
DB_PASSWORD=你的数据库强密码
MYSQL_ROOT_PASSWORD=你的 MySQL root 强密码
ADMIN_USER=admin
ADMIN_PASSWORD=你的后台强密码
APP_PORT=4173
```

应用容器只监听服务器本机：

```bash
127.0.0.1:4173
```

外网访问建议通过 Nginx 反向代理到这个端口。

## Nginx

项目里提供了模板：

```bash
deploy/nginx/deepfindtools.conf
```

在服务器上复制到 Nginx 配置目录：

```bash
sudo cp deploy/nginx/deepfindtools.conf /etc/nginx/sites-available/deepfindtools.conf
sudo nano /etc/nginx/sites-available/deepfindtools.conf
```

把里面的域名替换成你的真实域名：

```nginx
server_name your-domain.com www.your-domain.com;
```

启用站点并重载 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/deepfindtools.conf /etc/nginx/sites-enabled/deepfindtools.conf
sudo nginx -t
sudo systemctl reload nginx
```

如果要配置 HTTPS，建议用 Certbot：

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 常用维护命令

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend frontend nginx
docker compose down
docker compose up -d --build
```

后台地址：

```bash
https://你的域名/login
```
