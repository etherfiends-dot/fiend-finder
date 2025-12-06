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
            <div style={{ color: 'white', fontSize: 48 }}>NFT GIF</div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const gifData = JSON.parse(atob(decodeURIComponent(data)));
    const { images, username } = gifData;

    // Show first few images as a filmstrip style
    const displayImages = images?.slice(0, 4) || [];

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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 30 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#06b6d420',
              padding: '12px 24px',
              borderRadius: 50,
            }}>
              <span style={{ color: '#06b6d4', fontSize: 24, marginRight: 8 }}>🎬</span>
              <span style={{ color: '#06b6d4', fontSize: 24, fontWeight: 'bold' }}>NFT GIF Animation</span>
            </div>
          </div>

          {/* Filmstrip style images */}
          <div style={{ display: 'flex', flex: 1, gap: 16, alignItems: 'center' }}>
            {displayImages.map((image: string, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flex: 1,
                  height: '100%',
                  backgroundColor: '#1e293b',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '4px solid #06b6d4',
                  position: 'relative',
                }}
              >
                <img
                  src={image}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                {/* Frame number */}
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  backgroundColor: '#06b6d4',
                  color: 'black',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 16,
                  fontWeight: 'bold',
                }}>
                  {i + 1}
                </div>
              </div>
            ))}
            {images?.length > 4 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 100,
                height: '100%',
                backgroundColor: '#1e293b',
                borderRadius: 16,
                border: '4px dashed #06b6d4',
              }}>
                <span style={{ color: '#06b6d4', fontSize: 32, fontWeight: 'bold' }}>
                  +{images.length - 4}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 30,
          }}>
            <span style={{ color: '#94a3b8', fontSize: 24 }}>
              Created by @{username || 'user'}
            </span>
            <span style={{ color: '#06b6d4', fontSize: 24 }}>
              {images?.length || 0} frames • Your Based NFTs
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
        }}>
          <div style={{ color: 'white', fontSize: 48 }}>NFT GIF</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}

