import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_URL = 'https://api.pinata.cloud';

// Upload file (image/GIF) to IPFS
export async function POST(request: NextRequest) {
  try {
    const jwt = process.env.PINATA_JWT;
    
    if (!jwt) {
      return NextResponse.json(
        { error: 'Pinata not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Upload the file to Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    const fileResponse = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: pinataFormData,
    });

    if (!fileResponse.ok) {
      const error = await fileResponse.text();
      console.error('Pinata file upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload file to IPFS' },
        { status: 500 }
      );
    }

    const fileResult = await fileResponse.json();
    const imageIpfsHash = fileResult.IpfsHash;
    const imageUri = `ipfs://${imageIpfsHash}`;
    const imageGatewayUrl = `https://gateway.pinata.cloud/ipfs/${imageIpfsHash}`;

    // If metadata is provided, also upload that
    let metadataUri = null;
    let metadataGatewayUrl = null;

    if (metadata) {
      try {
        const parsedMetadata = JSON.parse(metadata);
        // Add the image URI to the metadata
        parsedMetadata.image = imageUri;
        if (parsedMetadata.type === 'gif') {
          parsedMetadata.animation_url = imageUri;
        }

        const metadataResponse = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pinataContent: parsedMetadata,
            pinataMetadata: {
              name: parsedMetadata.name || 'NFT Metadata',
            },
          }),
        });

        if (metadataResponse.ok) {
          const metadataResult = await metadataResponse.json();
          metadataUri = `ipfs://${metadataResult.IpfsHash}`;
          metadataGatewayUrl = `https://gateway.pinata.cloud/ipfs/${metadataResult.IpfsHash}`;
        }
      } catch (e) {
        console.error('Failed to upload metadata:', e);
      }
    }

    return NextResponse.json({
      success: true,
      image: {
        ipfsHash: imageIpfsHash,
        ipfsUri: imageUri,
        gatewayUrl: imageGatewayUrl,
      },
      metadata: metadataUri ? {
        ipfsUri: metadataUri,
        gatewayUrl: metadataGatewayUrl,
      } : null,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

