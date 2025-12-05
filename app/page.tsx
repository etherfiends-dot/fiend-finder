'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import sdk from '@farcaster/frame-sdk';

// Define types for our data
type NFT = {
  tokenId: string;
  name: string;
  image: string;
  location: string;
  isCustody: boolean;
  isFiend: boolean;
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

type Tab = 'mine' | 'explore';

export default function Home() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [currentUserFid, setCurrentUserFid] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  
  // Separate state for each tab
  const [myResults, setMyResults] = useState<ScanResult | null>(null);
  const [exploreResults, setExploreResults] = useState<ScanResult | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasAutoScanned = useRef(false);

  // Scan by FID (for current user)
  const scanMyCollection = useCallback(async (fid: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/scan-fiends?fid=${fid}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Scan failed");
      }
      const data = await res.json();
      setMyResults(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Scan by username (for exploring others)
  const scanByUsername = useCallback(async (username: string) => {
    if (!username.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const cleanUsername = username.replace('@', '').trim();
      const res = await fetch(`/api/scan-fiends?username=${encodeURIComponent(cleanUsername)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "User not found");
      }
      const data = await res.json();
      setExploreResults(data);
      setSearchQuery('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load SDK and auto-scan current user
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
      scanMyCollection(currentUserFid);
    }
  }, [isSDKLoaded, currentUserFid, scanMyCollection]);

  // Handle search form submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      scanByUsername(searchQuery);
    }
  };

  // Clear error when switching tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setError(null);
  };

  if (!isSDKLoaded) return <div className="bg-slate-950 text-white h-screen flex items-center justify-center">Loading...</div>;

  // Get the results for current tab
  const currentResults = activeTab === 'mine' ? myResults : exploreResults;

  return (
    <main className="bg-slate-950 min-h-screen text-white p-4 flex flex-col items-center font-sans selection:bg-purple-500/30">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-6 mt-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent tracking-tighter">
            SOUL SCANNER
          </h1>
          <p className="text-slate-400 text-sm mt-2">Discover NFT collectors on Base</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-900 rounded-xl p-1 mb-6 border border-slate-800">
          <button
            onClick={() => handleTabChange('mine')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'mine'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            My Collection
          </button>
          <button
            onClick={() => handleTabChange('explore')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'explore'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Explore
          </button>
        </div>

        {/* Error Box */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl mb-6 text-center text-sm">
            {error}
          </div>
        )}

        {/* MY COLLECTION TAB */}
        {activeTab === 'mine' && (
          <>
            {/* Loading State */}
            {loading && !myResults && (
              <div className="flex flex-col items-center justify-center h-64">
                <span className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mb-4"></span>
                <p className="text-slate-400">Loading your collection...</p>
              </div>
            )}

            {/* No FID detected */}
            {!loading && !myResults && !currentUserFid && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-slate-400 mb-2">Open in Warpcast</p>
                <p className="text-slate-500 text-sm">Your collection will load automatically</p>
              </div>
            )}

            {/* My Results */}
            {myResults && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Profile Card */}
                <div className="bg-slate-900 p-4 rounded-xl mb-6 border border-slate-800">
                  <div className="flex items-center gap-4">
                    {myResults.pfp && (
                      <img 
                        src={myResults.pfp} 
                        alt={myResults.displayName}
                        className="w-14 h-14 rounded-full border-2 border-purple-500"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{myResults.displayName}</p>
                      <p className="text-slate-400 text-sm">@{myResults.user}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-400">{myResults.totalFound}</p>
                      <p className="text-slate-500 text-xs uppercase">NFTs</p>
                    </div>
                  </div>
                </div>
                
                {/* Gallery */}
                <NFTGallery nfts={myResults.nfts} loading={loading} />
              </div>
            )}
          </>
        )}

        {/* EXPLORE TAB */}
        {activeTab === 'explore' && (
          <>
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter exact username..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="px-5 py-3 bg-purple-600 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-slate-500 text-xs mt-2 text-center">Enter the exact Farcaster username (e.g., dwr, vitalik.eth)</p>
            </form>

            {/* No search yet */}
            {!loading && !exploreResults && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-slate-400 mb-2">Discover other collectors</p>
                <p className="text-slate-500 text-sm">Search by username to see their NFTs</p>
              </div>
            )}

            {/* Loading */}
            {loading && !exploreResults && (
              <div className="flex flex-col items-center justify-center h-48">
                <span className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mb-4"></span>
                <p className="text-slate-400">Searching...</p>
              </div>
            )}

            {/* Explore Results */}
            {exploreResults && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Profile Card */}
                <div className="bg-slate-900 p-4 rounded-xl mb-6 border border-slate-800">
                  <div className="flex items-center gap-4">
                    {exploreResults.pfp && (
                      <img 
                        src={exploreResults.pfp} 
                        alt={exploreResults.displayName}
                        className="w-14 h-14 rounded-full border-2 border-slate-700"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{exploreResults.displayName}</p>
                      <p className="text-slate-400 text-sm">@{exploreResults.user}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-400">{exploreResults.totalFound}</p>
                      <p className="text-slate-500 text-xs uppercase">NFTs</p>
                    </div>
                  </div>
                  
                  {/* Clear search button */}
                  <button
                    onClick={() => setExploreResults(null)}
                    className="mt-4 w-full py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                  >
                    ← Search Another User
                  </button>
                </div>
                
                {/* Gallery */}
                <NFTGallery nfts={exploreResults.nfts} loading={loading} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// Extracted NFT Gallery component
function NFTGallery({ nfts, loading }: { nfts: NFT[]; loading: boolean }) {
  if (nfts.length === 0) {
    return (
      <div className="text-center text-slate-500 py-10">
        No NFTs found on Base.
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 pb-8 ${loading ? 'opacity-50' : ''}`}>
      {nfts.map((nft, i) => (
        <div 
          key={`${nft.tokenId}-${i}`} 
          className="group relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-purple-500 transition-colors"
        >
          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover"/>
          
          {/* Overlay Info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 flex flex-col justify-end p-3">
            <p className="font-bold text-white text-xs truncate">{nft.name}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${nft.isCustody ? 'bg-blue-500' : 'bg-green-500'}`}></span>
              <span className="text-[10px] text-slate-300 uppercase tracking-wide">
                {nft.isCustody ? "Vault" : "Active"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
