# 大香蕉图片生成工具 后端 API 对接文档

**文档版本**: v1.6
**最后更新**: 2025-12-29
**后端地址**: http://localhost:8080

## 📢 重要更新 (v1.6)

- ✅ **移除认证**: 所有 API 无需认证即可直接访问
- ✅ **限流保护**: 每个客户端 IP 每秒最多 10 个请求，突发容量 20 个
- ✅ **WebSocket 实时出图**: `progress.latestImage` 可能携带最新图片信息（用于前端实时展示）
- ✅ **options 生效**: `options` JSON 会映射到 SDK 生成配置（如 `temperature/seed/topP/topK` 等）
- ✅ **部分提交可继续**: 子任务提交部分成功时，返回 `200` 且以 `totalCount` 为准推进

---

## 📋 目录

1. [统一响应格式](#统一响应格式)
2. [图片生成相关 API](#图片生成相关-api)
3. [历史记录相关 API](#历史记录相关-api)
4. [图片管理相关 API](#图片管理相关-api)
5. [WebSocket 实时通信](#websocket-实时通信)
6. [数据模型说明](#数据模型说明)
7. [错误码说明](#错误码说明)
8. [完整前端示例](#完整前端示例)

---

## 限流说明

- 每个 IP 每秒最多 10 个请求
- 突发容量：20 个请求
- 超出限制返回 429 状态码

**限流失败响应** (429):
```json
{
  "code": 429,
  "message": "请求过于频繁,请稍后再试"
}
```

---

## 统一响应格式

所有 API 响应均遵循以下格式：

### 成功响应
```json
{
  "code": 0,
  "message": "success",
  "data": {
    // 具体数据内容
  }
}
```

### 错误响应
```json
{
  "code": 400,  // HTTP 状态码
  "message": "错误信息描述"
}
```

---

## 图片生成相关 API

### 1. 创建批量生成任务

**接口说明**: 创建一个批量图片生成任务

**请求方式**: `POST`

**请求路径**: `/api/v1/generate/batch`

**请求头**:
```
Content-Type: application/json
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| prompt | string | 是 | 图片描述提示词 | "一只可爱的猫咪" |
| model | string | 是 | AI模型名称 | "gemini-2.5-flash-image" |
| count | number | 是 | 生成数量(1-100) | 5 |
| apiKey | string | 是 | Gemini API密钥 | "your-api-key" |
| apiBase | string | 否 | API基础URL | "https://yunwu.ai" |
| aspectRatio | string | 否 | 图片宽高比 | "9:16" (支持: "1:1", "3:4", "4:3", "9:16", "16:9") |
| imageSize | string | 否 | 图片尺寸 | "1K" (支持: "1K", "2K", "4K") |
| options | string | 否 | 其他选项(JSON格式)，用于映射SDK生成配置 | "{\"temperature\": 0.7}" |

**请求示例**:
```json
{
  "prompt": "一只可爱的猫咪在花园里玩耍",
  "model": "gemini-2.5-flash-image",
  "count": 5,
  "apiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "apiBase": "https://yunwu.ai",
  "aspectRatio": "9:16",
  "imageSize": "1K"
}
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "prompt": "一只可爱的猫咪在花园里玩耍",
    "model": "gemini-2.5-flash-image",
    "totalCount": 5,
    "completedCount": 0,
    "status": "processing",
    "options": "",
    "errorMessage": "",
    "createdAt": "2025-12-25T10:30:00Z",
    "updatedAt": "2025-12-25T10:30:00Z",
    "images": []
  }
}
```

**部分提交成功说明**:
- 当后端提交子任务到Worker池过程中发生错误时，可能只提交成功部分子任务。
- 此时接口仍返回 `200`，但 `data.totalCount` 会小于请求的 `count`，且 `data.errorMessage` 会包含原因；前端应以 `totalCount` 为准展示进度。

**失败响应** (400):
```json
{
  "code": 400,
  "message": "生成数量必须在 1-100 张之间"
}
```

**失败响应** (500):
```json
{
  "code": 500,
  "message": "创建任务失败，请稍后重试"
}
```

---

### 2. 创建批量图生图任务（带参考图片）

**接口说明**: 创建一个批量图生图任务，支持上传参考图片进行相似风格的图片生成。通过参考图片指导 AI 模型生成符合特定风格、场景或视觉元素的新图片。

**核心特性**:
- 🖼️ **多图参考**: 支持上传 1-10 张参考图片，更多参考提高生成精准度
- 🎨 **风格保持**: AI 会根据参考图保持视觉风格和色彩搭配
- 📏 **灵活尺寸**: 支持多种宽高比和分辨率选择
- ⚡ **批量生成**: 一次请求可生成 1-100 张图片

**请求方式**: `POST`

**请求路径**: `/api/v1/generate/batch-with-images`

**请求头**:
```
Content-Type: multipart/form-data
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| prompt | string | 是 | 图片描述提示词（会根据参考图风格调整） | "根据这些参考图生成一张类似风格的办公室合影" |
| model | string | 是 | AI模型名称（需支持图生图功能） | "gemini-3-pro-image-preview" |
| count | number | 是 | 生成数量(1-100) | 1 |
| apiKey | string | 是 | Gemini API密钥 | "your-api-key" |
| apiBase | string | 否 | API基础URL（自定义转发地址） | "https://yunwu.ai" |
| aspectRatio | string | 否 | 图片宽高比 | "9:16" (支持: "1:1", "3:4", "4:3", "9:16", "16:9") |
| imageSize | string | 否 | 图片分辨率 | "2K" (支持: "1K", "2K", "4K") |
| refImages | file[] | 否 | 参考图片文件列表（支持多张） | JPG/PNG/WEBP 图片文件 |
| options | string | 否 | 其他高级选项(JSON格式)，用于映射SDK生成配置 | "{\"temperature\": 0.7}" |

**请求示例** (JavaScript/Fetch API):
```javascript
// 创建 FormData 对象
const formData = new FormData();

// 添加文本参数
formData.append('prompt', '根据这些参考图生成一张类似风格的办公室团队合照');
formData.append('model', 'gemini-3-pro-image-preview');
formData.append('count', '3');  // 生成3张图片
formData.append('apiKey', 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
formData.append('apiBase', 'https://yunwu.ai');
formData.append('aspectRatio', '16:9');  // 宽屏比例
formData.append('imageSize', '2K');      // 2K分辨率

// 添加参考图片（可以添加多张）
const fileInput = document.getElementById('refImages');
for (let i = 0; i < fileInput.files.length; i++) {
  formData.append('refImages', fileInput.files[i]);
}

// 发送请求
try {
  const response = await fetch('http://localhost:8080/api/v1/generate/batch-with-images', {
    method: 'POST',
    body: formData  // 注意：不需要设置 Content-Type 头，浏览器会自动设置
  });

  const result = await response.json();
  if (result.code === 0) {
    console.log('任务创建成功:', result.data.id);
  } else {
    console.error('创建失败:', result.message);
  }
} catch (error) {
  console.error('请求失败:', error);
}
```

**请求示例** (cURL):
```bash
# 单张参考图
curl -X POST http://localhost:8080/api/v1/generate/batch-with-images \
  -F "prompt=根据这些参考图生成一张类似风格的办公室合影" \
  -F "model=gemini-3-pro-image-preview" \
  -F "count=1" \
  -F "apiKey=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
  -F "apiBase=https://yunwu.ai" \
  -F "aspectRatio=16:9" \
  -F "imageSize=2K" \
  -F "refImages=@office_style.jpg"

# 多张参考图
curl -X POST http://localhost:8080/api/v1/generate/batch-with-images \
  -F "prompt=结合这些风格生成新的办公室设计图" \
  -F "model=gemini-3-pro-image-preview" \
  -F "count=2" \
  -F "apiKey=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
  -F "apiBase=https://yunwu.ai" \
  -F "aspectRatio=16:9" \
  -F "imageSize=2K" \
  -F "refImages=@style1.jpg" \
  -F "refImages=@style2.jpg" \
  -F "refImages=@style3.jpg"
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "prompt": "根据这些参考图生成一张类似风格的办公室合影",
    "model": "gemini-3-pro-image-preview",
    "totalCount": 3,
    "completedCount": 0,
    "status": "processing",
    "options": "",
    "errorMessage": "",
    "createdAt": "2025-12-26T10:35:00Z",
    "updatedAt": "2025-12-26T10:35:00Z",
    "images": []
  }
}
```

**失败响应** (400 - 缺少必填参数):
```json
{
  "code": 400,
  "message": "请求参数有误，请检查后重试"
}
```

**失败响应** (400 - count 参数无效):
```json
{
  "code": 400,
  "message": "请求参数有误，请检查后重试"
}
```

**失败响应** (400 - 读取图片失败):
```json
{
  "code": 400,
  "message": "请求参数有误，请检查后重试"
}
```

**实际使用流程**:
```
1. 用户选择参考图片 →
2. 输入生成描述和参数 →
3. 前端生成FormData并上传 →
4. 后端创建任务并将参考图数据与prompt发送给Gemini API →
5. Gemini 返回生成结果 →
6. 前端通过 WebSocket 或轮询接收进度和生成的图片
```

**注意事项**:

| 事项 | 说明 |
|------|------|
| 参考图大小 | 建议不超过5MB，过大会影响上传和处理速度 |
| 参考图数量 | 1-10张为佳，过多反而可能降低生成精准度 |
| 支持格式 | JPG/JPEG, PNG, WEBP，建议使用高质量图片 |
| 模型选择 | 必须使用支持图生图的模型（如 gemini-3-pro-image-preview） |
| 顺序保持 | 参考图片会按上传顺序提交给API，影响生成结果 |
| 参数组合 | aspectRatio 和 imageSize 参数可选，若不指定则使用模型默认值 |
| 错误处理 | 若某张图片读取失败，整个请求会失败，需重新上传 |
| 生成时间 | 根据数量和模型，通常需要 10-60 秒完成 |

**常见场景**:
- 🏢 **企业形象**：上传企业VI、办公环境参考图，生成符合品牌风格的新图片
- 🎨 **艺术创作**：上传艺术风格参考（油画、素描、插画等），生成相同风格的新创意
- 📸 **产品设计**：上传产品设计参考，生成新的配色或造型方案
- 🎬 **视频截图**：上传视频截图作参考，生成视觉风格一致的额外素材

---

### 3. 查询任务状态

**接口说明**: 查询指定任务的当前状态和进度

**请求方式**: `GET`

**请求路径**: `/api/v1/generate/status/:taskId`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| taskId | string | 是 | 任务ID |

**请求示例**:
```
GET /api/v1/generate/status/550e8400-e29b-41d4-a716-446655440000
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "prompt": "一只可爱的猫咪在花园里玩耍",
    "model": "gemini-2.5-flash-image",
    "totalCount": 5,
    "completedCount": 3,
    "status": "processing",
    "options": "",
    "errorMessage": "",
    "createdAt": "2025-12-25T10:30:00Z",
    "updatedAt": "2025-12-25T10:32:00Z",
    "images": [
      {
        "id": "image-001",
        "taskId": "550e8400-e29b-41d4-a716-446655440000",
        "filePath": "./storage/images/xxx.png",
        "thumbnailPath": "./storage/thumbnails/thumb_xxx.png",
        "fileSize": 1024000,
        "width": 1024,
        "height": 1024,
        "mimeType": "image/png",
        "createdAt": "2025-12-25T10:31:00Z"
      }
      // ... 更多图片
    ]
  }
}
```

**失败响应** (404):
```json
{
  "code": 404,
  "message": "任务不存在"
}
```

---

## 历史记录相关 API

### 4. 获取历史记录列表

**接口说明**: 分页获取所有历史任务记录

**请求方式**: `GET`

**请求路径**: `/api/v1/history`

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 10 | 每页数量 |

**请求示例**:
```
GET /api/v1/history?page=1&pageSize=10
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "task-001",
        "prompt": "一只可爱的猫咪",
        "model": "gemini-2.5-flash-image",
        "totalCount": 5,
        "completedCount": 5,
        "status": "completed",
        "createdAt": "2025-12-25T10:30:00Z",
        "updatedAt": "2025-12-25T10:35:00Z",
        "images": [
          // 图片列表
        ]
      }
      // ... 更多任务
    ],
    "total": 50,
    "page": 1
  }
}
```

**失败响应** (500):
```json
{
  "code": 500,
  "message": "获取历史记录失败"
}
```

---

### 5. 获取历史详情

**接口说明**: 获取单个历史任务的详细信息

**请求方式**: `GET`

**请求路径**: `/api/v1/history/:id`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 任务ID |

**请求示例**:
```
GET /api/v1/history/task-001
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "task-001",
    "prompt": "一只可爱的猫咪",
    "model": "gemini-2.5-flash-image",
    "totalCount": 5,
    "completedCount": 5,
    "status": "completed",
    "options": "",
    "errorMessage": "",
    "createdAt": "2025-12-25T10:30:00Z",
    "updatedAt": "2025-12-25T10:35:00Z",
    "images": [
      {
        "id": "image-001",
        "taskId": "task-001",
        "filePath": "./storage/images/xxx.png",
        "thumbnailPath": "./storage/thumbnails/thumb_xxx.png",
        "fileSize": 1024000,
        "width": 1024,
        "height": 1024,
        "mimeType": "image/png",
        "createdAt": "2025-12-25T10:31:00Z"
      }
      // ... 所有图片
    ]
  }
}
```

**失败响应** (404):
```json
{
  "code": 404,
  "message": "记录不存在"
}
```

---

### 6. 删除历史记录

**接口说明**: 删除单个历史任务(包括所有关联图片)

**请求方式**: `DELETE`

**请求路径**: `/api/v1/history/:id`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 任务ID |

**请求示例**:
```
DELETE /api/v1/history/task-001
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

**失败响应** (500):
```json
{
  "code": 500,
  "message": "删除失败"
}
```

---

### 7. 搜索历史记录（jieba 中文分词 + FTS5 全文搜索）

**接口说明**: 使用 jieba 中文分词 + SQLite FTS5 全文搜索功能，智能搜索历史记录的 prompt 字段

**技术特性**:
- ✅ **中文智能分词**: 使用 jieba 对中文进行智能分词，正确识别词语边界
- ✅ **中英文混合搜索**: 完美支持中文、英文及混合搜索
- ✅ **相关性排序**: 搜索结果按 FTS5 相关性自动排序
- ✅ **高性能查询**: 基于 FTS5 全文索引，毫秒级查询速度

**请求方式**: `GET`

**请求路径**: `/api/v1/history/search`

**查询参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| keyword | string | 是 | - | 搜索关键词（自动分词） |
| page | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 10 | 每页数量 |

**请求示例**:
```
GET /api/v1/history/search?keyword=油画&page=1&pageSize=20
GET /api/v1/history/search?keyword=女孩
GET /api/v1/history/search?keyword=油画女孩  (自动分词为 "油画 女孩")
GET /api/v1/history/search?keyword=vlog  (英文搜索)
GET /api/v1/history/search?keyword=写实绘画  (自动分词为 "写实 绘画")
```

**智能分词示例**:
| 用户输入 | jieba 分词结果 | 搜索效果 |
|---------|---------------|---------|
| `油画女孩` | `油画 女孩` | 同时匹配包含"油画"和"女孩"的记录 |
| `写实绘画创作` | `写实 绘画 创作` | 匹配包含这些词的记录 |
| `beautiful girl` | `beautiful girl` | 英文按空格分词，正常匹配 |
| `油画vlog` | `油画 vlog` | 中英文混合，自动识别 |

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "task-001",
        "prompt": "一个穿着红色衣服的女孩站在森林里",
        "model": "gemini-2.0-flash-exp",
        "totalCount": 4,
        "completedCount": 4,
        "status": "completed",
        "createdAt": "2025-12-25T10:30:00Z",
        "updatedAt": "2025-12-25T10:32:00Z",
        "images": [
          {
            "id": "img-001",
            "taskId": "task-001",
            "filePath": "./storage/images/img_xxx.png",
            "thumbnailPath": "./storage/thumbnails/thumb_xxx.png",
            "fileSize": 1024000,
            "width": 1024,
            "height": 1024,
            "mimeType": "image/png",
            "createdAt": "2025-12-25T10:31:00Z"
          }
          // ... 更多图片
        ]
      }
      // ... 更多任务
    ],
    "total": 15,        // 搜索结果总数
    "page": 1,
    "pageSize": 20,
    "keyword": "女孩"   // 搜索关键词
  }
}
```

**失败响应** (400):
```json
{
  "code": 400,
  "message": "请输入搜索关键词"
}
```

**失败响应** (500):
```json
{
  "code": 500,
  "message": "搜索失败: [错误详情]"
}
```

**注意事项**:
1. **自动分词**: 后端会自动使用 jieba 对搜索关键词进行分词，前端无需处理
2. **相关性排序**: 返回结果按 FTS5 相关性排序（相关度越高越靠前）
3. **中文优化**: jieba 分词确保中文词语被正确识别（如"女孩"不会拆成"女"+"孩"）
4. **接口兼容**: 搜索结果格式与 `/history` 列表接口完全一致，前端可复用组件
5. **性能**: jieba 分词器使用单例模式，内存占用约 40MB，查询速度毫秒级

**与之前版本的改进**:
- ❌ 之前: 搜索"油画"无结果（因为 FTS5 按字符拆分）
- ✅ 现在: 搜索"油画"返回正确结果（jieba 识别为完整词）

---

### 8. 批量删除历史

**接口说明**: 批量删除多个历史任务

**请求方式**: `DELETE`

**请求路径**: `/api/v1/history/batch`

**请求头**:
```
Content-Type: application/json
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ids | string[] | 是 | 任务ID数组 |

**请求示例**:
```json
{
  "ids": ["task-001", "task-002", "task-003"]
}
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

**失败响应** (400):
```json
{
  "code": 400,
  "message": "参数错误"
}
```

**失败响应** (500):
```json
{
  "code": 500,
  "message": "批量删除失败"
}
```

---

## 图片管理相关 API

### 9. 获取图片

**接口说明**: 获取原始图片文件

**请求方式**: `GET`

**请求路径**: `/api/v1/images/:id`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 图片ID |

**请求示例**:
```
GET /api/v1/images/image-001
```

**成功响应** (200):
```
Content-Type: image/png/jpeg/webp/...
[图片二进制数据]
```

**失败响应** (404):
```json
{
  "code": 404,
  "message": "图片不存在"
}
```

**前端使用**:
```html
<img src="http://localhost:8080/api/v1/images/image-001" alt="生成的图片">
```

---

### 10. 下载图片

**接口说明**: 下载图片文件(会触发浏览器下载)

**请求方式**: `GET`

**请求路径**: `/api/v1/images/:id/download`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 图片ID |

**请求示例**:
```
GET /api/v1/images/image-001/download
```

**成功响应** (200):
```
Content-Type: image/png/jpeg/webp/...
Content-Disposition: attachment; filename=xxx.ext
[图片二进制数据]
```

**失败响应** (404):
```json
{
  "code": 404,
  "message": "图片不存在"
}
```

**前端使用**:
```javascript
// 方式1: 直接跳转
window.location.href = `http://localhost:8080/api/v1/images/${imageId}/download`

// 方式2: 使用a标签
<a href={`http://localhost:8080/api/v1/images/${imageId}/download`} download>下载</a>
```

---

### 11. 批量导出为 ZIP

**接口说明**: 将多张图片打包为 ZIP 文件下载

**请求方式**: `POST`

**请求路径**: `/api/v1/images/export`

**请求头**:
```
Content-Type: application/json
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| imageIds | string[] | 是 | 图片ID数组 |

**请求示例**:
```json
{
  "imageIds": ["image-001", "image-002", "image-003"]
}
```

**成功响应** (200):
```
Content-Type: application/zip
Content-Disposition: attachment; filename=images.zip
[ZIP文件二进制数据]
```

**失败响应** (400):
```json
{
  "code": 400,
  "message": "参数错误"
}
```

**失败响应** (500):
```
导出失败: [错误详情]
```
**注意**: 由于成功响应已设置ZIP响应头，当导出过程中发生错误时，返回的是纯文本格式（非JSON）。前端需要检查 `response.ok` 或 `response.status` 来判断是否成功。

**前端使用**:
```javascript
async function exportImages(imageIds) {
  const response = await fetch('http://localhost:8080/api/v1/images/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imageIds })
  })

  if (response.ok) {
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'images.zip'
    a.click()
    window.URL.revokeObjectURL(url)
  }
}
```

---

### 12. 删除单张图片

**接口说明**: 删除指定的单张图片，包括原图和缩略图文件，并同步更新所属任务的已完成计数

**核心功能**:
- 🗑️ **完整删除**: 同时删除原图文件、缩略图文件和数据库记录
- 📊 **计数同步**: 自动减少所属任务的 `completedCount`，确保数据一致性
- 🔒 **原子操作**: 仅在 `completed_count > 0` 时执行减一，确保计数不会变成负数

**请求方式**: `DELETE`

**请求路径**: `/api/v1/images/:id`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 图片ID |

**请求示例**:
```
DELETE /api/v1/images/image-001
```

**成功响应** (200):
```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

**失败响应** (500):
```json
{
  "code": 500,
  "message": "删除图片失败"
}
```

**前端使用**:
```javascript
async function deleteImage(imageId: string): Promise<void> {
  const response = await fetch(`http://localhost:8080/api/v1/images/${imageId}`, {
    method: 'DELETE'
  })

  const result = await response.json()

  if (result.code !== 0) {
    throw new Error(result.message)
  }

  // 删除成功后刷新任务列表或更新UI
  console.log('图片删除成功')
}
```

**注意事项**:
| 事项 | 说明 |
|------|------|
| 文件删除 | 同时删除原图和缩略图，如果文件删除失败会记录警告但不影响整体流程 |
| 计数更新 | 自动减少所属任务的 `completedCount`，确保任务统计准确 |
| 原子操作 | 使用数据库原子操作确保并发安全，`completedCount` 不会小于0 |
| 级联影响 | 删除图片不会影响任务记录，仅减少已完成数量 |
| 不可恢复 | 删除操作不可逆，建议前端添加二次确认 |

**使用场景**:
- 🎨 **图片筛选**: 用户查看生成结果后，删除不满意的图片
- 📦 **存储管理**: 清理不需要的图片释放存储空间
- 🔧 **错误处理**: 删除生成错误的图片重新生成

---

### 13. 健康检查

**接口说明**: 检查服务是否正常运行

**请求方式**: `GET`

**请求路径**: `/api/v1/health`

**请求示例**:
```
GET /api/v1/health
```

**成功响应** (200):
```json
{
  "status": "ok",
  "message": "服务运行正常"
}
```

---

## WebSocket 实时通信

### 14. WebSocket 连接

**接口说明**: 建立 WebSocket 连接以接收任务实时进度

**连接方式**: `WebSocket`

**连接路径**: `/api/v1/ws/generate/:taskId`

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| taskId | string | 是 | 任务ID |

**连接示例**:
```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/ws/generate/task-001')

ws.onopen = () => {
  console.log('WebSocket 连接已建立')
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('收到消息:', message)
}

ws.onerror = (error) => {
  console.error('WebSocket 错误:', error)
}

ws.onclose = () => {
  console.log('WebSocket 连接已关闭')
}
```

### WebSocket 消息格式

#### 进度更新消息
```json
{
  "type": "progress",
  "taskId": "task-001",
  "completedCount": 3,
  "totalCount": 5,
  "latestImage": {
    "id": "image-001",
    "taskId": "task-001",
    "filePath": "./storage/images/xxx.png",
    "thumbnailPath": "./storage/thumbnails/thumb_xxx.png",
    "fileSize": 1024000,
    "width": 1024,
    "height": 1024,
    "mimeType": "image/png",
    "createdAt": "2025-12-25T10:31:00Z"
  },
  "message": "已完成 3/5"
}
```
**注意**:
- `latestImage` 可能为 `null`（例如仅推送进度类消息），也可能携带最新落库的图片信息（用于前端实时展示）。
- 如果某些图片生成失败，通常不会单独推送 `error`，最终统计请以任务状态/`errorMessage` 为准。

#### 任务完成消息
```json
{
  "type": "complete",
  "taskId": "task-001",
  "completedCount": 5,
  "totalCount": 5,
  "latestImage": null,
  "message": "任务完成: 成功 5, 失败 0"
}
```

#### 错误消息（服务端异常时）
```json
{
  "type": "error",
  "taskId": "task-001",
  "completedCount": 0,
  "totalCount": 5,
  "latestImage": null,
  "message": "任务处理异常: ..."
}
```

---

## 数据模型说明

### GenerationTask (任务模型)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 任务唯一ID |
| prompt | string | 图片描述提示词 |
| model | string | AI模型名称 |
| totalCount | number | 计划生成总数 |
| completedCount | number | 已完成数量 |
| status | string | 任务状态: processing/completed/failed/partial |
| options | string | 其他选项(JSON格式) |
| errorMessage | string | 错误信息 |
| createdAt | string | 创建时间(ISO 8601) |
| updatedAt | string | 更新时间(ISO 8601) |
| images | GeneratedImage[] | 关联的图片列表 |

### GeneratedImage (图片模型)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 图片唯一ID |
| taskId | string | 所属任务ID |
| filePath | string | 原始图片路径 |
| thumbnailPath | string | 缩略图路径 |
| fileSize | number | 文件大小(字节) |
| width | number | 图片宽度(像素) |
| height | number | 图片高度(像素) |
| mimeType | string | MIME类型(如 image/png) |
| createdAt | string | 创建时间(ISO 8601) |

---

## 错误码说明

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁(限流) |
| 500 | 服务器内部错误 |

**WebSocket 连接数限制**:
- 当连接数达到上限时，服务端会在升级成功后立即关闭连接（Close Code: `1013`，Try Again Later）。

---

## 完整前端示例

### Vue 3 + TypeScript 完整示例

```typescript
// types.ts - 类型定义
export interface GenerationTask {
  id: string
  prompt: string
  model: string
  totalCount: number
  completedCount: number
  status: 'processing' | 'completed' | 'failed' | 'partial'
  options: string
  errorMessage: string
  createdAt: string
  updatedAt: string
  images: GeneratedImage[]
}

export interface GeneratedImage {
  id: string
  taskId: string
  filePath: string
  thumbnailPath: string
  fileSize: number
  width: number
  height: number
  mimeType: string
  createdAt: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface ProgressMessage {
  type: 'progress' | 'complete' | 'error'
  taskId: string
  completedCount: number
  totalCount: number
  latestImage: GeneratedImage | null
  message: string
}
```

```typescript
// api.ts - API 封装
const BASE_URL = 'http://localhost:8080/api/v1'

export class ImageGenAPI {
  // 创建批量生成任务
  static async createTask(params: {
    prompt: string
    model: string
    count: number
    apiKey: string
    apiBase?: string
    aspectRatio?: string  // 图片宽高比: "1:1", "3:4", "4:3", "9:16", "16:9"
    imageSize?: string    // 图片尺寸: "1K", "2K", "4K"
    options?: string      // 可选参数(JSON字符串)，如 {"temperature":0.7,"seed":123}
  }): Promise<GenerationTask> {
    const response = await fetch(`${BASE_URL}/generate/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    const result: ApiResponse<GenerationTask> = await response.json()

    if (result.code !== 0) {
      throw new Error(result.message)
    }

    return result.data
  }

  // 查询任务状态
  static async getTaskStatus(taskId: string): Promise<GenerationTask> {
    const response = await fetch(`${BASE_URL}/generate/status/${taskId}`)
    const result: ApiResponse<GenerationTask> = await response.json()

    if (result.code !== 0) {
      throw new Error(result.message)
    }

    return result.data
  }

  // 获取历史列表
  static async getHistory(page = 1, pageSize = 10) {
    const response = await fetch(`${BASE_URL}/history?page=${page}&pageSize=${pageSize}`)
    const result: ApiResponse<{
      list: GenerationTask[]
      total: number
      page: number
    }> = await response.json()

    if (result.code !== 0) {
      throw new Error(result.message)
    }

    return result.data
  }

  // 删除历史
  static async deleteHistory(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/history/${id}`, {
      method: 'DELETE'
    })

    const result: ApiResponse<null> = await response.json()

    if (result.code !== 0) {
      throw new Error(result.message)
    }
  }

  // 批量导出
  static async exportImages(imageIds: string[]): Promise<void> {
    const response = await fetch(`${BASE_URL}/images/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageIds })
    })

    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'images.zip'
      a.click()
      window.URL.revokeObjectURL(url)
    } else {
      // 导出接口失败时可能返回纯文本（因为已设置ZIP响应头，无法再返回JSON）
      const text = await response.text()
      throw new Error(text || `导出失败: HTTP ${response.status}`)
    }
  }

  // 连接 WebSocket
  static connectWebSocket(
    taskId: string,
    onMessage: (message: ProgressMessage) => void
  ): WebSocket {
    const ws = new WebSocket(`ws://localhost:8080/api/v1/ws/generate/${taskId}`)

    ws.onmessage = (event) => {
      const message: ProgressMessage = JSON.parse(event.data)
      onMessage(message)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return ws
  }

  // 获取图片URL
  static getImageUrl(imageId: string): string {
    return `${BASE_URL}/images/${imageId}`
  }

  // 获取下载URL
  static getDownloadUrl(imageId: string): string {
    return `${BASE_URL}/images/${imageId}/download`
  }
}
```

```vue
<!-- ImageGenerator.vue - Vue组件示例 -->
<template>
  <div class="image-generator">
    <h2>图片生成</h2>

    <!-- 配置表单 -->
    <div class="form">
      <input v-model="apiKey" placeholder="API Key" />
      <input v-model="apiBase" placeholder="API Base (可选)" />
      <input v-model="prompt" placeholder="描述你想生成的图片" />
      <input v-model.number="count" type="number" min="1" max="100" />
      <button @click="generate" :disabled="loading">
        {{ loading ? '生成中...' : '开始生成' }}
      </button>
    </div>

    <!-- 进度显示 -->
    <div v-if="currentTask" class="progress">
      <p>任务ID: {{ currentTask.id }}</p>
      <p>进度: {{ currentTask.completedCount }} / {{ currentTask.totalCount }}</p>
      <p>状态: {{ currentTask.status }}</p>
    </div>

    <!-- 图片展示 -->
    <div v-if="currentTask?.images.length" class="images">
      <div v-for="image in currentTask.images" :key="image.id" class="image-item">
        <img :src="ImageGenAPI.getImageUrl(image.id)" :alt="currentTask.prompt" />
        <button @click="downloadImage(image.id)">下载</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ImageGenAPI } from './api'
import type { GenerationTask } from './types'

const apiKey = ref('')
const apiBase = ref('')
const prompt = ref('一只可爱的猫咪')
const count = ref(5)
const loading = ref(false)
const currentTask = ref<GenerationTask | null>(null)
let ws: WebSocket | null = null

async function generate() {
  try {
    loading.value = true

    // 创建任务
    const task = await ImageGenAPI.createTask({
      prompt: prompt.value,
      model: 'gemini-2.5-flash-image',
      count: count.value,
      apiKey: apiKey.value,
      apiBase: apiBase.value || undefined,
      aspectRatio: '9:16',  // 可选: 图片宽高比
      imageSize: '1K'       // 可选: 图片尺寸
    })

    currentTask.value = task

    // 连接 WebSocket 监听进度
    ws = ImageGenAPI.connectWebSocket(task.id, (message) => {
      console.log('进度更新:', message)

      if (message.type === 'progress' || message.type === 'complete') {
        // 更新任务状态
        if (currentTask.value) {
          currentTask.value.completedCount = message.completedCount
          if (message.latestImage) {
            currentTask.value.images.push(message.latestImage)
          }
        }
      }

      if (message.type === 'complete') {
        loading.value = false
        if (currentTask.value) {
          currentTask.value.status = 'completed'
        }
        ws?.close()
      }
    })

  } catch (error) {
    console.error('生成失败:', error)
    alert('生成失败: ' + (error as Error).message)
    loading.value = false
  }
}

function downloadImage(imageId: string) {
  window.location.href = ImageGenAPI.getDownloadUrl(imageId)
}
</script>
```

---

## 总结

本文档涵盖了所有 API 接口的详细说明,包括:

**版本更新说明**:
- v1.6 (2025-12-29): WebSocket `latestImage` 实时出图、`options` 生效、子任务部分提交可继续
- v1.5 (2025-12-26): 移除 API Key 认证机制
- v1.4: 添加 API Key 认证机制，健康检查接口无需认证
- v1.3: 图生图功能，支持参考图片上传
- v1.2: jieba 中文分词 + FTS5 全文搜索
- v1.1: WebSocket 实时进度推送
- v1.0: 初始版本

**核心功能**:

✅ **2个图片生成API**:
   - `/api/v1/generate/batch` - 文字描述生成图片
   - `/api/v1/generate/batch-with-images` - 图生图（支持参考图片）

✅ **1个任务状态查询API**: `/api/v1/generate/status/:taskId`

✅ **5个历史管理API**:
   - `/api/v1/history` - 获取历史记录列表
   - `/api/v1/history/:id` - 获取历史详情
   - `/api/v1/history/search` - 全文搜索（jieba + FTS5）
   - `DELETE /api/v1/history/:id` - 删除单个记录
   - `DELETE /api/v1/history/batch` - 批量删除

✅ **4个图片管理API**:
   - `/api/v1/images/:id` - 获取图片
   - `/api/v1/images/:id/download` - 下载图片
   - `/api/v1/images/export` - 批量导出ZIP
   - `DELETE /api/v1/images/:id` - 删除单张图片

✅ **1个健康检查API**: `/api/v1/health`

✅ **1个WebSocket实时通信接口**: `/api/v1/ws/generate/:taskId` - 任务进度推送

✅ **完整的请求/响应示例**: JavaScript、cURL、Vue 3 组件示例

✅ **数据模型定义**: GenerationTask、GeneratedImage 详细说明

✅ **限流机制**: IP 限流保护

✅ **错误处理说明**: HTTP 状态码、错误消息对应关系

✅ **实战指南**: 使用流程、注意事项、常见场景说明

如需快速上手请参考 `快速开始.md`
