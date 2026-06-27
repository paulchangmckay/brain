---
name: exec-dashboard
description: "Build a branded, single-file executive dashboard from raw data (CSV path, JSON, or described metrics). Produces KPI cards + trend chart + breakdown table + insight callout as a self-contained HTML artifact. Use when presenting data or business results to executive stakeholders."
---

# Executive Dashboard Skill

Turns raw data into a polished, brand-compliant executive dashboard — a single bundled HTML file ready to share, screenshot, or embed in slides.

**Gate:** Invoke the `brand` skill first to get the Brand Spec Card for "Data Visualization / Dashboard" before building.

---

## Step 1: Understand the Data and Narrative

Ask or infer:
1. **What is the single headline metric?** (The one number that matters most)
2. **What time period / comparison?** (QoQ, YoY, vs target, vs prior week)
3. **What are the 2–4 supporting metrics?** (KPI cards alongside the headline)
4. **What is the trend?** (The chart: time-series or category comparison)
5. **What breaks it down?** (The table: by region, product, team, etc.)
6. **What is the insight?** (One sentence: what does the data mean + what to do)

If raw data is provided (CSV path or JSON), read it and derive these answers before building.

---

## Step 2: Initialize the Project

```bash
# From the web-artifacts-builder skill directory:
bash ~/.claude/plugins/cache/anthropic-agent-skills/document-skills/35414756ca55/skills/web-artifacts-builder/scripts/init-artifact.sh exec-dashboard
cd exec-dashboard

# Add recharts (from dataviz skill):
pnpm add recharts
```

---

## Step 3: Structure — Fixed Layout

The dashboard uses a fixed 3-zone layout. Do not deviate:

```
┌─────────────────────────────────────────────┐
│  ◆ PM   TITLE                    DATE       │  ← Header bar (Charcoal bg)
├─────────────────────────────────────────────┤
│  [KPI 1]   [KPI 2]   [KPI 3]   [KPI 4]    │  ← KPI row (4 cards max)
├─────────────────────────────────────────────┤
│                                             │
│  PRIMARY CHART (60% width)  │  INSIGHT BOX  │  ← Main row
│                             │  (40% width)  │
│                                             │
├─────────────────────────────────────────────┤
│  BREAKDOWN TABLE (full width)               │  ← Detail row
├─────────────────────────────────────────────┤
│  ◆ Confidential • Prepared by Paul McKay   │  ← Footer
└─────────────────────────────────────────────┘
```

---

## Step 4: App.tsx Template

Replace `src/App.tsx` with this structure, filling in the actual data:

