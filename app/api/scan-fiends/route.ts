import { Alchemy, Network, NftFilters } from "alchemy-sdk";
import { NextRequest, NextResponse } from "next/server";

// Alchemy Configuration - Base Mainnet
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// ---------------------------------------------------------
// CACHING - Store results for 5 minutes to reduce API calls
// ---------------------------------------------------------
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Clean up old entries
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        cache.delete(k);
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: "Missing FID parameter" }, { status: 400 });
  }

  // Check cache first
  const cacheKey = `fid:${fid}`;
  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) {
    console.log(`Cache HIT for ${cacheKey}`);
    return NextResponse.json(cachedResult);
  }
  console.log(`Cache MISS for ${cacheKey}`);

  try {
    // ---------------------------------------------------------
    // STEP 1: Get User via Neynar API
    // ---------------------------------------------------------
    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json({ error: "Server Config Error: Missing Neynar Key" }, { status: 500 });
    }

    const neynarResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": process.env.NEYNAR_API_KEY,
        },
      }
    );

    if (!neynarResponse.ok) {
      const errText = await neynarResponse.text();
      console.error("Neynar Error:", errText);
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    const neynarData = await neynarResponse.json();
    const user = neynarData.users?.[0];

    if (!user) {
      return NextResponse.json({ error: "User not found on Farcaster" }, { status: 404 });
    }

    // Combine wallets
    const allWallets = [
      user.custody_address,
      ...(user.verified_addresses?.eth_addresses || []),
    ];
    const uniqueWallets = [...new Set(allWallets)].filter(Boolean);

    // ---------------------------------------------------------
    // STEP 2: Scan Wallets for NFTs on Base
    // ---------------------------------------------------------
    let allNfts: any[] = [];

    await Promise.all(
      uniqueWallets.map(async (walletAddress) => {
        try {
          const nfts = await alchemy.nft.getNftsForOwner(walletAddress as string, {
            excludeFilters: [NftFilters.SPAM],
            pageSize: 50,
          });

          nfts.ownedNfts.forEach((nft) => {
            const imageUrl =
              nft.image?.cachedUrl ||
              nft.image?.pngUrl ||
              nft.image?.originalUrl ||
              nft.raw?.metadata?.image;

            if (imageUrl) {
              allNfts.push({
                tokenId: nft.tokenId,
                name: nft.name || nft.contract.name || `Token #${nft.tokenId}`,
                image: imageUrl,
                collectionName: nft.contract.name || "Unknown Collection",
                isCustody: walletAddress === user.custody_address,
              });
            }
          });
        } catch (err) {
          console.error(`Error scanning wallet ${walletAddress}:`, err);
        }
      })
    );

    const result = {
      user: user.username,
      fid: user.fid,
      displayName: user.display_name,
      pfp: user.pfp_url,
      walletCount: uniqueWallets.length,
      totalFound: allNfts.length,
      nfts: allNfts,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Full Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
