# 部署指南

本文档提供中国象棋对决项目的完整部署指南，包括后端服务器和小程序前端的部署。

## 目录

- [环境要求](#环境要求)
- [后端部署](#后端部署)
- [小程序部署](#小程序部署)
- [生产环境配置](#生产环境配置)
- [监控和维护](#监控和维护)

## 环境要求

### 后端服务器

- Node.js 18.0.0 或更高版本
- npm 9.0.0 或更高版本
- Redis 6.0 或更高版本（可选，用于生产环境缓存）
- MongoDB 4.4 或更高版本（可选，用于持久化存储）

### 小程序开发

- 微信开发者工具 1.06.0 或更高版本
- 微信小程序开发者账号

## 后端部署

### 1. 本地开发环境

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，配置必要的环境变量
# NODE_ENV=development
# PORT=3000
# CORS_ORIGIN=http://localhost:3000

# 启动开发服务器
npm run dev
```

开发服务器将在 `http://localhost:3000` 启动。

### 2. 生产环境部署

#### 方案一：使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 构建项目
npm run build

# 使用 PM2 启动
pm2 start dist/index.js --name chinese-chess-server

# 查看日志
pm2 logs chinese-chess-server

# 重启服务
pm2 restart chinese-chess-server

# 停止服务
pm2 stop chinese-chess-server
```

#### 方案二：使用 Docker

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
```

构建和运行：

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

#### 方案三：云服务部署

##### 阿里云 ECS

1. 购买 ECS 实例（推荐配置：2核4GB）
2. 配置安全组，开放 3000 端口
3. 使用 SSH 连接服务器
4. 按照 PM2 方案部署
5. 配置 Nginx 反向代理

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

##### 腾讯云 CVM

1. 购买 CVM 实例（推荐配置：2核4GB）
2. 配置安全组，开放 3000 端口
3. 使用 SSH 连接服务器
4. 按照 PM2 方案部署
5. 配置 Nginx 反向代理

### 3. 环境变量配置

生产环境必须配置以下环境变量：

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-miniprogram.domain
```

可选配置：

```env
# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# 日志级别
LOG_LEVEL=info

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 小程序部署

### 1. 开发环境配置

1. **下载微信开发者工具**
   - 访问 [微信开发者工具下载页面](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
   - 根据操作系统选择对应版本安装

2. **导入项目**
   - 打开微信开发者工具
   - 选择"导入项目"
   - 选择项目目录：`E:/claude code/chess/miniprogram`
   - 填写项目名称和 AppID
   - 点击"导入"

3. **配置服务器域名**
   - 登录 [微信公众平台](https://mp.weixin.qq.com/)
   - 进入"开发" -> "开发管理" -> "开发设置"
   - 配置服务器域名：
     - request 合法域名：`https://your-server-domain.com`
     - socket 合法域名：`wss://your-server-domain.com`

### 2. 本地调试

1. **修改服务器地址**
   - 编辑 `miniprogram/app.ts`
   - 修改 `globalData.serverUrl` 为本地服务器地址
   ```typescript
   globalData: {
     serverUrl: 'http://localhost:3000'
   }
   ```

2. **开启调试模式**
   - 在微信开发者工具中，点击"详情"
   - 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"

3. **测试功能**
   - 测试游戏创建
   - 测试走棋功能
   - 测试悔棋和提示
   - 测试 WebSocket 连接

### 3. 生产环境发布

1. **更新服务器地址**
   - 编辑 `miniprogram/app.ts`
   - 修改 `globalData.serverUrl` 为生产服务器地址
   ```typescript
   globalData: {
     serverUrl: 'https://your-server-domain.com'
   }
   ```

2. **检查配置**
   - 检查 `app.json` 中的配置
   - 确认所有页面路径正确
   - 确认组件引用正确

3. **上传代码**
   - 在微信开发者工具中，点击"上传"
   - 填写版本号和项目备注
   - 点击"上传"

4. **提交审核**
   - 登录 [微信公众平台](https://mp.weixin.qq.com/)
   - 进入"版本管理"
   - 选择"开发版本"
   - 点击"提交审核"
   - 填写审核信息

5. **发布上线**
   - 审核通过后，在"版本管理"中点击"发布"
   - 小程序即可上线

## 生产环境配置

### 1. HTTPS 配置

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 2. 性能优化

#### 后端优化

1. **启用 Gzip 压缩**
   ```javascript
   // src/index.ts
   import compression from 'compression'
   app.use(compression())
   ```

2. **配置缓存**
   ```javascript
   // 使用 Redis 缓存游戏状态
   import Redis from 'ioredis'
   const redis = new Redis({
     host: process.env.REDIS_HOST,
     port: process.env.REDIS_PORT,
     password: process.env.REDIS_PASSWORD
   })
   ```

3. **负载均衡**
   - 使用 Nginx 配置多个后端实例
   - 使用 Docker Compose 启动多个容器

#### 小程序优化

1. **分包加载**
   ```json
   {
     "subpackages": [
       {
         "root": "pages/spectate",
         "pages": ["spectate"]
       },
       {
         "root": "pages/settings",
         "pages": ["settings"]
       }
     ]
   }
   ```

2. **图片优化**
   - 使用 WebP 格式
   - 压缩图片大小

3. **代码优化**
   - 移除未使用的代码
   - 使用 Tree Shaking

### 3. 安全配置

1. **配置 CORS**
   ```env
   CORS_ORIGIN=https://your-miniprogram.domain
   ```

2. **启用速率限制**
   ```env
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

3. **配置防火墙**
   - 只开放必要的端口（80, 443, 22）
   - 使用 fail2ban 防止暴力破解

## 监控和维护

### 1. 日志监控

使用 PM2 日志：

```bash
# 查看实时日志
pm2 logs chinese-chess-server

# 查看错误日志
pm2 logs chinese-chess-server --err

# 清空日志
pm2 flush
```

### 2. 性能监控

使用 PM2 监控：

```bash
# 监控 CPU 和内存
pm2 monit

# 查看状态
pm2 status

# 查看详细信息
pm2 show chinese-chess-server
```

### 3. 错误追踪

集成 Sentry：

```bash
npm install @sentry/node
```

```typescript
// src/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: process.env.NODE_ENV
});
```

### 4. 定期备份

```bash
# 备份数据库（如果使用）
mongodump --db chess-game --out /backup/$(date +%Y%m%d)

# 备份到云存储
aws s3 sync /backup/ s3://your-bucket/backup/
```

### 5. 更新和维护

```bash
# 更新依赖
npm update

# 安全审计
npm audit

# 修复安全漏洞
npm audit fix
```

## 故障排除

### 常见问题

1. **Socket 连接失败**
   - 检查服务器是否运行
   - 检查防火墙设置
   - 检查域名配置

2. **走棋无响应**
   - 检查 API 端点
   - 查看 CORS 配置
   - 检查网络连接

3. **小程序无法加载**
   - 检查服务器域名配置
   - 确认 HTTPS 证书有效
   - 检查小程序配置

### 调试技巧

1. **使用 Chrome DevTools**
   - 在微信开发者工具中打开调试器
   - 查看 Console 日志
   - 检查 Network 请求

2. **使用 Postman 测试 API**
   - 测试各个 API 端点
   - 验证请求和响应格式

3. **查看 PM2 日志**
   ```bash
   pm2 logs --lines 100
   ```

## 扩展阅读

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Socket.IO 文档](https://socket.io/docs/)
- [Express 最佳实践](https://expressjs.com/en/advanced/best-practice-performance.html)
- [PM2 文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Docker 文档](https://docs.docker.com/)
