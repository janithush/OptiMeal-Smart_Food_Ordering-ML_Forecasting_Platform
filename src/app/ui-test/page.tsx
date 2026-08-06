"use client";

/**
 * /ui-test — CaféSmart UI Architecture Demo Page
 *
 * Showcases:
 * - Glassmorphism card system
 * - Framer Motion entrance animations
 * - shadcn/ui Button variants
 * - Badge semantic variants
 * - Design token color palette
 *
 * This page is a permanent dev tool for design iteration.
 * AC: Framer Motion, shadcn/ui, and design tokens are verified working.
 */


import {
  Coffee, Zap, ShieldCheck, Sparkles, Bell, ChefHat,
  Wallet, Users, BarChart3, Leaf
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, type Variants } from "framer-motion";

// ── Animation Variants ─────────────────────────────────────────────────────

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0 },
};

const fadeIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show:   { opacity: 1, scale: 1 },
};

// ── Color Token Preview ────────────────────────────────────────────────────

const tokens = [
  { label: "Brand",     color: "var(--brand)" },
  { label: "Brand Muted", color: "var(--brand-muted)" },
  { label: "Success",   color: "var(--success)" },
  { label: "Warning",   color: "var(--warning)" },
  { label: "Error",     color: "var(--error)" },
  { label: "Info",      color: "var(--info)" },
  { label: "Surface",   color: "var(--bg-elevated)" },
  { label: "Muted Text",color: "var(--text-muted)" },
];

// ── Feature Cards Data ─────────────────────────────────────────────────────

const features = [
  {
    icon: <Coffee className="w-6 h-6" />,
    title: "Smart Ordering",
    description: "Pre-order meals with slot selection and real-time queue updates.",
    badge: "Core",
    badgeVariant: "default" as const,
  },
  {
    icon: <Wallet className="w-6 h-6" />,
    title: "Canteen Wallet",
    description: "Top up via PayHere, earn Canteen Coins, redeem at checkout.",
    badge: "Finance",
    badgeVariant: "success" as const,
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "ML Forecasting",
    description: "Nightly demand forecasts power the admin cook plan.",
    badge: "ML",
    badgeVariant: "warning" as const,
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Group Orders",
    description: "Coordinate lunch with friends using a 6-character share code.",
    badge: "Social",
    badgeVariant: "secondary" as const,
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "Google SSO",
    description: "FOT domain-restricted login. Secure JWT sessions.",
    badge: "Auth",
    badgeVariant: "outline" as const,
  },
  {
    icon: <Leaf className="w-6 h-6" />,
    title: "Waste Reduction",
    description: "Smart discounts on surplus, wastage heatmaps for admins.",
    badge: "Impact",
    badgeVariant: "success" as const,
  },
];

export default function UITestPage() {
  return (
    <main
      className="min-h-screen py-16 px-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="max-w-5xl mx-auto space-y-16">

        {/* ── Hero ── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="text-center space-y-4"
        >
          <motion.div variants={item} className="flex justify-center mb-2">
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium glass"
              style={{ color: "var(--brand)" }}
            >
              <Sparkles className="w-4 h-4" />
              CaféSmart Design System v1.0
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="text-5xl font-bold tracking-tight text-glow-brand"
            style={{ color: "var(--text-primary)" }}
          >
            UI Architecture Demo
          </motion.h1>

          <motion.p variants={item} style={{ color: "var(--text-muted)" }} className="text-lg max-w-xl mx-auto">
            Glassmorphism · OKLCH Color System · Framer Motion · shadcn/ui components
          </motion.p>
        </motion.div>

        {/* ── Button Variants ── */}
        <motion.section
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-6"
        >
          <motion.h2 variants={item} className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Button Variants
          </motion.h2>
          <motion.div variants={item} className="flex flex-wrap gap-3">
            <Button variant="default">
              <Zap className="w-4 h-4" />
              Primary
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button variant="default" size="sm">Small</Button>
            <Button variant="default" size="lg">
              <ChefHat className="w-5 h-5" />
              Large
            </Button>
            <Button variant="outline" size="icon">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="default" disabled>Disabled</Button>
          </motion.div>
        </motion.section>

        {/* ── Badge Variants ── */}
        <motion.section
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-6"
        >
          <motion.h2 variants={item} className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Badge Variants
          </motion.h2>
          <motion.div variants={item} className="flex flex-wrap gap-3">
            <Badge variant="default">Brand</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">✓ Paid</Badge>
            <Badge variant="warning">⚡ Pre-Exam</Badge>
            <Badge variant="destructive">Cancelled</Badge>
            <Badge variant="outline">Walk-in</Badge>
          </motion.div>
        </motion.section>

        {/* ── Feature Cards ── */}
        <motion.section
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-6"
        >
          <motion.h2 variants={item} className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Glassmorphism Cards + Framer Motion
          </motion.h2>
          <motion.div
            variants={container}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={item}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <Card className="h-full glass-hover group">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <span
                        className="p-2 rounded-lg glass"
                        style={{ color: "var(--brand)" }}
                      >
                        {f.icon}
                      </span>
                      <Badge variant={f.badgeVariant}>{f.badge}</Badge>
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="ghost" size="sm" className="w-full group-hover:text-white">
                      Learn more →
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── Design Token Palette ── */}
        <motion.section
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-6"
        >
          <motion.h2 variants={item} className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Design Token Palette (OKLCH)
          </motion.h2>
          <motion.div variants={fadeIn} className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {tokens.map((t, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg border border-[var(--border-subtle)]"
                  style={{ background: t.color }}
                />
                <span className="text-xs text-center leading-tight" style={{ color: "var(--text-muted)" }}>
                  {t.label}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* ── Glassmorphism Showcase ── */}
        <motion.section
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="space-y-6"
        >
          <motion.h2 variants={item} className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Glassmorphism Showcase
          </motion.h2>
          <motion.div variants={fadeIn} className="relative overflow-hidden rounded-2xl p-1">
            {/* Background glow orbs */}
            <div
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 30% 50%, oklch(0.78 0.18 55 / 0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 20%, oklch(0.65 0.15 240 / 0.1) 0%, transparent 70%)",
              }}
            />
            <Card className="glass-strong p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5" style={{ color: "var(--brand)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--brand)" }}>
                      Today's Special
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                    Rice & Chicken Curry
                  </h3>
                  <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                    Basmati rice, creamy chicken curry, mixed salad. 580 kcal.
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Vegetarian Available</Badge>
                    <Badge variant="secondary">Slot: 12:30</Badge>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div>
                    <span className="text-3xl font-bold glow-brand" style={{ color: "var(--brand)" }}>
                      LKR 180
                    </span>
                    <span className="text-sm ml-1 line-through" style={{ color: "var(--text-disabled)" }}>
                      LKR 220
                    </span>
                  </div>
                  <Button variant="default" size="lg" className="glow-brand">
                    <Coffee className="w-5 h-5" />
                    Pre-Order Now
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.section>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs pb-8"
          style={{ color: "var(--text-disabled)" }}
        >
          ✅ Story 1.3 verified — shadcn/ui · Framer Motion · Glassmorphism tokens all operational
        </motion.p>
      </div>
    </main>
  );
}
