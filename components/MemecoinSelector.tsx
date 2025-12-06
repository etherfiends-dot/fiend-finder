'use client';

import { useState, useEffect, useCallback } from 'react';
import { MEMECOINS, type Memecoin } from '@/lib/zora';

interface MemecoinSelectorProps {
  selectedCoin: Memecoin;
  price: string;
  onCoinChange: (coin: Memecoin) => void;
  onPriceChange: (price: string) => void;
  disabled?: boolean;
}

interface DexScreenerToken {
  address: string;
  name: string;
  symbol: string;
  priceUsd: string;
  liquidity: { usd: number };
  fdv: number;
  volume: { h24: number };
  priceChange: { h24: number };
  info?: {
    imageUrl?: string;
  };
}

interface SearchResult {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  priceUsd: number;
  liquidity: number;
}

export default function MemecoinSelector({
  selectedCoin,
  price,
  onCoinChange,
  onPriceChange,
  disabled = false,
}: MemecoinSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [usdPrice, setUsdPrice] = useState<number | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Debounced search for tokens
  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      // Show default tokens when no search
      setSearchResults(MEMECOINS.map(coin => ({
        address: coin.address,
        symbol: coin.symbol,
        name: coin.name,
        decimals: coin.decimals,
        logo: coin.logo,
        priceUsd: 0,
        liquidity: 0,
      })));
      return;
    }

    setSearching(true);
    try {
      // Search DexScreener for Base tokens
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      if (data.pairs) {
        // Filter for Base chain only and deduplicate by token address
        const baseTokens = new Map<string, SearchResult>();
        
        for (const pair of data.pairs) {
          // Only Base chain (chainId: base)
          if (pair.chainId !== 'base') continue;
          
          // Get the token that matches the search (not the quote token)
          const token = pair.baseToken;
          if (!token) continue;
          
          // Skip if we already have this token with higher liquidity
          const existing = baseTokens.get(token.address.toLowerCase());
          const liquidity = pair.liquidity?.usd || 0;
          
          // Only include tokens with at least $1000 liquidity
          if (liquidity < 1000) continue;
          
          if (!existing || liquidity > existing.liquidity) {
            baseTokens.set(token.address.toLowerCase(), {
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              decimals: 18, // Default, most tokens use 18
              logo: pair.info?.imageUrl || '',
              priceUsd: parseFloat(pair.priceUsd) || 0,
              liquidity,
            });
          }
        }
        
        // Sort by liquidity (highest first)
        const results = Array.from(baseTokens.values())
          .sort((a, b) => b.liquidity - a.liquidity)
          .slice(0, 20); // Limit to 20 results
        
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Token search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showDropdown) {
        searchTokens(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showDropdown, searchTokens]);

  // Fetch price for selected token from DexScreener
  useEffect(() => {
    const fetchTokenPrice = async () => {
      // ETH is special case
      if (selectedCoin.symbol === 'ETH') {
        try {
          const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
          );
          const data = await response.json();
          setTokenPrice(data.ethereum?.usd || null);
        } catch {
          setTokenPrice(null);
        }
        return;
      }

      // USDC is always $1
      if (selectedCoin.symbol === 'USDC') {
        setTokenPrice(1);
        return;
      }

      // Skip if no address
      if (!selectedCoin.address || selectedCoin.address === '0x0000000000000000000000000000000000000000') {
        setTokenPrice(null);
        return;
      }

      setLoadingPrice(true);
      try {
        // Use DexScreener to get token price on Base
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${selectedCoin.address}`
        );
        const data = await response.json();
        
        if (data.pairs && data.pairs.length > 0) {
          // Find the pair with highest liquidity on Base
          const basePairs = data.pairs.filter((p: { chainId: string }) => p.chainId === 'base');
          if (basePairs.length > 0) {
            // Sort by liquidity and get the best price
            const bestPair = basePairs.sort((a: { liquidity?: { usd: number } }, b: { liquidity?: { usd: number } }) => 
              (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            setTokenPrice(parseFloat(bestPair.priceUsd) || null);
          } else {
            setTokenPrice(null);
          }
        } else {
          setTokenPrice(null);
        }
      } catch (error) {
        console.error('Failed to fetch token price:', error);
        setTokenPrice(null);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchTokenPrice();
  }, [selectedCoin]);

  // Calculate USD equivalent when price or rate changes
  useEffect(() => {
    if (tokenPrice && price) {
      const numPrice = parseFloat(price);
      if (!isNaN(numPrice)) {
        setUsdPrice(numPrice * tokenPrice);
      } else {
        setUsdPrice(null);
      }
    } else {
      setUsdPrice(null);
    }
  }, [price, tokenPrice]);

  const handleTokenSelect = (result: SearchResult) => {
    const coin: Memecoin = {
      symbol: result.symbol,
      name: result.name,
      address: result.address,
      decimals: result.decimals,
      logo: result.logo,
    };
    onCoinChange(coin);
    setShowDropdown(false);
    setSearchQuery('');
    // Update price immediately if available
    if (result.priceUsd > 0) {
      setTokenPrice(result.priceUsd);
    }
  };

  const quickPrices = selectedCoin.symbol === 'ETH' 
    ? ['0.001', '0.01', '0.1', '1']
    : selectedCoin.symbol === 'USDC'
    ? ['1', '5', '10', '100']
    : ['1000', '10000', '100000', '1000000'];

  const formatQuickPrice = (p: string) => {
    const num = parseFloat(p);
    if (num >= 1000000) return `${num / 1000000}M`;
    if (num >= 1000) return `${num / 1000}K`;
    return p;
  };

  const formatUsdPrice = (usd: number): string => {
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(2)}K`;
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd >= 0.01) return `$${usd.toFixed(2)}`;
    if (usd >= 0.0001) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(6)}`;
  };

  const formatLiquidity = (liq: number): string => {
    if (liq >= 1000000) return `$${(liq / 1000000).toFixed(1)}M`;
    if (liq >= 1000) return `$${(liq / 1000).toFixed(0)}K`;
    return `$${liq.toFixed(0)}`;
  };

  return (
    <div className="space-y-3">
      {/* Currency selector with search */}
      <div className="relative">
        <label className="block text-slate-400 text-xs uppercase tracking-wide mb-1.5">
          Payment Currency
        </label>
        
        {/* Selected coin display / Search input */}
        <div 
          className="relative bg-slate-800 border border-slate-600 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/50 transition-all"
        >
          <div className="flex items-center">
            {/* Coin icon */}
            <div className="pl-3 pr-2">
              {selectedCoin.logo ? (
                <img 
                  src={selectedCoin.logo} 
                  alt={selectedCoin.symbol} 
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                  {selectedCoin.symbol.charAt(0)}
                </div>
              )}
            </div>
            
            {/* Search input */}
            <input
              type="text"
              placeholder={showDropdown ? "Search any Base token..." : `${selectedCoin.symbol} - ${selectedCoin.name}`}
              value={showDropdown ? searchQuery : ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                setShowDropdown(true);
                // Load default results
                if (!searchQuery) {
                  setSearchResults(MEMECOINS.map(coin => ({
                    address: coin.address,
                    symbol: coin.symbol,
                    name: coin.name,
                    decimals: coin.decimals,
                    logo: coin.logo,
                    priceUsd: 0,
                    liquidity: 0,
                  })));
                }
              }}
              disabled={disabled}
              className="flex-1 bg-transparent py-3 pr-3 text-white placeholder:text-slate-400 outline-none disabled:opacity-50"
            />
            
            {/* Dropdown arrow */}
            <button
              onClick={() => {
                if (!disabled) {
                  setShowDropdown(!showDropdown);
                  if (!showDropdown && !searchQuery) {
                    setSearchResults(MEMECOINS.map(coin => ({
                      address: coin.address,
                      symbol: coin.symbol,
                      name: coin.name,
                      decimals: coin.decimals,
                      logo: coin.logo,
                      priceUsd: 0,
                      liquidity: 0,
                    })));
                  }
                }
              }}
              disabled={disabled}
              className="px-3 py-3 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <svg 
                className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => {
                setShowDropdown(false);
                setSearchQuery('');
              }}
            />
            
            {/* Dropdown menu */}
            <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-72 overflow-y-auto">
              {/* Search hint */}
              {!searchQuery && (
                <div className="px-4 py-2 text-slate-500 text-xs border-b border-slate-700">
                  Search any token on Base • Min $1K liquidity
                </div>
              )}
              
              {searching ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full"></span>
                  <span className="text-slate-400">Searching...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.address}
                    onClick={() => handleTokenSelect(result)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors text-left ${
                      selectedCoin.address?.toLowerCase() === result.address?.toLowerCase() ? 'bg-purple-500/20' : ''
                    }`}
                  >
                    {result.logo ? (
                      <img 
                        src={result.logo} 
                        alt={result.symbol} 
                        className="w-8 h-8 rounded-full flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                          (e.target as HTMLImageElement).className = 'hidden';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {result.symbol.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{result.symbol}</span>
                        <span className="text-slate-400 text-sm truncate">{result.name}</span>
                      </div>
                      {result.liquidity > 0 && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>Liq: {formatLiquidity(result.liquidity)}</span>
                          {result.priceUsd > 0 && (
                            <span>• ${result.priceUsd < 0.0001 ? result.priceUsd.toExponential(2) : result.priceUsd.toFixed(6)}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedCoin.address?.toLowerCase() === result.address?.toLowerCase() && (
                      <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))
              ) : searchQuery ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-slate-400 text-sm mb-2">No tokens found for "{searchQuery}"</p>
                  <p className="text-slate-500 text-xs">Only showing tokens with $1K+ liquidity on Base</p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Price input */}
      <div>
        <label className="block text-slate-400 text-xs uppercase tracking-wide mb-1.5">
          Price
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="0"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
              disabled={disabled}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-xl font-bold placeholder:text-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 transition-all"
            />
          </div>
          <div className="flex items-center px-4 bg-slate-800 border border-slate-600 rounded-xl">
            <span className="text-white font-semibold">{selectedCoin.symbol}</span>
          </div>
        </div>
        
        {/* USD equivalent */}
        {usdPrice !== null && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-slate-400 text-sm">≈</span>
            <span className="text-green-400 font-medium">{formatUsdPrice(usdPrice)}</span>
            <span className="text-slate-500 text-sm">USD</span>
            {loadingPrice && (
              <span className="animate-spin h-3 w-3 border border-slate-500 border-t-transparent rounded-full"></span>
            )}
          </div>
        )}
        {tokenPrice === null && selectedCoin.address && selectedCoin.address !== '0x0000000000000000000000000000000000000000' && !loadingPrice && (
          <div className="mt-2 text-slate-500 text-sm">
            Price data unavailable
          </div>
        )}
      </div>

      {/* Quick price buttons */}
      <div className="flex gap-2">
        {quickPrices.map((qp) => {
          const isActive = price === qp;
          return (
            <button
              key={qp}
              onClick={() => onPriceChange(qp)}
              disabled={disabled}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              } disabled:opacity-50`}
            >
              {formatQuickPrice(qp)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
