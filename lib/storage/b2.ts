import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// The only module that knows about the storage vendor (Backblaze B2 via its S3 API). Swapping to
// R2 or Supabase Storage later should touch this file only. The bucket is private and never
// listed: the attachments table is the index.

const PUT_TTL_SECONDS = 5 * 60;
const GET_TTL_SECONDS = 10 * 60;

type storageConfig = { client: S3Client; bucket: string };
let cached: storageConfig | undefined;

function config(): storageConfig {
    if (cached) return cached;
    const { B2_ENDPOINT, B2_REGION, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET } = process.env;
    const missing = Object.entries({ B2_ENDPOINT, B2_REGION, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET })
        .filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw new Error(`Storage is not configured: missing ${missing.join(", ")} (see .env.local).`);
    cached = {
        bucket: B2_BUCKET!,
        client: new S3Client({
            endpoint: B2_ENDPOINT,
            region: B2_REGION,
            credentials: { accessKeyId: B2_KEY_ID!, secretAccessKey: B2_APPLICATION_KEY! },
            // B2 does not accept the SDK's default CRC32 checksum headers.
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED",
        }),
    };
    return cached;
}

// The browser must send exactly this content type and length, or the signature fails.
export async function presignPut({ key, contentType, contentLength }: { key: string; contentType: string; contentLength: number }): Promise<string> {
    const { client, bucket } = config();
    const headers = new Set(["content-type", "content-length"]);
    return getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
        { expiresIn: PUT_TTL_SECONDS, signableHeaders: headers, unhoistableHeaders: headers },
    );
}

// Content type and inline disposition come from the DB row, never from what B2 stored.
export async function presignGet({ key, contentType, fileName }: { key: string; contentType: string; fileName: string }): Promise<string> {
    const { client, bucket } = config();
    const safeName = fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
    return getSignedUrl(
        client,
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ResponseContentType: contentType,
            ResponseContentDisposition: `inline; filename="${safeName}"`,
        }),
        { expiresIn: GET_TTL_SECONDS },
    );
}

// Null when the object does not exist.
export async function head(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
    const { client, bucket } = config();
    try {
        const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (e) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return null;
        throw e;
    }
}

export async function remove(key: string): Promise<void> {
    const { client, bucket } = config();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
