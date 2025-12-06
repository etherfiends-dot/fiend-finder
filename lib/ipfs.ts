/**
 * IPFS Upload utility using Pinata
 * 
 * You'll need to set NEXT_PUBLIC_PINATA_JWT in your .env.local
 * Get a free API key at: https://app.pinata.cloud/
 */

const PINATA_API_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export interface IPFSUploadResult {
  ipfsHash: string;
  ipfsUri: string;
  gatewayUrl: string;
}

/**
 * Upload a file (image/gif) to IPFS via Pinata
 */
export async function uploadToIPFS(
  file: File | Blob,
  filename: string
): Promise<IPFSUploadResult> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  
  if (!jwt) {
    throw new Error("Pinata JWT not configured. Add NEXT_PUBLIC_PINATA_JWT to your .env.local");
  }

  const formData = new FormData();
  formData.append("file", file, filename);

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to IPFS: ${error}`);
  }

  const result = await response.json();
  const ipfsHash = result.IpfsHash;

  return {
    ipfsHash,
    ipfsUri: `ipfs://${ipfsHash}`,
    gatewayUrl: `${PINATA_GATEWAY}/${ipfsHash}`,
  };
}

/**
 * Upload JSON metadata to IPFS via Pinata
 */
export async function uploadMetadataToIPFS(
  metadata: NFTMetadata
): Promise<IPFSUploadResult> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  
  if (!jwt) {
    throw new Error("Pinata JWT not configured. Add NEXT_PUBLIC_PINATA_JWT to your .env.local");
  }

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: metadata.name,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload metadata to IPFS: ${error}`);
  }

  const result = await response.json();
  const ipfsHash = result.IpfsHash;

  return {
    ipfsHash,
    ipfsUri: `ipfs://${ipfsHash}`,
    gatewayUrl: `${PINATA_GATEWAY}/${ipfsHash}`,
  };
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // IPFS URI of the image
  animation_url?: string; // For GIFs
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
}

/**
 * Create and upload NFT metadata for a meme
 */
export async function createMemeMetadata(params: {
  name: string;
  description: string;
  imageUri: string;
  creator: string;
  topText?: string;
  bottomText?: string;
}): Promise<IPFSUploadResult> {
  const metadata: NFTMetadata = {
    name: params.name,
    description: params.description,
    image: params.imageUri,
    external_url: "https://fiend-finder.vercel.app",
    attributes: [
      { trait_type: "Creator", value: params.creator },
      { trait_type: "Type", value: "Meme" },
    ],
  };

  if (params.topText) {
    metadata.attributes!.push({ trait_type: "Top Text", value: params.topText });
  }
  if (params.bottomText) {
    metadata.attributes!.push({ trait_type: "Bottom Text", value: params.bottomText });
  }

  return uploadMetadataToIPFS(metadata);
}

/**
 * Create and upload NFT metadata for a GIF
 */
export async function createGifMetadata(params: {
  name: string;
  description: string;
  imageUri: string; // The GIF itself
  creator: string;
  frameCount: number;
  speed: number;
}): Promise<IPFSUploadResult> {
  const metadata: NFTMetadata = {
    name: params.name,
    description: params.description,
    image: params.imageUri,
    animation_url: params.imageUri, // Same as image for GIFs
    external_url: "https://fiend-finder.vercel.app",
    attributes: [
      { trait_type: "Creator", value: params.creator },
      { trait_type: "Type", value: "GIF" },
      { trait_type: "Frame Count", value: params.frameCount },
      { trait_type: "Speed (ms)", value: params.speed },
    ],
  };

  return uploadMetadataToIPFS(metadata);
}

/**
 * Convert a base64 string to a Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  // Remove data URI prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Convert a canvas to a Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to convert canvas to blob"));
      }
    }, mimeType);
  });
}

/**
 * Generate a meme image with text overlay
 * Returns a data URL that can be converted to a blob
 */
export async function generateMemeImage(
  imageUrl: string,
  topText: string,
  bottomText: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Configure text style (classic meme style)
      const fontSize = Math.max(canvas.width / 10, 24);
      ctx.font = `bold ${fontSize}px Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.lineWidth = fontSize / 15;

      // Draw top text
      if (topText) {
        const topY = fontSize + 10;
        ctx.strokeText(topText.toUpperCase(), canvas.width / 2, topY);
        ctx.fillText(topText.toUpperCase(), canvas.width / 2, topY);
      }

      // Draw bottom text
      if (bottomText) {
        const bottomY = canvas.height - 20;
        ctx.strokeText(bottomText.toUpperCase(), canvas.width / 2, bottomY);
        ctx.fillText(bottomText.toUpperCase(), canvas.width / 2, bottomY);
      }

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

