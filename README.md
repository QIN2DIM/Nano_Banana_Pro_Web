# 大香蕉图片生成工具 (Banana Pro Web)

<p align="center">
  <img src="assets/preview.png" alt="Banana Pro Web 预览" width="800">
</p>

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-blue.svg)
![Go](https://img.shields.io/badge/Go-1.24.3-00ADD8.svg)
![Gemini](https://img.shields.io/badge/GenAI%20SDK-1.40.0-orange.svg)

大香蕉图片生成工具 是一个高性能、易扩展的批量图片生成平台，专为创意工作者设计。它基于 Google Gemini API，支持高分辨率（最高 4K）的文生图与图生图功能，并提供直观的批量任务管理界面。

## 🌟 核心特性

- **🚀 极速生成**：基于 Go 语言后端与 Worker 池化技术，支持多任务并发处理。
- **🎨 4K 超清支持**：深度优化 Gemini 3.0 模型参数，支持多种画幅的 4K 超清生成。
- **📸 智能图生图**：支持多张参考图输入，精准控制生成风格与内容。
- **📦 批量处理**：一键开启批量生成模式，实时进度监控。
- **💾 历史记录管理**：完整的任务历史追踪，支持失败任务重试与本地缓存恢复。
- **🔌 灵活扩展**：模块化 Provider 设计，可轻松接入其他主流 AI 模型。

## 🛠️ 界面布局

系统采用经典的**三栏式响应式布局**：
1. **左侧配置面板**：实时调整模型参数（比例、分辨率、生成数量、参考图上传）。
2. **中间生成区域**：展示当前生成任务的实时状态、倒计时、进度条及生成结果。
3. **右侧历史面板**：持久化存储历史生成记录，支持瀑布流预览、大图查看。

## 💻 技术实现

### 后端 (Backend)
- **Go v1.24.3**: 高性能核心逻辑处理
- **Gin v1.11.0**: API 路由与中间件管理
- **Google GenAI SDK v1.40.0**: Gemini 模型深度对接
- **SQLite + GORM v1.25.12**: 任务与图片元数据持久化
- **Viper v1.21.0**: 多环境配置平滑切换
- **Worker Pool**: 异步任务并发调度系统

### 前端 (Frontend)
- **React v18.3.1**: 现代 UI 组件化开发框架
- **Vite v6.0.7**: 毫秒级热更新构建工具
- **Zustand v5.0.2**: 响应式轻量级状态管理
- **Tailwind CSS v3.4.17**: 原子化响应式样式系统
- **TypeScript v5.6.3**: 全链路类型安全保障
- **WebSocket**: 任务进度实时推送

## 🚀 快速启动

### 1. 环境准备
- Go 1.22+
- Node.js 18+
- Google Gemini API Key

### 2. 后端配置
```bash
cd backend
# 编辑配置文件
# 在 configs/config.yaml 中填入您的 providers.gemini.api_key
go run cmd/server/main.go
```

### 3. 前端启动
```bash
cd frontend
npm install
npm run dev
```

## ⚙️ 核心配置项

### 后端 (`backend/configs/config.yaml`)

| 配置项 | 描述 | 示例 |
| :--- | :--- | :--- |
| `server.port` | 服务监听端口 | `8080` |
| `storage.local_dir` | 图片存储路径 | `storage/local` |
| `providers.gemini.api_key` | Gemini API 密钥 | `AIzaSy...` |

### 前端 (`frontend/.env.development`)

| 配置项 | 描述 | 示例 |
| :--- | :--- | :--- |
| `VITE_API_URL` | 后端 API 地址 | `http://localhost:8080/api/v1` |

## 📂 项目结构
```text
.
├── backend/               # Go 后端核心代码
│   ├── cmd/               # 程序入口 (main.go)
│   ├── configs/           # 配置文件 (YAML)
│   ├── internal/          # 内部业务逻辑封装
│   └── storage/           # 本地持久化存储 (DB & Images)
└── frontend/              # React 前端代码
    ├── src/               # 源码目录
    │   ├── components/    # 业务 UI 组件
    │   ├── store/         # 状态管理 (Zustand)
    │   └── hooks/         # 自定义 React Hooks
    └── public/            # 静态资源文件
```

## 📄 开源协议
本项目采用 [MIT License](LICENSE) 协议开源。
