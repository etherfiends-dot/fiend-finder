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
            <div style={{ color: 'white', fontSize: 48 }}>NFT Meme</div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const memeData = JSON.parse(atob(decodeURIComponent(data)));
    const { image, topText, bottomText, username } = memeData;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#0f172a',
            position: 'relative',
          }}
        >
          {/* NFT Image - Full background */}
          <img
            src={image}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
          
          {/* Top text */}
          {topText && (
            <div style={{
              position: 'absolute',
              top: 40,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}>
              <span style={{
                color: 'white',
                fontSize: 64,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                textShadow: '4px 4px 0 black, -4px -4px 0 black, 4px -4px 0 black, -4px 4px 0 black',
                textAlign: 'center',
                maxWidth: '90%',
              }}>
                {topText}
              </span>
            </div>
          )}

          {/* Bottom text */}
          {bottomText && (
            <div style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}>
              <span style={{
                color: 'white',
                fontSize: 64,
                fontWeight: 'bold',
                textTransform: 'uppercase',
                textShadow: '4px 4px 0 black, -4px -4px 0 black, 4px -4px 0 black, -4px 4px 0 black',
                textAlign: 'center',
                maxWidth: '90%',
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
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '8px 16px',
            borderRadius: 20,
          }}>
            <span style={{ color: '#ec4899', fontSize: 16 }}>
              @{username || 'user'} • Your Based NFTs
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
          <div style={{ color: 'white', fontSize: 48 }}>NFT Meme</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}

