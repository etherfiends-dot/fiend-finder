'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';

// Define types
type NFT = {
  tokenId: string;
  name: string;
  image: string;
  collectionName: string;
  isCustody: boolean;
};

type ScanResult = {
  user: string;
  fid: number;
  displayName: string;
  pfp: string;
  walletCount: number;
  totalFound: number;
  nfts: NFT[];
};

export default function Home() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [currentUserFid, setCurrentUserFid] = useState<number | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoScanned = useRef(false);

  // Scan by FID
  const scanByFid = useCallback(async (fid: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/scan-fiends?fid=${fid}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Scan failed");
      }
      const data = await res.json();
      setScanResults(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load SDK and auto-scan
  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        if (context?.user?.fid) {
          setCurrentUserFid(context.user.fid);
        }
        sdk.actions.ready();
        setIsSDKLoaded(true);
      } catch (e) {
        setIsSDKLoaded(true);
      }
    };
    if (sdk && !isSDKLoaded) load();
  }, [isSDKLoaded]);

  // Auto-scan when FID is detected
  useEffect(() => {
    if (isSDKLoaded && currentUserFid && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      scanByFid(currentUserFid);
    }
  }, [isSDKLoaded, currentUserFid, scanByFid]);

  if (!isSDKLoaded) {
    return (
      <div className="bg-slate-950 text-white h-screen flex items-center justify-center">
        <span className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></span>
      </div>
    );
  }

  return (
    <main className="bg-slate-950 min-h-screen text-white p-4 font-sans selection:bg-purple-500/30">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent tracking-tighter">
            SOUL SCANNER
          </h1>
          <p className="text-slate-400 text-sm mt-1">Your NFT collection on Base</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl mb-6 text-center text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full mb-4"></span>
            <p className="text-slate-400">Loading your collection...</p>
          </div>
        )}

        {/* Not in Warpcast */}
        {!loading && !scanResults && !currentUserFid && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Open in Warpcast</h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              View your NFT collection on Base by opening this frame in Warpcast.
            </p>
          </div>
        )}

        {/* Results */}
        {scanResults && !loading && (
          <div className="space-y-6 pb-8">
            
            {/* Profile Card */}
            <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 p-4 rounded-2xl border border-purple-500/30">
              <div className="flex items-center gap-4">
                {scanResults.pfp && (
                  <img 
                    src={scanResults.pfp} 
                    alt={scanResults.displayName}
                    className="w-16 h-16 rounded-full border-2 border-purple-500"
                  />
                )}
                <div className="flex-1">
                  <p className="font-bold text-white text-lg">{scanResults.displayName}</p>
                  <p className="text-purple-400">@{scanResults.user}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{scanResults.totalFound}</p>
                  <p className="text-slate-400 text-xs uppercase">NFTs</p>
                </div>
              </div>
            </div>

            {/* NFT Gallery */}
            {scanResults.nfts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {scanResults.nfts.map((nft, i) => (
                  <div 
                    key={`${nft.tokenId}-${i}`}
                    className="group relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500 transition-colors"
                  >
                    <img 
                      src={nft.image} 
                      alt={nft.name} 
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3">
                      <p className="font-bold text-white text-xs truncate">{nft.name}</p>
                      <p className="text-slate-400 text-[10px] truncate">{nft.collectionName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-400">No NFTs found on Base</p>
                <p className="text-slate-500 text-sm mt-1">Start collecting to see them here!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
