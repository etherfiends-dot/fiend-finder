'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';
import { Avatar, Identity, Name, Address, Badge } from '@coinbase/onchainkit/identity';
import { TokenImage } from '@coinbase/onchainkit/token';
import { base } from 'viem/chains';
import { ethers } from 'ethers';

import { 
  initSeaport, 
  createBundleOrder, 
  checkApprovals, 
  approveForSeaport,
  getPriceInWei,
  SEAPORT_ADDRESS 
} from '@/lib/seaport';
import { MEMECOINS, type Memecoin, formatPrice, parsePrice } from '@/lib/zora';
import { generateMemeImage, base64ToBlob } from '@/lib/ipfs';
import MemecoinSelector from '@/components/MemecoinSelector';

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

type Tab = 'gallery' | 'trade' | 'fun';

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
  const [creatingListing, setCreatingListing] = useState(false);
  const [listingStep, setListingStep] = useState<'idle' | 'connecting' | 'approving' | 'signing' | 'done'>('idle');
  const [swapUsername, setSwapUsername] = useState('');
  const [mySwapNft, setMySwapNft] = useState<string | null>(null);
  const [theirSwapNft, setTheirSwapNft] = useState<string | null>(null);
  
  // Meme Generator state
  const [memeNftIndex, setMemeNftIndex] = useState<number | null>(null);
  const [memeTopText, setMemeTopText] = useState('');
  const [memeBottomText, setMemeBottomText] = useState('');
  const [memeTLText, setMemeTLText] = useState('');
  const [memeTRText, setMemeTRText] = useState('');
  const [memeBLText, setMemeBLText] = useState('');
  const [memeBRText, setMemeBRText] = useState('');
  const [memeTextMode, setMemeTextMode] = useState<'two-line' | 'quad'>('two-line');
