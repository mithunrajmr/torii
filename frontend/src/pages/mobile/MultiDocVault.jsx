// frontend/src/pages/mobile/MultiDocVault.jsx
import React, { useRef } from 'react';
import { Camera, RefreshCw, CheckCircle2, FileText, Upload } from 'lucide-react';

export default function MultiDocVault({ slots = [], files = {}, onFileChange }) {
  const inputRefs = useRef({});

  const handleSelect = (slotId, e) => {
    const file = e.target.files?.[0];
    if (file && onFileChange) {
      onFileChange(slotId, file);
    }
  };

  return (
    <div className="space-y-4" data-testid="multi-doc-vault">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Required Document Packages</h3>
        <span className="text-[10px] text-cyan-400 font-mono">
          {Object.keys(files).length} / {slots.length} Attached
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {slots.map((slot) => {
          const selectedFile = files[slot.id];
          const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;

          return (
            <div
              key={slot.id}
              onClick={() => inputRefs.current[slot.id]?.click()}
              className={`border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between ${
                selectedFile
                  ? 'border-blue-500 bg-slate-800/80'
                  : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
              }`}
            >
              <input
                ref={(el) => (inputRefs.current[slot.id] = el)}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleSelect(slot.id, e)}
              />

              <div className="flex items-center space-x-3 min-w-0">
                {previewUrl ? (
                  <img src={previewUrl} alt={slot.label} className="w-12 h-12 rounded-xl object-cover border border-slate-600" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-700/50 text-slate-400 flex items-center justify-center shrink-0">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-100 truncate">{slot.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {slot.required ? 'Mandatory Field' : 'Optional Upload'}
                  </p>
                </div>
              </div>

              <div>
                {selectedFile ? (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Attached</span>
                  </span>
                ) : (
                  <span className="text-xs text-blue-400 font-semibold flex items-center space-x-1 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
