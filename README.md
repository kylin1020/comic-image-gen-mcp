# Comic Image Generation MCP Server

一个基于 OpenAI 兼容 API 的漫画风格文生图 MCP 服务器，使用 `/v1/chat/completions` 端点进行图像生成。

[English](#english-version) | [中文](#中文版本)

## 中文版本

### 特性

- ✅ **高质量图像生成** - 使用 OpenAI 兼容的 chat completions API
- 🌐 **双语支持** - 支持中英文提示词
- 🎨 **灵活的尺寸选项** - 支持 1K、2K、4K 三种尺寸规格
- ⚡ **快速生成** - 高效的图像生成流程
- 🎯 **强大的指令遵循能力** - 高度还原文本描述
- 🖼️ **参考图支持** - 支持图生图功能，可输入 URL 或本地图片路径
- 💾 **灵活的输出选项** - 支持自定义保存路径和文件名
- 📝 **JSON 日志输出** - 所有日志以 JSON 格式输出，便于解析

### API 要求

本服务器使用 OpenAI 兼容的 `/v1/chat/completions` API。您的 API 服务需要：

1. 支持 `/v1/chat/completions` 端点
2. 接受标准的 chat completion 请求格式
3. 在响应中返回图像 URL（通常在 markdown 格式中，如 `![alt](url)`）
4. 支持 Bearer token 认证

### 可用工具

#### `generate_image`

使用 OpenAI 兼容 API 从文本提示生成图像。

**参数：**

- `prompt` (必需): 图像的文本描述（支持中英文）
- `size` (可选): 图像尺寸规格 - 可选值: `1K`, `2K`, `4K` (默认: `2K`)
- `guidance_scale` (可选): 提示词遵循强度，数值越高越严格遵循提示词 (2.0-3.0, 默认: 2.5)
- `seed` (可选): 随机种子，用于生成可复现的结果 (0-2147483647)
- `num_images` (可选): 生成图像数量 (1-4, 默认: 1)
- `output_directory` (可选): 保存生成图像的目录（必须是绝对路径）。如果不指定，图像仅作为 URL 返回。如果设置为空字符串或 null，图像将保存到默认临时目录
- `reference_images` (可选): 参考图像，用于图生图。可以是单个图像或图像数组。每个图像可以是 URL（http/https）或本地文件路径（必须是绝对路径）。本地图像会自动转换为 base64
- `filename` (可选): 自定义保存的文件名（默认: comic_{timestamp}_{index}.png）。对于多张图像，会自动添加索引

#### `batch_generate_images`

并发生成多张图像。此工具允许您并行生成多个不同的图像，具有可控的并发数量。每个任务可以有不同的提示词、设置和参数。

**参数：**

- `tasks` (必需): 要并发执行的图像生成任务数组。每个任务具有与 `generate_image` 工具相同的参数
- `max_concurrent` (可选): 最多并发运行的任务数 (1-10, 默认: 3)

### 安装

#### 前置要求

1. **API 密钥**: 从您的 OpenAI 兼容服务提供商获取 API 密钥
2. **API 端点**: 确保您有可用的 `/v1/chat/completions` 端点
3. **Node.js**: 确保已安装 Node.js（版本 16 或更高）

#### 快速配置（推荐）

在 Claude Desktop 或 Cursor 中，可以直接使用 npx 进行快速配置，无需手动构建。

#### 手动安装

1. **安装依赖**
```bash
npm install
```

3. **构建项目**
```bash
npm run build
```

4. **在配置中使用绝对路径**

##### Claude Desktop 应用或 Cursor 中使用 npx 快速配置

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "comic-image-gen": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/kylin1020/comic-image-gen-mcp.git"
      ],
      "env": {
        "API_KEY": "your_api_key_here",
        "API_ENDPOINT": "https://your-api-endpoint.com/v1/chat/completions",
        "MODEL_NAME": "your_model_name"
      }
    }
  }
}
```

**或使用本地构建方式（传统方式）**

手动构建后，更新配置使用本地路径。

##### Kilo Code MCP 设置

添加到 MCP 设置文件：
`C:\Users\[username]\AppData\Roaming\Code\User\globalStorage\kilocode.kilo-code\settings\mcp_settings.json`

可使用相同的 npx 方式或本地构建方式。

### 环境变量

- `API_KEY` (必需): 您的 API 密钥
- `API_ENDPOINT` (可选): API 端点 URL，默认为 `http://localhost:8000/v1/chat/completions`
- `MODEL_NAME` (可选): 模型名称，默认为 `gemini-2.5-flash-image`

