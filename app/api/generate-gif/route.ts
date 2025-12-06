import { NextRequest, NextResponse } from "next/server";
import GifEncoder from "gif-encoder-2";
import { Jimp } from "jimp";

// Max dimensions for the GIF (for performance)
const MAX_SIZE = 512;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrls, speed = 500 } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 image URLs" },
        { status: 400 }
      );
    }

    if (imageUrls.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 images allowed" },
        { status: 400 }
      );
    }

    // Download and process all images
    const processedImages: Buffer[] = [];
    let width = MAX_SIZE;
    let height = MAX_SIZE;

    for (const url of imageUrls) {
      try {
        // Fetch image
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch image: ${url}`);
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Process with Jimp
        const image = await Jimp.read(buffer);
        
        // Resize to fit within MAX_SIZE while maintaining aspect ratio
        if (image.width > MAX_SIZE || image.height > MAX_SIZE) {
          image.scaleToFit({ w: MAX_SIZE, h: MAX_SIZE });
        }
        
        // Use first image dimensions for GIF
        if (processedImages.length === 0) {
          width = image.width;
          height = image.height;
        } else {
          // Resize subsequent images to match first
          image.resize({ w: width, h: height });
        }
        
        // Get raw pixel data (RGBA)
        const pixels = new Uint8Array(image.bitmap.data);
        processedImages.push(Buffer.from(pixels));
        
      } catch (err) {
        console.error(`Error processing image ${url}:`, err);
      }
    }

    if (processedImages.length < 2) {
      return NextResponse.json(
        { error: "Could not process enough images" },
        { status: 400 }
      );
    }

    // Create GIF encoder
    const encoder = new GifEncoder(width, height, "neuquant", true);
    
    // Configure encoder
    encoder.setDelay(speed);
    encoder.setRepeat(0); // Loop forever
    encoder.setQuality(10); // 1-30, lower is better quality but slower
    
    // Start encoding
    encoder.start();
    
    // Add each frame
    for (const pixels of processedImages) {
      encoder.addFrame(pixels);
    }
    
    // Finish encoding
    encoder.finish();
    
    // Get the GIF buffer
    const gifBuffer = encoder.out.getData();
    
    // Return as base64 for easy handling
    const base64Gif = gifBuffer.toString("base64");
    
    return NextResponse.json({
      success: true,
      gif: base64Gif,
      mimeType: "image/gif",
      width,
      height,
      frames: processedImages.length,
    });
    
  } catch (error) {
    console.error("GIF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate GIF" },
      { status: 500 }
    );
  }
}

