'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import sdk from '@farcaster/frame-sdk';

type GifData = {
  frames: { image: string; name: string }[];
  speed: number;
  user: string;
  displayName: string;
};

function GifContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<GifData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initSDK = async () => {
      try {
        await sdk.actions.ready();
      } catch {}
    };
    initSDK();
  }, []);

  useEffect(() => {
    const encoded = searchParams.get('data');
    if (!encoded) {
      setError('No GIF data provided');
      return;
    }

    try {
      const decoded = JSON.parse(atob(encoded));
      if (!decoded.frames || decoded.frames.length < 2) {
        setError('Invalid GIF data');
        return;
      }
      setData(decoded);
    } catch {
      setError('Failed to decode GIF data');
    }
  }, [searchParams]);

  // Animation loop
  useEffect(() => {
    if (data && data.frames.length >= 2) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % data.frames.length);
      }, data.speed || 500);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [data]);

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
        <span className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full"></span>
      </div>
    );
  }

  const currentNft = data.frames[currentFrame];

  return (
    <main className="bg-slate-950 min-h-screen text-white p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-4 pt-4">
          <h1 className="text-xl font-black tracking-tighter text-cyan-400">
            NFT GIF
          </h1>
        </div>

        {/* Creator Info */}
        <div className="text-center mb-4">
          <p className="text-slate-400 text-sm">
            Created by <span className="text-white font-medium">{data.displayName}</span>
            <span className="text-purple-400"> @{data.user}</span>
          </p>
        </div>

        {/* GIF Display */}
        <div className="bg-black rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
          <div className="relative aspect-square">
            <img 
              src={currentNft.image} 
              alt={currentNft.name} 
              className="w-full h-full object-contain"
            />
            {/* Frame indicator */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
              <span className="text-cyan-400 text-sm font-mono">
                {currentFrame + 1}/{data.frames.length}
              </span>
            </div>
            {/* GIF badge */}
            <div className="absolute top-3 left-3 bg-cyan-500 rounded-md px-2 py-1">
              <span className="text-black text-xs font-bold">GIF</span>
            </div>
          </div>
          
          {/* Frame dots */}
          <div className="bg-slate-900 p-3 flex justify-center gap-2">
            {data.frames.map((_, i) => (
              <div 
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentFrame ? 'bg-cyan-500 scale-125' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* NFT name */}
        <div className="mt-4 text-center">
          <p className="text-white font-medium">{currentNft.name}</p>
          <p className="text-slate-500 text-sm">{data.frames.length} frames • {data.speed}ms</p>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm mb-4">Create your own NFT GIF</p>
          <a 
            href="/"
            className="inline-block px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-medium transition-colors"
          >
            Make a GIF
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

function GifLoading() {
  return (
    <div className="bg-slate-950 min-h-screen text-white flex items-center justify-center">
      <span className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full"></span>
    </div>
  );
}

export default function GifPage() {
  return (
    <Suspense fallback={<GifLoading />}>
      <GifContent />
    </Suspense>
  );
}