### 使用示例

配置完成后，您可以通过 MCP 客户端使用服务器：

#### 基础图像生成
```
生成一张漫画风格的城市街景图
```

#### 指定图像尺寸
```
生成一张高清的漫画角色图（4K 尺寸）
```

#### 生成多张图像
```
生成 3 个可爱机器人角色的变体
```

#### 批量并发生成
```
同时为以下提示词生成图像："一朵红玫瑰"、"蓝色海洋"、"绿色森林"
```

#### 使用参考图生成（图生图）
```
基于这张图片生成一个相似风格的场景：/path/to/reference/image.jpg
```

### JSON 日志格式

所有日志以 JSON 格式输出到 stderr，便于程序解析。日志格式示例：

```json
{
  "action": "generating_images",
  "num_images": 1,
  "prompt": "a comic-style cityscape",
  "size": "2K",
  "guidance_scale": 2.5
}
```

```json
{
  "action": "generation_complete",
  "image_count": 1
}
```

```json
{
  "action": "generation_failed",
  "error": "API error message"
}
```

### API 响应格式

服务器返回生成图像的详细信息：

```
✅ Successfully generated 1 image(s):

📝 Prompt: "a comic-style cityscape"
📏 Size: 2K
🎯 Guidance Scale: 2.5

🖼️  Generated Images:

Image 1:
  URL: https://example.com/image.png
```

### 开发

#### 本地测试
```bash
# 直接测试服务器
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node build/index.js
```

#### 监听模式
```bash
npm run watch
```

#### Inspector 工具
```bash
npm run inspector
```

### 故障排除

#### 常见问题

1. **"API_KEY is not properly configured"**
   - 确保在 MCP 配置中正确设置了 API 密钥
   - 验证密钥有效且有足够的配额

2. **"Server not showing up in Claude"**
   - 检查绝对路径是否正确
   - 修改配置后重启 Claude Desktop
   - 验证 JSON 配置语法是否有效

3. **"No image URLs found in the response"**
   - 检查您的 API 是否正确返回图像 URL
   - 确保 API 响应包含 markdown 格式的图像链接

4. **"Generation failed"**
   - 检查 API 端点是否正确
   - 验证 API 密钥是否具有必要的权限
   - 查看 JSON 日志以获取详细错误信息

### 许可证

本项目采用 MIT 许可证。

### 贡献

欢迎提交 Pull Request 和 Issue！

---

## English Version

### Features

- ✅ **High-quality image generation** - Using OpenAI-compatible chat completions API
- 🌐 **Bilingual support** - Supports English and Chinese prompts
- 🎨 **Flexible size options** - Supports 1K, 2K, and 4K size specifications
- ⚡ **Fast generation** - Efficient image generation workflow
- 🎯 **Strong instruction following** - Highly accurate text-to-image conversion
- 🖼️ **Reference image support** - Image-to-image generation with URL or local file paths
- 💾 **Flexible output options** - Support for custom save paths and filenames
- 📝 **JSON logging** - All logs output in JSON format for easy parsing

### API Requirements

This server uses OpenAI-compatible `/v1/chat/completions` API. Your API service needs to:

1. Support `/v1/chat/completions` endpoint
2. Accept standard chat completion request format
3. Return image URLs in the response (typically in markdown format, like `![alt](url)`)
4. Support Bearer token authentication

### Available Tools

#### `generate_image`

Generate images from text prompts using OpenAI-compatible API.

**Parameters:**

- `prompt` (required): Text description of the image (supports English and Chinese)
- `size` (optional): Image size specification - options: `1K`, `2K`, `4K` (default: `2K`)
- `guidance_scale` (optional): Prompt adherence strength, higher values follow prompt more literally (2.0-3.0, default: 2.5)
- `seed` (optional): Random seed for reproducible results (0-2147483647)
- `num_images` (optional): Number of images to generate (1-4, default: 1)
- `output_directory` (optional): Directory to save generated images (MUST be absolute path). If not specified, images will only be returned as URLs. If set to empty string or null, images will be saved to a default temporary directory
- `reference_images` (optional): Reference image(s) for image-to-image generation. Can be a single image or an array of images. Each image can be either a URL (http/https) or a local file path (MUST be absolute path). Local images will be automatically converted to base64
- `filename` (optional): Custom filename for saved images (default: comic_{timestamp}_{index}.png). For multiple images, index will be automatically appended