const [memeSource, setMemeSource] = useState<'nft' | 'template'>('nft');
const [memeTemplates, setMemeTemplates] = useState<{ url: string; name: string; width: number; height: number }[]>([]);
const [memeTemplateIndex, setMemeTemplateIndex] = useState<number | null>(null);
const [loadingTemplates, setLoadingTemplates] = useState(false);
const [templateError, setTemplateError] = useState<string | null>(null);
  
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
  
  // Mint state (for memes and GIFs)
  const [mintMode, setMintMode] = useState<'meme' | 'gif' | null>(null);
  const [mintAction, setMintAction] = useState<'cast' | 'mint' | 'sell'>('cast'); // cast=free share, mint=own it, sell=list for sale
  const [mintCoin, setMintCoin] = useState<Memecoin>(MEMECOINS[1]); // Default to DEGEN
  const [mintPrice, setMintPrice] = useState('10000'); // Default 10k tokens
  const [mintStep, setMintStep] = useState<'idle' | 'uploading' | 'signing' | 'done' | 'error'>('idle');
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<{ 
    ipfsUrl?: string; 
    metadataUrl?: string;
    zoraUrl?: string;
  } | null>(null);

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

  // Load meme templates (public API)
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        setTemplateError(null);
        const res = await fetch('https://api.imgflip.com/get_memes');
        const data = await res.json();
        if (data?.success && Array.isArray(data.data?.memes)) {
          // Take top 30 popular templates
          const templates = data.data.memes.slice(0, 30).map((m: any) => ({
            url: m.url as string,
            name: m.name as string,
            width: Number(m.width) || 0,
            height: Number(m.height) || 0,
          }));
          setMemeTemplates(templates);
        } else {
          setTemplateError('Could not load meme templates right now.');
        }
      } catch (e) {
        console.error('Failed to load templates:', e);
        setTemplateError('Could not load meme templates right now.');
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

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
      else if (next.size < 10) next.add(key);
      return next;
    });
  };

  // Cast bag for sale
  // Create Seaport listing and cast
  const castBag = async () => {
    if (!scanResults || bagNfts.size === 0 || !bagPrice) return;
    
    setCreatingListing(true);
    setListingStep('connecting');
    
    try {
      // Get the selected NFT data
      const selectedNftsData = scanResults.nfts
        .map((nft, i) => ({ nft, key: getNftKey(nft, i) }))
        .filter(({ key }) => bagNfts.has(key))
        .map(({ nft }) => ({
          name: nft.name,
          image: nft.image,
          contractAddress: nft.contractAddress,
          tokenId: nft.tokenId,
        }));

      // Check if ethereum provider is available
      if (typeof window === 'undefined' || !window.ethereum) {
        alert('Please connect a wallet to create listings. Make sure you have MetaMask or another Web3 wallet installed.');
        setCreatingListing(false);
        setListingStep('idle');
        return;
      }

      // Connect to provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const sellerAddress = await signer.getAddress();

      // Initialize Seaport
      const seaport = initSeaport(provider);

      // Check approvals
      setListingStep('approving');
      const { approved, needsApproval } = await checkApprovals(
        provider,
        sellerAddress,
        selectedNftsData
      );

      // Approve if needed
      if (!approved) {
        for (const contractAddress of needsApproval) {
          await approveForSeaport(provider, contractAddress);
        }
      }

      // Create the Seaport order
      setListingStep('signing');
      const priceInWei = getPriceInWei(bagPrice, bagCurrency);
      const order = await createBundleOrder(
        seaport,
        sellerAddress,
        selectedNftsData,
        priceInWei,
        bagCurrency
      );

      // Create bundle data for URL (includes the Seaport order!)
      const bundleData = {
        seller: scanResults.user,
        sellerFid: currentUserFid,
        sellerPfp: scanResults.pfp,
        sellerAddress,
        price: bagPrice,
        currency: bagCurrency,
        nfts: selectedNftsData.map(n => ({
          name: n.name,
          image: n.image,
          contract: n.contractAddress,
          tokenId: n.tokenId,
        })),
        // Include the Seaport order for fulfillment
        seaportOrder: order,
      };

      const encodedData = encodeURIComponent(btoa(JSON.stringify(bundleData)));
      const bundleUrl = `https://fiend-finder.vercel.app/bundle?data=${encodedData}`;

      // Build cast text
      const nftCount = selectedNftsData.length;
      const priceDisplay = bagCurrency === 'USDC' ? `$${bagPrice} USDC` : `${bagPrice} ETH`;
      const castText = `🛍️ NFT Bundle for Sale!\n\n${nftCount} NFT${nftCount > 1 ? 's' : ''} for ${priceDisplay}\n\nPowered by Seaport 🌊`;

      setListingStep('done');

      // Cast to Farcaster
      await sdk.actions.composeCast({
        text: castText,
        embeds: [bundleUrl],
      });

      // Reset state
      setBagNfts(new Set());
      setBagPrice('0.001');
      
    } catch (err: any) {
      console.error('Failed to create listing:', err);
      alert(`Error: ${err.message || 'Failed to create listing'}`);
    } finally {
      setCreatingListing(false);
      setListingStep('idle');
    }
  };

  // Slideshow controls
  const startSlideshow = () => {
    if (!scanResults) return;
    const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
    if (visibleNfts.length === 0) return;

    setSlideshowActive(true);
    setSlideshowIndex(prev => Math.min(prev, visibleNfts.length - 1));
    
    // Auto-advance every 4 seconds
    slideshowInterval.current = setInterval(() => {
      setSlideshowIndex(prev => {
        const currentVisible = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
        if (currentVisible.length === 0) {
          // Nothing to show, keep index at 0
          return 0;
        }
        return (prev + 1) % currentVisible.length;
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
    if (visibleNfts.length === 0) return;
    setSlideshowIndex(prev => (prev + 1) % visibleNfts.length);
  };

  const prevSlide = () => {
    if (!scanResults) return;
    const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
    if (visibleNfts.length === 0) return;
    setSlideshowIndex(prev => (prev - 1 + visibleNfts.length) % visibleNfts.length);
  };

  // Clamp slideshow index when the visible set changes (e.g., hiding NFTs)
  useEffect(() => {
    if (!scanResults) return;
    const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
    const count = visibleNfts.length;

    if (count === 0) {
      setSlideshowIndex(0);
      if (slideshowActive && slideshowInterval.current) {
        clearInterval(slideshowInterval.current);
        slideshowInterval.current = null;
      }
      if (slideshowActive) setSlideshowActive(false);
      return;
    }

    if (slideshowIndex >= count) {
      setSlideshowIndex(count - 1);
    }
  }, [hiddenNfts, scanResults, slideshowActive, slideshowIndex]);

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

  // Start mint process for meme
  const startMemeMint = () => {
    const hasSelection = memeSource === 'nft'
      ? memeNftIndex !== null
      : memeTemplateIndex !== null;
    const hasText = memeTextMode === 'two-line'
      ? (memeTopText || memeBottomText)
      : (memeTLText || memeTRText || memeBLText || memeBRText);
    if (!hasSelection || !hasText || !scanResults) return;
    setMintMode('meme');
    setMintAction('cast'); // Default to cast/share
    setMintStep('idle');
    setMintError(null);
    setMintResult(null);
  };

  // Start mint process for GIF
  const startGifMint = () => {
    if (!generatedGif) return;
    setMintMode('gif');
    setMintAction('cast'); // Default to cast/share
    setMintStep('idle');
    setMintError(null);
    setMintResult(null);
  };

  // Cancel mint
  const cancelMint = () => {
    setMintMode(null);
    setMintStep('idle');
    setMintError(null);
  };

  // Execute the action (cast, mint, or sell)
  const executeMint = async () => {
    if (!scanResults || !currentUserFid) return;

    try {
      setMintStep('uploading');
      setMintError(null);

      let imageBlob: Blob;
      let filename: string;
      let metadata: Record<string, unknown>;
      let tokenName: string;

      if (mintMode === 'meme') {
        // Choose source image from NFT or template
        let sourceImage = '';
        let sourceName = 'Meme';

        if (memeSource === 'nft' && memeNftIndex !== null) {
          const nft = scanResults.nfts[memeNftIndex];
          sourceImage = nft?.image || '';
          sourceName = nft?.name || 'Meme';
          if (!sourceImage) throw new Error('No NFT selected for meme');
        } else if (memeSource === 'template' && memeTemplateIndex !== null) {
          const tmpl = memeTemplates[memeTemplateIndex];
          sourceImage = tmpl?.url || '';
          sourceName = tmpl?.name || 'Meme';
          if (!sourceImage) throw new Error('No template selected for meme');
        } else {
          throw new Error('Select an NFT or a template to make a meme');
        }

        // Generate the meme image with text overlay
        const memeDataUrl = await generateMemeImage(
          sourceImage,
          memeTopText,
          memeBottomText,
          {
            mode: memeTextMode,
            topLeft: memeTLText,
            topRight: memeTRText,
            bottomLeft: memeBLText,
            bottomRight: memeBRText,
          }
        );
        imageBlob = base64ToBlob(memeDataUrl, 'image/png');
        filename = `meme-${Date.now()}.png`;
        tokenName = (memeTextMode === 'quad'
          ? (memeTLText || memeTRText || memeBLText || memeBRText)
          : (memeTopText || memeBottomText)
        ) || sourceName || 'Meme';
        metadata = {
          name: tokenName,
          description: `A meme created with My Based NFTs by @${scanResults.user}`,
          external_url: 'https://fiend-finder.vercel.app',
          attributes: [
            { trait_type: 'Creator', value: scanResults.user },
            { trait_type: 'Type', value: 'Meme' },
            { trait_type: 'Source', value: memeSource === 'nft' ? 'NFT' : 'Template' },
            ...(memeTopText ? [{ trait_type: 'Top Text', value: memeTopText }] : []),
            ...(memeBottomText ? [{ trait_type: 'Bottom Text', value: memeBottomText }] : []),
            ...(memeTLText ? [{ trait_type: 'Top Left', value: memeTLText }] : []),
            ...(memeTRText ? [{ trait_type: 'Top Right', value: memeTRText }] : []),
            ...(memeBLText ? [{ trait_type: 'Bottom Left', value: memeBLText }] : []),
            ...(memeBRText ? [{ trait_type: 'Bottom Right', value: memeBRText }] : []),
          ],
        };
      } else if (mintMode === 'gif' && generatedGif) {
        // Use the generated GIF
        imageBlob = base64ToBlob(generatedGif, 'image/gif');
        filename = `gif-${Date.now()}.gif`;
        const selectedIndices = Array.from(gifNfts).sort((a, b) => a - b);
        tokenName = `NFT GIF`;
        metadata = {
          name: tokenName,
          description: `An animated GIF featuring ${selectedIndices.length} NFTs, created with My Based NFTs by @${scanResults.user}`,
          animation_url: '', // Will be set after upload
          external_url: 'https://fiend-finder.vercel.app',
          attributes: [
            { trait_type: 'Creator', value: scanResults.user },
            { trait_type: 'Type', value: 'GIF' },
            { trait_type: 'Frame Count', value: selectedIndices.length },
            { trait_type: 'Speed (ms)', value: gifSpeed },
          ],
        };
      } else {
        setMintError('Nothing to create');
        setMintStep('error');
        return;
      }

      // Upload to IPFS via our API
      const formData = new FormData();
      formData.append('file', imageBlob, filename);
      formData.append('metadata', JSON.stringify(metadata));

      const uploadResponse = await fetch('/api/upload-ipfs', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to IPFS');
      }

      const uploadResult = await uploadResponse.json();
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      const ipfsImageUrl = uploadResult.image.gatewayUrl;
      const ipfsImageUri = uploadResult.image.ipfsUri;
      const metadataUri = uploadResult.metadata?.ipfsUri;
      
      // Generate Zora create URL with the metadata
      // Zora's create page can accept an IPFS URI for the media
      const zoraCreateUrl = `https://zora.co/create/single-edition?media=${encodeURIComponent(ipfsImageUri)}&name=${encodeURIComponent(tokenName)}&chain=8453`;
      
      setMintStep('done');
      setMintResult({
        ipfsUrl: ipfsImageUrl,
        metadataUrl: metadataUri,
        zoraUrl: zoraCreateUrl,
      });

    } catch (error) {
      console.error('Action error:', error);
      setMintStep('error');
      setMintError(error instanceof Error ? error.message : 'Failed to complete action');
    }
  };
  
  // Handle the final action after upload is complete
  const handleFinalAction = async () => {
    if (!mintResult || !scanResults) return;
    
    const contentType = mintMode === 'meme' ? 'meme' : 'GIF';
    
    if (mintAction === 'cast') {
      // Share on Farcaster
      const castText = `Check out this ${contentType} I made with My Based NFTs! 🎨`;
      try {
        if (sdk.actions.composeCast) {
          await sdk.actions.composeCast({
            text: castText,
            embeds: [mintResult.ipfsUrl || ''],
          });
        }
      } catch (e) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(`${castText}\n\n${mintResult.ipfsUrl}`);
        alert('Copied to clipboard!');
      }
    } else if (mintAction === 'mint') {
      // Open Zora create page
      if (mintResult.zoraUrl) {
        window.open(mintResult.zoraUrl, '_blank');
      }
    } else if (mintAction === 'sell') {
      // Share listing on Farcaster
      const priceDisplay = formatPrice(mintPrice, mintCoin.decimals);
      const castText = `🎨 New ${contentType} for sale!\n\n💰 ${priceDisplay} $${mintCoin.symbol}\n🔥 Open edition`;
      try {
        if (sdk.actions.composeCast) {
          await sdk.actions.composeCast({
            text: castText,
            embeds: [mintResult.ipfsUrl || ''],
          });
        }
      } catch (e) {
        await navigator.clipboard.writeText(`${castText}\n\n${mintResult.ipfsUrl}`);
        alert('Copied to clipboard!');
      }
    }
    
    cancelMint();
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
          <p className="text-slate-400 text-sm mb-4">Select up to 10 NFTs to bundle and sell</p>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">Selected: <span className="text-green-400 font-bold">{bagNfts.size}/10</span></span>
          </div>

          {/* Mini NFT selector */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {scanResults.nfts.slice(0, 20).map((nft, i) => {
              const key = getNftKey(nft, i);
              const isSelected = bagNfts.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleBagNft(key)}
                  disabled={bagNfts.size >= 10 && !isSelected}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-green-500' : 'border-slate-700'} ${bagNfts.size >= 10 && !isSelected ? 'opacity-30' : ''}`}
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
                disabled={!bagPrice || parseFloat(bagPrice) <= 0 || creatingListing}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  creatingListing
                    ? 'bg-green-500/70 cursor-wait text-white'
                    : bagPrice && parseFloat(bagPrice) > 0
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-green-500/50 text-white/50 cursor-not-allowed'
                }`}
              >
                {creatingListing ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    {listingStep === 'connecting' && 'Connecting Wallet...'}
                    {listingStep === 'approving' && 'Approving NFTs...'}
                    {listingStep === 'signing' && 'Sign Order...'}
                    {listingStep === 'done' && 'Creating Cast...'}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create Listing (Seaport)
                  </>
                )}
              </button>
              <div className="text-slate-500 text-[11px] mt-2 text-center flex flex-col gap-1">
                <div className="flex items-center justify-center gap-1">
                  <span>🌊</span> Powered by Seaport Protocol v1.6 (Base)
                </div>
                <div>Contract: 0x0000000000000068F116a894984e2DB1123eB395</div>
              </div>
            </>
          )}
        </div>

        {/* P2P Swap - Hidden for now, coming soon */}
        {/* Will be implemented with Seaport protocol */}
      </div>
    );
  };

  const renderFunTab = () => {
    if (!scanResults) return null;
    
    const selectedMemeNft = memeNftIndex !== null ? scanResults.nfts[memeNftIndex] : null;
    const selectedTemplate = memeTemplateIndex !== null ? memeTemplates[memeTemplateIndex] : null;
    const selectedMemeImage = memeSource === 'template' ? selectedTemplate?.url : selectedMemeNft?.image;
    const selectedMemeName = memeSource === 'template' ? selectedTemplate?.name : selectedMemeNft?.name;
    
    return (
      <div className="space-y-6">
        {/* Meme Generator */}
            <div className="bg-[rgba(12,10,20,0.65)] p-4 rounded-xl border border-[#8C52FF]/40 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-bold text-white">Meme Generator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-1">Use your NFT or a popular template, then add meme text</p>
          <p className="text-[11px] text-slate-500 mb-3">Uploads go to IPFS; “Mint NFT” opens Zora’s create page; casts share on Farcaster. No custody taken.</p>

          {/* Source toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setMemeSource('nft'); setMemeTemplateIndex(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                memeSource === 'nft'
                  ? 'bg-[#8C52FF] text-white border-[#8C52FF]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-[#8C52FF]/50'
              }`}
            >
              Use My NFT
            </button>
            <button
              onClick={() => { setMemeSource('template'); setMemeNftIndex(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                memeSource === 'template'
                  ? 'bg-[#8C52FF] text-white border-[#8C52FF]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-[#8C52FF]/50'
              }`}
            >
              Use Template
            </button>
          </div>

          {/* NFT selector */}
          {memeSource === 'nft' && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {scanResults.nfts.slice(0, 8).map((nft, i) => (
                <button 
                  key={i} 
                  onClick={() => {
                    setMemeNftIndex(memeNftIndex === i ? null : i);
                    setMemeTemplateIndex(null);
                  }}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${memeNftIndex === i ? 'border-[#E53935] ring-2 ring-[#E53935]/50' : 'border-slate-700 hover:border-[#E53935]/50'}`}
                >
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Template selector */}
          {memeSource === 'template' && (
            <div className="mb-4">
              {loadingTemplates && (
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                  <span className="animate-spin h-4 w-4 border-2 border-pink-500 border-t-transparent rounded-full"></span>
                  Loading templates...
                </div>
              )}
              {templateError && (
                <p className="text-red-300 text-sm mb-3">{templateError}</p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {memeTemplates.slice(0, 16).map((tmpl, i) => (
                  <button
                    key={tmpl.url}
                    onClick={() => {
                      setMemeTemplateIndex(memeTemplateIndex === i ? null : i);
                      setMemeNftIndex(null);
                    }}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${memeTemplateIndex === i ? 'border-[#E53935] ring-2 ring-[#E53935]/50' : 'border-slate-700 hover:border-[#E53935]/50'}`}
                    title={tmpl.name}
                  >
                    <img src={tmpl.url} alt={tmpl.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Meme Preview */}
          {selectedMemeImage && (
            <div className="relative aspect-square bg-black rounded-lg mb-4 overflow-hidden">
              <img src={selectedMemeImage} alt={selectedMemeName || 'Meme'} className="w-full h-full object-contain" />
              
              {memeTextMode === 'two-line' && (
                <>
                  {memeTopText && (
                    <div className="absolute top-2 left-0 right-0 text-center px-2">
                      <span className="text-white text-2xl font-black uppercase break-words leading-tight" style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                      }}>
                        {memeTopText}
                      </span>
                    </div>
                  )}
                  {memeBottomText && (
                    <div className="absolute bottom-2 left-0 right-0 text-center px-2">
                      <span className="text-white text-2xl font-black uppercase break-words leading-tight" style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                      }}>
                        {memeBottomText}
                      </span>
                    </div>
                  )}
                </>
              )}

              {memeTextMode === 'quad' && (
                <>
                  {memeTLText && (
                    <div className="absolute top-2 left-2 right-1/2 text-left px-2">
                      <span className="text-white text-xl font-black uppercase break-words leading-tight" style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                      }}>
                        {memeTLText}
                      </span>
                    </div>
                  )}
                  {memeTRText && (
                    <div className="absolute top-2 right-2 left-1/2 text-right px-2">
                      <span className="text-white text-xl font-black uppercase break-words leading-tight" style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                      }}>
                        {memeTRText}
                      </span>
                    </div>
                  )}
                  {memeBLText && (
                    <div className="absolute bottom-2 left-2 right-1/2 text-left px-2">
                      <span className="text-white text-xl font-black uppercase break-words leading-tight" style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                      }}>
                        {memeBLText}
                      </span>
                    </div>
                  )}
                  {memeBRText && (
                    <div className="absolute bottom-2 right-2 left-1/2 text-right px-2">
                      <span className="text-white text-xl font-black uppercase break-words leading-tight" style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                      }}>
                        {memeBRText}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Text mode toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setMemeTextMode('two-line')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                memeTextMode === 'two-line'
                  ? 'bg-[#8C52FF] text-white border-[#8C52FF]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-[#8C52FF]/50'
              }`}
            >
              Top / Bottom
            </button>
            <button
              onClick={() => setMemeTextMode('quad')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                memeTextMode === 'quad'
                  ? 'bg-[#8C52FF] text-white border-[#8C52FF]'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-[#8C52FF]/50'
              }`}
            >
              4 Quadrants
            </button>
          </div>

          {memeTextMode === 'two-line' && (
            <>
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
            </>
          )}

          {memeTextMode === 'quad' && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input
                type="text"
                placeholder="Top Left"
                value={memeTLText}
                onChange={(e) => setMemeTLText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 uppercase"
              />
              <input
                type="text"
                placeholder="Top Right"
                value={memeTRText}
                onChange={(e) => setMemeTRText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 uppercase"
              />
              <input
                type="text"
                placeholder="Bottom Left"
                value={memeBLText}
                onChange={(e) => setMemeBLText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 uppercase"
              />
              <input
                type="text"
                placeholder="Bottom Right"
                value={memeBRText}
                onChange={(e) => setMemeBRText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 uppercase"
              />
            </div>
          )}
          
          <button 
            onClick={startMemeMint}
            disabled={
              (memeSource === 'nft' && memeNftIndex === null) ||
              (memeSource === 'template' && memeTemplateIndex === null) ||
              (memeTextMode === 'two-line'
                ? (!memeTopText && !memeBottomText)
                : (!memeTLText && !memeTRText && !memeBLText && !memeBRText))
            }
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
              ((memeSource === 'nft' && memeNftIndex !== null) || (memeSource === 'template' && memeTemplateIndex !== null)) && (
                memeTextMode === 'two-line'
                  ? (memeTopText || memeBottomText)
                  : (memeTLText || memeTRText || memeBLText || memeBRText)
              )
                ? 'bg-gradient-to-r from-[#8C52FF] to-[#E53935] hover:from-[#7b47e5] hover:to-[#c7312f] text-white shadow-lg shadow-[#8C52FF]/30'
                : 'bg-slate-700/50 text-white/50 cursor-not-allowed'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Meme
          </button>
        </div>

        {/* GIF Creator */}
        <div className="bg-[rgba(12,10,20,0.65)] p-4 rounded-xl border border-[#E53935]/40 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2m0 2v2m0-2h2m8 0h2m-2 0V2m0 2v2M3 20h18V8H3v12zm4-8h10m-10 4h4" />
            </svg>
            <h3 className="font-bold text-white">GIF Creator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-1">Select 2-10 NFTs to create an animated GIF</p>
          <p className="text-[11px] text-slate-500 mb-3">GIFs are generated server-side; uploads go to IPFS; “Mint NFT” opens Zora’s create page; casts share on Farcaster.</p>
          
          {/* Selection counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">
              Selected: <span className={`font-bold ${gifNfts.size >= 2 ? 'text-[#8C52FF]' : 'text-red-400'}`}>{gifNfts.size}/10</span>
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
                    isSelected ? 'border-[#8C52FF] ring-2 ring-[#8C52FF]/50' : 'border-slate-700 hover:border-[#8C52FF]/50'
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
                <span className="text-[#8C52FF] text-sm">{gifSpeed}ms</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="100"
                value={gifSpeed}
                onChange={(e) => setGifSpeed(Number(e.target.value))}
                className="w-full accent-[#8C52FF]"
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
                  Generate GIF
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
              onClick={startGifMint}
              disabled={!generatedGif}
              className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                generatedGif
                  ? 'bg-gradient-to-r from-[#8C52FF] to-[#E53935] hover:from-[#7b47e5] hover:to-[#c7312f] text-white shadow-lg shadow-[#8C52FF]/30'
                  : 'bg-slate-700/50 text-white/50 cursor-not-allowed'
              }`}
              title={generatedGif ? "Share GIF" : "Generate GIF first"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share GIF
            </button>
          </div>
          {!generatedGif && gifNfts.size >= 2 && (
            <p className="text-slate-500 text-xs mt-2 text-center">
              Generate GIF first, then share or sell it
            </p>
          )}
        </div>

        {/* Top 3 Curator (moved lower, above slideshow) */}
        <div className="bg-[rgba(12,10,20,0.65)] p-4 rounded-xl border border-[#E53935]/50 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <h3 className="font-bold text-white">Top 3 Curator</h3>
          </div>
          <p className="text-slate-400 text-sm mb-3">Select your 3 favorite NFTs to share</p>
          
          {/* Selection counter and Cast button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Selected: <span className={`font-bold ${selectedNfts.size === 3 ? 'text-[#8C52FF]' : 'text-[#E53935]'}`}>{selectedNfts.size}/3</span></span>
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
              <button onClick={castTriptych} className="px-4 py-2 bg-[#E53935] hover:bg-[#c7312f] text-white rounded-lg text-sm font-bold flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Cast Top 3
              </button>
            )}
          </div>

          {/* Mini NFT selector grid */}
          <div className="grid grid-cols-5 gap-2">
            {scanResults.nfts.slice(0, 15).map((nft, i) => {
              const key = getNftKey(nft, i);
              if (hiddenNfts.has(key)) return null;
              const isSelected = selectedNfts.has(key);
              const selectionOrder = isSelected ? Array.from(selectedNfts).indexOf(key) + 1 : null;
              return (
                <button
                  key={key}
                  onClick={() => toggleSelectNft(key)}
                  disabled={selectedNfts.size >= 3 && !isSelected}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected ? 'border-[#E53935] ring-2 ring-[#E53935]/40' : 'border-slate-700 hover:border-[#E53935]/40'
                  } ${selectedNfts.size >= 3 && !isSelected ? 'opacity-30' : ''}`}
                >
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                  {isSelected && selectionOrder && (
                    <div className="absolute top-0 right-0 w-5 h-5 bg-yellow-500 rounded-bl-lg flex items-center justify-center">
                      <span className="text-black text-xs font-bold">{selectionOrder}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Digital Frame (moved lower to feature creation tools first) */}
        <div className="bg-[rgba(12,10,20,0.65)] p-4 rounded-xl border border-[#8C52FF]/40 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur">
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
              className="flex-1 py-2 bg-[#8C52FF] hover:bg-[#7b47e5] disabled:bg-[#8C52FF]/30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
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
      </div>
    );
  };

  const design = {
    primary: '#8C52FF',
    accent: '#E53935',
    surface: 'rgba(12, 10, 20, 0.8)',
    border: 'rgba(140, 82, 255, 0.4)',
    glow: '0 20px 60px rgba(140, 82, 255, 0.25)',
    heroOverlay:
      'linear-gradient(135deg, rgba(12,10,20,0.9) 0%, rgba(12,10,20,0.8) 40%, rgba(12,10,20,0.75) 100%)',
    // Use your dropped asset as the hero background
    heroImage:
      "url('/fiends/ETHFIENDS-banner.png')",
  };

  const tabBackgrounds: Record<Tab, string> = {
    gallery: "linear-gradient(180deg, rgba(8,6,14,0.9), rgba(8,6,14,0.85)), url('/fiends/NFT.jpg')",
    trade: "linear-gradient(180deg, rgba(8,6,14,0.9), rgba(8,6,14,0.85)), url('/fiends/warplet-jacket.png')",
    fun: "linear-gradient(180deg, rgba(8,6,14,0.9), rgba(8,6,14,0.85)), url('/fiends/ETHFIENDS-banner.png')",
  };

  return (
    <main
      className="bg-slate-950 min-h-screen text-white font-sans"
      style={{
        backgroundImage: `${design.heroOverlay}, ${design.heroImage}`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center py-6 px-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <span className="text-xs font-semibold tracking-wide text-white/80">EtherFiends Mini App</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mt-3" style={{ color: design.primary, textShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
            Your Based NFTs
          </h1>
          <p className="text-slate-300 text-sm mt-2">Gallery • Trade • Fun • Memes</p>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 mb-4">
          <div className="flex bg-black/40 rounded-xl p-1 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
            {[
              { id: 'gallery', label: 'Gallery', icon: '🖼️' },
              { id: 'trade', label: 'Trade', icon: '💰' },
              { id: 'fun', label: 'Fun', icon: '🎨' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#8C52FF] text-white shadow-[0_10px_30px_rgba(140,82,255,0.35)]'
                    : 'text-slate-300 hover:text-white'
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
          <div
            className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.35)]"
            style={{
              backgroundImage: "linear-gradient(180deg, rgba(8,6,14,0.9), rgba(8,6,14,0.9)), url('/fiends/ETHFIENDS-banner.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <span className="animate-spin h-10 w-10 border-4 border-[#8C52FF] border-t-transparent rounded-full mb-4"></span>
            <p className="text-white font-semibold text-lg">Loading your Fiends...</p>
            <p className="text-slate-300 text-sm mt-1">Pulling NFTs and floor prices</p>
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
        <div
          className="px-4 pb-8"
          style={{
            backgroundImage: tabBackgrounds[activeTab],
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
            {/* Profile Card - Always visible */}
            <div className="bg-[rgba(12,10,20,0.72)] p-4 rounded-2xl border border-[#8C52FF]/40 mb-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-center gap-4">
                {scanResults.pfp && (
                  <img src={scanResults.pfp} alt={scanResults.displayName} className="w-14 h-14 rounded-full border-2 border-[#8C52FF]" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-white">{scanResults.displayName}</p>
                  <p className="text-[#b08bff] text-sm">@{scanResults.user}</p>
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
            {activeTab === 'trade' && renderTradeTab()}
            {activeTab === 'fun' && renderFunTab()}
          </div>
        )}
      </div>

      {/* Action Modal - Cast, Mint, or Sell */}
      {mintMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="font-bold text-white text-lg">
                Share, Mint or Sell Your Creation
              </h2>
              <button 
                onClick={cancelMint}
                disabled={mintStep === 'uploading' || mintStep === 'signing'}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Preview - smaller */}
              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 max-h-48 mx-auto">
                {mintMode === 'meme' && memeNftIndex !== null && scanResults && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={scanResults.nfts[memeNftIndex].image} 
                      alt="Meme preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                    {memeTopText && (
                      <div className="absolute top-1 left-0 right-0 text-center">
                        <span className="text-white text-sm font-black uppercase px-2" style={{ 
                          textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
                        }}>
                          {memeTopText}
                        </span>
                    </div>
                    )}
                    {memeBottomText && (
                      <div className="absolute bottom-1 left-0 right-0 text-center">
                        <span className="text-white text-sm font-black uppercase px-2" style={{ 
                          textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
                        }}>
                          {memeBottomText}
                        </span>
                  </div>
                    )}
              </div>
                )}
                {mintMode === 'gif' && generatedGif && (
                  <img 
                    src={`data:image/gif;base64,${generatedGif}`}
                    alt="GIF preview"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Action selector - only show when idle */}
              {mintStep === 'idle' && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wide">What do you want to do?</p>
                  
                  {/* Cast/Share option */}
                  <button
                    onClick={() => setMintAction('cast')}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                      mintAction === 'cast'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        mintAction === 'cast' ? 'bg-purple-500' : 'bg-slate-800'
                      }`}>
                        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                <div className="flex-1">
                        <p className="font-semibold text-white">Cast / Share</p>
                        <p className="text-slate-400 text-sm">Share freely on Farcaster</p>
                </div>
                      <span className="text-green-400 text-sm font-medium">FREE</span>
                </div>
                  </button>

                  {/* Mint option */}
                  <button
                    onClick={() => setMintAction('mint')}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                      mintAction === 'mint'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        mintAction === 'mint' ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}>
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
              </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">Mint NFT</p>
                        <p className="text-slate-400 text-sm">Own it on-chain forever</p>
            </div>
                      <span className="text-slate-400 text-sm">+ gas</span>
                    </div>
                  </button>

                  {/* Sell option */}
                  <button
                    onClick={() => setMintAction('sell')}
                    className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                      mintAction === 'sell'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        mintAction === 'sell' ? 'bg-gradient-to-br from-orange-500 to-pink-500' : 'bg-slate-800'
                      }`}>
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">Sell for Memecoins</p>
                        <p className="text-slate-400 text-sm">List for any Base token</p>
                      </div>
                      <span className="text-orange-400 text-sm font-medium">💰</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Memecoin selector - only show for sell action */}
              {mintStep === 'idle' && mintAction === 'sell' && (
                <div className="pt-2">
                  <MemecoinSelector
                    selectedCoin={mintCoin}
                    price={mintPrice}
                    onCoinChange={setMintCoin}
                    onPriceChange={setMintPrice}
                  />
                </div>
              )}

              {/* Status display when processing */}
              {(mintStep === 'uploading' || mintStep === 'signing') && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full"></span>
                    <div>
                      <p className="text-white font-medium">
                        {mintStep === 'uploading' ? 'Uploading to IPFS...' : 'Creating listing...'}
                      </p>
                      <p className="text-slate-400 text-sm">
                        Making your creation permanent
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success state */}
              {mintStep === 'done' && mintResult && (
                <div className="space-y-4">
                  <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-green-400 font-bold">Uploaded to IPFS!</p>
                    </div>
                    <p className="text-slate-300 text-sm">
                      Your {mintMode} is permanently stored and ready.
                    </p>
                  </div>
                  
                  {/* Preview the uploaded content */}
                  {mintResult.ipfsUrl && (
                    <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-700">
                      <img 
                        src={mintResult.ipfsUrl} 
                        alt="Your creation" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Action-specific content */}
                  {mintAction === 'cast' && (
                    <p className="text-slate-400 text-sm text-center">
                      Share your creation on Farcaster!
                    </p>
                  )}
                  
                  {mintAction === 'mint' && (
                    <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-3">
                      <p className="text-cyan-300 text-sm mb-2">
                        <strong>Ready to mint!</strong> Click below to create your NFT on Zora.
                      </p>
                      <p className="text-slate-400 text-xs">
                        You'll pay a small gas fee (~$0.10) to mint on Base.
                      </p>
                  </div>
                  )}
                  
                  {mintAction === 'sell' && (
                    <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-3">
                      <p className="text-orange-300 text-sm">
                        <strong>Price:</strong> {formatPrice(mintPrice, mintCoin.decimals)} ${mintCoin.symbol}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Share your listing on Farcaster to find buyers.
                      </p>
              </div>
                  )}
                </div>
              )}

              {/* Error state */}
              {mintStep === 'error' && mintError && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 font-medium">{mintError}</p>
                  </div>
                  <button
                    onClick={() => setMintStep('idle')}
                    className="mt-3 text-sm text-slate-400 hover:text-white underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 space-y-2">
              {mintStep === 'done' ? (
                <>
                  {/* Action button based on selected action */}
                  <button 
                    onClick={handleFinalAction}
                    className={`w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                      mintAction === 'cast'
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : mintAction === 'mint'
                          ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                          : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white'
                    }`}
                  >
                    {mintAction === 'cast' ? (
                      <>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        Cast to Farcaster
                      </>
                    ) : mintAction === 'mint' ? (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Mint on Zora (pays gas)
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        Share Listing
                      </>
                    )}
                  </button>
                  
                  {/* Close button */}
                  <button 
                    onClick={cancelMint}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors text-sm"
                  >
                    Close
                  </button>
                </>
              ) : (
                <button 
                  onClick={executeMint}
                  disabled={mintStep === 'uploading' || mintStep === 'signing' || (mintAction === 'sell' && (!mintPrice || parseFloat(mintPrice) <= 0))}
                  className={`w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                    mintStep === 'uploading' || mintStep === 'signing'
                      ? 'bg-purple-500/50 text-white/70 cursor-wait'
                      : mintAction === 'cast'
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : mintAction === 'mint'
                          ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                          : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {mintStep === 'uploading' || mintStep === 'signing' ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Uploading to IPFS...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload to IPFS
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Slideshow Overlay */}
      {slideshowActive && scanResults && (
        (() => {
          const visibleNfts = scanResults.nfts.filter((_, i) => !hiddenNfts.has(getNftKey(scanResults.nfts[i], i)));
          const visibleCount = visibleNfts.length;
          const currentIndex = visibleCount > 0 ? Math.min(slideshowIndex, visibleCount - 1) : 0;
          const currentNft = visibleCount > 0 ? visibleNfts[currentIndex] : null;

          return (
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
                  {visibleCount > 0 ? currentIndex + 1 : 0} / {visibleCount}
                </span>
              </div>

              {/* Main image area */}
              <div className="flex-1 flex items-center justify-center p-4">
                {currentNft && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={currentNft.image}
                      alt={currentNft.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                  </div>
                )}
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
                {currentNft && (
                  <div className="text-center">
                    <h2 className="text-white text-xl font-bold">{currentNft.name}</h2>
                    <p className="text-slate-400">{currentNft.collectionName}</p>
                    {currentNft.floorPrice > 0 && (
                      <p className="text-purple-400 text-sm mt-1">{currentNft.floorPrice.toFixed(4)} ETH</p>
                    )}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-white/10">
                <div 
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${visibleCount > 0 ? ((currentIndex + 1) / visibleCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          );
        })()
      )}
    </main>
  );
}
