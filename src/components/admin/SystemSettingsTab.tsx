"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Check, Settings as SettingsIcon, DollarSign, Clock, Package, Award, Brain, Wrench } from "lucide-react";

interface Settings {
  canteenName: string;
  canteenLogoUrl: string | null;
  canteenContactEmail: string | null;
  canteenContactPhone: string | null;
  currencyCode: string;
  currencySymbol: string;
  preOrderCutoffTime: string;
  pickupSlotStart: string;
  pickupSlotEnd: string;
  pickupSlotIntervalMin: number;
  defaultSlotCapacity: number;
  minTopupAmount: number;
  maxTopupAmount: number;
  maxCoinRedemption: number;
  mlConfidenceThreshold: number;
  smartDiscountThreshold: number;
  smartDiscountCheckTime: string;
  enableGroupOrders: boolean;
  enableFlashDeals: boolean;
  enableCoinsLoyalty: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

export default function SystemSettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const json = await res.json();
        const s = {
          ...json.settings,
          minTopupAmount: Number(json.settings.minTopupAmount),
          maxTopupAmount: Number(json.settings.maxTopupAmount),
          mlConfidenceThreshold: Number(json.settings.mlConfidenceThreshold),
          smartDiscountThreshold: Number(json.settings.smartDiscountThreshold),
        };
        setSettings(s);
        setDraft(s);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!settings || !draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasChanges(JSON.stringify(settings) !== JSON.stringify(draft));
  }, [settings, draft]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to save settings"); return; }
      const s = {
        ...json.settings,
        minTopupAmount: Number(json.settings.minTopupAmount),
        maxTopupAmount: Number(json.settings.maxTopupAmount),
        mlConfidenceThreshold: Number(json.settings.mlConfidenceThreshold),
        smartDiscountThreshold: Number(json.settings.smartDiscountThreshold),
      };
      setSettings(s);
      setDraft(s);
      setSuccess("Settings saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    if (settings) setDraft(settings);
    setError(null);
    setSuccess(null);
  }

  if (loading || !draft) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <SectionCard icon={SettingsIcon} title="Canteen identity">
        <Field label="Canteen name"><input type="text" value={draft.canteenName} onChange={(e) => setDraft({ ...draft, canteenName: e.target.value })} className={inputClass} /></Field>
        <Field label="Logo URL (optional)"><input type="url" value={draft.canteenLogoUrl ?? ""} onChange={(e) => setDraft({ ...draft, canteenLogoUrl: e.target.value || null })} placeholder="https://..." className={inputClass} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact email"><input type="email" value={draft.canteenContactEmail ?? ""} onChange={(e) => setDraft({ ...draft, canteenContactEmail: e.target.value || null })} className={inputClass} /></Field>
          <Field label="Contact phone"><input type="tel" value={draft.canteenContactPhone ?? ""} onChange={(e) => setDraft({ ...draft, canteenContactPhone: e.target.value || null })} className={inputClass} /></Field>
        </div>
      </SectionCard>

      <SectionCard icon={DollarSign} title="Currency">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency code (ISO)"><input type="text" maxLength={3} value={draft.currencyCode} onChange={(e) => setDraft({ ...draft, currencyCode: e.target.value.toUpperCase() })} className={inputClass} /></Field>
          <Field label="Display symbol"><input type="text" maxLength={5} value={draft.currencySymbol} onChange={(e) => setDraft({ ...draft, currencySymbol: e.target.value })} className={inputClass} /></Field>
        </div>
      </SectionCard>

      <SectionCard icon={Clock} title="Pre-order window">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cutoff time" hint="Orders close after this"><input type="time" value={draft.preOrderCutoffTime} onChange={(e) => setDraft({ ...draft, preOrderCutoffTime: e.target.value })} className={inputClass} /></Field>
          <Field label="Slot start"><input type="time" value={draft.pickupSlotStart} onChange={(e) => setDraft({ ...draft, pickupSlotStart: e.target.value })} className={inputClass} /></Field>
          <Field label="Slot end"><input type="time" value={draft.pickupSlotEnd} onChange={(e) => setDraft({ ...draft, pickupSlotEnd: e.target.value })} className={inputClass} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Interval (min)" hint="5-60"><input type="number" min={5} max={60} value={draft.pickupSlotIntervalMin} onChange={(e) => setDraft({ ...draft, pickupSlotIntervalMin: Number(e.target.value) })} className={inputClass} /></Field>
          <Field label="Default slot capacity" hint="1-200"><input type="number" min={1} max={200} value={draft.defaultSlotCapacity} onChange={(e) => setDraft({ ...draft, defaultSlotCapacity: Number(e.target.value) })} className={inputClass} /></Field>
        </div>
      </SectionCard>

      <SectionCard icon={Package} title="Wallet limits">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Min top-up (${draft.currencySymbol})`}><input type="number" min={1} value={draft.minTopupAmount} onChange={(e) => setDraft({ ...draft, minTopupAmount: Number(e.target.value) })} className={inputClass} /></Field>
          <Field label={`Max top-up (${draft.currencySymbol})`}><input type="number" min={1} value={draft.maxTopupAmount} onChange={(e) => setDraft({ ...draft, maxTopupAmount: Number(e.target.value) })} className={inputClass} /></Field>
        </div>
      </SectionCard>

      <SectionCard icon={Award} title="Loyalty (Canteen Coins)">
        <Field label="Max coins redeemable per order" hint="0-1000"><input type="number" min={0} max={1000} value={draft.maxCoinRedemption} onChange={(e) => setDraft({ ...draft, maxCoinRedemption: Number(e.target.value) })} className={inputClass} /></Field>
        <ToggleField label="Enable loyalty program" description="Disable to hide Coins from the student UI" checked={draft.enableCoinsLoyalty} onChange={(v) => setDraft({ ...draft, enableCoinsLoyalty: v })} />
      </SectionCard>

      <SectionCard icon={Brain} title="ML and smart discounts">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Confidence threshold (%)" hint="Below is tagged as fallback"><input type="number" min={0} max={100} step="0.1" value={draft.mlConfidenceThreshold} onChange={(e) => setDraft({ ...draft, mlConfidenceThreshold: Number(e.target.value) })} className={inputClass} /></Field>
          <Field label="Smart-discount threshold" hint="% of cook plan target"><input type="number" min={0} max={100} step="0.1" value={draft.smartDiscountThreshold} onChange={(e) => setDraft({ ...draft, smartDiscountThreshold: Number(e.target.value) })} className={inputClass} /></Field>
        </div>
        <Field label="Smart-discount check time" hint="Daily check time"><input type="time" value={draft.smartDiscountCheckTime} onChange={(e) => setDraft({ ...draft, smartDiscountCheckTime: e.target.value })} className={inputClass} /></Field>
      </SectionCard>

      <SectionCard icon={Wrench} title="Feature flags">
        <ToggleField label="Group orders" description="Allow students to create and join group orders" checked={draft.enableGroupOrders} onChange={(v) => setDraft({ ...draft, enableGroupOrders: v })} />
        <ToggleField label="Flash deals" description="Allow admins to publish time-bound discounts" checked={draft.enableFlashDeals} onChange={(v) => setDraft({ ...draft, enableFlashDeals: v })} />
        <ToggleField label="Maintenance mode" description="Show students a maintenance message instead of the menu" checked={draft.maintenanceMode} onChange={(v) => setDraft({ ...draft, maintenanceMode: v })} />
      </SectionCard>

      {draft.maintenanceMode && (
        <SectionCard icon={AlertCircle} title="Maintenance message">
          <textarea value={draft.maintenanceMessage ?? ""} onChange={(e) => setDraft({ ...draft, maintenanceMessage: e.target.value || null })} placeholder="We are temporarily unavailable. Back soon!" rows={3} className={inputClass} />
        </SectionCard>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-[oklch(0.08_0.01_260)]/95 backdrop-blur border-t border-[rgba(255,255,255,0.07)] flex justify-end gap-2">
        <button onClick={revert} disabled={!hasChanges || saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[var(--text-secondary)]">Revert</button>
        <button onClick={save} disabled={!hasChanges || saving} className="px-4 py-2 rounded-lg text-xs font-bold bg-[var(--brand)] hover:opacity-90 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save changes
        </button>
      </div>
    </div>
  );
}

const inputClass = "w-full px-3 py-2 rounded-lg bg-[oklch(0.18_0.012_260)] border border-[rgba(255,255,255,0.08)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--brand)]";

function SectionCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 border border-[rgba(255,255,255,0.07)] space-y-3" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)" }}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Icon className="w-4 h-4 text-[var(--brand)]" />{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">{label}{hint && <span className="ml-1 text-[10px] text-[var(--text-disabled)]">({hint})</span>}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-[rgba(255,255,255,0.05)] cursor-pointer">
      <div>
        <div className="text-xs font-medium text-[var(--text-primary)]">{label}</div>
        {description && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{description}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-[var(--brand)]" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