#### `batch_generate_images`

Batch generate multiple images concurrently. This tool allows you to generate multiple different images in parallel with controlled concurrency. Each task can have different prompts, settings, and parameters.

**Parameters:**

- `tasks` (required): Array of image generation tasks to execute concurrently. Each task has the same parameters as the `generate_image` tool
- `max_concurrent` (optional): Maximum number of tasks to run concurrently (1-10, default: 3)

### Installation

#### Prerequisites

1. **API Key**: Get your API key from your OpenAI-compatible service provider
2. **API Endpoint**: Ensure you have access to a `/v1/chat/completions` endpoint
3. **Node.js**: Ensure Node.js is installed (version 16 or higher)

#### Manual Installation

1. **Clone or download the project**
```bash
cd /Users/jyxc-dz-0100286/comic-image-gen-mcp
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Use absolute path in configuration**

##### For Claude Desktop App or Quick Setup with npx in Cursor

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "comic-image-gen": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/kylin1020/comic-image-gen-mcp.git"
      ],
      "env": {
        "API_KEY": "your_api_key_here",
        "API_ENDPOINT": "https://your-api-endpoint.com/v1/chat/completions",
        "MODEL_NAME": "your_model_name"
      }
    }
  }
}
```

**Or use local build method (traditional way)**

Build locally and then update configuration to use local path.

### Environment Variables

- `API_KEY` (required): Your API key
- `API_ENDPOINT` (optional): API endpoint URL, defaults to `http://localhost:8000/v1/chat/completions`
- `MODEL_NAME` (optional): Model name, defaults to `comic-image-gen`

### Usage Examples

Once configured, you can use the server through your MCP client:

#### Basic Image Generation
```
Generate a comic-style cityscape image
```

#### Specific Image Size
```
Generate a high-resolution comic character image (4K size)
```

#### Generate Multiple Images
```
Generate 3 variations of a cute robot character
```

#### Batch Concurrent Generation
```
Generate images concurrently for these prompts: "a red rose", "a blue ocean", "a green forest"
```

#### Using Reference Images (Image-to-Image)
```
Generate a similar style scene based on this image: /path/to/reference/image.jpg
```

### JSON Log Format

All logs are output in JSON format to stderr for easy parsing. Example log formats:

```json
{
  "action": "generating_images",
  "num_images": 1,
  "prompt": "a comic-style cityscape",
  "size": "2K",
  "guidance_scale": 2.5
}
```

```json
{
  "action": "generation_complete",
  "image_count": 1
}
```

```json
{
  "action": "generation_failed",
  "error": "API error message"
}
```

### API Response Format

The server returns detailed information about generated images:

```
✅ Successfully generated 1 image(s):

📝 Prompt: "a comic-style cityscape"
📏 Size: 2K
🎯 Guidance Scale: 2.5

🖼️  Generated Images:

Image 1:
  URL: https://example.com/image.png
```

### Development

#### Local Testing
```bash
# Test the server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node build/index.js
```

#### Watch Mode
```bash
npm run watch
```

#### Inspector Tool
```bash
npm run inspector
```

### Troubleshooting

#### Common Issues

1. **"API_KEY is not properly configured"**
   - Ensure your API key is properly set in the MCP configuration
   - Verify the key is valid and has sufficient quota

2. **"Server not showing up in Claude"**
   - Check that the absolute path is correct
   - Restart Claude Desktop after configuration changes
   - Verify the JSON configuration syntax is valid

3. **"No image URLs found in the response"**
   - Check if your API correctly returns image URLs
   - Ensure API response contains markdown-formatted image links

4. **"Generation failed"**
   - Check if the API endpoint is correct
   - Verify your API key has the necessary permissions
   - Check JSON logs for detailed error information

### License

This project is licensed under the MIT License.

### Contributing

Pull requests and issues are welcome!

