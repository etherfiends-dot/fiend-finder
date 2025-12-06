'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import sdk from '@farcaster/frame-sdk';

type TriptychData = {
  fid: number;
  user: string;
  displayName: string;
  pfp: string;
  nfts: {
    image: string;
    name: string;
    collection: string;
  }[];
};

export default function TriptychPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<TriptychData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  useEffect(() => {
    // Initialize SDK
    const initSDK = async () => {
      try {
        await sdk.actions.ready();
        setIsSDKLoaded(true);
      } catch {
        setIsSDKLoaded(true);
      }
    };
    initSDK();
  }, []);

  useEffect(() => {
    const encoded = searchParams.get('data');
    if (!encoded) {
      setError('No triptych data provided');
      return;
    }

    try {
      const decoded = JSON.parse(atob(encoded));
      if (!decoded.nfts || decoded.nfts.length !== 3) {
        setError('Invalid triptych data');
        return;
      }
      setData(decoded);
    } catch {
      setError('Failed to decode triptych data');
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/" className="text-blue-400 hover:underline">Go to main app</a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center">
        <span className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></span>
      </div>
    );
  }

  return (
    <main className="bg-slate-950 min-h-screen text-white p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <h1 className="text-2xl font-black tracking-tighter" style={{ color: '#0000f4' }}>
            Top 3 NFTs
          </h1>
        </div>

        {/* User Info */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {data.pfp && (
            <img 
              src={data.pfp} 
              alt={data.displayName}
              className="w-10 h-10 rounded-full border-2 border-purple-500"
            />
          )}
          <div>
            <p className="font-bold text-white">{data.displayName}</p>
            <p className="text-purple-400 text-sm">@{data.user}</p>
          </div>
        </div>

        {/* Triptych Display */}
        <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900 p-4 rounded-2xl border border-yellow-500/30">
          <div className="grid grid-cols-3 gap-2">
            {data.nfts.map((nft, i) => (
              <div 
                key={i}
                className="relative aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/10"
              >
                <img 
                  src={nft.image} 
                  alt={nft.name} 
                  className="w-full h-full object-cover"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-2">
                  <p className="font-bold text-white text-[10px] truncate">{nft.name}</p>
                  <p className="text-slate-400 text-[8px] truncate">{nft.collection}</p>
                </div>
                {/* Number badge */}
                <div className="absolute top-2 left-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs">{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Star decoration */}
          <div className="flex justify-center mt-4 gap-1">
            {[...Array(5)].map((_, i) => (
              <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm mb-4">Create your own Top 3</p>
          <a 
            href="/"
            className="inline-block px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
          >
            View Your NFTs
          </a>
        </div>

        {/* Branding */}
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-xs">
            Powered by <span className="text-blue-400">Your Based NFTs</span>
          </p>
        </div>
      </div>
    </main>
  );
}

