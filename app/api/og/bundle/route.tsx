import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const data = searchParams.get('data');
    
    if (!data) {
      return new ImageResponse(
        (
          <div style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#0f172a',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ color: 'white', fontSize: 48 }}>NFT Bundle</div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const bundleData = JSON.parse(atob(decodeURIComponent(data)));
    const { seller, price, currency, nfts } = bundleData;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#0f172a',
            padding: 60,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#22c55e20',
              padding: '12px 24px',
              borderRadius: 50,
            }}>
              <span style={{ color: '#22c55e', fontSize: 24, marginRight: 8 }}>🛍️</span>
              <span style={{ color: '#22c55e', fontSize: 24, fontWeight: 'bold' }}>NFT Bundle for Sale</span>
            </div>
          </div>

          {/* NFT Grid */}
          <div style={{ display: 'flex', flex: 1, gap: 20 }}>
            {nfts.slice(0, 5).map((nft: { image: string; name: string }, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  backgroundColor: '#1e293b',
                  borderRadius: 20,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={nft.image}
                  style={{
                    width: '100%',
                    height: 280,
                    objectFit: 'cover',
                  }}
                />
                <div style={{
                  display: 'flex',
                  padding: 16,
                  color: 'white',
                  fontSize: 18,
                }}>
                  {nft.name.slice(0, 20)}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 40,
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: 24 }}>by @{seller}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#22c55e',
              padding: '16px 32px',
              borderRadius: 16,
            }}>
              <span style={{ color: 'white', fontSize: 36, fontWeight: 'bold' }}>
                {currency === 'USDC' ? '$' : ''}{price} {currency || 'ETH'}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error('OG Image error:', e);
    return new ImageResponse(
      (
        <div style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ color: 'white', fontSize: 48 }}>NFT Bundle</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}

