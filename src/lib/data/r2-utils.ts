import { buildR2PublicUrlFromBase, deriveR2ObjectKey, isR2LikeHost } from "../r2-shared";

export const resolveNoteFileMetadata = (data: any) => {
    const originalUrl = typeof data.fileUrl === 'string' ? data.fileUrl : undefined;
    const storedProvider = typeof data.storageProvider === 'string' ? data.storageProvider : undefined;
    const bucketName =
        typeof data.storageBucket === 'string'
            ? data.storageBucket
            : (process.env.CLOUDFLARE_R2_BUCKET_NAME || undefined);

    const isLikelyR2 =
        storedProvider === 'cloudflare-r2' ||
        (originalUrl ? (() => {
            try {
                return isR2LikeHost(new URL(originalUrl).hostname.toLowerCase());
            } catch {
                return false;
            }
        })() : false);

    let storageKey =
        typeof data.storageKey === 'string' && data.storageKey.trim()
            ? data.storageKey.trim()
            : undefined;

    if (!storageKey && originalUrl) {
        storageKey = deriveR2ObjectKey(originalUrl, bucketName) || undefined;
    }

    const r2PublicBaseUrl = (
        process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
        process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
        ''
    ).trim();

    let resolvedUrl = originalUrl;

    if (isLikelyR2 && storageKey && r2PublicBaseUrl) {
        try {
            resolvedUrl = buildR2PublicUrlFromBase({
                baseUrl: r2PublicBaseUrl,
                objectKey: storageKey,
            });
        } catch {
            // If construction fails, fall back to whatever we already have
        }
    }

    return {
        resolvedUrl,
        storageKey,
        storageProvider: isLikelyR2 ? 'cloudflare-r2' : storedProvider,
        storageBucket: bucketName ?? data.storageBucket,
    };
};