/**
 * Zora Protocol utilities for creating NFT sales with memecoin pricing
 * 
 * Note: This implementation uses a simplified approach focused on 
 * uploading to IPFS and creating shareable listings.
 * Full Zora SDK integration requires additional wallet/signing setup.
 */

// Default tokens shown in selector (others searchable via DexScreener)
export const MEMECOINS = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x0000000000000000000000000000000000000000", // Native ETH
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    symbol: "DEGEN",
    name: "Degen",
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/34515/small/android-chrome-512x512.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
];

export type Memecoin = (typeof MEMECOINS)[number];

export interface PremintConfig {
  creatorAddress: string;
  tokenName: string;
  tokenDescription: string;
  imageUri: string; // IPFS URI
  price: string; // Price in token units (e.g., "1000000" for 1M tokens)
  currency: Memecoin;
  maxSupply?: number; // Default 100 for edition
  platformReferral?: string;
}

export interface PremintResult {
  collectionAddress?: string;
  tokenId?: string;
  chainId: number;
  ipfsUri: string;
  listingUrl: string;
}

/**
 * Create a listing for a meme/GIF NFT
 * 
 * This is a simplified flow:
 * 1. Image is already uploaded to IPFS
 * 2. We store the listing data and generate a shareable URL
 * 3. Users can mint through Zora's website or a custom mint page
 */
export async function createMemePremint(config: PremintConfig): Promise<{ premint: PremintResult; parameters: unknown }> {
  // For now, we create a "listing" that can be shared
  // Full Zora integration would require wallet signing here
  
  const listingData = {
    creator: config.creatorAddress,
    name: config.tokenName,
    description: config.tokenDescription,
    image: config.imageUri,
    price: config.price,
    currency: config.currency.symbol,
    currencyAddress: config.currency.address,
    maxSupply: config.maxSupply || 100,
    chainId: 8453, // Base
    timestamp: Date.now(),
  };
  
  // Generate a unique listing ID
  const listingId = btoa(JSON.stringify(listingData)).slice(0, 32);
  
  // In a full implementation, this would:
  // 1. Call Zora's createPremint API
  // 2. Sign the typed data with the user's wallet
  // 3. Submit to Zora's backend
  
  return {
    premint: {
      chainId: 8453,
      ipfsUri: config.imageUri,
      listingUrl: `https://zora.co/create`, // Placeholder - would be actual collection URL
    },
    parameters: listingData,
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: string, decimals: number): string {
  const num = parseFloat(price);
  if (isNaN(num)) return "0";
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toFixed(decimals > 6 ? 4 : 2);
}

/**
 * Parse price input with support for K/M suffixes
 */
export function parsePrice(input: string): string {
  const cleaned = input.toUpperCase().replace(/,/g, "");
  
  if (cleaned.endsWith("M")) {
    return String(parseFloat(cleaned.slice(0, -1)) * 1_000_000);
  } else if (cleaned.endsWith("K")) {
    return String(parseFloat(cleaned.slice(0, -1)) * 1_000);
  }
  
  return cleaned;
}

/**
 * Get price in smallest unit (wei)
 */
export function getPriceInWei(price: string, decimals: number): bigint {
  const parsed = parseFloat(price);
  if (isNaN(parsed)) return BigInt(0);
  return BigInt(Math.floor(parsed * Math.pow(10, decimals)));
}
