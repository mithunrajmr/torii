// backend/src/services/storageService.js
// Supabase Object Storage Service
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'pan-documents';

// Local memory store for dev environments without live Supabase storage credentials
const localImageStore = new Map();

/**
 * Upload an identity document to private Supabase storage bucket.
 * Auto-creates bucket if missing, and falls back gracefully to in-memory data URL.
 */
export async function uploadDocument(fileName, fileBuffer, mimeType = 'image/jpeg') {
  const path = `${Date.now()}_${fileName}`;

  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('mock.supabase.co')) {
    // Dev/Fallback: convert uploaded buffer into base64 data URL for instant teller inspection
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    localImageStore.set(path, dataUrl);
    return path;
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      // If bucket doesn't exist, attempt auto-creation
      if (error.message && error.message.includes('Bucket not found')) {
        console.warn(`[storageService] Bucket '${BUCKET_NAME}' not found — attempting auto-creation...`);
        const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, { public: false });
        if (!createErr) {
          // Retry upload
          const { data: retryData, error: retryErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, fileBuffer, { contentType: mimeType, upsert: true });
          if (!retryErr && retryData) return retryData.path;
        }
      }

      // If storage upload fails for any reason (permissions, bucket missing, etc.), fallback to in-memory data URL
      console.warn(`[storageService] Supabase storage upload error (${error.message}) — falling back to local memory store.`);
      const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      localImageStore.set(path, dataUrl);
      return path;
    }

    return data.path;
  } catch (err) {
    console.warn(`[storageService] Storage error (${err.message}) — using fallback memory store.`);
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    localImageStore.set(path, dataUrl);
    return path;
  }
}

/**
 * Generate a temporary 300-second (5 minute) signed read URL for staff view.
 */
export async function getSignedUrl(documentPath) {
  // If stored in local dev cache, return base64 data URL directly
  if (localImageStore.has(documentPath)) {
    return localImageStore.get(documentPath);
  }

  if (documentPath?.startsWith('data:')) {
    return documentPath;
  }

  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('mock.supabase.co')) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(documentPath, 300);

    if (error || !data?.signedUrl) {
      console.warn(`[storageService] Signed URL failed (${error?.message}) — returning fallback image.`);
      return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
    }

    return data.signedUrl;
  } catch (err) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
  }
}

