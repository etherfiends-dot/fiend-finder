'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import sdk from '@farcaster/frame-sdk';
import { ethers } from 'ethers';
import { initSeaport, fulfillOrder, SEAPORT_ADDRESS, getPriceInWei } from '@/lib/seaport';

interface BundleNft {
  name: string;
  image: string;
  contract: string;
  tokenId: string;
}

interface SeaportOrder {
  parameters: any;
  signature: string;
}

interface BundleData {
  seller: string;
  sellerFid: number;
  sellerPfp: string;
  sellerAddress?: string;
  price: string;
  currency: 'ETH' | 'USDC';
  nfts: BundleNft[];
  seaportOrder?: SeaportOrder;
}

function BundleContent() {
  const searchParams = useSearchParams();
  const [bundleData, setBundleData] = useState<BundleData | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<'idle' | 'connecting' | 'confirming' | 'processing'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decoded = JSON.parse(atob(decodeURIComponent(data)));
        setBundleData(decoded);
      } catch (err) {
        console.error('Failed to decode bundle data:', err);
      }
    }
    sdk.actions.ready();
  }, [searchParams]);

  const handleBuy = async () => {
    if (!bundleData) return;

    // Check if this is a Seaport order
    if (!bundleData.seaportOrder) {
      alert('This listing was created before Seaport integration. Please ask the seller to create a new listing.');
      return;
    }

    setPurchasing(true);
    setPurchaseStep('connecting');

    try {
      // Check for wallet
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('Please connect a wallet to purchase. Make sure you have MetaMask or another Web3 wallet installed.');
        setPurchasing(false);
        setPurchaseStep('idle');
        return;
      }

      // Connect to provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const buyerAddress = await signer.getAddress();

      // Check if buyer is not the seller
      if (bundleData.sellerAddress && buyerAddress.toLowerCase() === bundleData.sellerAddress.toLowerCase()) {
        alert('You cannot buy your own listing!');
        setPurchasing(false);
        setPurchaseStep('idle');
        return;
      }

      // Check balance
      const priceInWei = getPriceInWei(bundleData.price, bundleData.currency);
      if (bundleData.currency === 'ETH') {
        const balance = await provider.getBalance(buyerAddress);
        if (balance < BigInt(priceInWei)) {
          alert(`Insufficient ETH balance. You need ${bundleData.price} ETH.`);
          setPurchasing(false);
          setPurchaseStep('idle');
          return;
        }
      }

      // Initialize Seaport
      const seaport = initSeaport(provider);

      setPurchaseStep('confirming');

      // Fulfill the order
      const tx = await fulfillOrder(seaport, bundleData.seaportOrder, buyerAddress);
      
      setPurchaseStep('processing');
      setTxHash(tx.hash);

      // Wait for confirmation
      await tx.wait();

      alert(`🎉 Purchase successful!\n\nYou now own ${bundleData.nfts.length} NFTs!\n\nTransaction: ${tx.hash}`);

    } catch (err: any) {
      console.error('Purchase failed:', err);
      if (err.code === 'ACTION_REJECTED') {
        alert('Transaction cancelled');
      } else {
        alert(`Purchase failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setPurchasing(false);
      setPurchaseStep('idle');
    }
  };

  const contactSeller = async () => {
    if (!bundleData) return;
    try {
      const priceDisplay = bundleData.currency === 'USDC' 
        ? `$${bundleData.price} USDC` 
        : `${bundleData.price} ETH`;
      await sdk.actions.composeCast({
        text: `@${bundleData.seller} Hey! I'm interested in your NFT bundle for ${priceDisplay} 👀`,
      });
    } catch (err) {
      console.error('Failed to compose cast:', err);
    }
  };

  if (!bundleData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading bundle...</div>
      </div>
    );
  }

  const hasSeaportOrder = !!bundleData.seaportOrder;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-green-950/20 to-slate-950 text-white">
      <div className="max-w-md mx-auto p-4">
        <div className="text-center mb-6 pt-4">
          <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            NFT Bundle for Sale
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {bundleData.currency === 'USDC' ? '$' : ''}{bundleData.price} {bundleData.currency || 'ETH'}
          </h1>
          <p className="text-slate-400">{bundleData.nfts.length} NFT{bundleData.nfts.length > 1 ? 's' : ''} included</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl mb-6 border border-slate-800">
          <img 
            src={bundleData.sellerPfp} 
            alt={bundleData.seller}
            className="w-12 h-12 rounded-full border-2 border-green-500/50"
          />
          <div>
            <p className="text-slate-400 text-xs">Seller</p>
            <p className="font-semibold">@{bundleData.seller}</p>
          </div>
          {hasSeaportOrder && (
            <div className="ml-auto flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full">
              <span>🌊</span> Seaport
            </div>
          )}
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase mb-3">What's Included</h3>
          <div className={`grid gap-3 ${bundleData.nfts.length <= 2 ? 'grid-cols-2' : bundleData.nfts.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {bundleData.nfts.map((nft, i) => (
              <div key={i} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                <div className="aspect-square">
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{nft.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400">Bundle Price</span>
            <span className="font-bold text-xl">
              {bundleData.currency === 'USDC' ? '$' : ''}{bundleData.price} {bundleData.currency || 'ETH'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Per NFT avg</span>
            <span className="text-slate-400">
              ~{bundleData.currency === 'USDC' ? '$' : ''}{(parseFloat(bundleData.price) / bundleData.nfts.length).toFixed(bundleData.currency === 'USDC' ? 2 : 4)} {bundleData.currency || 'ETH'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleBuy}
            disabled={purchasing || !hasSeaportOrder}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              purchasing
                ? 'bg-green-500/50 cursor-wait'
                : !hasSeaportOrder
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/25'
            }`}
          >
            {purchasing ? (
              <>
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                {purchaseStep === 'connecting' && 'Connecting Wallet...'}
                {purchaseStep === 'confirming' && 'Confirm in Wallet...'}
                {purchaseStep === 'processing' && 'Processing...'}
              </>
            ) : !hasSeaportOrder ? (
              <>Legacy Listing (Contact Seller)</>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Buy Bundle
              </>
            )}
          </button>

          <button
            onClick={contactSeller}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Message Seller
          </button>
        </div>

        {txHash && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
            <p className="text-green-400 text-sm font-medium">Transaction submitted!</p>
            <a 
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-300 text-xs hover:underline break-all"
            >
              View on BaseScan →
            </a>
          </div>
        )}

        <p className="text-center text-slate-500 text-xs mt-6">
          🌊 Secured by Seaport Protocol • 0% platform fees
        </p>

        <div className="mt-8 text-center">
          <button
            onClick={() => sdk.actions.openUrl('https://fiend-finder.vercel.app')}
            className="text-green-400 hover:text-green-300 text-sm font-medium"
          >
            Create your own bundle →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BundleClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading bundle...</div>
      </div>
    }>
      <BundleContent />
    </Suspense>
  );
}
