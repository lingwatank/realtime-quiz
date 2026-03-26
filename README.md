# 答题系统

一个基于 Cloudflare Workers 的轻量级答题系统，支持实时答题、自动统计、历史记录管理等功能。

## 功能特性

- 📱 **观众答题** - 简洁的答题界面，支持昵称设置
- 📝 **题目管理** - 支持单选题，可设置倒计时
- 📊 **实时统计** - 答题正确率、参与人数实时展示
- 📚 **历史记录** - 自动保存历史题目，支持查看和导出
- 🔄 **自动切换** - 新题目自动替换旧题目，旧题目进入历史
- 🎨 **响应式设计** - 适配桌面和移动设备
- 🔐 **API 鉴权** - 管理端 API 使用 API Key 鉴权，保护数据安全

## 技术栈

- **前端**：原生 HTML + JavaScript + CSS
- **后端**：Cloudflare Workers
- **存储**：Cloudflare KV
- **部署**：Cloudflare Pages

## 访问地址

### 客户端（观众答题）
```
https://your-domain.com/client
```

### 管理端（需要登录）

| 功能 | 访问路径 | 说明 |
|------|----------|------|
| 登录页面 | `/login` | 输入 API Key 登录 |
| 管理首页 | `/ctrl-panel` | 创建题目、查看实时统计 |
| 数据管理 | `/data-mgmt` | 数据导出、清空记录 |
| 详细统计 | `/stats-view` | 题目详情、答题记录分析 |

**注意**：管理端需要先访问 `/login` 登录，输入正确的 API Key 后才能访问其他管理页面。

## 使用指南

### 主持人/管理员

1. **生成 API Key** - 运行 `generate-api-key.ps1` 生成随机 API Key
2. **配置 API Key** - 将 API Key 配置到 `wrangler.toml` 的 `[vars]` 中
3. **登录管理端** - 访问 `/login`，输入 API Key 登录
4. **创建题目** - 在管理首页输入题目、选项、正确答案和倒计时时间
5. **推送题目** - 点击"推送到客户端"将题目发布给观众
6. **查看统计** - 在管理首页查看实时答题统计
7. **历史管理** - 在数据管理页面查看历史题目和导出数据

### 观众

1. **访问客户端** - 打开 `/client` 页面
2. **设置昵称** - 输入昵称（可选，默认为匿名用户）
3. **获取题目** - 自动获取最新题目
4. **提交答案** - 选择 A/B/C/D 选项并提交
5. **查看结果** - 倒计时结束后显示正确答案和答题结果

## API 接口

### 公开接口（无需鉴权）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/latest` | POST | 获取最新题目（含用户答题状态） |
| `/api/action` | POST | `submitAnswer` - 提交答案 |
| `/api/action` | POST | `clientJoin` / `clientLeave` - 客户端管理 |
| `/api/login` | POST | 登录验证 |

### 管理接口（需要 API Key 鉴权）

所有管理接口需要在请求 Header 中添加：`Authorization: Bearer <API_KEY>`

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/data?type=questions` | GET | 获取题目列表 |
| `/api/data?type=history` | GET | 获取历史题目 |
| `/api/data?type=stats` | GET | 获取统计数据 |
| `/api/admin/summary` | GET | 获取管理端摘要数据 |
| `/api/export?type=all` | GET | 导出所有数据 |
| `/api/action` | POST | `createQuestion` - 创建题目 |
| `/api/action` | POST | `deleteQuestion` - 删除题目 |
| `/api/action` | POST | `clearRecords` - 清空答题记录 |

## 部署说明

### 1. 准备工作

- Cloudflare 账号
- 本仓库代码

### 2. 创建 KV 命名空间

在 Cloudflare Dashboard 中创建一个 KV 命名空间，用于存储题目和答题记录。

### 3. 生成 API Key

```powershell
# 运行脚本生成随机 API Key
.\generate-api-key.ps1
```

### 4. 配置 wrangler.toml

```toml
name = "your-project-name"
main = "src/index.js"
compatibility_date = "2024-01-01"

# 环境变量 - API Key 用于管理端鉴权
[vars]
ADMIN_API_KEY = "your-generated-api-key"

# 静态资源绑定
[assets]
binding = "ASSETS"
directory = "./public"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "EXAM_KV"
id = "your-kv-namespace-id"
preview_id = "your-kv-namespace-preview-id"
```

**生产环境建议**：使用 `wrangler secret` 设置 API Key，而不是明文写在配置文件中：
```bash
wrangler secret put ADMIN_API_KEY
```

### 5. 部署

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 部署到生产环境
npm run deploy
```

## 项目结构

```
onlinexame/
├── public/                 # 静态资源
│   ├── client.html        # 客户端答题页面
│   ├── login.html         # 管理端登录页面
│   ├── admin.html         # 管理端首页
│   ├── admin-data.html    # 数据管理页面
│   └── admin-stats.html   # 详细统计页面
├── src/
│   ├── index.js           # Cloudflare Workers 入口
│   ├── modules/           # 业务模块
│   │   ├── auth.js             # API 鉴权模块
│   │   ├── questionUpload.js   # 题目上传管理
│   │   ├── questionFetch.js    # 题目获取
│   │   ├── answerSubmit.js     # 答案提交
│   │   ├── answerRecord.js     # 答题记录
│   │   ├── clientJoin.js       # 客户端管理
│   │   └── adminData.js        # 管理数据
├── generate-api-key.ps1   # API Key 生成脚本
├── wrangler.toml          # Cloudflare 配置
└── README.md              # 项目说明
```

## 数据模型

### 题目（Question）

```json
{
  "id": 1,
  "text": "题目内容",
  "type": "single",
  "options": [
    {"letter": "A", "text": "选项A"},
    {"letter": "B", "text": "选项B"}
  ],
  "correctAnswer": "A",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-01-01T00:01:00Z",
  "expired": false
}
```

### 答题记录（AnswerRecord）

```json
{
  "id": 1,
  "questionId": 1,
  "userAnswer": "A",
  "isCorrect": true,
  "userId": "user_xxx",
  "nickname": "张三",
  "submittedAt": "2024-01-01T00:00:30Z"
}
```

## 安全说明

1. **API Key 鉴权** - 管理端所有 API 都需要有效的 API Key 才能访问
2. **登录机制** - 管理端页面需要先登录，Token 保存在浏览器 localStorage
3. **随机路径** - 管理端使用有意义但不易猜测的 URL 路径
4. **分层鉴权** - 客户端接口公开，管理接口需要鉴权
5. **数据隔离** - 每个部署实例使用独立的 KV 存储，数据互不干扰

## 注意事项

1. **单题模式** - 系统采用单题模式，新题目会自动替换当前题目，旧题目进入历史
2. **倒计时** - 题目可设置倒计时（秒），倒计时结束后无法提交答案
3. **防重复提交** - 同一用户只能回答每道题目一次
4. **数据持久化** - 数据存储在 Cloudflare KV 中，有短暂的最终一致性延迟
5. **API Key 安全** - 请妥善保管 API Key，不要泄露给未授权人员

## 许可证

MIT License
