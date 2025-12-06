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
            <div style={{ color: 'white', fontSize: 48 }}>Top 3 NFTs</div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const triptychData = JSON.parse(atob(decodeURIComponent(data)));
    const { user, displayName, pfp, nfts } = triptychData;
    const username = user;

    // Extract individual NFTs (can't use .map in @vercel/og)
    const nft1 = nfts?.[0] || { image: '', name: 'NFT 1', collection: '' };
    const nft2 = nfts?.[1] || { image: '', name: 'NFT 2', collection: '' };
    const nft3 = nfts?.[2] || { image: '', name: 'NFT 3', collection: '' };

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            padding: 40,
          }}
        >
          {/* Header with user info */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            {pfp && (
              <img
                src={pfp}
                width={56}
                height={56}
                style={{
                  borderRadius: 28,
                  marginRight: 16,
                  border: '3px solid #a855f7',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'white', fontSize: 26, fontWeight: 'bold' }}>
                {displayName || username}&apos;s Top 3
              </span>
              <span style={{ color: '#a855f7', fontSize: 18 }}>@{username}</span>
            </div>
            <div style={{
              display: 'flex',
              marginLeft: 'auto',
              alignItems: 'center',
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              padding: '10px 20px',
              borderRadius: 50,
            }}>
              <span style={{ color: '#a855f7', fontSize: 22 }}>⭐ Top 3 NFTs</span>
            </div>
          </div>

          {/* NFT Triptych - 3 cards side by side */}
          <div style={{ display: 'flex', flex: 1, gap: 20 }}>
            {/* NFT 1 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                backgroundColor: '#1e293b',
                borderRadius: 20,
                overflow: 'hidden',
                border: '2px solid #334155',
                position: 'relative',
              }}
            >
              {nft1.image && (
                <img
                  src={nft1.image}
                  width={350}
                  height={320}
                  style={{ objectFit: 'cover' }}
                />
              )}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 14,
                backgroundColor: '#0f172a',
              }}>
                <span style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                  {(nft1.name || 'NFT').slice(0, 20)}
                </span>
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {(nft1.collection || '').slice(0, 25)}
                </span>
              </div>
              {/* Rank badge */}
              <div style={{
                position: 'absolute',
                top: 12,
                left: 12,
                backgroundColor: '#fbbf24',
                color: 'black',
                padding: '6px 14px',
                borderRadius: 16,
                fontSize: 14,
                fontWeight: 'bold',
              }}>
                #1
              </div>
            </div>

            {/* NFT 2 (Featured - slightly larger) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1.1,
                backgroundColor: '#1e293b',
                borderRadius: 20,
                overflow: 'hidden',
                border: '3px solid #a855f7',
                position: 'relative',
              }}
            >
              {nft2.image && (
                <img
                  src={nft2.image}
                  width={380}
                  height={340}
                  style={{ objectFit: 'cover' }}
                />
              )}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 14,
                backgroundColor: '#0f172a',
              }}>
                <span style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                  {(nft2.name || 'NFT').slice(0, 20)}
                </span>
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {(nft2.collection || '').slice(0, 25)}
                </span>
              </div>
              {/* Rank badge */}
              <div style={{
                position: 'absolute',
                top: 12,
                left: 12,
                backgroundColor: '#a855f7',
                color: 'white',
                padding: '6px 14px',
                borderRadius: 16,
                fontSize: 14,
                fontWeight: 'bold',
              }}>
                #2
              </div>
            </div>

            {/* NFT 3 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                backgroundColor: '#1e293b',
                borderRadius: 20,
                overflow: 'hidden',
                border: '2px solid #334155',
                position: 'relative',
              }}
            >
              {nft3.image && (
                <img
                  src={nft3.image}
                  width={350}
                  height={320}
                  style={{ objectFit: 'cover' }}
                />
              )}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 14,
                backgroundColor: '#0f172a',
              }}>
                <span style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                  {(nft3.name || 'NFT').slice(0, 20)}
                </span>
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {(nft3.collection || '').slice(0, 25)}
                </span>
              </div>
              {/* Rank badge */}
              <div style={{
                position: 'absolute',
                top: 12,
                left: 12,
                backgroundColor: '#6b7280',
                color: 'white',
                padding: '6px 14px',
                borderRadius: 16,
                fontSize: 14,
                fontWeight: 'bold',
              }}>
                #3
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 20,
          }}>
            <span style={{ color: '#64748b', fontSize: 18 }}>
              Your Based NFTs • fiend-finder.vercel.app
            </span>
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
          flexDirection: 'column',
        }}>
          <div style={{ color: 'white', fontSize: 48, marginBottom: 16 }}>Top 3 NFTs</div>
          <div style={{ color: '#64748b', fontSize: 24 }}>fiend-finder.vercel.app</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
