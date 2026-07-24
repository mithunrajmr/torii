// backend/src/services/storageService.js
// Supabase Object Storage Service
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'pan-documents';

/**
 * Upload an identity document to private Supabase storage bucket.
 */
export async function uploadDocument(fileName, fileBuffer, mimeType = 'image/jpeg') {
  if (process.env.NODE_ENV === 'test' || !process.env.SUPABASE_URL) {
    // Mock storage path for tests / dev fallback
    return `pan-documents/mock_${Date.now()}_${fileName}`;
  }

  const path = `${Date.now()}_${fileName}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return data.path;
}

/**
 * Generate a temporary 300-second (5 minute) signed read URL for staff view.
 */
export async function getSignedUrl(documentPath) {
  if (process.env.NODE_ENV === 'test' || !process.env.SUPABASE_URL) {
    // Return sample image for demo / testing
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(documentPath, 300);

  if (error) {
    throw new Error(`Signed URL generation failed: ${error.message}`);
  }

  return data.signedUrl;
}
