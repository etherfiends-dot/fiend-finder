import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NFT Meme';
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
          <div style={{ color: 'white', fontSize: 48 }}>NFT Meme</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  try {
    const memeData = JSON.parse(atob(decodeURIComponent(data)));
    const { image, topText, bottomText, username } = memeData;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* NFT Image */}
          <img
            src={image}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
          
          {/* Top text */}
          {topText && (
            <div style={{
              position: 'absolute',
              top: 30,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: '0 20px',
            }}>
              <span style={{
                color: 'white',
                fontSize: 56,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                textAlign: 'center',
                textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000',
              }}>
                {topText}
              </span>
            </div>
          )}

          {/* Bottom text */}
          {bottomText && (
            <div style={{
              position: 'absolute',
              bottom: 30,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: '0 20px',
            }}>
              <span style={{
                color: 'white',
                fontSize: 56,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                textAlign: 'center',
                textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000',
              }}>
                {bottomText}
              </span>
            </div>
          )}

          {/* Watermark */}
          <div style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '6px 12px',
            borderRadius: 16,
          }}>
            <span style={{ color: '#ec4899', fontSize: 14 }}>
              @{username || 'user'} • Your Based NFTs
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
          <div style={{ color: 'white', fontSize: 48 }}>NFT Meme</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}

