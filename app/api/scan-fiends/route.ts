import { Alchemy, Network, NftFilters } from "alchemy-sdk";
import { NextRequest, NextResponse } from "next/server";

// Alchemy Configuration - Base Mainnet
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// ---------------------------------------------------------
// CACHING - Store results to reduce API calls
// ---------------------------------------------------------
type CacheEntry = {
  data: any;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for user data
const COLLECTION_CACHE_TTL = 60 * 60 * 1000; // 1 hour for collection holders

function getFromCache(key: string, ttl: number = CACHE_TTL): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > ttl) {
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
      if (now - v.timestamp > COLLECTION_CACHE_TTL) {
        cache.delete(k);
      }
    }
  }
}

// ---------------------------------------------------------
// Find Farcaster users holding a specific collection
// ---------------------------------------------------------
async function getCollectionHolders(contractAddress: string): Promise<any[]> {
  const cacheKey = `holders:${contractAddress.toLowerCase()}`;
  const cached = getFromCache(cacheKey, COLLECTION_CACHE_TTL);
  if (cached) {
    console.log(`Cache HIT for collection holders: ${contractAddress}`);
    return cached;
  }
  console.log(`Cache MISS for collection holders: ${contractAddress}`);

  try {
    // Get owners of this collection from Alchemy
    const owners = await alchemy.nft.getOwnersForContract(contractAddress);
    const ownerAddresses = owners.owners.slice(0, 100); // Limit to top 100 holders

    if (ownerAddresses.length === 0) return [];

    // Look up which wallets belong to Farcaster users
    const farcasterUsers = await lookupFarcasterUsers(ownerAddresses);
    
    setCache(cacheKey, farcasterUsers);
    return farcasterUsers;
  } catch (err) {
    console.error(`Error getting holders for ${contractAddress}:`, err);
    return [];
  }
}

// ---------------------------------------------------------
// Batch lookup wallet addresses to Farcaster users
// ---------------------------------------------------------
async function lookupFarcasterUsers(addresses: string[]): Promise<any[]> {
  if (!process.env.NEYNAR_API_KEY || addresses.length === 0) return [];

  try {
    // Neynar bulk lookup by address (batches of 350 max)
    const batchSize = 350;
    const allUsers: any[] = [];

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const addressList = batch.join(",");

      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${encodeURIComponent(addressList)}`,
        {
          headers: {
            accept: "application/json",
            "x-api-key": process.env.NEYNAR_API_KEY!,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // data is an object with addresses as keys
        for (const [address, users] of Object.entries(data)) {
          if (Array.isArray(users) && users.length > 0) {
            allUsers.push({
              address,
              user: users[0], // Take first user if multiple
            });
          }
        }
      }
    }

    return allUsers;
  } catch (err) {
    console.error("Error looking up Farcaster users:", err);
    return [];
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
              // Track unique collections
              contractAddresses.add(nft.contract.address.toLowerCase());
              
              allNfts.push({
                tokenId: nft.tokenId,
                name: nft.name || nft.contract.name || `Token #${nft.tokenId}`,
                image: imageUrl,
                contractAddress: nft.contract.address.toLowerCase(),
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

    // ---------------------------------------------------------
    // STEP 3: Find Farcaster users with same collections
    // ---------------------------------------------------------
    const topCollections = Array.from(contractAddresses).slice(0, 10);
    const collectorsMap = new Map<number, { user: any; sharedCollections: string[] }>();

    await Promise.all(
      topCollections.map(async (contractAddress) => {
        const holders = await getCollectionHolders(contractAddress);
        const collectionName = allNfts.find(n => n.contractAddress === contractAddress)?.collectionName || "Unknown";
        
        holders.forEach(({ user: holderUser }) => {
          // Don't include the current user
          if (holderUser.fid === user.fid) return;
          
          if (collectorsMap.has(holderUser.fid)) {
            collectorsMap.get(holderUser.fid)!.sharedCollections.push(collectionName);
          } else {
            collectorsMap.set(holderUser.fid, {
              user: {
                fid: holderUser.fid,
                username: holderUser.username,
                displayName: holderUser.display_name,
                pfp: holderUser.pfp_url,
              },
              sharedCollections: [collectionName],
            });
          }
        });
      })
    );

    // Sort by most shared collections
    const similarCollectors = Array.from(collectorsMap.values())
      .sort((a, b) => b.sharedCollections.length - a.sharedCollections.length)
      .slice(0, 20); // Top 20 similar collectors

    const result = {
      user: user.username,
      fid: user.fid,
      displayName: user.display_name,
      pfp: user.pfp_url,
      walletCount: uniqueWallets.length,
      totalFound: allNfts.length,
      collectionsCount: contractAddresses.size,
      nfts: allNfts,
      similarCollectors,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Full Scan Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
