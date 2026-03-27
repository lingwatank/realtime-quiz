# 答题系统部署指南

本文档详细说明如何从 0 开始部署答题系统到 Cloudflare Workers。

## 目录

1. [准备工作](#1-准备工作)
2. [获取项目代码](#2-获取项目代码)
3. [创建 Cloudflare 资源](#3-创建-cloudflare-资源)
4. [配置项目](#4-配置项目)
5. [部署上线](#5-部署上线)
6. [验证部署](#6-验证部署)
7. [生产环境配置](#7-生产环境配置)
8. [常见问题](#8-常见问题)

---

## 1. 准备工作

### 1.1 所需账号和工具

| 项目 | 要求 | 说明 |
|------|------|------|
| Cloudflare 账号 | 免费版即可 | 用于部署 Workers 和 KV 存储 |
| Node.js | v18 或更高 | 运行 Wrangler CLI |
| Git | 可选 | 克隆代码仓库 |

### 1.2 安装 Wrangler CLI

Wrangler 是 Cloudflare 官方提供的命令行工具，用于管理 Workers 项目。

```bash
# 全局安装 Wrangler
npm install -g wrangler

# 验证安装
wrangler --version
# 应输出类似：3.x.x
```

### 1.3 登录 Cloudflare

```bash
wrangler login
```

执行后会自动打开浏览器授权页面：
1. 点击 "Allow" 授权 Wrangler 访问你的账号
2. 授权成功后，命令行会显示 "Successfully logged in"

**验证登录状态：**
```bash
wrangler whoami
# 应显示你的账号邮箱
```

---

## 2. 获取项目代码

### 2.1 克隆仓库

```bash
git clone <repository-url>
cd onlinexame
```

或下载 ZIP 文件解压后进入目录。

### 2.2 安装项目依赖

```bash
npm install
```

---

## 3. 创建 Cloudflare 资源

现在需要创建 KV 存储空间来保存题目和答题记录。

### 3.1 创建 KV 命名空间

```bash
wrangler kv namespace create "EXAM_KV"
```

**预期输出：**
```
🌀 Creating namespace with title "your-project-name-EXAM_KV"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "EXAM_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**📋 记录信息：**
- [ ] 记录 `id` 值（32位十六进制字符串）

### 3.2 创建预览环境 KV（推荐）

用于本地开发和测试，与生产环境数据隔离。

```bash
wrangler kv namespace create "EXAM_KV" --preview
```

**预期输出：**
```
✨ Success!
[[kv_namespaces]]
binding = "EXAM_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

**📋 记录信息：**
- [ ] 记录 `preview_id` 值

### 3.3 验证 KV 创建

```bash
wrangler kv namespace list
```

应看到你创建的命名空间。

---

## 4. 配置项目

### 4.1 生成 API Key

API Key 是管理端的唯一凭证，请妥善保管！

**Windows PowerShell：**
```powershell
.\generate-api-key.ps1
```

**Linux/Mac：**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex').toUpperCase())"
```

**预期输出：**
```
生成的 API Key:
F7C9A8F491009BBB736DEA2AEC92E5E86E8E986E1CDF59D164129003895DC6EC

请保存此 API Key，并设置到 Cloudflare Secrets 中：
wrangler secret put ADMIN_API_KEY
```

**⚠️ 重要提示：**
- [ ] **立即保存** API Key 到安全的地方（密码管理器）
- [ ] 这是管理系统的唯一凭证，丢失无法找回
- [ ] 生产环境务必使用 `wrangler secret` 设置，不要硬编码

### 4.2 配置 wrangler.toml

打开 `wrangler.toml` 文件，修改以下配置：

```toml
name = "your-project-name"  # ← 修改为你的项目名称（只能包含小写字母、数字、连字符）
main = "src/index.js"
compatibility_date = "2024-01-01"

# 静态资源绑定（Pages Functions）
[assets]
binding = "ASSETS"
directory = "./public"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "EXAM_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"           # ← 填入步骤 3.1 的 id
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"   # ← 填入步骤 3.2 的 preview_id
```

**📋 配置检查清单：**
- [ ] `name` 已修改（小写字母、数字、连字符）
- [ ] `id` 已填入（32位十六进制）
- [ ] `preview_id` 已填入（如使用预览环境）

### 4.3 设置 API Key（Secret）

**⚠️ 生产环境必须使用 Secrets，不要硬编码在代码或配置文件中！**

```bash
wrangler secret put ADMIN_API_KEY
```

输入步骤 4.1 生成的 API Key，回车确认。

**验证设置：**
```bash
wrangler secret list
```

应显示：
```
ADMIN_API_KEY
```

---

## 5. 部署上线

### 5.1 本地开发测试（可选）

```bash
npm run dev
```

或：
```bash
wrangler dev
```

访问 http://localhost:8787 进行测试。

**常用开发命令：**
```bash
# 指定端口
wrangler dev --port 8080

# 使用预览环境 KV
wrangler dev --preview

# 使用远程 KV（与生产环境共享数据）
wrangler dev --remote
```

### 5.2 部署到生产环境

```bash
npm run deploy
```

或：
```bash
wrangler deploy
```

**预期输出：**
```
✨ Successfully published your script to:
https://your-project-name.your-subdomain.workers.dev
```

### 5.3 绑定自定义域名（可选）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 选择你的项目
4. 点击 **Triggers** → **Custom Domains**
5. 点击 **Add Custom Domain**
6. 输入你的域名（如 `quiz.yourdomain.com`）
7. 按提示完成 DNS 配置

---

## 6. 验证部署

### 6.1 健康检查

```bash
curl https://your-domain.com/check-health
```

**预期响应（健康）：**
```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00Z",
  "status": "healthy",
  "checks": {
    "apiKey": { "configured": true, "message": "已配置" },
    "kvStorage": { "connected": true, "message": "已连接" },
    "assets": { "configured": true, "message": "已配置" }
  }
}
```

**如果 `status` 为 `unhealthy`：**
- 根据 `checks` 中的提示检查对应配置
- 常见原因：API Key 未设置、KV 未绑定

### 6.2 测试客户端

浏览器访问：
```
https://your-domain.com/client
```

应看到：
- 答题界面正常显示
- 可以设置昵称
- 能获取题目（如有）

### 6.3 测试管理端

**步骤 1：登录**
```
https://your-domain.com/login
```

输入 API Key 登录。

**步骤 2：访问管理首页**
```
https://your-domain.com/ctrl-panel
```

**步骤 3：导入测试题库**

创建 `test-bank.json`：
```json
{
  "questions": [
    {
      "id": "q_001",
      "text": "1+1等于几？",
      "options": [
        {"letter": "A", "text": "1"},
        {"letter": "B", "text": "2"},
        {"letter": "C", "text": "3"},
        {"letter": "D", "text": "4"}
      ],
      "correctAnswer": "B",
      "durationSeconds": 10
    }
  ]
}
```

在管理首页：
1. 点击"导入 JSON 题库"
2. 选择 `test-bank.json`
3. 确认导入成功
4. 点击题库中的"推送"按钮
5. 在客户端查看题目是否正常显示

---

## 7. 生产环境配置

### 7.1 安全加固

#### 7.1.1 限制 CORS 域名

编辑 `src/index.js`：
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com',  // 修改为你的域名
  // ...
};
```

#### 7.1.2 启用 Cloudflare 安全功能

1. 进入 Cloudflare Dashboard
2. 选择你的域名
3. 开启以下功能：
   - [ ] **Bot Fight Mode**（自动阻止恶意爬虫）
   - [ ] **Security Level**（设置为 Medium 或 High）
   - [ ] **Challenge Passage**（设置为 30 分钟）

### 7.2 环境管理

**生产环境：**
```bash
wrangler deploy
```

**预览/测试环境：**
```bash
wrangler deploy --env staging
```

需要在 `wrangler.toml` 中配置环境：
```toml
[env.staging]
name = "your-project-name-staging"
```

### 7.3 监控和日志

**查看实时日志：**
```bash
wrangler tail
```

**查看生产环境日志：**
```bash
wrangler tail --production
```

### 7.4 数据备份

**导出所有数据：**
```bash
# 获取 KV 命名空间 ID
wrangler kv namespace list

# 导出数据
wrangler kv key get --namespace-id=YOUR_ID "questions"
wrangler kv key get --namespace-id=YOUR_ID "question_history"
wrangler kv key get --namespace-id=YOUR_ID "question_bank"
```

或在管理端 `/data-mgmt` 页面导出 JSON。

---

## 8. 常见问题

### Q1: 部署后访问页面显示 404

**症状：**
- 访问首页显示 "Not Found"
- 或显示 Workers 默认页面

**诊断：**
```bash
curl https://your-domain.com/check-health
```

**可能原因及解决：**

| 原因 | 检查 | 解决 |
|------|------|------|
| 静态资源未绑定 | `assets` 为 `false` | 确认 `wrangler.toml` 中 `[assets]` 配置 |
| 路由配置错误 | - | 检查 `wrangler.toml` 是否有 `route` 配置冲突 |
| 部署失败 | - | 重新运行 `wrangler deploy` |

### Q2: 登录提示"服务器未配置 API Key"

**诊断：**
```bash
wrangler secret list
```

**解决：**
```bash
wrangler secret put ADMIN_API_KEY
# 输入你的 API Key
```

### Q3: 题目数据无法保存/读取

**诊断：**
```bash
curl https://your-domain.com/check-health
```

查看 `kvStorage` 状态。

**可能原因：**
- KV 命名空间 ID 配置错误
- 使用了预览环境 KV ID 但部署到生产环境

**解决：**
1. 确认 `wrangler.toml` 中的 `id` 正确
2. 重新部署：`wrangler deploy`

### Q4: 如何更新已部署的项目？

```bash
# 修改代码后
npm run deploy

# 或
wrangler deploy
```

### Q5: 如何回滚到旧版本？

Cloudflare Workers 自动保存最近 10 个部署版本：

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages → 你的项目
3. 点击 **Deployments** 标签
4. 找到要回滚的版本
5. 点击 **Rollback**

### Q6: 如何删除项目？

```bash
wrangler delete
```

**注意：**
- 这会删除 Worker，但不会删除 KV 数据
- 如需删除 KV 数据：
  ```bash
  wrangler kv namespace delete --namespace-id=YOUR_ID
  ```

### Q7: 本地开发时 KV 数据不同步

**原因：**
本地开发默认使用本地模拟 KV，与生产环境数据隔离。

**解决（使用远程 KV）：**
```bash
wrangler dev --remote
```

### Q8: API 返回 429 Too Many Requests

**原因：**
触发了速率限制（登录接口 15 分钟内最多 5 次尝试）。

**解决：**
等待 15 分钟后重试，或检查登录凭据是否正确。

---

## 附录

### A. 环境变量清单

| 变量名 | 类型 | 说明 | 设置方式 |
|--------|------|------|---------|
| `ADMIN_API_KEY` | Secret | 管理端 API 鉴权密钥 | `wrangler secret put` |
| `EXAM_KV` | 绑定 | KV 存储绑定 | `wrangler.toml` |
| `ASSETS` | 绑定 | 静态资源绑定 | `wrangler.toml` |

### B. Wrangler 常用命令

```bash
# 登录
wrangler login

# 查看账号信息
wrangler whoami

# 本地开发
wrangler dev
wrangler dev --port 8080
wrangler dev --remote

# 部署
wrangler deploy
wrangler deploy --env staging

# Secrets 管理
wrangler secret put KEY_NAME
wrangler secret list
wrangler secret delete KEY_NAME

# KV 管理（新版语法使用空格，旧版使用冒号）
wrangler kv namespace create "NAME"
wrangler kv namespace list
wrangler kv key put --namespace-id=ID "key" "value"
wrangler kv key list --namespace-id=ID
wrangler kv key get --namespace-id=ID "key"
wrangler kv key delete --namespace-id=ID "key"

# 查看日志
wrangler tail

# 删除项目
wrangler delete
```

### C. 项目结构说明

```
onlinexame/
├── public/                    # 静态资源（前端页面）
│   ├── client.html           # 观众答题页面
│   ├── login.html            # 管理端登录页面
│   ├── admin.html            # 管理端首页
│   ├── admin-data.html       # 数据管理页面
│   └── admin-stats.html      # 详细统计页面
├── src/
│   ├── index.js              # Workers 入口
│   └── modules/              # 业务模块
│       ├── auth.js           # 鉴权模块
│       ├── questionBank.js   # 题库管理
│       ├── questionUpload.js # 题目上传
│       ├── answerSubmit.js   # 答案提交
│       └── ...
├── doc/                      # 文档
│   └── deployment-guide.md   # 本文件
├── wrangler.toml             # Cloudflare 配置
├── package.json              # 项目配置
└── generate-api-key.ps1      # API Key 生成脚本
```

### D. 安全建议

1. **定期更换 API Key**
   ```bash
   wrangler secret delete ADMIN_API_KEY
   wrangler secret put ADMIN_API_KEY
   ```

2. **使用强密码生成器生成 API Key**
   - 长度至少 64 字符
   - 包含大小写字母、数字

3. **限制管理端访问**
   - 在 Cloudflare Dashboard 配置 IP 访问规则
   - 或使用 Cloudflare Access 添加额外身份验证

4. **启用审计日志**
   - 在 Cloudflare Dashboard 查看 Security Events
   - 定期检查 Workers 日志

5. **数据备份**
   - 定期导出重要数据
   - 使用 `wrangler kv key list` 和 `wrangler kv key get` 备份

---

**部署完成！** 🎉

如有问题，请：
1. 检查 `/check-health` 接口返回的状态
2. 查看 `wrangler tail` 日志
3. 参考 Cloudflare 官方文档：https://developers.cloudflare.com/workers/
