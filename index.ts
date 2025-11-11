#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// OpenAI-compatible API configuration
const API_ENDPOINT = process.env.API_ENDPOINT || "http://openai/v1/chat/completions";
const API_KEY = process.env.API_KEY;
const MODEL_NAME = process.env.MODEL_NAME || "gemini-2.5-flash-image";

// System prompt for image generation
const SYSTEM_PROMPT = "You are an image generation AI. Generate images based on user requirements. Do not respond with any other content. Only generate images as requested.";

// Validate API Key is configured
if (!API_KEY || API_KEY.includes("your_api_key")) {
  const errorConfig = {
    error: "API_KEY is not properly configured",
    message: "Please set your API key in the MCP configuration",
    steps: [
      "1. Get your API key from your service provider",
      "2. Add it to your MCP client configuration file",
      "3. Restart your MCP client"
    ],
    example_configuration: {
      mcpServers: {
        "comic-image-gen": {
          command: "node",
          args: ["path/to/build/index.js"],
          env: {
            API_KEY: "your_actual_api_key_here",
            API_ENDPOINT: "https://your-api-endpoint.com/v1/chat/completions",
            MODEL_NAME: "your_model_name"
          }
        }
      }
    }
  };
  console.log(JSON.stringify(errorConfig, null, 2));
  process.exit(1);
}

interface GenerateImageArgs {
  prompt: string;
  size?: string;
  guidance_scale?: number;
  seed?: number;
  num_images?: number;
  output_directory?: string;
  reference_images?: string[];
  filename?: string;
  temperature?: number;
  max_tokens?: number;
}

interface BatchGenerateImageArgs {
  tasks: GenerateImageArgs[];
  max_concurrent?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  error?: {
    message: string;
    type: string;
  };
}

// Save image from base64 data or URL to disk
async function saveImage(imageData: string, outputPath: string): Promise<void> {
  // Check if it's a base64 data URL
  if (imageData.startsWith('data:image/')) {
    // Extract base64 data
    const matches = imageData.match(/data:image\/\w+;base64,(.+)/);
    if (!matches || !matches[1]) {
      throw new Error('Invalid base64 image data format');
    }
    
    const base64Data = matches[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(outputPath, imageBuffer);
  } else {
    // It's a URL, download it
    const response = await axios.get(imageData, {
      responseType: 'arraybuffer',
      timeout: 60000, // 1 minute timeout
    });
    
    await fs.promises.writeFile(outputPath, response.data);
  }
}

// Get default output directory (temp directory with comic-images subfolder)
function getDefaultOutputDirectory(): string {
  const tempDir = os.tmpdir();
  const comicDir = path.join(tempDir, 'comic-images');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(comicDir)) {
    fs.mkdirSync(comicDir, { recursive: true });
  }
  
  return comicDir;
}

