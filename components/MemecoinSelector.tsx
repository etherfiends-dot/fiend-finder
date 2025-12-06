'use client';

import { useState } from 'react';
import { MEMECOINS, type Memecoin, formatPrice, parsePrice } from '@/lib/zora';

interface MemecoinSelectorProps {
  selectedCoin: Memecoin;
  price: string;
  onCoinChange: (coin: Memecoin) => void;
  onPriceChange: (price: string) => void;
  disabled?: boolean;
}

export default function MemecoinSelector({
  selectedCoin,
  price,
  onCoinChange,
  onPriceChange,
  disabled = false,
}: MemecoinSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomAddressSubmit = () => {
    if (customAddress && customAddress.startsWith('0x') && customAddress.length === 42) {
      const customCoin: Memecoin = {
        symbol: 'CUSTOM',
        name: 'Custom Token',
        address: customAddress,
        decimals: 18, // Assume 18 decimals for custom tokens
        logo: '',
      };
      onCoinChange(customCoin);
      setShowCustom(false);
      setShowDropdown(false);
    }
  };

  const quickPrices = selectedCoin.symbol === 'ETH' || selectedCoin.symbol === 'USDC'
    ? ['0.001', '0.01', '0.1', '1']
    : ['1000', '10000', '100K', '1M'];

  return (
    <div className="space-y-3">
      {/* Currency selector */}
      <div className="relative">
        <label className="block text-slate-400 text-xs uppercase mb-1">Currency</label>
        <button
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          disabled={disabled}
          className="w-full flex items-center justify-between gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            {selectedCoin.logo ? (
              <img src={selectedCoin.logo} alt={selectedCoin.symbol} className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs">
                {selectedCoin.symbol.charAt(0)}
              </div>
            )}
            <span className="font-medium">{selectedCoin.symbol}</span>
            <span className="text-slate-500 text-sm">{selectedCoin.name}</span>
          </div>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
            {MEMECOINS.map((coin) => (
              <button
                key={coin.address}
                onClick={() => {
                  onCoinChange(coin);
                  setShowDropdown(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 transition-colors ${
                  selectedCoin.address === coin.address ? 'bg-slate-700' : ''
                }`}
              >
                {coin.logo ? (
                  <img src={coin.logo} alt={coin.symbol} className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs">
                    {coin.symbol.charAt(0)}
                  </div>
                )}
                <span className="font-medium text-white">{coin.symbol}</span>
                <span className="text-slate-500 text-sm">{coin.name}</span>
              </button>
            ))}
            
            {/* Custom token option */}
            <button
              onClick={() => {
                setShowCustom(true);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 transition-colors border-t border-slate-700"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                <span className="text-white text-xs">+</span>
              </div>
              <span className="font-medium text-white">Custom Token</span>
              <span className="text-slate-500 text-sm">Enter address</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom token input */}
      {showCustom && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <label className="block text-slate-400 text-xs uppercase mb-1">Token Contract Address</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x..."
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 font-mono"
            />
            <button
              onClick={handleCustomAddressSubmit}
              disabled={!customAddress || customAddress.length !== 42}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              Add
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Enter any Base ERC-20 token address
          </p>
        </div>
      )}

      {/* Price input */}
      <div>
        <label className="block text-slate-400 text-xs uppercase mb-1">Price</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            disabled={disabled}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-lg font-bold disabled:opacity-50"
          />
          <span className="flex items-center px-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium">
            {selectedCoin.symbol}
          </span>
        </div>
      </div>

      {/* Quick price buttons */}
      <div className="flex gap-2">
        {quickPrices.map((qp) => (
          <button
            key={qp}
            onClick={() => onPriceChange(parsePrice(qp))}
            disabled={disabled}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              price === parsePrice(qp)
                ? 'bg-purple-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            } disabled:opacity-50`}
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Price preview */}
      {price && parseFloat(price) > 0 && (
        <div className="text-center text-slate-400 text-sm">
          Selling for <span className="text-white font-bold">{formatPrice(price, selectedCoin.decimals)}</span>{' '}
          <span className="text-purple-400">${selectedCoin.symbol}</span>
        </div>
      )}
    </div>
  );
}

