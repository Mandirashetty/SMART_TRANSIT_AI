import React, { useState } from 'react';
import { Car, Check, CheckCircle2, MapPin, Plus, X } from 'lucide-react';
import { ParentRideRequest, ParentVehicle, TransitNode, User } from '../types';

interface Props {
  heading: string;
  vehicles: ParentVehicle[];
  requests: ParentRideRequest[];
  nodes: TransitNode[];
  user: User | null;
  onOfferVehicle: (payload: {
    vehicle_model: string;
    reg_number: string;
    origin_node_id: string;
    destination_node_id: string;
    seats_total: number;
    departure_minutes: number;
  }) => Promise<void>;
  onRequestSeat: (vehicleId: string, pickupNodeId: string) => Promise<void>;
  onRequestAction: (
    requestId: string,
    action: 'accepted' | 'rejected' | 'picked_up' | 'dropped_off'
  ) => Promise<void>;
}

export const ParentRideHub: React.FC<Props> = ({
  heading,
  vehicles,
  requests,
  nodes,
  user,
  onOfferVehicle,
  onRequestSeat,
  onRequestAction,
}) => {
  const villages = nodes.filter((n) => n.type === 'village');
  const institutions = nodes.filter((n) => n.type === 'institution');
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const [vehicleModel, setVehicleModel] = useState('Maruti Suzuki Dzire');
  const [regNumber, setRegNumber] = useState('KA-42-M-8410');
  const [originId, setOriginId] = useState('V5');
  const [destId, setDestId] = useState('I1');
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [depMin, setDepMin] = useState(12);
  const [pickupNode, setPickupNode] = useState('V1');
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canOfferOrApprove =
    user?.role === 'parent' || user?.role === 'admin' || user?.role === 'authority';

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    try {
      await onOfferVehicle({
        vehicle_model: vehicleModel,
        reg_number: regNumber,
        origin_node_id: originId,
        destination_node_id: destId,
        seats_total: seatsTotal,
        departure_minutes: depMin,
      });
      setNotice('Verified ParentRide vehicle offer published to live network.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Unable to publish offer.');
    }
  };

  const handleSeatRequest = async (vehicleId: string) => {
    setErr(null);
    setNotice(null);
    try {
      await onRequestSeat(vehicleId, pickupNode);
      setNotice(`Seat request sent for ${vehicleId} from ${nodeName(pickupNode)}.`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Unable to request seat.');
    }
  };

  const handleAction = async (
    reqId: string,
    action: 'accepted' | 'rejected' | 'picked_up' | 'dropped_off'
  ) => {
    setErr(null);
    setNotice(null);
    try {
      await onRequestAction(reqId, action);
      setNotice(`Ride request ${reqId} marked ${action.replace('_', ' ').toUpperCase()}.`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-mono text-indigo-700">VERIFIED PARENT CARPOOL NETWORK</p>
        <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {err}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Verified Parent Vehicles List */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-xs font-semibold text-slate-800">
              Select Student Pickup Stop for Seat Requests
            </span>
            <select
              value={pickupNode}
              onChange={(e) => setPickupNode(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
            >
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} · {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {vehicles.map((pv) => (
              <div
                key={pv.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{pv.parent_name}</div>
                      <div className="text-xs text-slate-500">
                        {pv.vehicle_model} · {pv.reg_number}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-emerald-700">
                      VERIFIED
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span>
                        {nodeName(pv.origin_node_id)} -&gt; {nodeName(pv.destination_node_id)}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      Departs in {pv.departure_minutes} min · Phone: {pv.phone}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-800">
                    {pv.seats_available}/{pv.seats_total} seats open
                  </span>
                  <button
                    disabled={pv.seats_available <= 0 || !user}
                    onClick={() => handleSeatRequest(pv.id)}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    {pv.seats_available > 0 ? 'Request Seat' : 'Full'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Offer Vehicle Form (Parents/Admins) */}
        <div className="xl:col-span-5 space-y-6">
          <form
            onSubmit={handleOfferSubmit}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-indigo-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Offer Verified ParentRide Seats
              </h3>
            </div>
            {!canOfferOrApprove && (
              <p className="text-xs text-amber-700">
                Sign in as a Parent, Admin, or Transport Authority to publish vehicle seat offers.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Model</label>
                <input
                  type="text"
                  required
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registration</label>
                <input
                  type="text"
                  required
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Origin Village</label>
                <select
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Destination</label>
                <select
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Open Seats</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={seatsTotal}
                  onChange={(e) => setSeatsTotal(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Departs (min)</label>
                <input
                  type="number"
                  min={5}
                  max={90}
                  value={depMin}
                  onChange={(e) => setDepMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!canOfferOrApprove}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Publish Seat Offer
            </button>
          </form>

          {/* Ride Requests & Pickup / Drop-off Confirmation */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Seat Requests &amp; Pickup / Drop-Off Confirmation
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
              {requests.map((req) => (
                <div key={req.id} className="px-4 py-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">{req.student_name}</span>
                      <span className="text-slate-500"> · {req.vehicle_id} · Pickup {nodeName(req.pickup_node_id)}</span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold uppercase text-indigo-700">
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>
                  {canOfferOrApprove && (
                    <div className="flex flex-wrap gap-1.5">
                      {req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(req.id, 'accepted')}
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="h-3 w-3" /> Accept
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 cursor-pointer"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      {req.status === 'accepted' && (
                        <button
                          onClick={() => handleAction(req.id, 'picked_up')}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 cursor-pointer"
                        >
                          Confirm Pickup
                        </button>
                      )}
                      {req.status === 'picked_up' && (
                        <button
                          onClick={() => handleAction(req.id, 'dropped_off')}
                          className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Confirm Drop-Off
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
