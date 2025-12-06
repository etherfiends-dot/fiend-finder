'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import sdk from '@farcaster/miniapp-sdk';

type MemeData = {
  image: string;
  name: string;
  topText: string;
  bottomText: string;
  username: string;
  displayName: string;
};

function MemeContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MemeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSDK = async () => {
      try { await sdk.actions.ready(); } catch {}
    };
    initSDK();
  }, []);

  useEffect(() => {
    const encoded = searchParams.get('data');
    if (!encoded) { setError('No meme data provided'); return; }
    try {
      const decoded = JSON.parse(atob(encoded));
      if (!decoded.image) { setError('Invalid meme data'); return; }
      setData(decoded);
    } catch { setError('Failed to decode meme data'); }
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
        <span className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></span>
      </div>
    );
  }

  return (
    <main className="bg-slate-950 min-h-screen text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-4 pt-4">
          <h1 className="text-xl font-black tracking-tighter text-pink-400">NFT Meme</h1>
        </div>
        <div className="text-center mb-4">
          <p className="text-slate-400 text-sm">
            Created by <span className="text-white font-medium">{data.displayName}</span>
            <span className="text-purple-400"> @{data.username}</span>
          </p>
        </div>
        <div className="bg-black rounded-2xl overflow-hidden border border-pink-500/30 shadow-lg shadow-pink-500/10">
          <div className="relative aspect-square">
            <img src={data.image} alt={data.name} className="w-full h-full object-contain" />
            {data.topText && (
              <div className="absolute top-4 left-0 right-0 text-center">
                <span 
                  className="text-white text-3xl sm:text-4xl font-black uppercase px-4"
                  style={{ 
                    textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000',
                    fontFamily: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif'
                  }}
                >
                  {data.topText}
                </span>
              </div>
            )}
            {data.bottomText && (
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span 
                  className="text-white text-3xl sm:text-4xl font-black uppercase px-4"
                  style={{ 
                    textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000',
                    fontFamily: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif'
                  }}
                >
                  {data.bottomText}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-slate-500 text-xs">{data.name}</p>
        </div>
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm mb-4">Create your own NFT memes</p>
          <a href="/" className="inline-block px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-medium transition-colors">Make a Meme</a>
        </div>
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-xs">Powered by <span className="text-blue-400">Your Based NFTs</span></p>
        </div>
      </div>
    </main>
  );
}

export default function MemeClient() {
  return (
    <Suspense fallback={
      <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center">
        <span className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></span>
      </div>
    }>
      <MemeContent />
    </Suspense>
  );
}

