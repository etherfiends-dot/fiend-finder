import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Top 3 NFTs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ searchParams }: { searchParams: { data?: string } }) {
  const data = searchParams.data;
  
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

  try {
    const triptychData = JSON.parse(atob(decodeURIComponent(data)));
    const { username, displayName, pfp, nfts } = triptychData;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            padding: 50,
          }}
        >
          {/* Header with user info */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 30 }}>
            {pfp && (
              <img
                src={pfp}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  marginRight: 16,
                  border: '3px solid #a855f7',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>
                {displayName || username}'s Top 3
              </span>
              <span style={{ color: '#a855f7', fontSize: 20 }}>@{username}</span>
            </div>
            <div style={{
              display: 'flex',
              marginLeft: 'auto',
              alignItems: 'center',
              backgroundColor: '#a855f720',
              padding: '12px 24px',
              borderRadius: 50,
            }}>
              <span style={{ color: '#a855f7', fontSize: 24 }}>⭐ Top 3 NFTs</span>
            </div>
          </div>

          {/* NFT Triptych */}
          <div style={{ display: 'flex', flex: 1, gap: 24, alignItems: 'stretch' }}>
            {nfts?.slice(0, 3).map((nft: { image: string; name: string; collection: string }, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  backgroundColor: '#1e293b',
                  borderRadius: 24,
                  overflow: 'hidden',
                  border: i === 1 ? '4px solid #a855f7' : '2px solid #334155',
                }}
              >
                <img
                  src={nft.image}
                  style={{
                    width: '100%',
                    height: 340,
                    objectFit: 'cover',
                  }}
                />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 16,
                  backgroundColor: '#0f172a',
                }}>
                  <span style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                    {nft.name?.slice(0, 25) || 'NFT'}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 14 }}>
                    {nft.collection?.slice(0, 30) || ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 24,
          }}>
            <span style={{ color: '#64748b', fontSize: 20 }}>
              Your Based NFTs • fiend-finder.vercel.app
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
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
}

