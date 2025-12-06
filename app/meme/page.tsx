import type { Metadata } from 'next';
import MemeClient from './MemeClient';

type Props = {
  searchParams: Promise<{ data?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const data = params?.data || '';
  
  const ogImageUrl = data 
    ? `https://fiend-finder.vercel.app/api/og/meme?data=${data}`
    : 'https://fiend-finder.vercel.app/og-image.png';
  
  let title = 'NFT Meme';
  let description = 'Check out this NFT meme!';
  
  if (data) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(data)));
      title = 'NFT Meme';
      description = `NFT meme by @${decoded.username}`;
    } catch {}
  }
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    other: {
      'fc:frame': 'vNext',
      'fc:frame:image': ogImageUrl,
      'fc:frame:button:1': 'Make Your Own',
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': 'https://fiend-finder.vercel.app',
    },
  };
}

export default function MemePage() {
  return <MemeClient />;
}
