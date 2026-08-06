"use client";

import { useState, useCallback } from "react";
import type { FormEvent } from "react";

export type ProfileData = {
  name: string;
  regNo: string;
  batch: string;
  department: string;
  dietaryPreference: string;
  allergies: string[];
  phone: string;
  image: string;
};

const DEPARTMENTS = [
  { value: "ICT", label: "ICT — Information & Communication Technology" },
  { value: "ET", label: "ET — Engineering Technology" },
  { value: "BST", label: "BST — Biosystems Technology" },
];

const DIETARY_OPTIONS = [
  { value: "VEGAN", label: "Vegan 🌱" },
  { value: "VEGETARIAN", label: "Vegetarian 🥬" },
  { value: "NON_VEGETARIAN", label: "Non-Vegetarian 🍗" },
];

const ALLERGY_OPTIONS = [
  "Nuts", "Dairy", "Gluten", "Shellfish", "Eggs", "Soy", "None",
];

interface Props {
  initialData: Partial<ProfileData>;
  isOnboarding: boolean;
  onSubmit: (data: ProfileData & { onboardingDone?: boolean }) => Promise<{ error?: string } | void>;
}

export default function ProfileForm({ initialData, isOnboarding, onSubmit }: Props) {
  const [name, setName] = useState(initialData.name ?? "");
  const [regNo, setRegNo] = useState(initialData.regNo ?? "");
  const [batch, setBatch] = useState(initialData.batch ?? "");
  const [department, setDepartment] = useState(initialData.department ?? "");
  const [dietaryPreference, setDietaryPreference] = useState(initialData.dietaryPreference ?? "");
  const [allergies, setAllergies] = useState<string[]>(initialData.allergies ?? []);
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [image, setImage] = useState(initialData.image ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const toggleAllergy = (allergy: string) => {
    setAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy]
    );
  };

  const getRequiredFields = (): { field: string; value: string | string[] }[] => {
    if (!isOnboarding) return [];
    return [
      { field: "regNo", value: regNo },
      { field: "batch", value: batch },
      { field: "department", value: department },
      { field: "dietaryPreference", value: dietaryPreference },
      { field: "allergies", value: allergies },
    ];
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";

    for (const { field, value } of getRequiredFields()) {
      if (Array.isArray(value) ? value.length === 0 : !value.trim()) {
        newErrors[field] = `${field === "regNo" ? "Registration number" : field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormComplete = useCallback(() => {
    if (!name.trim()) return false;
    if (isOnboarding) {
      return regNo.trim() && batch.trim() && department && dietaryPreference && allergies.length > 0;
    }
    return true;
  }, [name, regNo, batch, department, dietaryPreference, allergies, isOnboarding]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError("");
    setSuccess(false);

    if (!validate()) return;

    setSaving(true);
    try {
      const result = await onSubmit({
        name: name.trim(),
        regNo: regNo.trim() || "",
        batch: batch.trim() || "",
        department,
        dietaryPreference,
        allergies,
        phone: phone.trim(),
        image: image.trim(),
        onboardingDone: isOnboarding ? true : undefined,
      });
      if (result && "error" in result) {
        setGlobalError(result.error!);
      } else {
        setSuccess(true);
      }
    } catch {
      setGlobalError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-[oklch(0.12_0.01_260)] border border-[oklch(0.25_0.01_260)] text-[oklch(0.97_0_0)] text-sm placeholder:text-[oklch(0.45_0.01_260)] focus:outline-none focus:border-[oklch(0.78_0.18_55)] transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Profile Picture */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[oklch(0.15_0.01_260)] border border-[oklch(0.25_0.01_260)] shrink-0">
          {image ? (
            <img src={image} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[oklch(0.45_0.01_260)] text-xl font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-[oklch(0.65_0.01_260)] text-xs mb-1">Profile Picture URL</p>
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Display Name {isOnboarding && <span className="text-[oklch(0.78_0.18_55)]">*</span>}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
      </div>

      {/* Registration Number */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Student Registration Number {isOnboarding && <span className="text-[oklch(0.78_0.18_55)]">*</span>}</label>
        <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="e.g., 2023/ICT/001" className={inputClass} />
        {errors.regNo && <p className="text-red-400 text-xs mt-1">{errors.regNo}</p>}
      </div>

      {/* Batch */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Batch / Academic Year {isOnboarding && <span className="text-[oklch(0.78_0.18_55)]">*</span>}</label>
        <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g., 2023/2024" className={inputClass} />
        {errors.batch && <p className="text-red-400 text-xs mt-1">{errors.batch}</p>}
      </div>

      {/* Department */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Department {isOnboarding && <span className="text-[oklch(0.78_0.18_55)]">*</span>}</label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
          <option value="">Select department...</option>
          {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {errors.department && <p className="text-red-400 text-xs mt-1">{errors.department}</p>}
      </div>

      {/* Dietary Preference */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Dietary Preference {isOnboarding && <span className="text-[oklch(0.78_0.18_55)]">*</span>}</label>
        <div className="grid grid-cols-3 gap-2">
          {DIETARY_OPTIONS.map((d) => (
            <button key={d.value} type="button" onClick={() => setDietaryPreference(d.value)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${dietaryPreference === d.value ? "bg-[oklch(0.78_0.18_55)]/20 border-[oklch(0.78_0.18_55)] text-[oklch(0.78_0.18_55)]" : "bg-[oklch(0.12_0.01_260)] border-[oklch(0.25_0.01_260)] text-[oklch(0.55_0.01_260)] hover:border-[oklch(0.4_0.01_260)]"}`}>
              {d.label}
            </button>
          ))}
        </div>
        {errors.dietaryPreference && <p className="text-red-400 text-xs mt-1">{errors.dietaryPreference}</p>}
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Food Allergies {isOnboarding && <span className="text-[oklch(0.78_0.18_55)]">*</span>}</label>
        <div className="flex flex-wrap gap-2">
          {ALLERGY_OPTIONS.map((a) => (
            <button key={a} type="button" onClick={() => toggleAllergy(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${allergies.includes(a) ? "bg-[oklch(0.78_0.18_55)]/20 border-[oklch(0.78_0.18_55)] text-[oklch(0.78_0.18_55)]" : "bg-[oklch(0.12_0.01_260)] border-[oklch(0.25_0.01_260)] text-[oklch(0.55_0.01_260)] hover:border-[oklch(0.4_0.01_260)]"}`}>
              {a}
            </button>
          ))}
        </div>
        {errors.allergies && <p className="text-red-400 text-xs mt-1">{errors.allergies}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-[oklch(0.65_0.01_260)] text-xs mb-1">Phone Number <span className="text-[oklch(0.55_0.01_260)]">(optional)</span></label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., +94771234567" className={inputClass} />
      </div>

      {/* Global Error */}
      {globalError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{globalError}</div>
      )}

      {/* Success */}
      {success && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">Profile saved successfully!</div>
      )}

      {/* Submit */}
      <button type="submit" disabled={!isFormComplete() || saving}
        className="w-full py-3 rounded-xl font-medium text-sm transition-all duration-200
                   bg-[oklch(0.78_0.18_55)] text-black hover:bg-[oklch(0.82_0.18_55)]
                   disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
        {saving ? "Saving..." : isOnboarding ? "Complete Onboarding →" : "Save Changes"}
      </button>
    </form>
  );
}
