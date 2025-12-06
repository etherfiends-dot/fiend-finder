import { Seaport } from "@opensea/seaport-js";
import { ethers } from "ethers";

// Seaport v1.6 on Base Mainnet
export const SEAPORT_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";
export const BASE_CHAIN_ID = 8453;

// Item types for Seaport
export const ItemType = {
  NATIVE: 0,      // ETH
  ERC20: 1,       // ERC20 tokens
  ERC721: 2,      // NFTs
  ERC1155: 3,     // Multi-token NFTs
  ERC721_CRITERIA: 4,
  ERC1155_CRITERIA: 5,
};

export interface NFTItem {
  contractAddress: string;
  tokenId: string;
  name?: string;
  image?: string;
}

export interface SeaportOrder {
  parameters: any;
  signature: string;
}

/**
 * Initialize Seaport with a provider
 */
export function initSeaport(provider: ethers.BrowserProvider) {
  // Seaport SDK expects JsonRpcProvider, but BrowserProvider works at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Seaport(provider as any);
}

/**
 * Create a bundle sale order (seller signs, doesn't go on-chain yet)
 */
export async function createBundleOrder(
  seaport: Seaport,
  sellerAddress: string,
  nfts: NFTItem[],
  priceInWei: string,
  currency: 'ETH' | 'USDC' = 'ETH'
): Promise<SeaportOrder> {
  // Build offer items (the NFTs being sold)
  const offerItems = nfts.map(nft => ({
    itemType: ItemType.ERC721,
    token: nft.contractAddress,
    identifier: nft.tokenId,
  }));

  // Build consideration (what seller receives)
  const considerationItems = [
    {
      amount: priceInWei,
      recipient: sellerAddress,
      // Native ETH = zero address, USDC would be the USDC contract
      token: currency === 'ETH' 
        ? "0x0000000000000000000000000000000000000000"
        : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    }
  ];

  // Create the order
  const { executeAllActions } = await seaport.createOrder({
    offer: offerItems,
    consideration: considerationItems,
    // Order expires in 30 days
    endTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });

  // User signs the order (wallet popup)
  const order = await executeAllActions();
  
  return order as SeaportOrder;
}

/**
 * Fulfill an order (buyer pays and receives NFTs)
 */
export async function fulfillOrder(
  seaport: Seaport,
  order: SeaportOrder,
  buyerAddress?: string
): Promise<{ hash: string; wait: () => Promise<unknown> }> {
  const fulfillOptions: { order: SeaportOrder; accountAddress?: string } = { order };
  if (buyerAddress) {
    fulfillOptions.accountAddress = buyerAddress;
  }
  
  const { executeAllActions } = await seaport.fulfillOrder(fulfillOptions);

  const transaction = await executeAllActions();
  // Return with consistent interface
  return transaction as { hash: string; wait: () => Promise<unknown> };
}

/**
 * Check if NFTs are approved for Seaport
 */
export async function checkApprovals(
  provider: ethers.BrowserProvider,
  ownerAddress: string,
  nfts: NFTItem[]
): Promise<{ approved: boolean; needsApproval: string[] }> {
  const signer = await provider.getSigner();
  const needsApproval: string[] = [];

  // Group by contract
  const contractAddresses = [...new Set(nfts.map(n => n.contractAddress))];

  for (const contractAddress of contractAddresses) {
    const nftContract = new ethers.Contract(
      contractAddress,
      [
        "function isApprovedForAll(address owner, address operator) view returns (bool)",
      ],
      signer
    );

    const isApproved = await nftContract.isApprovedForAll(ownerAddress, SEAPORT_ADDRESS);
    if (!isApproved) {
      needsApproval.push(contractAddress);
    }
  }

  return {
    approved: needsApproval.length === 0,
    needsApproval,
  };
}

/**
 * Approve a contract for Seaport
 */
export async function approveForSeaport(
  provider: ethers.BrowserProvider,
  contractAddress: string
) {
  const signer = await provider.getSigner();
  const nftContract = new ethers.Contract(
    contractAddress,
    [
      "function setApprovalForAll(address operator, bool approved) external",
    ],
    signer
  );

  const tx = await nftContract.setApprovalForAll(SEAPORT_ADDRESS, true);
  await tx.wait();
  return tx;
}

/**
 * Encode order for URL parameter
 */
export function encodeOrder(order: SeaportOrder): string {
  return btoa(JSON.stringify(order));
}

/**
 * Decode order from URL parameter
 */
export function decodeOrder(encoded: string): SeaportOrder {
  return JSON.parse(atob(encoded));
}

/**
 * Get price in wei from ETH or USDC amount
 */
export function getPriceInWei(amount: string, currency: 'ETH' | 'USDC'): string {
  if (currency === 'ETH') {
    return ethers.parseEther(amount).toString();
  } else {
    // USDC has 6 decimals
    return ethers.parseUnits(amount, 6).toString();
  }
}

