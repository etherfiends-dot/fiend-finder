import type { Metadata } from 'next';

// Force dynamic rendering to access searchParams
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ data?: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const data = searchParams?.data || '';
  
  const ogImageUrl = data 
    ? `https://fiend-finder.vercel.app/api/og/bundle?data=${data}`
    : 'https://fiend-finder.vercel.app/og-image.png';
  
  let title = 'NFT Bundle for Sale';
  let description = 'Check out this NFT bundle!';
  
  // Try to decode data for better metadata
  if (data) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(data)));
      const nftCount = decoded.nfts?.length || 0;
      const price = decoded.price || '?';
      const currency = decoded.currency || 'ETH';
      title = `${nftCount} NFT Bundle for ${currency === 'USDC' ? '$' : ''}${price} ${currency}`;
      description = `Buy this bundle of ${nftCount} NFTs from @${decoded.seller}`;
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
      'fc:frame:button:1': 'View Bundle',
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': 'https://fiend-finder.vercel.app',
    },
  };
}

export default function BundleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

