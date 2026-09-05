"use client";

import { useState, useCallback } from "react";
import type { FormEvent } from "react";
import { motion, AnimatePresence, LayoutGroup, useAnimationControls } from "motion/react";
import { springSnappy, fadeEase } from "@/lib/motion";

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
  const shakeControls = useAnimationControls();

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

    if (!validate()) {
      // Tactile error nudge (spring keyframes, no remount — focus is kept).
      shakeControls.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
      return;
    }

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

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--brand)] transition-colors";

  return (
    <motion.form onSubmit={handleSubmit} animate={shakeControls} className="space-y-5">
      {/* Profile Picture */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--glass-bg)] border border-[var(--glass-border)] shrink-0">
          {image ? (
            <img src={image} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xl font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-[var(--text-secondary)] text-xs mb-1">Profile Picture URL</p>
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Display Name {isOnboarding && <span className="text-[var(--brand)]">*</span>}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
      </div>

      {/* Registration Number */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Student Registration Number {isOnboarding && <span className="text-[var(--brand)]">*</span>}</label>
        <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="e.g., 2023/ICT/001" className={inputClass} />
        {errors.regNo && <p className="text-red-400 text-xs mt-1">{errors.regNo}</p>}
      </div>

      {/* Batch */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Batch / Academic Year {isOnboarding && <span className="text-[var(--brand)]">*</span>}</label>
        <input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g., 2023/2024" className={inputClass} />
        {errors.batch && <p className="text-red-400 text-xs mt-1">{errors.batch}</p>}
      </div>

      {/* Department */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Department {isOnboarding && <span className="text-[var(--brand)]">*</span>}</label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
          <option value="">Select department...</option>
          {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {errors.department && <p className="text-red-400 text-xs mt-1">{errors.department}</p>}
      </div>

      {/* Dietary Preference */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Dietary Preference {isOnboarding && <span className="text-[var(--brand)]">*</span>}</label>
        <LayoutGroup id="dietary-prefs">
          <div className="grid grid-cols-3 gap-2">
            {DIETARY_OPTIONS.map((d) => {
              const active = dietaryPreference === d.value;
              return (
                <motion.button
                  key={d.value}
                  type="button"
                  onClick={() => setDietaryPreference(d.value)}
                  whileTap={{ scale: 0.96 }}
                  aria-pressed={active}
                  className={`relative px-3 py-2.5 rounded-xl text-xs font-medium border ${
                    active
                      ? "text-[var(--brand)] border-[var(--brand)]"
                      : "text-[var(--text-muted)] border-[var(--glass-border)]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="dietary-pill"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-xl bg-[var(--brand)]/20"
                    />
                  )}
                  <span className="relative z-10">{d.label}</span>
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>
        {errors.dietaryPreference && <p className="text-red-400 text-xs mt-1">{errors.dietaryPreference}</p>}
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Food Allergies {isOnboarding && <span className="text-[var(--brand)]">*</span>}</label>
        <div className="flex flex-wrap gap-2">
          {ALLERGY_OPTIONS.map((a) => {
            const active = allergies.includes(a);
            return (
              <motion.button
                key={a}
                type="button"
                onClick={() => toggleAllergy(a)}
                whileTap={{ scale: 0.96 }}
                aria-pressed={active}
                animate={{ scale: active ? 1.04 : 1 }}
                transition={springSnappy}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  active
                    ? "bg-[var(--brand)]/20 border-[var(--brand)] text-[var(--brand)]"
                    : "bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]"
                }`}
              >
                {a}
              </motion.button>
            );
          })}
        </div>
        {errors.allergies && <p className="text-red-400 text-xs mt-1">{errors.allergies}</p>}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-[var(--text-secondary)] text-xs mb-1">Phone Number <span className="text-[var(--text-muted)]">(optional)</span></label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., +94771234567" className={inputClass} />
      </div>

      {/* Global Error */}
      <AnimatePresence>
        {globalError && (
          <motion.div
            key="form-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fadeEase}
            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {globalError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {success && (
          <motion.div
            key="form-success"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...springSnappy, opacity: fadeEase }}
            className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
          >
            Profile saved successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={!isFormComplete() || saving}
        whileTap={{ scale: 0.96 }}
        className="w-full py-3 rounded-xl font-medium text-sm
                   bg-[var(--brand)] text-black hover:brightness-110
                   disabled:opacity-40 disabled:cursor-not-allowed transition-[filter]"
      >
        {saving ? "Saving..." : isOnboarding ? "Complete Onboarding →" : "Save Changes"}
      </motion.button>
    </motion.form>
  );
}
