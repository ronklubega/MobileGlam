"use client";
import { useState } from "react";
import { ActionForm, SubmitButton, inputClass, labelClass, type FormAction } from "@/components/forms";

export function OnboardingForm({ action }: { action: FormAction }) {
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) return setGeoMsg("Your browser can't share location. Enter coordinates manually.");
    setGeoMsg("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }); setGeoMsg("Location set. Do this while you're at the business for best accuracy."); },
      () => setGeoMsg("Couldn't get your location. Allow location access, or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <ActionForm action={action} className="space-y-4">
      <div><label className={labelClass}>Business name</label><input name="name" required maxLength={120} className={inputClass} /></div>
      <div>
        <label className={labelClass}>Type</label>
        <select name="type" required defaultValue="salon" className={inputClass}>
          <option value="salon">Salon</option><option value="barbershop">Barbershop</option><option value="clinic">Hair / scalp clinic</option>
        </select>
      </div>
      <div><label className={labelClass}>Description (optional)</label><textarea name="description" rows={3} maxLength={1000} className={inputClass} placeholder="What you specialise in" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelClass}>Area (e.g. Kololo, Ntinda, Entebbe)</label><input name="area" required maxLength={80} className={inputClass} /></div>
        <div><label className={labelClass}>Street address / landmark</label><input name="address" required maxLength={200} className={inputClass} /></div>
      </div>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-xs font-semibold text-muted">Map location (so clients can find you nearby)</legend>
        <button type="button" onClick={locate} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">Use my current location</button>
        {geoMsg ? <p className="mt-2 text-xs text-muted" role="status">{geoMsg}</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className={labelClass}>Latitude</label><input name="latitude" inputMode="decimal" value={coords.lat} onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} className={inputClass} placeholder="0.3476" /></div>
          <div><label className={labelClass}>Longitude</label><input name="longitude" inputMode="decimal" value={coords.lng} onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} className={inputClass} placeholder="32.5825" /></div>
        </div>
      </fieldset>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-xs font-semibold text-muted">Where should we send your deposit payouts?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Network</label>
            <select name="provider" defaultValue="mtn_momo" className={inputClass}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option></select>
          </div>
          <div><label className={labelClass}>Mobile money number</label><input name="payoutPhone" required inputMode="tel" placeholder="0772 123 456" className={inputClass} /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Registered account name</label><input name="accountName" required maxLength={80} className={inputClass} /></div>
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="offersHomeVisits" /> We offer home / mobile visits</label>
      <SubmitButton>Submit for approval</SubmitButton>
    </ActionForm>
  );
}
