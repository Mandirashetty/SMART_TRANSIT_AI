import React, { useState } from 'react';
import { PhoneCall, ShieldAlert, X } from 'lucide-react';
import { TransitNode } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  nodes: TransitNode[];
  onSubmitSos: (payload: {
    emergency_number: string;
    location_node_id: string;
    notes: string;
    phone: string;
  }) => Promise<void>;
}

const HELPLINES = [
  { num: '112', label: 'National Emergency' },
  { num: '100', label: 'Police Control' },
  { num: '108', label: 'Ambulance / Medical' },
  { num: '1098', label: 'Childline India' },
  { num: '1091', label: 'Women Helpline' },
];

export const SosModal: React.FC<Props> = ({ open, onClose, nodes, onSubmitSos }) => {
  const [selectedNum, setSelectedNum] = useState('112');
  const [locationId, setLocationId] = useState('V6');
  const [phone, setPhone] = useState('+91 98451 10001');
  const [notes, setNotes] = useState('Student stranded / urgent transit safety assistance requested.');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmitSos({
        emergency_number: selectedNum,
        location_node_id: locationId,
        notes,
        phone,
      });
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between bg-red-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="text-base font-bold">Emergency SOS — Indian Safety Helplines</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-red-700 cursor-pointer" aria-label="Close SOS modal">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {HELPLINES.map((h) => (
              <button
                key={h.num}
                type="button"
                onClick={() => setSelectedNum(h.num)}
                className={`rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                  selectedNum === h.num
                    ? 'border-red-600 bg-red-50 text-red-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-base font-bold text-red-700">
                  <PhoneCall className="h-3.5 w-3.5" />
                  {h.num}
                </div>
                <div className="text-[11px] font-medium text-slate-600">{h.label}</div>
              </button>
            ))}
          </div>

          {submitted ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-2">
              <div className="font-bold">SOS Report Saved &amp; Dispatched to Admin Dashboard</div>
              <p>
                Emergency alert for helpline <strong>{selectedNum}</strong> at location{' '}
                <strong>{locationId}</strong> is now active in the Transport Authority &amp; Admin SOS console.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  onClose();
                }}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nearest Stop / Village</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id} · {n.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Callback Phone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Incident Details</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
              >
                {saving ? 'Logging SOS Alert...' : `Log SOS Incident (${selectedNum}) to Admin Dashboard`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
