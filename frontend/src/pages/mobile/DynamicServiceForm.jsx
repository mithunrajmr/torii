// frontend/src/pages/mobile/DynamicServiceForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';
import MultiDocVault from './MultiDocVault.jsx';
import DigitalSignaturePad from '../../components/DigitalSignaturePad.jsx';

export default function DynamicServiceForm({ token, serviceType = 'FULL_KYC' }) {
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [files, setFiles] = useState({});
  const [signatureData, setSignatureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/services/config/${serviceType}`);
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      } catch (err) {
        console.warn('Failed to load service config:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceType]);

  const handleInputChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = (slotId, file) => {
    setFiles((prev) => ({ ...prev, [slotId]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // Validate signature if required
    if (config?.requiresSignature && !signatureData) {
      setError('Please provide your digital signature before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = new FormData();
    payload.append('qr_token', token);
    payload.append('service_type', serviceType);
    payload.append('form_data', JSON.stringify(formData));
    if (signatureData) {
      payload.append('signature', signatureData);
    }

    Object.entries(files).forEach(([slotId, file]) => {
      payload.append(slotId, file);
    });

    try {
      const res = await fetch('/api/services/submit', {
        method: 'POST',
        body: payload,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Submission failed. Please try again.');
        return;
      }

      navigate(`/mobile/${token}/status`, {
        state: {
          ticketId: data.service_request_id || data.ticket_id,
          status: data.status,
          serviceType,
        },
      });
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400">Loading branch application form...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 flex flex-col justify-between" data-testid="dynamic-service-form">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <ToriiLogo variant="icon" size="sm" />
          <div>
            <h1 className="text-base font-extrabold text-white">{config?.title || 'Branch Service Form'}</h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Secure Mobile Workflow</p>
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <form onSubmit={handleSubmit} className="my-auto py-6 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-extrabold text-white">{config?.title}</h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">{config?.description}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-2xl text-xs flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Dynamic Form Fields */}
        {config?.formFields?.length > 0 && (
          <div className="space-y-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Application Information</h3>
            {config.formFields.map((field) => (
              <div key={field.id} className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-300 flex justify-between">
                  <span>{field.label}</span>
                  {field.required && <span className="text-red-400 text-[10px]">*Required</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    value={formData[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    required={field.required}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-white outline-none focus:border-blue-500"
                  >
                    <option value="">Select option...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center space-x-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(formData[field.id])}
                      onChange={(e) => handleInputChange(field.id, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-300">{field.label}</span>
                  </label>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    pattern={field.pattern}
                    required={field.required}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-medium text-white outline-none focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Multi-Doc Upload Package */}
        {config?.documentSlots?.length > 0 && (
          <MultiDocVault
            slots={config.documentSlots}
            files={files}
            onFileChange={handleFileChange}
          />
        )}

        {/* Digital Signature Canvas Pad */}
        {config?.requiresSignature && (
          <DigitalSignaturePad
            onSave={(sigData) => setSignatureData(sigData)}
            initialName={formData.full_name || ''}
          />
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-base rounded-2xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Submitting Application...</span>
            </>
          ) : (
            <>
              <span>Complete & Submit Application</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
