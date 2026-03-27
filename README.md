# 答题系统

一个基于 Cloudflare Workers 的轻量级答题系统，支持实时答题、自动统计、历史记录管理、题库导入等功能。

## 功能特性

- 📱 **观众答题** - 简洁的答题界面，支持昵称设置
- 📝 **题目管理** - 支持单选题，可设置倒计时
- 📚 **题库管理** - 支持 JSON 格式题库导入（最多 100 题）
- 🚀 **快速推送** - 从题库一键推送题目，或点击填充后编辑推送
- 📊 **实时统计** - 答题正确率、参与人数实时展示
- 📈 **历史记录** - 自动保存历史题目，支持查看和导出
- 🔄 **自动切换** - 新题目自动替换旧题目，旧题目进入历史
- 🎨 **响应式设计** - 适配桌面和移动设备
- 🔐 **API 鉴权** - 管理端 API 使用 API Key 鉴权，保护数据安全
- 🛡️ **安全防护** - XSS 防护、点击劫持防护、速率限制等

## 技术栈

- **前端**：原生 HTML + JavaScript + CSS
- **后端**：Cloudflare Workers
- **存储**：Cloudflare KV
- **部署**：Cloudflare Pages

## 快速开始

### 访问地址

| 功能 | 路径 | 说明 |
|------|------|------|
| 观众答题 | `/client` | 无需登录 |
| 管理登录 | `/login` | 输入 API Key |
| 题库管理 | `/ctrl-panel` | 推送题目、查看统计 |
| 数据管理 | `/data-mgmt` | 导出数据、清空记录 |
| 详细统计 | `/stats-view` | 题目详情分析 |

### 使用流程

**主持人：**
1. 运行 `generate-api-key.ps1` 生成 API Key
2. 执行 `wrangler secret put ADMIN_API_KEY` 配置密钥
3. 访问 `/login` 登录管理端
4. 导入题库 → 推送题目 → 查看统计

**观众：**
1. 访问 `/client` 页面
2. 设置昵称（可选）
3. 选择答案并提交

## 题库格式

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

## 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lingwatank/realtime-quiz)

### 手动部署

```bash
npm install
wrangler login
wrangler kv namespace create "EXAM_KV"
# 将输出的 id 填入 wrangler.toml
wrangler secret put ADMIN_API_KEY
npm run deploy
```

详细部署指南请参考 [docs/deployment-guide.md](docs/deployment-guide.md)

## 项目结构

```
onlinexame/
├── public/              # 静态页面
│   ├── client.html     # 观众答题页
│   ├── login.html      # 登录页
│   ├── admin.html      # 管理首页
│   ├── admin-data.html # 数据管理
│   └── admin-stats.html# 统计页面
├── src/
│   ├── index.js        # Worker 入口
│   └── modules/        # 业务模块
├── generate-api-key.ps1
└── wrangler.toml
```

## API 概览

**公开接口：**
- `POST /api/latest` - 获取最新题目
- `POST /api/action` - 提交答案、客户端管理
- `POST /api/login` - 登录验证

**管理接口**（需 `Authorization: Bearer <API_KEY>`）：
- `GET /api/data` - 获取题目/记录/统计数据
- `GET /api/export` - 导出数据
- `POST /api/action` - 题目管理、题库操作

## 安全说明

- 管理端使用 API Key 鉴权
- 登录接口带速率限制（15分钟最多5次）
- 已配置 XSS、点击劫持等安全防护
- 生产环境请使用 `wrangler secret` 存储密钥

## 注意事项

1. 系统采用单题模式，新题目会自动替换当前题目
2. 题目可设置倒计时，结束后无法提交
3. 同一用户只能回答每道题目一次
4. KV 存储有短暂的一致性延迟
5. 建议单个题库不超过 100 题（25MB 限制）

## 许可证

MIT License
