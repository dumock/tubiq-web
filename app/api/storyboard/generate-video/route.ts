import { NextResponse } from 'next/server';

// Helper to validate environment
const getComfyUrl = () => {
    // Hardcode the URL to ensure it works regardless of env vars
    return "https://emma-timing-outlets-voltage.trycloudflare.com";
};

// Wan 2.2 Lightning Image-to-Video Workflow (4-step with High/Low LoRA)
// Required Models:
// - diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors
// - diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors
// - loras/wan_lightning_i2v/wan2.2_i2v_lightning_high.safetensors
// - loras/wan_lightning_i2v/wan2.2_i2v_lightning_low.safetensors
// - text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors  
// - vae/wan_2.1_vae.safetensors
// - clip_vision/clip_vision_h.safetensors
const WAN_I2V_WORKFLOW = {
    // 1. Load Checkpoint (Wan 2.2 All-In-One via Phr00t)
    "1": {
        "inputs": {
            "ckpt_name": "wan2.2_rapid_14b_aio.safetensors"
        },
        "class_type": "CheckpointLoaderSimple",
        "_meta": { "title": "Load Checkpoint (Wan 2.2 AIO)" }
    },
    // 4. Load CLIP Vision (Video workflows often need specific vision models, keeping this safe)
    "4": {
        "inputs": {
            "clip_name": "clip_vision_h.safetensors"
        },
        "class_type": "CLIPVisionLoader",
        "_meta": { "title": "Load CLIP Vision" }
    },
    // 5. Load Input Image
    "5": {
        "inputs": {
            "image": "",
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": { "title": "Load Image" }
    },
    // 6. CLIP Text Encode (Positive)
    "6": {
        "inputs": {
            "text": "",
            "clip": ["1", 1] // CLIP from Checkpoint
        },
        "class_type": "CLIPTextEncode",
        "_meta": { "title": "Positive Prompt" }
    },
    // 7. CLIP Text Encode (Negative)
    "7": {
        "inputs": {
            "text": "static, blurry, low quality, distorted, ugly",
            "clip": ["1", 1] // CLIP from Checkpoint
        },
        "class_type": "CLIPTextEncode",
        "_meta": { "title": "Negative Prompt" }
    },
    // 8. CLIP Vision Encode
    "8": {
        "inputs": {
            "clip_vision": ["4", 0],
            "image": ["5", 0],
            "crop": "center"
        },
        "class_type": "CLIPVisionEncode",
        "_meta": { "title": "CLIP Vision Encode" }
    },
    // 11. Scale Image (Resize for Video)
    "11": {
        "inputs": {
            "upscale_method": "lanczos",
            "width": 720,
            "height": 1280,
            "crop": "center",
            "image": ["5", 0]
        },
        "class_type": "ImageScale",
        "_meta": { "title": "Scale Image" }
    },
    // 16. Wan Image-to-Video Conditioning
    "16": {
        "inputs": {
            "positive": ["6", 0],
            "negative": ["7", 0],
            "vae": ["1", 2], // VAE from Checkpoint
            "width": 720,
            "height": 1280,
            "length": 49,
            "batch_size": 1,
            "clip_vision_output": ["8", 0],
            "start_image": ["11", 0]
        },
        "class_type": "WanImageToVideo",
        "_meta": { "title": "Wan Image to Video" }
    },
    // 10. KSampler (Standard)
    "10": {
        "inputs": {
            "seed": 0,
            "steps": 25, // Increased for better quality with Wan 2.2
            "cfg": 8.0,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "denoise": 1.0,
            "model": ["1", 0], // Model from Checkpoint
            "positive": ["16", 0],
            "negative": ["16", 1],
            "latent_image": ["16", 2]
        },
        "class_type": "KSampler",
        "_meta": { "title": "Video KSampler" }
    },
    // 12. VAE Decode
    "12": {
        "inputs": {
            "samples": ["10", 0],
            "vae": ["1", 2] // VAE from Checkpoint
        },
        "class_type": "VAEDecode",
        "_meta": { "title": "VAE Decode" }
    },
    // 14. Save Animated WEBP
    "14": {
        "inputs": {
            "filename_prefix": "wan_i2v",
            "fps": 12,
            "lossless": false,
            "quality": 85,
            "method": "default",
            "images": ["12", 0]
        },
        "class_type": "SaveAnimatedWEBP",
        "_meta": { "title": "Save Video" }
    }
};

export async function POST(request: Request) {
    try {
        const { imageUrl, motionPrompt, sceneId } = await request.json();

        if (!imageUrl) {
            return NextResponse.json(
                { error: 'Image URL is required' },
                { status: 400 }
            );
        }

        const comfyUrl = getComfyUrl();

        // First, upload the image to ComfyUI
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status} `);
        }
        const imageBlob = await imageResponse.blob();

        // Create form data for image upload
        const formData = new FormData();
        formData.append('image', imageBlob, 'input.png');
        formData.append('overwrite', 'true');

        const uploadResponse = await fetch(`${comfyUrl}/upload/image`, {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Failed to upload image: ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        const uploadedImageName = uploadResult.name;

        // Build the workflow with injected values
        const workflow = JSON.parse(JSON.stringify(WAN_I2V_WORKFLOW));

        // Inject image name
        workflow["5"].inputs.image = uploadedImageName;

        // Inject motion prompt
        workflow["6"].inputs.text = motionPrompt || "smooth camera movement, cinematic motion";

        // Generate random seed
        const seed = Math.floor(Math.random() * 2147483647);
        workflow["10"].inputs.seed = seed;

        // Queue the prompt
        const promptResponse = await fetch(`${comfyUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });

        if (!promptResponse.ok) {
            const errorText = await promptResponse.text();
            throw new Error(`Failed to queue prompt: ${errorText}`);
        }

        const promptResult = await promptResponse.json();
        const promptId = promptResult.prompt_id;

        // Poll for completion (max 10 minutes for video)
        const maxAttempts = 120; // 10 minutes at 5 second intervals
        let attempts = 0;
        let outputUrl = null;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

            const historyResponse = await fetch(`${comfyUrl}/history/${promptId}`);
            if (!historyResponse.ok) {
                attempts++;
                continue;
            }

            const history = await historyResponse.json();
            const promptHistory = history[promptId];

            if (promptHistory && promptHistory.outputs) {
                // Find output from any save node (check multiple possible nodes)
                const possibleNodes = ["14", "12", "save"];
                for (const nodeId of Object.keys(promptHistory.outputs)) {
                    const nodeOutput = promptHistory.outputs[nodeId];
                    if (nodeOutput && nodeOutput.images && nodeOutput.images.length > 0) {
                        const outputImage = nodeOutput.images[0];
                        outputUrl = `${comfyUrl}/view?filename=${outputImage.filename}&type=${outputImage.type}&subfolder=${outputImage.subfolder || ''}`;
                        break;
                    }
                }
                if (outputUrl) break;
            }

            // Check for errors
            if (promptHistory && promptHistory.status && promptHistory.status.status_str === 'error') {
                throw new Error('Video generation failed in ComfyUI');
            }

            attempts++;
        }

        if (!outputUrl) {
            throw new Error('Video generation timed out');
        }

        return NextResponse.json({
            success: true,
            videoUrl: outputUrl,
            sceneId,
            promptId
        });

    } catch (error) {
        console.error('Video generation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Video generation failed' },
            { status: 500 }
        );
    }
}
