import type { Metadata } from 'next';
import TriptychClient from './TriptychClient';

type Props = {
  searchParams: Promise<{ data?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const data = params?.data || '';
  
  const ogImageUrl = data 
    ? `https://fiend-finder.vercel.app/api/og/triptych?data=${data}`
    : 'https://fiend-finder.vercel.app/og-image.png';
  
  let title = 'Top 3 NFTs';
  let description = 'Check out my favorite NFTs!';
  
  if (data) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(data)));
      title = `${decoded.displayName || decoded.user}'s Top 3 NFTs`;
      description = `See @${decoded.user}'s favorite NFT collection`;
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
      'fc:frame:button:1': 'View Collection',
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': 'https://fiend-finder.vercel.app',
    },
  };
}

export default function TriptychPage() {
  return <TriptychClient />;
}
