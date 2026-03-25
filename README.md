# 答题系统

一个基于 Cloudflare Workers 的简易答题系统，支持现场答题、实时统计功能。

## 功能特性

- 📱 观众扫码答题
- 📊 实时统计结果
- 🔄 支持多种题型（单选、多选）
- 🎯 主持人控制答题节奏
- 📍 兼容校园网络环境

## 技术栈

- **前端**：HTML + JavaScript + TailwindCSS
- **后端**：Cloudflare Workers
- **存储**：Worker KV
- **部署**：Cloudflare Pages

## 使用方法

### 主持人
1. 打开管理端页面
2. 创建答题房间
3. 显示二维码给观众
4. 输入题目并下发
5. 查看实时统计结果

### 观众
1. 扫描二维码
2. 输入昵称加入房间
3. 看大屏幕获取题目
4. 在手机上选择答案并提交
5. 查看答题结果

## 部署

1. Fork 本仓库
2. 连接到 Cloudflare Pages
3. 配置构建设置
4. 部署完成后访问生成的 URL

## 项目结构

```
onlinexame/
├── index.html        # 管理端页面
├── client.html       # 观众页面
├── functions/        # Cloudflare Functions
├── README.md         # 项目说明
└── LICENSE           # 许可证
```

## 许可证

MIT License - 详见 LICENSE 文件
