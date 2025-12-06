'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';
import { Avatar, Identity, Name, Address, Badge } from '@coinbase/onchainkit/identity';
import { TokenImage } from '@coinbase/onchainkit/token';
import { base } from 'viem/chains';

// ETH token for Base
const ethToken = {
  name: 'Ethereum',
  address: '' as const,
  symbol: 'ETH',
  decimals: 18,
  image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
  chainId: base.id,
};

// Define types
type NFT = {
  tokenId: string;
  name: string;
  image: string;
  collectionName: string;
  contractAddress: string;
  isCustody: boolean;
  floorPrice: number;
};

type ScanResult = {
  user: string;
  fid: number;
  displayName: string;
  pfp: string;
  wallets: string[];
  walletCount: number;
  totalFound: number;
  totalValueEth: number;
  nfts: NFT[];
};

export default function Home() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [currentUserFid, setCurrentUserFid] = useState<number | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoScanned = useRef(false);
  const [hiddenNfts, setHiddenNfts] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const hasLoadedHidden = useRef(false);
  
  // Top 3 Curator state
  const [selectedNfts, setSelectedNfts] = useState<Set<string>>(new Set());
  const [curatorMode, setCuratorMode] = useState(false);
  const hasLoadedTop3 = useRef(false);

  // LocalStorage keys
  const getStorageKey = (fid: number) => `hidden-nfts-${fid}`;
  const getTop3StorageKey = (fid: number) => `top3-nfts-${fid}`;

  // Load hidden NFTs from localStorage when FID is available
  useEffect(() => {
    if (currentUserFid && !hasLoadedHidden.current) {
      hasLoadedHidden.current = true;
      try {
        const stored = localStorage.getItem(getStorageKey(currentUserFid));
        if (stored) {
          const parsed = JSON.parse(stored);
          setHiddenNfts(new Set(parsed));
        }
      } catch (e) {
        console.error('Failed to load hidden NFTs from storage:', e);
      }
    }
  }, [currentUserFid]);

  // Save hidden NFTs to localStorage whenever they change
  useEffect(() => {
    if (currentUserFid && hasLoadedHidden.current) {
      try {
        const toStore = Array.from(hiddenNfts);
        localStorage.setItem(getStorageKey(currentUserFid), JSON.stringify(toStore));
      } catch (e) {
        console.error('Failed to save hidden NFTs to storage:', e);
      }
    }
  }, [hiddenNfts, currentUserFid]);

  // Load Top 3 selections from localStorage
  useEffect(() => {
    if (currentUserFid && !hasLoadedTop3.current) {
      hasLoadedTop3.current = true;
      try {
        const stored = localStorage.getItem(getTop3StorageKey(currentUserFid));
        if (stored) {
          const parsed = JSON.parse(stored);
          setSelectedNfts(new Set(parsed));
        }
      } catch (e) {
        console.error('Failed to load Top 3 NFTs from storage:', e);
      }
    }
  }, [currentUserFid]);

  // Save Top 3 selections to localStorage
  useEffect(() => {
    if (currentUserFid && hasLoadedTop3.current) {
      try {
        const toStore = Array.from(selectedNfts);
        localStorage.setItem(getTop3StorageKey(currentUserFid), JSON.stringify(toStore));
      } catch (e) {
        console.error('Failed to save Top 3 NFTs to storage:', e);
      }
    }
  }, [selectedNfts, currentUserFid]);

  // Generate unique key for NFT
  const getNftKey = (nft: NFT, index: number) => `${nft.tokenId}-${nft.collectionName}-${index}`;
  
  // Toggle Top 3 selection
  const toggleSelectNft = (key: string) => {
    setSelectedNfts(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < 3) {
        next.add(key);
      }
      return next;
    });
  };

  // Share triptych
  const shareTriptych = async () => {
    if (selectedNfts.size !== 3 || !currentUserFid) return;
    
    // Get the selected NFT data
    const selectedData = scanResults?.nfts
      .map((nft, i) => ({ nft, key: getNftKey(nft, i) }))
      .filter(({ key }) => selectedNfts.has(key))
      .map(({ nft }) => ({
        image: nft.image,
        name: nft.name,
        collection: nft.collectionName,
      }));
    
    if (!selectedData || selectedData.length !== 3) return;
    
    // Encode the data for URL
    const encoded = btoa(JSON.stringify({
      fid: currentUserFid,
      user: scanResults?.user,
      displayName: scanResults?.displayName,
      pfp: scanResults?.pfp,
      nfts: selectedData,
    }));
    
    const shareUrl = `${window.location.origin}/triptych?data=${encoded}`;
    
    // Try to share via Farcaster SDK or copy to clipboard
    try {
      if (sdk.actions.openUrl) {
        // Open composer with the share URL
        await sdk.actions.openUrl(shareUrl);
      }
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      alert('Triptych link copied to clipboard!');
    }
  };

  // Toggle hide/show for an NFT
  const toggleHideNft = (key: string) => {
    setHiddenNfts(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
        <div className="flex flex-col items-center gap-3">
          <span className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></span>
          <span className="text-slate-400 text-sm">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-slate-950 min-h-screen text-white p-4 font-sans selection:bg-purple-500/30">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-3xl font-black tracking-tighter" style={{ color: '#0000f4' }}>
            Your Based NFTs
          </h1>
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

              {/* Wallet Addresses with OnchainKit Identity */}
              {scanResults.wallets && scanResults.wallets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-slate-500 text-xs uppercase mb-2">Connected Wallets</p>
                  <div className="space-y-2">
                    {scanResults.wallets.slice(0, 3).map((wallet) => (
                      <Identity
                        key={wallet}
                        address={wallet as `0x${string}`}
                        chain={base}
                        className="!bg-slate-800/50 !rounded-lg !px-3 !py-2"
                      >
                        <Avatar className="!w-6 !h-6" />
                        <Name className="!text-white !text-sm" />
                        <Address className="!text-slate-400 !text-xs" />
                        <Badge className="!bg-blue-500" />
                      </Identity>
                    ))}
                    {scanResults.wallets.length > 3 && (
                      <p className="text-slate-500 text-xs">+{scanResults.wallets.length - 3} more wallets</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Portfolio Value with ETH Icon */}
              {scanResults.totalValueEth > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Portfolio Value</span>
                    <div className="flex items-center gap-2">
                      <TokenImage token={ethToken} size={20} />
                      <span className="text-xl font-bold text-white">{scanResults.totalValueEth.toFixed(4)}</span>
                      <span className="text-slate-400 text-sm">ETH</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top 3 Curator Section */}
            <div className="bg-gradient-to-br from-blue-900/30 to-slate-900 p-4 rounded-2xl border border-blue-500/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Top 3 Curator
                  </h3>
                  <p className="text-slate-400 text-xs">Select 3 favorites to create a shareable triptych</p>
                </div>
                <button
                  onClick={() => setCuratorMode(!curatorMode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    curatorMode 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {curatorMode ? 'Done' : 'Select'}
                </button>
              </div>
              
              {curatorMode && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                  <span className="text-slate-400 text-sm">
                    Selected: <span className="text-white font-bold">{selectedNfts.size}/3</span>
                  </span>
                  {selectedNfts.size === 3 && (
                    <button
                      onClick={shareTriptych}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share Triptych
                    </button>
                  )}
                  {selectedNfts.size > 0 && selectedNfts.size < 3 && (
                    <span className="text-slate-500 text-sm">Select {3 - selectedNfts.size} more</span>
                  )}
                </div>
              )}
              
              {/* Mini preview of selected NFTs */}
              {selectedNfts.size > 0 && !curatorMode && (
                <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                  {scanResults.nfts
                    .map((nft, i) => ({ nft, key: getNftKey(nft, i) }))
                    .filter(({ key }) => selectedNfts.has(key))
                    .map(({ nft, key }) => (
                      <div key={key} className="w-12 h-12 rounded-lg overflow-hidden border border-yellow-500/50">
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                      </div>
                    ))
                  }
                  {selectedNfts.size === 3 && (
                    <button
                      onClick={shareTriptych}
                      className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg flex items-center justify-center gap-1 text-blue-400 text-xs font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* NFT Gallery */}
            {(() => {
              const visibleNfts = scanResults.nfts.filter((nft, i) => !hiddenNfts.has(getNftKey(nft, i)));
              const hiddenNftsList = scanResults.nfts.filter((nft, i) => hiddenNfts.has(getNftKey(nft, i)));
              
              return (
                <>
                  {visibleNfts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {scanResults.nfts.map((nft, i) => {
                        const key = getNftKey(nft, i);
                        if (hiddenNfts.has(key)) return null;
                        return (
                          <div 
                            key={key}
                            className="group relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500 transition-colors"
                          >
                            <img 
                              src={nft.image} 
                              alt={nft.name} 
                              className="w-full h-full object-cover"
                            />
                            {/* Star Button (Curator Mode) */}
                            {curatorMode && (
                              <button
                                onClick={() => toggleSelectNft(key)}
                                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                  selectedNfts.has(key)
                                    ? 'bg-yellow-500 opacity-100'
                                    : 'bg-black/60 hover:bg-yellow-500/80 opacity-100'
                                } ${selectedNfts.size >= 3 && !selectedNfts.has(key) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={selectedNfts.has(key) ? 'Remove from Top 3' : 'Add to Top 3'}
                                disabled={selectedNfts.size >= 3 && !selectedNfts.has(key)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${selectedNfts.has(key) ? 'text-black' : 'text-white'}`} viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </button>
                            )}
                            {/* Hide Button */}
                            {!curatorMode && (
                              <button
                                onClick={() => toggleHideNft(key)}
                                className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                title="Hide NFT"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              </button>
                            )}
                            {/* Selected indicator border */}
                            {selectedNfts.has(key) && (
                              <div className="absolute inset-0 border-4 border-yellow-500 rounded-xl pointer-events-none" />
                            )}
                            {/* Floor Price Badge */}
                            {nft.floorPrice > 0 && (
                              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                                <span className="text-[10px] font-medium text-white">{nft.floorPrice.toFixed(4)} ETH</span>
                              </div>
                            )}
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                              <p className="font-bold text-white text-xs truncate">{nft.name}</p>
                              <p className="text-slate-400 text-[10px] truncate">{nft.collectionName}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : hiddenNftsList.length > 0 ? (
                    <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800">
                      <p className="text-slate-400">All NFTs are hidden</p>
                      <p className="text-slate-500 text-sm mt-1">Expand the hidden section below to view them</p>
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

                  {/* Hidden NFTs Dropdown */}
                  {hiddenNftsList.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setShowHidden(!showHidden)}
                        className="w-full flex items-center justify-between p-3 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700 rounded-xl transition-colors"
                      >
                        <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                          Hidden NFTs ({hiddenNftsList.length})
                        </span>
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className={`h-5 w-5 text-slate-400 transition-transform ${showHidden ? 'rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showHidden && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {scanResults.nfts.map((nft, i) => {
                            const key = getNftKey(nft, i);
                            if (!hiddenNfts.has(key)) return null;
                            return (
                              <div 
                                key={key}
                                className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700 opacity-60 hover:opacity-100 transition-opacity"
                              >
                                <img 
                                  src={nft.image} 
                                  alt={nft.name} 
                                  className="w-full h-full object-cover"
                                />
                                {/* Unhide Button */}
                                <button
                                  onClick={() => toggleHideNft(key)}
                                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-green-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                  title="Show NFT"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                {/* Name overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1">
                                  <p className="text-white text-[9px] truncate text-center">{nft.name}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </main>
  );
}
