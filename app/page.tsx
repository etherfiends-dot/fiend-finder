'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';

// Define types
type NFT = {
  tokenId: string;
  name: string;
  image: string;
  contractAddress: string;
  collectionName: string;
  isCustody: boolean;
};

type Collector = {
  user: {
    fid: number;
    username: string;
    displayName: string;
    pfp: string;
  };
  sharedCollections: string[];
};

type ScanResult = {
  user: string;
  fid: number;
  displayName: string;
  pfp: string;
  walletCount: number;
  totalFound: number;
  collectionsCount: number;
  nfts: NFT[];
  similarCollectors: Collector[];
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
      <div className="max-w-lg mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent tracking-tighter">
            SOUL SCANNER
          </h1>
          <p className="text-slate-400 text-sm mt-1">Find collectors like you on Base</p>
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
            <p className="text-slate-400">Scanning your collections...</p>
            <p className="text-slate-500 text-sm mt-1">Finding collectors like you</p>
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
              This frame discovers Farcaster users who collect the same NFTs as you.
            </p>
          </div>
        )}

        {/* Results */}
        {scanResults && !loading && (
          <div className="space-y-6 pb-8">
            
            {/* Your Profile Card */}
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
              </div>
              <div className="flex gap-4 mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-white">{scanResults.totalFound}</p>
                  <p className="text-slate-400 text-xs uppercase">NFTs</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-white">{scanResults.collectionsCount}</p>
                  <p className="text-slate-400 text-xs uppercase">Collections</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-purple-400">{scanResults.similarCollectors.length}</p>
                  <p className="text-slate-400 text-xs uppercase">Matches</p>
                </div>
              </div>
            </div>

            {/* Similar Collectors */}
            {scanResults.similarCollectors.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-purple-400">✨</span>
                  Collectors Like You
                </h2>
                <div className="space-y-3">
                  {scanResults.similarCollectors.map((collector) => (
                    <div 
                      key={collector.user.fid}
                      className="bg-slate-900 p-3 rounded-xl border border-slate-800 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {collector.user.pfp && (
                          <img 
                            src={collector.user.pfp} 
                            alt={collector.user.displayName}
                            className="w-12 h-12 rounded-full border border-slate-700"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{collector.user.displayName}</p>
                          <p className="text-slate-400 text-sm">@{collector.user.username}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-purple-400 font-bold">{collector.sharedCollections.length}</p>
                          <p className="text-slate-500 text-xs">shared</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {collector.sharedCollections.slice(0, 3).map((collection, i) => (
                          <span 
                            key={i}
                            className="px-2 py-0.5 bg-slate-800 rounded-full text-xs text-slate-300 truncate max-w-[120px]"
                          >
                            {collection}
                          </span>
                        ))}
                        {collector.sharedCollections.length > 3 && (
                          <span className="px-2 py-0.5 bg-purple-900/30 rounded-full text-xs text-purple-300">
                            +{collector.sharedCollections.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No matches found */}
            {scanResults.similarCollectors.length === 0 && scanResults.totalFound > 0 && (
              <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800">
                <p className="text-slate-400">No matching collectors found yet</p>
                <p className="text-slate-500 text-sm mt-1">Your collections might be unique!</p>
              </div>
            )}

            {/* Your NFTs */}
            {scanResults.nfts.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-purple-400">🖼️</span>
                  Your Collection
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {scanResults.nfts.slice(0, 12).map((nft, i) => (
                    <div 
                      key={`${nft.tokenId}-${i}`}
                      className="aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800"
                    >
                      <img 
                        src={nft.image} 
                        alt={nft.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                {scanResults.nfts.length > 12 && (
                  <p className="text-center text-slate-500 text-sm mt-3">
                    +{scanResults.nfts.length - 12} more NFTs
                  </p>
                )}
              </div>
            )}

            {/* No NFTs */}
            {scanResults.nfts.length === 0 && (
              <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800">
                <p className="text-slate-400">No NFTs found on Base</p>
                <p className="text-slate-500 text-sm mt-1">Collect some NFTs to find similar collectors!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
