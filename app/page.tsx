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

type Tab = 'gallery' | 'top3' | 'trade' | 'fun';

export default function Home() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [currentUserFid, setCurrentUserFid] = useState<number | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoScanned = useRef(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('gallery');
  
  // Gallery state
  const [hiddenNfts, setHiddenNfts] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const hasLoadedHidden = useRef(false);
  
  // Top 3 Curator state
  const [selectedNfts, setSelectedNfts] = useState<Set<string>>(new Set());
  const hasLoadedTop3 = useRef(false);
  
  // Trade state
  const [bagNfts, setBagNfts] = useState<Set<string>>(new Set());
  const [bagPrice, setBagPrice] = useState('');
  const [swapUsername, setSwapUsername] = useState('');
  const [mySwapNft, setMySwapNft] = useState<string | null>(null);
  const [theirSwapNft, setTheirSwapNft] = useState<string | null>(null);

  // LocalStorage keys
  const getStorageKey = (fid: number) => `hidden-nfts-${fid}`;
  const getTop3StorageKey = (fid: number) => `top3-nfts-${fid}`;

  // Load hidden NFTs from localStorage
  useEffect(() => {
    if (currentUserFid && !hasLoadedHidden.current) {
      hasLoadedHidden.current = true;
      try {
        const stored = localStorage.getItem(getStorageKey(currentUserFid));
        if (stored) setHiddenNfts(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to load hidden NFTs:', e);
      }
    }
  }, [currentUserFid]);

  // Save hidden NFTs
  useEffect(() => {
    if (currentUserFid && hasLoadedHidden.current) {
      try {
        localStorage.setItem(getStorageKey(currentUserFid), JSON.stringify(Array.from(hiddenNfts)));
      } catch (e) {
        console.error('Failed to save hidden NFTs:', e);
      }
    }
  }, [hiddenNfts, currentUserFid]);

  // Load Top 3 selections
  useEffect(() => {
    if (currentUserFid && !hasLoadedTop3.current) {
      hasLoadedTop3.current = true;
      try {
        const stored = localStorage.getItem(getTop3StorageKey(currentUserFid));
        if (stored) setSelectedNfts(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error('Failed to load Top 3:', e);
      }
    }
  }, [currentUserFid]);

  // Save Top 3 selections
  useEffect(() => {
    if (currentUserFid && hasLoadedTop3.current) {
      try {
        localStorage.setItem(getTop3StorageKey(currentUserFid), JSON.stringify(Array.from(selectedNfts)));
      } catch (e) {
        console.error('Failed to save Top 3:', e);
      }
    }
  }, [selectedNfts, currentUserFid]);

  // Helper functions
  const getNftKey = (nft: NFT, index: number) => `${nft.tokenId}-${nft.collectionName}-${index}`;
  
  const toggleSelectNft = (key: string) => {
    setSelectedNfts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < 3) next.add(key);
      return next;
    });
  };

  const toggleHideNft = (key: string) => {
    setHiddenNfts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleBagNft = (key: string) => {
    setBagNfts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < 5) next.add(key);
      return next;
    });
  };

  // Cast triptych
  const castTriptych = async () => {
    if (selectedNfts.size !== 3 || !currentUserFid || !scanResults) return;
    
    const selectedData = scanResults.nfts
      .map((nft, i) => ({ nft, key: getNftKey(nft, i) }))
      .filter(({ key }) => selectedNfts.has(key))
      .map(({ nft }) => ({ image: nft.image, name: nft.name, collection: nft.collectionName }));
    
    if (selectedData.length !== 3) return;
    
    const encoded = btoa(JSON.stringify({
      fid: currentUserFid,
      user: scanResults.user,
      displayName: scanResults.displayName,
      pfp: scanResults.pfp,
      nfts: selectedData,
    }));
    
    const triptychUrl = `${window.location.origin}/triptych?data=${encoded}`;
    const castText = `Check out my Top 3 NFTs! 🌟`;
    
    try {
      if (sdk.actions.composeCast) {
        await sdk.actions.composeCast({ text: castText, embeds: [triptychUrl] });
      } else {
        const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(triptychUrl)}`;
        await sdk.actions.openUrl(composeUrl);
      }
    } catch {
      await navigator.clipboard.writeText(`${castText}\n\n${triptychUrl}`);
      alert('Cast text copied to clipboard!');
    }
  };

  // Scan by FID
  const scanByFid = useCallback(async (fid: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scan-fiends?fid=${fid}`);
      if (!res.ok) throw new Error((await res.json()).error || "Scan failed");
      setScanResults(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load SDK
  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        if (context?.user?.fid) setCurrentUserFid(context.user.fid);
        sdk.actions.ready();
      } catch {}
      setIsSDKLoaded(true);
    };
    if (sdk && !isSDKLoaded) load();
  }, [isSDKLoaded]);

  // Auto-scan
  useEffect(() => {
    if (isSDKLoaded && currentUserFid && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      scanByFid(currentUserFid);
    }
  }, [isSDKLoaded, currentUserFid, scanByFid]);

  // Loading screen
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

  // Tab content renderers
  const renderGalleryTab = () => {
    if (!scanResults) return null;
    const visibleNfts = scanResults.nfts.filter((nft, i) => !hiddenNfts.has(getNftKey(nft, i)));
    const hiddenNftsList = scanResults.nfts.filter((nft, i) => hiddenNfts.has(getNftKey(nft, i)));

    return (
      <div className="space-y-4">
        {/* NFT Grid */}
        {visibleNfts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {scanResults.nfts.map((nft, i) => {
              const key = getNftKey(nft, i);
              if (hiddenNfts.has(key)) return null;
              return (
                <div key={key} className="group relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500 transition-colors">
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => toggleHideNft(key)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  </button>
                  {nft.floorPrice > 0 && (
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <span className="text-[10px] font-medium text-white">{nft.floorPrice.toFixed(4)} ETH</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                    <p className="font-bold text-white text-xs truncate">{nft.name}</p>
                    <p className="text-slate-400 text-[10px] truncate">{nft.collectionName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800">
            <p className="text-slate-400">No visible NFTs</p>
          </div>
        )}

        {/* Hidden NFTs */}
        {hiddenNftsList.length > 0 && (
          <div>
            <button onClick={() => setShowHidden(!showHidden)} className="w-full flex items-center justify-between p-3 bg-slate-900/80 border border-slate-700 rounded-xl">
              <span className="text-slate-400 text-sm">Hidden NFTs ({hiddenNftsList.length})</span>
              <svg className={`h-5 w-5 text-slate-400 transition-transform ${showHidden ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showHidden && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {scanResults.nfts.map((nft, i) => {
                  const key = getNftKey(nft, i);
                  if (!hiddenNfts.has(key)) return null;
                  return (
                    <div key={key} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700 opacity-60 hover:opacity-100">
                      <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                      <button onClick={() => toggleHideNft(key)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-green-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTop3Tab = () => {
    if (!scanResults) return null;
    
    return (
      <div className="space-y-4">
        {/* Instructions */}
        <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900 p-4 rounded-xl border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <h3 className="font-bold text-white">Top 3 Curator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-3">Tap your 3 favorite NFTs below to select them</p>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Selected: <span className="text-yellow-400 font-bold">{selectedNfts.size}/3</span></span>
            {selectedNfts.size === 3 && (
              <button onClick={castTriptych} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Cast
              </button>
            )}
          </div>
        </div>

        {/* NFT Selection Grid */}
        <div className="grid grid-cols-2 gap-3">
          {scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i))).map((nft, i) => {
            const key = getNftKey(nft, i);
            const isSelected = selectedNfts.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleSelectNft(key)}
                disabled={selectedNfts.size >= 3 && !isSelected}
                className={`relative aspect-square bg-slate-900 rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-yellow-500' : 'border-slate-800 hover:border-slate-600'} ${selectedNfts.size >= 3 && !isSelected ? 'opacity-50' : ''}`}
              >
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                {isSelected && (
                  <div className="absolute top-2 right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-2 pointer-events-none">
                  <p className="font-bold text-white text-xs truncate">{nft.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTradeTab = () => {
    if (!scanResults) return null;
    
    return (
      <div className="space-y-6">
        {/* Buy This Bag */}
        <div className="bg-gradient-to-br from-green-900/20 to-slate-900 p-4 rounded-xl border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h3 className="font-bold text-white">Buy This Bag</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Select up to 5 NFTs to bundle and sell</p>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">Selected: <span className="text-green-400 font-bold">{bagNfts.size}/5</span></span>
          </div>

          {/* Mini NFT selector */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {scanResults.nfts.slice(0, 10).map((nft, i) => {
              const key = getNftKey(nft, i);
              const isSelected = bagNfts.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleBagNft(key)}
                  disabled={bagNfts.size >= 5 && !isSelected}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-green-500' : 'border-slate-700'} ${bagNfts.size >= 5 && !isSelected ? 'opacity-30' : ''}`}
                >
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>

          {bagNfts.size > 0 && (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  placeholder="Bundle price (ETH)"
                  value={bagPrice}
                  onChange={(e) => setBagPrice(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500"
                />
              </div>
              <button className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Cast Bundle for Sale
              </button>
            </>
          )}
        </div>

        {/* P2P Swap */}
        <div className="bg-gradient-to-br from-orange-900/20 to-slate-900 p-4 rounded-xl border border-orange-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <h3 className="font-bold text-white">P2P Swap</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Propose a direct swap with another user</p>
          
          <input
            type="text"
            placeholder="Enter Farcaster username"
            value={swapUsername}
            onChange={(e) => setSwapUsername(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 mb-4"
          />

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-slate-500 text-xs uppercase mb-2">Your NFT</p>
              <div className="aspect-square bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
                {mySwapNft ? (
                  <img src={scanResults.nfts[0].image} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-slate-500 text-xs">Select</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase mb-2">Their NFT</p>
              <div className="aspect-square bg-slate-800 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
                <span className="text-slate-500 text-xs">Enter username first</span>
              </div>
            </div>
          </div>

          <button disabled className="w-full py-3 bg-orange-500/50 text-white/50 rounded-lg font-medium cursor-not-allowed">
            Propose Swap
          </button>
        </div>
      </div>
    );
  };

  const renderFunTab = () => {
    if (!scanResults) return null;
    
    return (
      <div className="space-y-6">
        {/* Digital Frame */}
        <div className="bg-gradient-to-br from-purple-900/20 to-slate-900 p-4 rounded-xl border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="font-bold text-white">Digital Frame</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Turn your screen into an art slideshow</p>
          
          {/* Preview */}
          <div className="aspect-video bg-slate-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
            {scanResults.nfts[0] ? (
              <img src={scanResults.nfts[0].image} className="w-full h-full object-contain" />
            ) : (
              <span className="text-slate-500">No NFTs to display</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium">
              Start Slideshow
            </button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
              ⚙️
            </button>
          </div>
        </div>

        {/* Meme Generator */}
        <div className="bg-gradient-to-br from-pink-900/20 to-slate-900 p-4 rounded-xl border border-pink-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-bold text-white">Meme Generator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Add meme text to your NFTs and cast them</p>
          
          {/* NFT selector */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {scanResults.nfts.slice(0, 8).map((nft, i) => (
              <button key={i} className="aspect-square rounded-lg overflow-hidden border-2 border-slate-700 hover:border-pink-500 transition-colors">
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Top text..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 mb-2"
          />
          <input
            type="text"
            placeholder="Bottom text..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 mb-4"
          />
          
          <button className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Cast Meme
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="bg-slate-950 min-h-screen text-white font-sans">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center py-4 px-4">
          <h1 className="text-2xl font-black tracking-tighter" style={{ color: '#0000f4' }}>
            Your Based NFTs
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 mb-4">
          <div className="flex bg-slate-900 rounded-xl p-1">
            {[
              { id: 'gallery', label: 'Gallery', icon: '🖼️' },
              { id: 'top3', label: 'Top 3', icon: '⭐' },
              { id: 'trade', label: 'Trade', icon: '💰' },
              { id: 'fun', label: 'Fun', icon: '🎨' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-4 bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl text-center text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full mb-4"></span>
            <p className="text-slate-400">Loading your collection...</p>
          </div>
        )}

        {/* Not in Warpcast */}
        {!loading && !scanResults && !currentUserFid && (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
              <svg className="h-10 w-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Open in Warpcast</h2>
            <p className="text-slate-400 text-sm">View your NFT collection on Base by opening this frame in Warpcast.</p>
          </div>
        )}

        {/* Main Content */}
        {scanResults && !loading && (
          <div className="px-4 pb-8">
            {/* Profile Card - Always visible */}
            <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 p-4 rounded-2xl border border-purple-500/30 mb-4">
              <div className="flex items-center gap-4">
                {scanResults.pfp && (
                  <img src={scanResults.pfp} alt={scanResults.displayName} className="w-14 h-14 rounded-full border-2 border-purple-500" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-white">{scanResults.displayName}</p>
                  <p className="text-purple-400 text-sm">@{scanResults.user}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{scanResults.totalFound}</p>
                  <p className="text-slate-400 text-xs">NFTs</p>
                </div>
              </div>
              {scanResults.totalValueEth > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Portfolio</span>
                  <div className="flex items-center gap-1">
                    <TokenImage token={ethToken} size={16} />
                    <span className="font-bold text-white">{scanResults.totalValueEth.toFixed(4)}</span>
                    <span className="text-slate-400 text-sm">ETH</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tab Content */}
            {activeTab === 'gallery' && renderGalleryTab()}
            {activeTab === 'top3' && renderTop3Tab()}
            {activeTab === 'trade' && renderTradeTab()}
            {activeTab === 'fun' && renderFunTab()}
          </div>
        )}
      </div>
    </main>
  );
}
