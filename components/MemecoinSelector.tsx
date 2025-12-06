'use client';

import { useState, useEffect, useMemo } from 'react';
import { MEMECOINS, type Memecoin, formatPrice, parsePrice } from '@/lib/zora';

interface MemecoinSelectorProps {
  selectedCoin: Memecoin;
  price: string;
  onCoinChange: (coin: Memecoin) => void;
  onPriceChange: (price: string) => void;
  disabled?: boolean;
}

// CoinGecko IDs for price lookup
const COINGECKO_IDS: Record<string, string> = {
  'ETH': 'ethereum',
  'DEGEN': 'degen-base',
  'HIGHER': 'higher',
  'TOSHI': 'toshi',
  'BRETT': 'brett',
  'CLANKER': 'clanker',
  'USDC': 'usd-coin',
};

export default function MemecoinSelector({
  selectedCoin,
  price,
  onCoinChange,
  onPriceChange,
  disabled = false,
}: MemecoinSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [usdPrice, setUsdPrice] = useState<number | null>(null);
  const [tokenUsdRate, setTokenUsdRate] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Filter coins based on search query
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return MEMECOINS;
    const query = searchQuery.toLowerCase();
    return MEMECOINS.filter(
      coin => 
        coin.symbol.toLowerCase().includes(query) ||
        coin.name.toLowerCase().includes(query) ||
        coin.address.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Fetch USD price for selected token
  useEffect(() => {
    const fetchTokenPrice = async () => {
      const coingeckoId = COINGECKO_IDS[selectedCoin.symbol];
      if (!coingeckoId) {
        setTokenUsdRate(null);
        setUsdPrice(null);
        return;
      }

      // USDC is always $1
      if (selectedCoin.symbol === 'USDC') {
        setTokenUsdRate(1);
        return;
      }

      setLoadingPrice(true);
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
        );
        const data = await response.json();
        const rate = data[coingeckoId]?.usd;
        setTokenUsdRate(rate || null);
      } catch (error) {
        console.error('Failed to fetch token price:', error);
        setTokenUsdRate(null);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchTokenPrice();
  }, [selectedCoin]);

  // Calculate USD equivalent when price or rate changes
  useEffect(() => {
    if (tokenUsdRate && price) {
      const numPrice = parseFloat(price);
      if (!isNaN(numPrice)) {
        setUsdPrice(numPrice * tokenUsdRate);
      } else {
        setUsdPrice(null);
      }
    } else {
      setUsdPrice(null);
    }
  }, [price, tokenUsdRate]);

  const handleCustomAddressSubmit = () => {
    if (customAddress && customAddress.startsWith('0x') && customAddress.length === 42) {
      const customCoin: Memecoin = {
        symbol: 'CUSTOM',
        name: 'Custom Token',
        address: customAddress,
        decimals: 18,
        logo: '',
      };
      onCoinChange(customCoin);
      setShowCustom(false);
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  const handleCoinSelect = (coin: Memecoin) => {
    onCoinChange(coin);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const quickPrices = selectedCoin.symbol === 'ETH' 
    ? ['0.001', '0.01', '0.1', '1']
    : selectedCoin.symbol === 'USDC'
    ? ['1', '5', '10', '100']
    : ['1000', '10000', '100K', '1M'];

  const formatUsdPrice = (usd: number): string => {
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(2)}K`;
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd >= 0.01) return `$${usd.toFixed(2)}`;
    return `$${usd.toFixed(6)}`;
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
              placeholder={showDropdown ? "Search tokens..." : `${selectedCoin.symbol} - ${selectedCoin.name}`}
              value={showDropdown ? searchQuery : ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              disabled={disabled}
              className="flex-1 bg-transparent py-3 pr-3 text-white placeholder:text-slate-400 outline-none disabled:opacity-50"
            />
            
            {/* Dropdown arrow */}
            <button
              onClick={() => !disabled && setShowDropdown(!showDropdown)}
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
            <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {filteredCoins.length > 0 ? (
                filteredCoins.map((coin) => (
                  <button
                    key={coin.address}
                    onClick={() => handleCoinSelect(coin)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors text-left ${
                      selectedCoin.address === coin.address ? 'bg-purple-500/20' : ''
                    }`}
                  >
                    {coin.logo ? (
                      <img 
                        src={coin.logo} 
                        alt={coin.symbol} 
                        className="w-7 h-7 rounded-full flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {coin.symbol.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{coin.symbol}</span>
                        <span className="text-slate-400 text-sm truncate">{coin.name}</span>
                      </div>
                    </div>
                    {selectedCoin.address === coin.address && (
                      <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-slate-400 text-sm">
                  No tokens found matching "{searchQuery}"
                </div>
              )}
              
              {/* Custom token option */}
              <button
                onClick={() => {
                  setShowCustom(true);
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors text-left border-t border-slate-700"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-white">Add Custom Token</span>
                  <span className="text-slate-400 text-sm block">Paste any Base ERC-20 address</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Custom token input */}
      {showCustom && (
        <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-4">
          <label className="block text-slate-400 text-xs uppercase tracking-wide mb-1.5">
            Token Contract Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x..."
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 font-mono focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={handleCustomAddressSubmit}
              disabled={!customAddress || customAddress.length !== 42}
              className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowCustom(false);
                setCustomAddress('');
              }}
              className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
        {tokenUsdRate === null && selectedCoin.symbol !== 'CUSTOM' && (
          <div className="mt-2 text-slate-500 text-sm">
            Price data unavailable for {selectedCoin.symbol}
          </div>
        )}
      </div>

      {/* Quick price buttons */}
      <div className="flex gap-2">
        {quickPrices.map((qp) => {
          const parsed = parsePrice(qp);
          const isActive = price === parsed;
          return (
            <button
              key={qp}
              onClick={() => onPriceChange(parsed)}
              disabled={disabled}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              } disabled:opacity-50`}
            >
              {qp}
            </button>
          );
        })}
      </div>
    </div>
  );
}
