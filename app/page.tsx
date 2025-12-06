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
  const [bagPrice, setBagPrice] = useState('0.001');
  const [bagCurrency, setBagCurrency] = useState<'ETH' | 'USDC'>('ETH');
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [swapUsername, setSwapUsername] = useState('');
  const [mySwapNft, setMySwapNft] = useState<string | null>(null);
  const [theirSwapNft, setTheirSwapNft] = useState<string | null>(null);
  
  // Meme Generator state
  const [memeNftIndex, setMemeNftIndex] = useState<number | null>(null);
  const [memeTopText, setMemeTopText] = useState('');
  const [memeBottomText, setMemeBottomText] = useState('');
  
  // Slideshow state
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const slideshowInterval = useRef<NodeJS.Timeout | null>(null);
  
  // GIF Creator state
  const [gifNfts, setGifNfts] = useState<Set<number>>(new Set());
  const [gifPreviewIndex, setGifPreviewIndex] = useState(0);
  const [gifSpeed, setGifSpeed] = useState(500); // ms between frames
  const gifPreviewInterval = useRef<NodeJS.Timeout | null>(null);
  const [generatingGif, setGeneratingGif] = useState(false);
  const [generatedGif, setGeneratedGif] = useState<string | null>(null); // base64 GIF

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

  // Fetch ETH price for currency conversion
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (e) {
        console.error('Failed to fetch ETH price:', e);
      }
    };
    fetchEthPrice();
    // Refresh every 5 minutes
    const interval = setInterval(fetchEthPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Convert price between ETH and USDC
  const getConvertedPrice = () => {
    if (!ethPrice || !bagPrice || parseFloat(bagPrice) <= 0) return null;
    const price = parseFloat(bagPrice);
    if (bagCurrency === 'ETH') {
      return `≈ $${(price * ethPrice).toFixed(2)} USDC`;
    } else {
      return `≈ ${(price / ethPrice).toFixed(6)} ETH`;
    }
  };

  // Handle price input - ensure positive values only
  const handlePriceChange = (value: string) => {
    // Allow empty string for clearing
    if (value === '') {
      setBagPrice('');
      return;
    }
    // Parse and validate
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setBagPrice(value);
    }
  };

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

  // Cast bag for sale
  const castBag = async () => {
    if (!scanResults || bagNfts.size === 0 || !bagPrice) return;
    
    // Get the selected NFT data - keys are in format: tokenId-collectionName-index
    const selectedNfts = scanResults.nfts
      .map((nft, i) => ({ nft, key: getNftKey(nft, i) }))
      .filter(({ key }) => bagNfts.has(key))
      .map(({ nft }) => ({
        name: nft.name,
        image: nft.image,
        contract: nft.contractAddress,
        tokenId: nft.tokenId,
      }));

    // Create bundle data for URL
    const bundleData = {
      seller: scanResults.user,
      sellerFid: currentUserFid,
      sellerPfp: scanResults.pfp,
      price: bagPrice,
      currency: bagCurrency,
      nfts: selectedNfts,
    };

    const encodedData = encodeURIComponent(btoa(JSON.stringify(bundleData)));
    const bundleUrl = `https://fiend-finder.vercel.app/bundle?data=${encodedData}`;

    // Build cast text
    const nftCount = selectedNfts.length;
    const priceDisplay = bagCurrency === 'USDC' ? `$${bagPrice} USDC` : `${bagPrice} ETH`;
    const castText = `🛍️ NFT Bundle for Sale!\n\n${nftCount} NFT${nftCount > 1 ? 's' : ''} for ${priceDisplay}\n\nCheck it out 👇`;

    try {
      await sdk.actions.composeCast({
        text: castText,
        embeds: [bundleUrl],
      });
    } catch (err) {
      console.error('Failed to cast bundle:', err);
    }
  };

  // Slideshow controls
  const startSlideshow = () => {
    if (!scanResults || scanResults.nfts.length === 0) return;
    setSlideshowActive(true);
    setSlideshowIndex(0);
    
    // Auto-advance every 4 seconds
    slideshowInterval.current = setInterval(() => {
      setSlideshowIndex(prev => {
        const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
        return (prev + 1) % visibleNfts.length;
      });
    }, 4000);
  };

  const stopSlideshow = () => {
    setSlideshowActive(false);
    if (slideshowInterval.current) {
      clearInterval(slideshowInterval.current);
      slideshowInterval.current = null;
    }
  };

  const nextSlide = () => {
    if (!scanResults) return;
    const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
    setSlideshowIndex(prev => (prev + 1) % visibleNfts.length);
  };

  const prevSlide = () => {
    if (!scanResults) return;
    const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
    setSlideshowIndex(prev => (prev - 1 + visibleNfts.length) % visibleNfts.length);
  };

  // Cleanup slideshow on unmount
  useEffect(() => {
    return () => {
      if (slideshowInterval.current) {
        clearInterval(slideshowInterval.current);
      }
      if (gifPreviewInterval.current) {
        clearInterval(gifPreviewInterval.current);
      }
    };
  }, []);

  // GIF Creator functions
  const toggleGifNft = (index: number) => {
    setGifNfts(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < 10) {
        next.add(index);
      }
      return next;
    });
  };

  // Start GIF preview animation
  useEffect(() => {
    if (gifNfts.size >= 2) {
      gifPreviewInterval.current = setInterval(() => {
        setGifPreviewIndex(prev => (prev + 1) % gifNfts.size);
      }, gifSpeed);
    } else {
      if (gifPreviewInterval.current) {
        clearInterval(gifPreviewInterval.current);
        gifPreviewInterval.current = null;
      }
    }
    return () => {
      if (gifPreviewInterval.current) {
        clearInterval(gifPreviewInterval.current);
      }
    };
  }, [gifNfts.size, gifSpeed]);

  // Generate real GIF server-side
  const generateRealGif = async () => {
    if (gifNfts.size < 2 || !scanResults) return;
    
    setGeneratingGif(true);
    setGeneratedGif(null);
    
    try {
      const selectedIndices = Array.from(gifNfts).sort((a, b) => a - b);
      const imageUrls = selectedIndices.map(i => scanResults.nfts[i].image);
      
      const response = await fetch('/api/generate-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls,
          speed: gifSpeed,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate GIF');
      }
      
      const data = await response.json();
      setGeneratedGif(data.gif);
      
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingGif(false);
    }
  };

  // Download generated GIF
  const downloadGif = () => {
    if (!generatedGif) return;
    
    const link = document.createElement('a');
    link.href = `data:image/gif;base64,${generatedGif}`;
    link.download = 'nft-gif.gif';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cast GIF
  const castGif = async () => {
    if (gifNfts.size < 2 || !scanResults || !currentUserFid) return;
    
    const selectedIndices = Array.from(gifNfts).sort((a, b) => a - b);
    const imageUrls = selectedIndices.map(i => scanResults.nfts[i].image);
    
    const encoded = btoa(JSON.stringify({
      images: imageUrls,
      speed: gifSpeed,
      username: scanResults.user,
      displayName: scanResults.displayName,
    }));
    
    const gifUrl = `${window.location.origin}/gif?data=${encoded}`;
    const castText = `Check out my NFT GIF! 🎬`;
    
    try {
      if (sdk.actions.composeCast) {
        await sdk.actions.composeCast({ text: castText, embeds: [gifUrl] });
      } else {
        const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(gifUrl)}`;
        await sdk.actions.openUrl(composeUrl);
      }
    } catch {
      await navigator.clipboard.writeText(`${castText}\n\n${gifUrl}`);
      alert('GIF link copied to clipboard!');
    }
  };

  // Cast meme
  const castMeme = async () => {
    if (memeNftIndex === null || !scanResults || !currentUserFid) return;
    if (!memeTopText && !memeBottomText) {
      alert('Add some text to your meme!');
      return;
    }
    
    const nft = scanResults.nfts[memeNftIndex];
    if (!nft) return;
    
    const encoded = btoa(JSON.stringify({
      image: nft.image,
      name: nft.name,
      topText: memeTopText,
      bottomText: memeBottomText,
      username: scanResults.user,
      displayName: scanResults.displayName,
    }));
    
    const memeUrl = `${window.location.origin}/meme?data=${encoded}`;
    const castText = `check out the meme I made with My BASED NFT's 😂`;
    
    try {
      if (sdk.actions.composeCast) {
        await sdk.actions.composeCast({ text: castText, embeds: [memeUrl] });
      } else {
        const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(memeUrl)}`;
        await sdk.actions.openUrl(composeUrl);
      }
    } catch {
      await navigator.clipboard.writeText(`${castText}\n\n${memeUrl}`);
      alert('Meme link copied to clipboard!');
    }
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
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Selected: <span className="text-yellow-400 font-bold">{selectedNfts.size}/3</span></span>
              {selectedNfts.size > 0 && (
                <button 
                  onClick={() => setSelectedNfts(new Set())}
                  className="text-slate-500 hover:text-red-400 text-xs underline"
                >
                  Clear
                </button>
              )}
            </div>
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
          {scanResults.nfts.map((nft, originalIndex) => {
            const key = getNftKey(nft, originalIndex);
            // Skip hidden NFTs
            if (hiddenNfts.has(key)) return null;
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
              {/* Currency Toggle */}
              <div className="flex gap-1 mb-3 bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setBagCurrency('ETH')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    bagCurrency === 'ETH' 
                      ? 'bg-green-500 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ETH
                </button>
                <button
                  onClick={() => setBagCurrency('USDC')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    bagCurrency === 'USDC' 
                      ? 'bg-blue-500 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  USDC
                </button>
              </div>

              {/* Price Input */}
              <div className="mb-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.0001"
                      min="0.00001"
                      placeholder={bagCurrency === 'ETH' ? '0.001' : '10.00'}
                      value={bagPrice}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-16 text-white text-sm placeholder:text-slate-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                      {bagCurrency}
                    </span>
                  </div>
                </div>
                {/* Conversion display */}
                {getConvertedPrice() && (
                  <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    {getConvertedPrice()}
                  </p>
                )}
              </div>

              <button 
                onClick={castBag}
                disabled={!bagPrice || parseFloat(bagPrice) <= 0}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  bagPrice && parseFloat(bagPrice) > 0
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-green-500/50 text-white/50 cursor-not-allowed'
                }`}
              >
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
    
    const selectedMemeNft = memeNftIndex !== null ? scanResults.nfts[memeNftIndex] : null;
    
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
            {scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)))[0] ? (
              <img src={scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)))[0].image} className="w-full h-full object-contain" />
            ) : (
              <span className="text-slate-500">No NFTs to display</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={startSlideshow}
              disabled={scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i))).length === 0}
              className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Start Slideshow
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2 text-center">
            {scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i))).length} NFTs • Auto-advances every 4s
          </p>
        </div>

        {/* Meme Generator */}
        <div className="bg-gradient-to-br from-pink-900/20 to-slate-900 p-4 rounded-xl border border-pink-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-bold text-white">Meme Generator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Select an NFT and add meme text</p>
          
          {/* NFT selector */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {scanResults.nfts.slice(0, 8).map((nft, i) => (
              <button 
                key={i} 
                onClick={() => setMemeNftIndex(memeNftIndex === i ? null : i)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${memeNftIndex === i ? 'border-pink-500 ring-2 ring-pink-500/50' : 'border-slate-700 hover:border-pink-500/50'}`}
              >
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Meme Preview */}
          {selectedMemeNft && (
            <div className="relative aspect-square bg-black rounded-lg mb-4 overflow-hidden">
              <img src={selectedMemeNft.image} alt={selectedMemeNft.name} className="w-full h-full object-contain" />
              {/* Top text overlay */}
              {memeTopText && (
                <div className="absolute top-2 left-0 right-0 text-center">
                  <span className="text-white text-2xl font-black uppercase px-2" style={{ 
                    textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                  }}>
                    {memeTopText}
                  </span>
                </div>
              )}
              {/* Bottom text overlay */}
              {memeBottomText && (
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="text-white text-2xl font-black uppercase px-2" style={{ 
                    textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                  }}>
                    {memeBottomText}
                  </span>
                </div>
              )}
            </div>
          )}

          <input
            type="text"
            placeholder="Top text..."
            value={memeTopText}
            onChange={(e) => setMemeTopText(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 mb-2 uppercase"
          />
          <input
            type="text"
            placeholder="Bottom text..."
            value={memeBottomText}
            onChange={(e) => setMemeBottomText(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 mb-4 uppercase"
          />
          
          <button 
            onClick={castMeme}
            disabled={memeNftIndex === null || (!memeTopText && !memeBottomText)}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              memeNftIndex !== null && (memeTopText || memeBottomText)
                ? 'bg-pink-500 hover:bg-pink-600 text-white'
                : 'bg-pink-500/30 text-white/50 cursor-not-allowed'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Cast Meme
          </button>
        </div>

        {/* GIF Creator */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-slate-900 p-4 rounded-xl border border-cyan-500/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2m0 2v2m0-2h2m8 0h2m-2 0V2m0 2v2M3 20h18V8H3v12zm4-8h10m-10 4h4" />
            </svg>
            <h3 className="font-bold text-white">GIF Creator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">Select 2-10 NFTs to create an animated GIF</p>
          
          {/* Selection counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">
              Selected: <span className={`font-bold ${gifNfts.size >= 2 ? 'text-cyan-400' : 'text-red-400'}`}>{gifNfts.size}/10</span>
              {gifNfts.size < 2 && <span className="text-red-400 text-xs ml-2">(min 2)</span>}
            </span>
            {gifNfts.size > 0 && (
              <button 
                onClick={() => setGifNfts(new Set())}
                className="text-slate-500 hover:text-red-400 text-xs underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* NFT selector grid */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {scanResults.nfts.slice(0, 15).map((nft, i) => {
              const isSelected = gifNfts.has(i);
              const selectionOrder = isSelected ? Array.from(gifNfts).sort((a, b) => a - b).indexOf(i) + 1 : null;
              return (
                <button 
                  key={i} 
                  onClick={() => toggleGifNft(i)}
                  disabled={gifNfts.size >= 10 && !isSelected}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/50' : 'border-slate-700 hover:border-cyan-500/50'
                  } ${gifNfts.size >= 10 && !isSelected ? 'opacity-30' : ''}`}
                >
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                  {isSelected && selectionOrder && (
                    <div className="absolute top-0 right-0 w-5 h-5 bg-cyan-500 rounded-bl-lg flex items-center justify-center">
                      <span className="text-black text-xs font-bold">{selectionOrder}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* GIF Preview */}
          {gifNfts.size >= 2 && (
            <div className="mb-4">
              <p className="text-slate-500 text-xs uppercase mb-2">Preview</p>
              <div className="aspect-square bg-black rounded-lg overflow-hidden border border-cyan-500/30">
                {(() => {
                  const selectedIndices = Array.from(gifNfts).sort((a, b) => a - b);
                  const currentIndex = selectedIndices[gifPreviewIndex % selectedIndices.length];
                  const currentNft = scanResults.nfts[currentIndex];
                  return currentNft ? (
                    <img 
                      src={currentNft.image} 
                      alt={currentNft.name} 
                      className="w-full h-full object-contain"
                    />
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* Speed control */}
          {gifNfts.size >= 2 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Speed</span>
                <span className="text-cyan-400 text-sm">{gifSpeed}ms</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="100"
                value={gifSpeed}
                onChange={(e) => setGifSpeed(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Fast</span>
                <span>Slow</span>
              </div>
            </div>
          )}

          {/* Generate GIF button */}
          {gifNfts.size >= 2 && !generatedGif && (
            <button 
              onClick={generateRealGif}
              disabled={generatingGif}
              className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors mb-3 ${
                generatingGif
                  ? 'bg-cyan-500/50 text-white/70 cursor-wait'
                  : 'bg-cyan-500 hover:bg-cyan-600 text-white'
              }`}
            >
              {generatingGif ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Generating GIF...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Generate Real GIF
                </>
              )}
            </button>
          )}

          {/* Generated GIF preview & actions */}
          {generatedGif && (
            <div className="mb-4">
              <p className="text-green-400 text-xs uppercase mb-2 flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                GIF Generated!
              </p>
              <div className="aspect-square bg-black rounded-lg overflow-hidden border-2 border-green-500/50 mb-3">
                <img 
                  src={`data:image/gif;base64,${generatedGif}`}
                  alt="Generated GIF"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2 mb-2">
                <button 
                  onClick={downloadGif}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download GIF
                </button>
                <button 
                  onClick={() => setGeneratedGif(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button 
              onClick={castGif}
              disabled={gifNfts.size < 2}
              className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                gifNfts.size >= 2
                  ? 'bg-purple-500 hover:bg-purple-600 text-white'
                  : 'bg-purple-500/30 text-white/50 cursor-not-allowed'
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              Cast
            </button>
            <button 
              disabled={!generatedGif}
              className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                generatedGif
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white'
                  : 'bg-slate-700/50 text-white/50 cursor-not-allowed'
              }`}
              title={generatedGif ? "Mint as NFT" : "Generate GIF first"}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Mint NFT
            </button>
          </div>
          {!generatedGif && gifNfts.size >= 2 && (
            <p className="text-slate-500 text-xs mt-2 text-center">
              Generate GIF first, then mint it as an on-chain NFT
            </p>
          )}
          {generatedGif && (
            <p className="text-slate-500 text-xs mt-2 text-center">
              Mint requires IPFS + wallet connection (coming soon)
            </p>
          )}
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

      {/* Fullscreen Slideshow Overlay */}
      {slideshowActive && scanResults && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Close button */}
          <button
            onClick={stopSlideshow}
            className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Slide counter */}
          <div className="absolute top-4 left-4 z-10 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-white text-sm font-medium">
              {slideshowIndex + 1} / {scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i))).length}
            </span>
          </div>

          {/* Main image area */}
          <div className="flex-1 flex items-center justify-center p-4">
            {(() => {
              const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
              const currentNft = visibleNfts[slideshowIndex];
              if (!currentNft) return null;
              return (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={currentNft.image}
                    alt={currentNft.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              );
            })()}
          </div>

          {/* Navigation arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* NFT info bar */}
          <div className="bg-gradient-to-t from-black/80 to-transparent p-6">
            {(() => {
              const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
              const currentNft = visibleNfts[slideshowIndex];
              if (!currentNft) return null;
              return (
                <div className="text-center">
                  <h2 className="text-white text-xl font-bold">{currentNft.name}</h2>
                  <p className="text-slate-400">{currentNft.collectionName}</p>
                  {currentNft.floorPrice > 0 && (
                    <p className="text-purple-400 text-sm mt-1">{currentNft.floorPrice.toFixed(4)} ETH</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/10">
            <div 
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${((slideshowIndex + 1) / scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i))).length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
