import { NextRequest, NextResponse } from 'next/server'
import { resolveUploadDescriptorByMime } from '@/constants/uploadFileTypes'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')
    const requestedFilename = searchParams.get('filename')?.trim() || ''

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    try {
        // Validate URL to prevent SSRF attacks
        const parsedUrl = new URL(url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid URL protocol')
        }

        // Fetch the file from the original URL
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'UoLink-Download-Service/1.0',
                'Accept': [
                    'application/pdf',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/octet-stream',
                    '*/*'
                ].join(','),
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`)
        }

        // Get the file content
        const fileBuffer = await response.arrayBuffer()

        // Determine content type
        const contentTypeHeader = response.headers.get('content-type') || 'application/octet-stream'
        const normalizedContentType = contentTypeHeader.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream'
        const descriptor = resolveUploadDescriptorByMime(normalizedContentType)
        const fallbackExtension = descriptor?.extension || 'bin'
        const hasExtension = requestedFilename.includes('.')
        const safeFilename = requestedFilename
            ? hasExtension
                ? requestedFilename
                : `${requestedFilename}.${fallbackExtension}`
            : `document.${fallbackExtension}`

        // Create response with proper download headers
        const downloadResponse = new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentTypeHeader,
                'Content-Disposition': `attachment; filename="${safeFilename}"`,
                'Content-Length': fileBuffer.byteLength.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        })

        return downloadResponse

    } catch (error) {
        console.error('Download proxy error:', error)
        return NextResponse.json(
            { error: 'Failed to download file', details: error instanceof Error ? error.message : 'Unknown error' },
            {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            }
        )
    }
}

// Handle preflight requests
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