// Process reference images - convert all to base64 (both URLs and local paths)
async function processReferenceImages(images: string[]): Promise<string[]> {
  const processedImages: string[] = [];

  for (const img of images) {
    try {
      // Check if it's a URL
      if (img.startsWith('http://') || img.startsWith('https://')) {
        // Download URL and convert to base64
        console.log(JSON.stringify({
          action: "downloading_reference_image",
          url: img
        }));
        
        const response = await axios.get(img, {
          responseType: 'arraybuffer',
          timeout: 60000, // 1 minute timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const base64Image = Buffer.from(response.data).toString('base64');
        
        // Detect MIME type from response headers or URL
        let mimeType = 'image/jpeg'; // default
        const contentType = response.headers['content-type'];
        if (contentType) {
          mimeType = contentType.split(';')[0].trim();
        } else {
          // Fallback: try to detect from URL extension
          const urlExt = img.toLowerCase().split(/[?#]/)[0].split('.').pop();
          if (urlExt === 'png') mimeType = 'image/png';
          else if (urlExt === 'jpg' || urlExt === 'jpeg') mimeType = 'image/jpeg';
          else if (urlExt === 'gif') mimeType = 'image/gif';
          else if (urlExt === 'webp') mimeType = 'image/webp';
        }
        
        // Format as data URL
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        processedImages.push(dataUrl);
        
        console.log(JSON.stringify({
          action: "downloaded_reference_image",
          url: img,
          mime_type: mimeType
        }));
      } else {
        // It's a local file path - convert to base64
        // Resolve path (support both absolute and relative paths)
        const resolvedPath = path.isAbsolute(img) ? img : path.resolve(process.cwd(), img);
        
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`Image file not found: ${resolvedPath}`);
        }

        const imageBuffer = await fs.promises.readFile(resolvedPath);
        const base64Image = imageBuffer.toString('base64');
        
        // Detect MIME type based on file extension
        const ext = path.extname(resolvedPath).toLowerCase();
        let mimeType = 'image/jpeg'; // default
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';
        
        // Format as data URL
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        processedImages.push(dataUrl);
        
        console.log(JSON.stringify({
          action: "loaded_local_image",
          path: resolvedPath
        }));
      }
    } catch (error) {
      throw new Error(`Failed to process image "${img}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return processedImages;
}

// Extract image data (base64 or URLs) from content
function extractImageData(content: string): string[] {
  const imageDatas: string[] = [];
  
  // Match base64 image data URLs (data:image/...) - prioritize these
  const base64Regex = /(data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+)/g;
  let match;
  while ((match = base64Regex.exec(content)) !== null) {
    imageDatas.push(match[1]);
  }
  
  // Match ![alt](url) format
  const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g;
  while ((match = markdownImageRegex.exec(content)) !== null) {
    if (!imageDatas.includes(match[1])) {
      imageDatas.push(match[1]);
    }
  }
  
  // Also match plain URLs in the content
  const urlRegex = /(https?:\/\/[^\s\)]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  while ((match = urlRegex.exec(content)) !== null) {
    if (!imageDatas.includes(match[1])) {
      imageDatas.push(match[1]);
    }
  }
  
  return imageDatas;
}

// Generate image using OpenAI-compatible chat API
async function generateImage(args: GenerateImageArgs): Promise<string> {

  const {
    prompt,
    size = "2K",
    guidance_scale = 2.5,
    seed,
    num_images = 1,
    output_directory,
    reference_images,
    filename,
    temperature = 1,
    max_tokens = 2048,
  } = args;

  // Validate guidance scale
  if (guidance_scale < 1.0 || guidance_scale > 10.0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "guidance_scale must be between 1.0 and 10.0"
    );
  }

  // Validate num_images
  if (num_images < 1 || num_images > 4) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "num_images must be between 1 and 4"
    );
  }

  console.log(JSON.stringify({
    action: "generating_images",
    num_images,
    prompt,
    size,
    guidance_scale,
    seed
  }));

  // Process reference images if provided
  let processedReferenceImages: string[] | undefined;
  if (reference_images) {
    console.log(JSON.stringify({
      action: "processing_reference_images",
      count: reference_images.length
    }));
    processedReferenceImages = await processReferenceImages(reference_images);
    console.log(JSON.stringify({
      action: "processed_reference_images",
      count: processedReferenceImages.length
    }));
  }

  try {
    // Build user message with image generation parameters
    let userMessage = `Generate ${num_images} image(s) with the following parameters:\n`;
    userMessage += `- Size: ${size}\n`;
    userMessage += `- Guidance Scale: ${guidance_scale}\n`;
    if (seed !== undefined) {
      userMessage += `- Seed: ${seed}\n`;
    }
    if (processedReferenceImages && processedReferenceImages.length > 0) {
      userMessage += `- Reference Images: ${processedReferenceImages.length} image(s)\n`;
    }
    userMessage += `\nPrompt:\n\`\`\`\n${prompt}\n\`\`\``;

    // Build messages array with content structure
    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      }
    ];

    // Add user message with text and images separately
    const userContent: any[] = [
      {
        type: "text",
        text: userMessage
      }
    ];

    // Add reference images as separate image content blocks at the end
    if (processedReferenceImages && processedReferenceImages.length > 0) {
      for (const imageData of processedReferenceImages) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: imageData
          }
        });
      }
    }

    messages.push({
      role: "user",
      content: userContent
    });

    const requestBody: any = {
      model: MODEL_NAME,
      messages,
      temperature,
      max_tokens
    };

    const response = await axios.post<ChatCompletionResponse>(
      API_ENDPOINT,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        timeout: 120000, // 2 minutes timeout
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message || "Image generation failed");
    }

    const content = response.data.choices?.[0]?.message?.content || "";
    const imageDatas = extractImageData(content);

    if (imageDatas.length === 0) {
      throw new Error("No image data (base64 or URLs) found in the response");
    }

    // Save images if output_directory is specified
    let savedPaths: string[] = [];
    if (output_directory !== undefined && output_directory !== null) {
      const targetDir = output_directory || getDefaultOutputDirectory();
      
      // Ensure output directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      console.log(JSON.stringify({
        action: "saving_images",
        directory: targetDir,
        image_count: imageDatas.length
      }));
      
      for (let i = 0; i < imageDatas.length; i++) {
        const imageData = imageDatas[i];
        const timestamp = Date.now();
        // Use provided filename or default to comic_{timestamp}_{index}.png
        let finalFilename: string;
        if (filename) {
          // If custom filename is provided and multiple images, append index
          if (imageDatas.length > 1) {
            const ext = path.extname(filename) || '.png';
            const basename = path.basename(filename, ext);
            finalFilename = `${basename}_${i + 1}${ext}`;
          } else {
            // For single image, ensure filename has .png extension if no extension provided
            const ext = path.extname(filename);
            finalFilename = ext ? filename : `${filename}.png`;
          }
        } else {
          // Default filename pattern
          finalFilename = `comic_${timestamp}_${i + 1}.png`;
        }
        const filepath = path.join(targetDir, finalFilename);
        
        try {
          await saveImage(imageData, filepath);
          savedPaths.push(filepath);
          console.log(JSON.stringify({
            action: "saved_image",
            index: i + 1,
            path: filepath,
            is_base64: imageData.startsWith('data:image/')
          }));
        } catch (error) {
          console.log(JSON.stringify({
            action: "failed_to_save",
            index: i + 1,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }
    }

    // Format response
    let result = `✅ Successfully generated ${imageDatas.length} image(s):\n\n`;
    result += `📝 Prompt: "${prompt}"\n`;
    result += `📏 Size: ${size}\n`;
    result += `🎯 Guidance Scale: ${guidance_scale}\n`;
    if (seed) {
      result += `🌱 Seed: ${seed}\n`;
    }
    if (processedReferenceImages && processedReferenceImages.length > 0) {
      result += `🖼️  Reference Images: ${processedReferenceImages.length}\n`;
    }
    result += `\n🖼️  Generated Images:\n`;

    imageDatas.forEach((imageData, index) => {
      result += `\nImage ${index + 1}:\n`;
      if (savedPaths[index]) {
        result += `  Saved to: ${savedPaths[index]}\n`;
      } else if (imageData.startsWith('data:image/')) {
        result += `  Format: Base64 (embedded)\n`;
      } else {
        result += `  URL: ${imageData}\n`;
      }
    });

    console.log(JSON.stringify({
      action: "generation_complete",
      image_count: imageDatas.length
    }));

    return result;
  } catch (error) {
    console.log(JSON.stringify({
      action: "generation_failed",
      error: error instanceof Error ? error.message : String(error)
    }));

    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new McpError(
          ErrorCode.InternalError,
          `API error: ${error.response.data?.message || error.message}`
        );
      } else if (error.request) {
        throw new McpError(
          ErrorCode.InternalError,
          "No response from API. Please check your network connection."
        );
      }
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Batch generate images with concurrency control
async function batchGenerateImages(args: BatchGenerateImageArgs): Promise<string> {
  const { tasks, max_concurrent = 3 } = args;

  if (!tasks || tasks.length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "tasks array is required and must not be empty"
    );
  }

  if (tasks.length > 20) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Maximum 20 tasks allowed per batch"
    );
  }

  console.log(JSON.stringify({
    action: "batch_generation_start",
    task_count: tasks.length,
    max_concurrent
  }));

  // Function to run tasks with concurrency limit
  const runWithConcurrency = async (
    tasks: GenerateImageArgs[],
    limit: number
  ): Promise<Array<{ success: boolean; result?: string; error?: string; taskIndex: number }>> => {
    const results: Array<{ success: boolean; result?: string; error?: string; taskIndex: number }> = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const taskIndex = i;

      const promise = (async () => {
        try {
          console.log(JSON.stringify({
            action: "task_start",
            task_index: taskIndex + 1,
            total: tasks.length
          }));
          const result = await generateImage(task);
          results.push({ success: true, result, taskIndex });
          console.log(JSON.stringify({
            action: "task_complete",
            task_index: taskIndex + 1,
            total: tasks.length
          }));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.push({ success: false, error: errorMsg, taskIndex });
          console.log(JSON.stringify({
            action: "task_failed",
            task_index: taskIndex + 1,
            total: tasks.length,
            error: errorMsg
          }));
        }
      })();

      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);
    return results.sort((a, b) => a.taskIndex - b.taskIndex);
  };

  try {
    const results = await runWithConcurrency(tasks, max_concurrent);

    // Format response
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    let response = `\n${'='.repeat(60)}\n`;
    response += `📊 Batch Generation Summary\n`;
    response += `${'='.repeat(60)}\n\n`;
    response += `Total Tasks: ${tasks.length}\n`;
    response += `✅ Successful: ${successCount}\n`;
    response += `❌ Failed: ${failCount}\n`;
    response += `⚡ Max Concurrent: ${max_concurrent}\n`;
    response += `\n${'='.repeat(60)}\n`;

    results.forEach((result, index) => {
      response += `\n[Task ${index + 1}]\n`;
      response += `${'-'.repeat(60)}\n`;
      
      if (result.success) {
        response += result.result + '\n';
      } else {
        response += `❌ Error: ${result.error}\n`;
      }
    });

    response += `\n${'='.repeat(60)}\n`;
    response += `✅ Batch generation completed!\n`;
    response += `${'='.repeat(60)}\n`;

    return response;
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Batch generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Create MCP server
const server = new Server(
  {
    name: "comic-image-gen-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_image",
        description:
          "Generate images using OpenAI-compatible chat API. Supports both text-to-image (txt2img) and image-to-image (img2img) generation. " +
          "For img2img: provide source images via 'reference_images' parameter - the AI will use them as VISUAL INPUT to guide generation. " +
          "Supports bilingual prompts (English and Chinese), multiple aspect ratios, and configurable generation parameters. " +
          "Perfect for creating high-quality comic-style images with strong instruction following.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Text description of the image to generate (supports English and Chinese)",
            },
            size: {
              type: "string",
              description:
                "Image size specification. Supports: '1K', '2K', '4K' (default: '2K')",
              default: "2K",
            },
            guidance_scale: {
              type: "number",
              description: "Prompt adherence strength, higher values follow prompt more literally (2.0-3.0, default: 2.5)",
              default: 2.5,
            },
            seed: {
              type: "number",
              description: "Random seed for reproducible results (0-2147483647)",
            },
            num_images: {
              type: "number",
              description: "Number of images to generate (1-4, default: 1)",
              default: 1,
            },
            output_directory: {
              type: "string",
              description: "Directory to save generated images (MUST be absolute path). If not specified, images will only be returned as URLs. If set to empty string or null, images will be saved to a default temporary directory",
            },
            reference_images: {
              type: "array",
              description: "🎨 INPUT IMAGE(S) for image-to-image generation. Provide source image(s) that will be used as visual input to guide the generation. Supports: URL (http/https) or local file path (MUST be absolute path). Local images are auto-converted to base64. Use this to enhance, transform, or create variations of existing images.",
              items: {
                type: "string",
              },
            },
            filename: {
              type: "string",
              description: "Custom filename for saved images (default: comic_{timestamp}_{index}.png). For multiple images, index will be automatically appended.",
            },
            temperature: {
              type: "number",
              description: "Temperature for API response randomness (default: 1)",
            },
            max_tokens: {
              type: "number",
              description: "Maximum tokens for API response (default: 2048)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "batch_generate_images",
        description:
          "Batch generate multiple images concurrently. " +
          "This tool allows you to generate multiple different images in parallel with controlled concurrency. " +
          "Each task can have different prompts, settings, and parameters. " +
          "Perfect for generating multiple variations, scenes, or concepts efficiently.",
        inputSchema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              description: "Array of image generation tasks to execute concurrently. Each task has the same parameters as generate_image tool.",
              items: {
                type: "object",
                properties: {
                  prompt: {
                    type: "string",
                    description: "Text description of the image to generate",
                  },
                  size: {
                    type: "string",
                    description: "Image size: '1K', '2K', '4K'. Default: '2K'",
                  },
                  guidance_scale: {
                    type: "number",
                    description: "Prompt adherence strength (1.0-10.0, default: 2.5)",
                  },
                  seed: {
                    type: "number",
                    description: "Random seed for reproducible results",
                  },
                  num_images: {
                    type: "number",
                    description: "Number of images per task (1-4, default: 1)",
                  },
                  output_directory: {
                    type: "string",
                    description: "Directory to save images (absolute path)",
                  },
                  reference_images: {
                    type: "array",
                    description: "Reference images for img2img generation",
                    items: {
                      type: "string",
                    },
                  },
                  filename: {
                    type: "string",
                    description: "Custom filename for saved images",
                  },
                  temperature: {
                    type: "number",
                    description: "Temperature for API response randomness (default: 1)",
                  },
                  max_tokens: {
                    type: "number",
                    description: "Maximum tokens for API response (default: 2048)",
                  },
                },
                required: ["prompt"],
              },
            },
            max_concurrent: {
              type: "number",
              description: "Maximum number of tasks to run concurrently (1-10, default: 3). Lower values reduce API load, higher values increase speed.",
              default: 3,
            },
          },
          required: ["tasks"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "generate_image") {
    const args = request.params.arguments as unknown as GenerateImageArgs;

    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, "prompt is required");
    }

    const result = await generateImage(args);

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  if (request.params.name === "batch_generate_images") {
    const args = request.params.arguments as unknown as BatchGenerateImageArgs;

    if (!args.tasks || args.tasks.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, "tasks array is required and must not be empty");
    }

    // Validate max_concurrent parameter
    if (args.max_concurrent !== undefined) {
      if (args.max_concurrent < 1 || args.max_concurrent > 10) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "max_concurrent must be between 1 and 10"
        );
      }
    }

    const result = await batchGenerateImages(args);

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});

main().catch((error) => {
  console.log(JSON.stringify({
    error: "fatal_error",
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exit(1);
});

