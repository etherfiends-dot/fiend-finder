import { Alchemy, Network, NftFilters } from "alchemy-sdk";
import { NextRequest, NextResponse } from "next/server";

// Alchemy Configuration - Base Mainnet
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Your Contract Address 
// (Replace this with your actual contract later to highlight your specific NFTs)
const FIEND_CONTRACT_ADDRESS = "0xYourContractAddressHere".toLowerCase();

// ---------------------------------------------------------
// CACHING - Store results for 5 minutes to reduce API calls
// ---------------------------------------------------------
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

function getCacheKey(fid: string | null, username: string | null): string {
  return fid ? `fid:${fid}` : `username:${username?.toLowerCase()}`;
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  // Check if cache has expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Clean up old entries (prevent memory leak)
  if (cache.size > 1000) {
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
  const username = searchParams.get('username');

  if (!fid && !username) {
    return NextResponse.json({ error: "Missing FID or username parameter" }, { status: 400 });
  }

  // Check cache first
  const cacheKey = getCacheKey(fid, username);
  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) {
    console.log(`Cache HIT for ${cacheKey}`);
    return NextResponse.json(cachedResult);
  }
  console.log(`Cache MISS for ${cacheKey}`);

  try {
    // ---------------------------------------------------------
    // STEP 1: Get Linked Wallets via Neynar API
    // ---------------------------------------------------------
    if (!process.env.NEYNAR_API_KEY) {
        return NextResponse.json({ error: "Server Config Error: Missing Neynar Key" }, { status: 500 });
    }

    let user;

    if (username) {
      // Lookup by exact username (free tier endpoint)
      const usernameResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
        {
          headers: {
            accept: "application/json",
            "x-api-key": process.env.NEYNAR_API_KEY!,
          },
        }
      );

      if (!usernameResponse.ok) {
        const errData = await usernameResponse.json().catch(() => ({}));
        console.error("Neynar Username Lookup Error:", errData);
        if (usernameResponse.status === 404) {
          return NextResponse.json({ error: `User "@${username}" not found on Farcaster` }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to lookup user" }, { status: 500 });
      }

      const usernameData = await usernameResponse.json();
      user = usernameData.user;

      if (!user) {
        return NextResponse.json({ error: `User "@${username}" not found on Farcaster` }, { status: 404 });
      }
    } else {
      // Lookup by FID
      const neynarResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
        {
          headers: {
            accept: "application/json",
            "api_key": process.env.NEYNAR_API_KEY,
          },
        }
      );

      if (!neynarResponse.ok) {
        const errText = await neynarResponse.text();
        console.error("Neynar Error:", errText);
        return NextResponse.json({ error: "Failed to fetch user data from Neynar" }, { status: 500 });
      }

      const neynarData = await neynarResponse.json();
      user = neynarData.users?.[0];

      if (!user) {
        return NextResponse.json({ error: "User not found on Farcaster" }, { status: 404 });
      }
    }

    // Combine the Custody Address (Cold) + All Verified Addresses (Hot)
    const allWallets = [
      user.custody_address,
      ...(user.verified_addresses.eth_addresses || []),
    ];

    // Remove duplicates and nulls
    const uniqueWallets = [...new Set(allWallets)].filter(Boolean);

    // ---------------------------------------------------------
    // STEP 2: Scan Every Wallet for NFTs on Base using Alchemy
    // ---------------------------------------------------------
    let allNfts: any[] = [];

    await Promise.all(
      uniqueWallets.map(async (walletAddress) => {
        try {
          // Get NFTs from Alchemy with Spam Filter enabled
          const nfts = await alchemy.nft.getNftsForOwner(walletAddress as string, {
            excludeFilters: [NftFilters.SPAM],
            pageSize: 50,
          });

          nfts.ownedNfts.forEach((nft) => {
            // Alchemy SDK v3 image structure
            const imageUrl =
              nft.image?.cachedUrl ||
              nft.image?.pngUrl ||
              nft.image?.originalUrl ||
              nft.raw?.metadata?.image;

            // Only add if it has a valid image
            if (imageUrl) {
              allNfts.push({
                tokenId: nft.tokenId,
                name: nft.name || nft.contract.name || `Token #${nft.tokenId}`,
                image: imageUrl,
                location: walletAddress,
                // Flag if it's in the cold wallet
                isCustody: walletAddress === user.custody_address,
                // Flag if it matches YOUR specific collection (Contract Address)
                isFiend: nft.contract.address.toLowerCase() === FIEND_CONTRACT_ADDRESS,
              });
            }
          });
        } catch (err) {
          console.error(`Error scanning wallet ${walletAddress}:`, err);
        }
      })
    );

    // Sort Results: Put "Fiend" NFTs at the top
    allNfts.sort((a, b) => Number(b.isFiend) - Number(a.isFiend));

    const result = {
      user: user.username,
      fid: user.fid,
      displayName: user.display_name,
      pfp: user.pfp_url,
      walletCount: uniqueWallets.length,
      totalFound: allNfts.length,
      nfts: allNfts,
    };

    // Save to cache before returning
    setCache(cacheKey, result);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error("Full Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}