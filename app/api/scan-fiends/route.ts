import { Alchemy, Network, NftFilters } from "alchemy-sdk";
import { NextRequest, NextResponse } from "next/server";

// Alchemy Configuration - Base Mainnet
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// ---------------------------------------------------------
// CACHING - Store results for 5 minutes to reduce API calls
// Floor prices cached for 15 minutes (change less frequently)
// ---------------------------------------------------------
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FLOOR_PRICE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const floorPriceCache = new Map<string, CacheEntry>();

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

function getFloorPriceFromCache(contractAddress: string): number | null {
  const entry = floorPriceCache.get(contractAddress.toLowerCase());
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > FLOOR_PRICE_CACHE_TTL) {
    floorPriceCache.delete(contractAddress.toLowerCase());
    return null;
  }
  
  return entry.data;
}

function setFloorPriceCache(contractAddress: string, price: number): void {
  floorPriceCache.set(contractAddress.toLowerCase(), { data: price, timestamp: Date.now() });
}

// Fetch floor price for a contract
async function fetchFloorPrice(contractAddress: string): Promise<number> {
  // Check cache first
  const cached = getFloorPriceFromCache(contractAddress);
  if (cached !== null) return cached;
  
  try {
    const floorPrice = await alchemy.nft.getFloorPrice(contractAddress);
    
    // Try OpenSea first, then LooksRare
    let price = 0;
    if (floorPrice.openSea?.floorPrice) {
      price = floorPrice.openSea.floorPrice;
    } else if (floorPrice.looksRare?.floorPrice) {
      price = floorPrice.looksRare.floorPrice;
    }
    
    setFloorPriceCache(contractAddress, price);
    return price;
  } catch (err) {
    console.error(`Error fetching floor price for ${contractAddress}:`, err);
    setFloorPriceCache(contractAddress, 0);
    return 0;
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
    const contractAddresses = new Set<string>();

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
              contractAddresses.add(nft.contract.address);
              allNfts.push({
                tokenId: nft.tokenId,
                name: nft.name || nft.contract.name || `Token #${nft.tokenId}`,
                image: imageUrl,
                collectionName: nft.contract.name || "Unknown Collection",
                contractAddress: nft.contract.address,
                isCustody: walletAddress === user.custody_address,
                floorPrice: 0, // Will be filled in below
              });
            }
          });
        } catch (err) {
          console.error(`Error scanning wallet ${walletAddress}:`, err);
        }
      })
    );

    // ---------------------------------------------------------
    // STEP 3: Fetch Floor Prices for each collection
    // ---------------------------------------------------------
    const floorPrices = new Map<string, number>();
    
    await Promise.all(
      Array.from(contractAddresses).map(async (contractAddress) => {
        const price = await fetchFloorPrice(contractAddress);
        floorPrices.set(contractAddress.toLowerCase(), price);
      })
    );

    // Add floor prices to NFTs and calculate total value
    let totalValueEth = 0;
    allNfts = allNfts.map((nft) => {
      const floorPrice = floorPrices.get(nft.contractAddress.toLowerCase()) || 0;
      totalValueEth += floorPrice;
      return {
        ...nft,
        floorPrice,
      };
    });

    const result = {
      user: user.username,
      fid: user.fid,
      displayName: user.display_name,
      pfp: user.pfp_url,
      wallets: uniqueWallets,
      walletCount: uniqueWallets.length,
      totalFound: allNfts.length,
      totalValueEth: Math.round(totalValueEth * 10000) / 10000, // Round to 4 decimals
      nfts: allNfts,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Full Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