```tsx
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = {
  primary: '#6b5b54',
  secondary: '#5a7a8a',
  tertiary: '#a89980',
  charcoal: '#2a2a28',
  linen: '#f5f2ed',
  offWhite: '#fafaf8',
};

// ── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ label, value, delta, positive }: {
  label: string; value: string; delta: string; positive: boolean;
}) {
  return (
    <div style={{
      flex: 1,
      background: COLORS.offWhite,
      border: `1px solid ${COLORS.linen}`,
      padding: '20px 24px',
      minWidth: 0,
    }}>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 11, fontWeight: 600,
        color: COLORS.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 36, fontWeight: 800,
        color: COLORS.charcoal, margin: '6px 0 4px' }}>
        {value}
      </div>
      <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 13,
        color: positive ? COLORS.secondary : COLORS.tertiary }}>
        {delta}
      </div>
    </div>
  );
}

// ── Insight Box ─────────────────────────────────────────────────────────────
function InsightBox({ title, finding, recommendation }: {
  title: string; finding: string; recommendation: string;
}) {
  return (
    <div style={{
      background: COLORS.linen,
      padding: '32px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      width: '38%',
      flexShrink: 0,
    }}>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700,
        color: COLORS.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 15, lineHeight: 1.7,
        color: COLORS.charcoal }}>
        {finding}
      </div>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 600,
        color: COLORS.secondary, borderLeft: `3px solid ${COLORS.secondary}`, paddingLeft: 12 }}>
        {recommendation}
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  // Replace with real data
  const kpis = [
    { label: 'Total Revenue',    value: '$4.2M', delta: '+18% vs Q1', positive: true },
    { label: 'Active Accounts',  value: '1,247', delta: '+4.2% MoM',  positive: true },
    { label: 'Avg Deal Size',    value: '$3,370', delta: '−2% vs target', positive: false },
    { label: 'Win Rate',         value: '42%',   delta: '+3 pts YoY', positive: true },
  ];

  const trendData = [
    { month: 'Jan', value: 2800000 },
    { month: 'Feb', value: 3100000 },
    { month: 'Mar', value: 3560000 },
    { month: 'Apr', value: 4200000 },
  ];

  const breakdownData = [
    { name: 'Enterprise',   revenue: '$2.1M', accounts: 84,  winRate: '51%', trend: '↑' },
    { name: 'Mid-Market',   revenue: '$1.4M', accounts: 312, winRate: '43%', trend: '↑' },
    { name: 'SMB',          revenue: '$0.7M', accounts: 851, winRate: '38%', trend: '→' },
  ];

  return (
    <div style={{ background: COLORS.offWhite, minHeight: '100vh',
      fontFamily: 'Poppins, sans-serif', color: COLORS.charcoal }}>

      {/* Header */}
      <div style={{ background: COLORS.charcoal, padding: '16px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: COLORS.primary, fontSize: 20, fontWeight: 800 }}>◆</span>
          <span style={{ color: '#fafaf8', fontSize: 15, fontWeight: 700, letterSpacing: '0.02em' }}>
            Q2 2026 Revenue Performance  {/* REPLACE */}
          </span>
        </div>
        <span style={{ color: COLORS.tertiary, fontSize: 12 }}>
          June 27, 2026 · Confidential  {/* REPLACE */}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 1, background: COLORS.linen, padding: '1px 0' }}>
        {kpis.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Main Row: Chart + Insight */}
      <div style={{ display: 'flex', gap: 0, margin: '0', minHeight: 360 }}>
        <div style={{ flex: 1, padding: '32px 40px', background: COLORS.offWhite }}>
          <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700,
            color: COLORS.charcoal, marginBottom: 4 }}>
            Revenue Trend  {/* REPLACE */}
          </div>
          <div style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 12,
            color: COLORS.tertiary, marginBottom: 20 }}>
            January – April 2026  {/* REPLACE */}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.linen} vertical={false} />
              <XAxis dataKey="month"
                tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, fill: COLORS.charcoal }}
                axisLine={{ stroke: COLORS.linen }} tickLine={false} />
              <YAxis
                tickFormatter={v => `$${(v/1000000).toFixed(1)}M`}
                tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 11, fill: COLORS.charcoal }}
                axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`$${(v/1000000).toFixed(2)}M`, 'Revenue']}
                contentStyle={{ fontFamily: 'Lora, Georgia, serif', fontSize: 13,
                  background: COLORS.offWhite, border: `1px solid ${COLORS.linen}`, color: COLORS.charcoal }} />
              <Bar dataKey="value" fill={COLORS.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <InsightBox
          title="Key Finding"
          finding="Revenue grew 50% from January to April, driven primarily by Enterprise expansion. Mid-Market pipeline velocity increased but deal sizes remain below target."
          recommendation="Prioritise Enterprise upsell motions in Q3. Review Mid-Market pricing to close the deal-size gap."
        />
      </div>

      {/* Breakdown Table */}
      <div style={{ padding: '32px 40px', background: COLORS.linen }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700,
          color: COLORS.charcoal, marginBottom: 16 }}>
          Segment Breakdown
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: COLORS.primary }}>
              {['Segment', 'Revenue', 'Accounts', 'Win Rate', 'Trend'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left',
                  fontFamily: 'Poppins, sans-serif', fontSize: 11, fontWeight: 700,
                  color: '#fafaf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdownData.map((row, i) => (
              <tr key={row.name} style={{ background: i % 2 === 0 ? COLORS.offWhite : '#f0ede8' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'Poppins, sans-serif',
                  fontSize: 13, fontWeight: 600, color: COLORS.charcoal }}>{row.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'Lora, Georgia, serif',
                  fontSize: 13, color: COLORS.charcoal }}>{row.revenue}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'Lora, Georgia, serif',
                  fontSize: 13, color: COLORS.charcoal }}>{row.accounts}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'Lora, Georgia, serif',
                  fontSize: 13, color: COLORS.charcoal }}>{row.winRate}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'Poppins, sans-serif',
                  fontSize: 14, color: COLORS.secondary }}>{row.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 40px', background: COLORS.charcoal,
        display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: COLORS.tertiary, fontSize: 11 }}>◆ Confidential — Internal Use Only</span>
        <span style={{ color: COLORS.tertiary, fontSize: 11 }}>Prepared by Paul McKay</span>
      </div>
    </div>
  );
}
```

---

## Step 5: Add Google Fonts to index.html

In `index.html`, add inside `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Lora:wght@400;500&display=swap" rel="stylesheet">
```

---

## Step 6: Bundle and Export

```bash
# Bundle to single HTML
bash scripts/bundle-artifact.sh

# Export to PNG + PDF (for slide embedding or async sharing)
node ~/.claude/skills/html-export/scripts/html-export.js bundle.html
```

---

## Customization Notes

- **Replace all placeholder comments** (`{/* REPLACE */}`) with actual data before bundling
- **KPI cards:** 2–4 max. More than 4 creates cognitive overload for executives
- **Chart:** Choose bar (comparison) or line (trend) — the template uses bar. Switch by swapping `<BarChart>` for `<LineChart>` and `<Bar>` for `<Line>`
- **Insight box:** The `finding` should state what the data shows. The `recommendation` should state what to do. Both should be one sentence each.
- **Breakdown table:** Limit to 5–8 rows. More than that belongs in an appendix

---

## Checklist Before Delivering

- [ ] `brand` skill was invoked and Brand Spec Card confirmed
- [ ] All 6 brand colors applied correctly (no off-palette values)
- [ ] KPI cards show value, delta, and positive/negative color
- [ ] Chart has clean axes, no vertical gridlines, Linen gridlines only
- [ ] Insight box has exactly one finding + one recommendation
- [ ] Bundled to single HTML file (all assets inlined)
- [ ] Exported to PNG + PDF via html-export skill
