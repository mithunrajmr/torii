import React, { useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Upload, AlertCircle, RefreshCw, ShieldCheck, CheckCircle } from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';
import DynamicServiceForm from './DynamicServiceForm.jsx';

export default function DocumentUpload() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceType = searchParams.get('service_type');

  if (serviceType) {
    return <DynamicServiceForm token={token} serviceType={serviceType} />;
  }

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG or PNG).');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('qr_token', token);

    try {
      const res = await fetch('/api/mobile/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'RETAKE_IMAGE') {
          const nextRetries = retryCount + 1;
          setRetryCount(nextRetries);
          if (nextRetries >= 3) {
            setError('Verification limit reached. Document routed to bank teller for manual review.');
            if (data.ticket_id) {
              setTimeout(() => {
                navigate(`/mobile/${token}/status`, { state: { ticketId: data.ticket_id } });
              }, 2500);
            }
          } else {
            const reasonMsg = data.message || `Document unreadable or defaced (${data.confidence ? (data.confidence * 100).toFixed(0) : 0}% clarity).`;
            setError(`${reasonMsg} (Attempt ${nextRetries}/3)`);
            setSelectedFile(null);
            setPreviewUrl(null);
          }
        } else if (data.error === 'MISMATCH_ERROR') {
          setError(data.message || 'Name on document does not match account records. Please present ID to a bank teller.');
        } else if (data.error === 'ERR_INVALID_OR_EXPIRED_QR_TOKEN') {
          setError(data.message || 'Your upload session has expired. Please scan a fresh QR code from the Kiosk screen.');
        } else {
          setError(data.message || 'Upload failed. Please try again.');
        }
        return;
      }

      // Success
      navigate(`/mobile/${token}/status`, {
        state: {
          ticketId: data.ticket_id,
          crossSell: data.cross_sell_offer,
          status: data.status,
        },
      });
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 flex flex-col justify-between">
      
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <ToriiLogo variant="icon" size="sm" />
          <div>
            <h1 className="text-base font-extrabold text-white">Torii Secure Mobile</h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Legacy Behind. Resolution Ahead.</p>
          </div>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-mono">
          PAN Handoff
        </span>
      </div>

      {/* Main Upload Content */}
      <div className="my-auto py-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">Upload Document</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Please capture or upload a clear photo of your original PAN card for AI extraction.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl text-xs flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Viewfinder / Capture Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] ${
            previewUrl
              ? 'border-blue-500 bg-slate-800/50'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-slate-700">
              <img src={previewUrl} alt="PAN preview" className="w-full h-auto object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-xs font-bold text-white bg-slate-900/80 px-3 py-1.5 rounded-full flex items-center space-x-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tap to retake</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Tap to capture or upload PAN image</p>
                <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG up to 10MB</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="py-4 border-t border-slate-800">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center space-x-2 ${
            selectedFile && !uploading
              ? 'bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-lg shadow-blue-600/30'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {uploading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Analyzing Document...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span>Submit for Verification</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
