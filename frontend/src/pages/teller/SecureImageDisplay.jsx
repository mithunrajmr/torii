// frontend/src/pages/teller/SecureImageDisplay.jsx
import React, { useState, useEffect } from 'react';
import { FileImage, Lock, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

// Re-use the same token helper as Dashboard — reads from localStorage.
// The token is written there by Dashboard's getTellerToken() on first render,
// so by the time SecureImageDisplay mounts it will already be available.
function getTellerAuthHeader() {
  const token = localStorage.getItem('teller_jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SecureImageDisplay({ ticketId }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticketId) return;

    const fetchSignedUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/teller/media/${ticketId}`, {
          headers: getTellerAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to obtain signed URL');
        const data = await res.json();
        setImageUrl(data.signed_url);
      } catch (err) {
        setError('Unable to load document image. Signed URL expired or unauthorized.');
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
    setZoom(1);
  }, [ticketId]);

  return (
    <div className="neo-card p-6 flex flex-col justify-between">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <FileImage className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Uploaded Document Image</h3>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))}
            className="p-2 neo-button text-slate-600 hover:text-slate-800"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-500 font-bold w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-2 neo-button text-slate-600 hover:text-slate-800"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Display Well */}
      <div className="neo-inset p-4 rounded-2xl flex-1 flex items-center justify-center overflow-hidden min-h-[320px] relative">
        {loading ? (
          <div className="text-center space-y-2">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Generating 5-min Signed Supabase URL...</p>
          </div>
        ) : error ? (
          <div className="text-center text-red-600 space-y-2 p-4">
            <Lock className="w-8 h-8 mx-auto" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : (
          <div
            className="transition-transform duration-200 ease-out max-w-full max-h-full"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={imageUrl}
              alt="Uploaded PAN Card Document"
              className="rounded-xl shadow-md max-h-[360px] object-contain border border-slate-300"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center space-x-1">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Protected via Supabase Private Bucket</span>
        </span>
        <span className="font-mono text-[10px]">URL TTL: 300s</span>
      </div>
    </div>
  );
}
