import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to validate environment
const getComfyUrl = () => {
    // Hardcode the URL to ensure it works regardless of env vars
    return "https://emma-timing-outlets-voltage.trycloudflare.com";
};

const COMFY_WORKFLOW = {
    "3": {
        "inputs": {
            "seed": 0,
            "steps": 25,
            "cfg": 7,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "denoise": 1,
            "model": [
                "4",
                0
            ],
            "positive": [
                "6",
                0
            ],
            "negative": [
                "7",
                0
            ],
            "latent_image": [
                "5",
                0
            ]
        },
        "class_type": "KSampler",
        "_meta": {
            "title": "KSampler"
        }
    },
    "4": {
        "inputs": {
            "unet_name": "z_image_turbo_bf16.safetensors",
            "weight_dtype": "default"
        },
        "class_type": "UNETLoader",
        "_meta": {
            "title": "Load UNET (Z-Image)"
        }
    },
    "10": {
        "inputs": {
            "clip_name": "qwen_3_4b.safetensors",
            "type": "qwen_image"
        },
        "class_type": "CLIPLoader",
        "_meta": {
            "title": "Load CLIP (Qwen)"
        }
    },
    "11": {
        "inputs": {
            "vae_name": "ae.safetensors"
        },
        "class_type": "VAELoader",
        "_meta": {
            "title": "Load VAE (Flux)"
        }
    },
    "5": {
        "inputs": {
            "width": 1024, // Will be overridden
            "height": 1024,
            "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
            "title": "Empty Latent Image"
        }
    },
    "6": {
        "inputs": {
            "text": "", // Will be overridden
            "clip": [
                "10",
                0
            ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
            "title": "CLIP Text Encode (Prompt)"
        }
    },
    "7": {
        "inputs": {
            "text": "text, watermark, blurry, low quality, ugly, deformed hands",
            "clip": [
                "10",
                0
            ]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
            "title": "CLIP Text Encode (Negative Prompt)"
        }
    },
    "8": {
        "inputs": {
            "samples": [
                "3",
                0
            ],
            "vae": [
                "11",
                0
            ]
        },
        "class_type": "VAEDecode",
        "_meta": {
            "title": "VAE Decode"
        }
    },
    "9": {
        "inputs": {
            "filename_prefix": "tubiq_storyboard",
            "images": [
                "8",
                0
            ]
        },
        "class_type": "SaveImage",
        "_meta": {
            "title": "Save Image"
        }
    }
};

export async function POST(request: Request) {
    try {
        const { prompt, negative_prompt, aspectRatio, seed, sampler } = await request.json();

        // 1. Configure Dimensions based on Ratio (Full HD / 1080p)
        let width = 1024;
        let height = 1024;
        if (aspectRatio === '9:16') { width = 1080; height = 1920; }
        else if (aspectRatio === '16:9') { width = 1920; height = 1080; }
        else if (aspectRatio === '2.35:1') { width = 1920; height = 816; } // Cinematic 2.35:1
        else if (aspectRatio === '1:1') { width = 1024; height = 1024; } // Square stays 1024 for compatibility

        // 2. Prepare Workflow
        const workflow = JSON.parse(JSON.stringify(COMFY_WORKFLOW));

        // Inject values
        // Inject values
        workflow["3"].inputs.seed = seed ?? Math.floor(Math.random() * 1000000000);

        // Turbo / LCM Model Settings Optimization
        workflow["3"].inputs.steps = 4; // Turbo needs 4-8 steps
        workflow["3"].inputs.cfg = 1.0;    // Turbo needs 1.0 CFG
        workflow["3"].inputs.scheduler = "sgm_uniform"; // CRITICAL: Turbo models fry without this or 'simple'

        // Sampler Mapping
        const samplerMap: Record<string, string> = {
            'dpm++_2m_karras': 'dpmpp_2m',
            'euler_a': 'euler_ancestral',
            'lcm': 'lcm'
        };
        // Force Euler A for Turbo if not specified, or respect user choice but prefer fast ones
        if (sampler) workflow["3"].inputs.sampler_name = samplerMap[sampler] || "euler_ancestral";
        else workflow["3"].inputs.sampler_name = "euler_ancestral";

        workflow["5"].inputs.width = width;
        workflow["5"].inputs.height = height;

        workflow["6"].inputs.text = prompt;
        workflow["7"].inputs.text = negative_prompt || "blurry, low quality, ugly";

        // 3. Send to ComfyUI
        const comfyUrl = getComfyUrl();
        const promptRes = await fetch(`${comfyUrl}/prompt`, {
            method: 'POST',
            body: JSON.stringify({ prompt: workflow }),
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; TubiQ/1.0)',
                'Accept': 'application/json'
            },
        });

        if (!promptRes.ok) {
            const errText = await promptRes.text();
            console.error(`ComfyUI Error (${promptRes.status} ${promptRes.statusText}):`, errText);
            throw new Error(`ComfyUI Connection Failed (${promptRes.status} ${promptRes.statusText}): ${errText}`);
        }

        const promptData = await promptRes.json();
        const promptId = promptData.prompt_id;

        // 4. Poll for completion (Simple polling for V1)
        // In production, use WebSocket. Here we'll poll history.
        let imageUrl = null;
        let attempts = 0;

        while (!imageUrl && attempts < 300) { // Timeout after ~300s (Extended for high-res/cold start)
            await new Promise(r => setTimeout(r, 1000));
            attempts++;

            const historyRes = await fetch(`${comfyUrl}/history/${promptId}`);
            if (historyRes.ok) {
                const historyData = await historyRes.json();
                if (historyData[promptId] && historyData[promptId].outputs) {
                    const outputs = historyData[promptId].outputs;
                    // Find SaveImage output node (Node 9)
                    if (outputs["9"] && outputs["9"].images && outputs["9"].images.length > 0) {
                        const img = outputs["9"].images[0];
                        // Construct direct URL to ComfyUI view endpoint
                        imageUrl = `${comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
                    }
                }
            }
        }

        if (!imageUrl) throw new Error("Image generation timed out");

        return NextResponse.json({
            ok: true,
            imageUrl: imageUrl
        });

    } catch (error: any) {
        console.error("Generation Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
