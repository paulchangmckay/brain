---
title: "dataviz"
description: "Data visualization skill for executive-facing charts and dashboards. Use when building any chart, graph, KPI display, or visual data summary. Wraps web-artifacts-builder with recharts and enforces brand-palette defaults and executive design standards. Invoke before touching any charting code."
---

# DataViz Skill — Executive Data Visualization

Wraps the `web-artifacts-builder` skill with recharts and brand-compliant defaults. Use whenever any chart, graph, dashboard metric, or data visualization is needed.

---

## Step 1: Identify Chart Type

Choose based on what the data needs to communicate:

| Chart Type | When to Use | Never Use When |
|---|---|---|
| **Bar (vertical)** | Compare discrete categories (revenue by region, scores by quarter) | Showing change over time with many time points |
| **Bar (horizontal)** | Ranked list where label length matters | Categories exceed 8–10 items |
| **Line** | Continuous change over time (trends, growth curves) | Fewer than 3 data points |
| **Area** | Volume over time when magnitude matters (not just direction) | Overlapping series obscure each other |
| **KPI Card** | Single headline metric + delta vs prior period + sparkline | When context requires more than 3 numbers |
| **Waterfall** | Incremental contributions to a total (P&L bridge, budget breakdown) | Negative-only or positive-only values |
| **Scatter** | Correlation between two continuous variables | Audience unfamiliar with scatter plots |
| **Pie / Donut** | Composition of a whole — only when ≤5 segments, values clearly dominate | Trends, comparisons, or >5 segments |
| **Table + inline bars** | Ranked list where both label and magnitude matter | Non-comparable rows |
| **Stacked Bar** | Part-to-whole across categories | More than 4 stack segments |
| **Heatmap** | Patterns across two categorical dimensions (day × hour, team × metric) | Sparse data or too many cells |

**Executive rule:** When in doubt, use a bar or line chart. Executives read bars and lines instantly. Anything else requires a moment of cognitive translation — earn that moment.

---

## Step 2: Add Recharts to a web-artifacts-builder Project

After `scripts/init-artifact.sh <project-name>`:

```bash
cd <project-name>
pnpm add recharts
# If you also want shadcn chart wrapper (recommended — uses recharts under the hood):
pnpm add recharts @radix-ui/react-separator
```

The shadcn chart component (`src/components/ui/chart.tsx`) may not be pre-bundled in the tarball. If not, use recharts directly as shown in Step 3.

---

## Step 3: Brand-Compliant Chart Defaults

### Color Palette for Data Visualization

Use ONLY these colors from the brand guide:

```typescript
const BRAND_COLORS = {
  primary: '#6b5b54',    // Taupe — first/primary data series
  secondary: '#5a7a8a',  // Slate — second series, or positive delta
  tertiary: '#a89980',   // Khaki — third series, neutral, supporting
  text: '#2a2a28',       // Charcoal — axis labels, data labels
  grid: '#f5f2ed',       // Linen — gridlines, backgrounds
  background: '#fafaf8', // Off-White — chart background
} as const;

// For multi-series charts, use in order: primary → secondary → tertiary
// Never introduce colors outside this set
const SERIES_COLORS = ['#6b5b54', '#5a7a8a', '#a89980'];
```

### Typography (match brand guide)

```typescript
const CHART_FONTS = {
  label: 'Poppins, sans-serif',  // axis labels, legend, data labels
  body: 'Lora, Georgia, serif',  // tooltips, callout text
};
```

Add Google Fonts to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Lora:wght@400;500&display=swap" rel="stylesheet">
```

### Standard Recharts Configuration

```tsx
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Standard chart wrapper — use for every chart
<ResponsiveContainer width="100%" height={320}>
  <BarChart
    data={data}
    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
  >
    <CartesianGrid
      strokeDasharray="3 3"
      stroke="#f5f2ed"  // Linen gridlines — subtle, not distracting
      vertical={false}  // Horizontal gridlines only — cleaner
    />
    <XAxis
      dataKey="name"
      tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, fill: '#2a2a28' }}
      axisLine={{ stroke: '#f5f2ed' }}
      tickLine={false}
    />
    <YAxis
      tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 12, fill: '#2a2a28' }}
      axisLine={false}
      tickLine={false}
    />
    <Tooltip
      contentStyle={{
        fontFamily: 'Lora, Georgia, serif',
        fontSize: 13,
        background: '#fafaf8',
        border: '1px solid #f5f2ed',
        borderRadius: 4,
        color: '#2a2a28',
      }}
    />
    <Bar dataKey="value" fill="#6b5b54" radius={[2, 2, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

## Step 4: Executive Design Standards

**Do:**
- Label data directly on the chart when possible (avoid legend-only labeling)
- Show one accent color per chart (not both Taupe and Slate together)
- Use `tickLine={false}` and `axisLine={false}` on the Y-axis — cleaner
- Remove vertical gridlines (`vertical={false}`) — horizontal only
- Round bar corners slightly (`radius={[2, 2, 0, 0]}`) — modern, not rounded to a bubble
- Show delta vs prior period in the chart subtitle or a KPI card beside the chart

**Never:**
- 3D effects, drop shadows, or gradients on chart elements
- Rainbow/multi-color series (more than 3 colors signals a design problem)
- Pie charts with >5 segments
- Tilted or angled axis labels (use shorter category names or horizontal bars instead)
- Excessive decimal places (round to 1 decimal or whole numbers for exec audiences)
- Truncated Y-axis that exaggerates change (start at 0 unless showing a tight range)

---

## Step 5: KPI Card Pattern

For headline metrics, use this component pattern:

```tsx
interface KPICardProps {
  label: string;
  value: string;          // formatted: "$4.2M", "82%", "1,247"
  delta: string;          // "+18% vs Q1" or "−3 pts"
  deltaPositive: boolean; // controls color
  sparklineData?: number[];
}

function KPICard({ label, value, delta, deltaPositive, sparklineData }: KPICardProps) {
  return (
    <div style={{
      background: '#fafaf8',
      border: '1px solid #f5f2ed',
      padding: '24px',
      fontFamily: 'Poppins, sans-serif',
    }}>
      <div style={{ fontSize: 12, color: '#6b5b54', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: '#2a2a28', margin: '8px 0 4px' }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: deltaPositive ? '#5a7a8a' : '#a89980', fontWeight: 500 }}>
        {delta}
      </div>
      {sparklineData && (
        <div style={{ marginTop: 12, height: 40 }}>
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={sparklineData.map((v, i) => ({ i, v }))}>
              <Line type="monotone" dataKey="v" stroke="#6b5b54" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

---

## Step 6: Bundle and Export

After building the artifact:
```bash
bash scripts/bundle-artifact.sh
```

To export to PDF/PNG for async sharing, run the `html-export` skill on `bundle.html`.

---

## Checklist Before Delivering

- [ ] Only brand palette colors used (Taupe, Slate, Khaki, Charcoal, Linen, Off-White)
- [ ] No more than 3 data series per chart
- [ ] No 3D, drop shadows, or gradients
- [ ] Axes are clean (no tick lines on Y, no vertical gridlines)
- [ ] Data labels or values readable without hover where possible
- [ ] Chart title and subtitle convey the insight, not just the data name
- [ ] Font is Poppins (labels) / Lora (body/tooltip)
