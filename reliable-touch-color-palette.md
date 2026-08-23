# Reliable Touch Services — Brand Color Palette

## Brand Overview

This palette is based on the Reliable Touch Services logo and is intended for the company website and web system.

The core visual identity uses:
- Coral red as the primary brand accent
- Black / near-black for strong contrast and dark interfaces
- White and neutral grays for clean surfaces and typography

---

# 1. Core Brand Colors

| Color | HEX | RGB | Usage |
|---|---|---|---|
| Reliable Coral | `#F95C4B` | `249, 92, 75` | Primary brand color |
| White | `#FFFFFF` | `255, 255, 255` | Logo, text, light surfaces |
| Black | `#000000` | `0, 0, 0` | Logo, dark backgrounds |

### Primary Brand Color

`#F95C4B`

Use this as the main accent throughout the website and web system.

Recommended uses:
- Primary buttons
- Active navigation
- Links
- Important icons
- Highlights
- Status accents
- Key calls to action
- Selected states

---

# 2. Light Mode Palette

| Purpose | Name | HEX |
|---|---|---|
| Page background | Off White | `#FAFAF9` |
| Card / Surface | White | `#FFFFFF` |
| Main text | Near Black | `#111111` |
| Secondary text | Gray | `#6B7280` |
| Primary brand | Coral | `#F95C4B` |
| Primary hover | Dark Coral | `#E84B3A` |
| Border | Light Gray | `#E5E7EB` |
| Input background | Soft Gray | `#F5F5F4` |
| Success | Green | `#16A34A` |
| Warning | Amber | `#F59E0B` |
| Error | Red | `#DC2626` |

### Light Mode Structure

```text
Background       #FAFAF9
Cards            #FFFFFF
Text             #111111
Secondary text   #6B7280
Brand            #F95C4B
Brand hover      #E84B3A
Borders          #E5E7EB
Inputs           #F5F5F4
```

---

# 3. Dark Mode Palette

| Purpose | Name | HEX |
|---|---|---|
| Main background | Deep Black | `#0B0B0B` |
| Secondary background | Dark | `#121212` |
| Card / Surface | Dark Surface | `#181818` |
| Elevated surface | Elevated Dark | `#202020` |
| Main text | White | `#FFFFFF` |
| Secondary text | Muted Gray | `#A1A1AA` |
| Primary brand | Coral | `#F95C4B` |
| Primary hover | Light Coral | `#FF7060` |
| Border | Dark Gray | `#2A2A2A` |
| Input background | Dark Surface | `#181818` |
| Success | Green | `#22C55E` |
| Warning | Amber | `#FBBF24` |
| Error | Light Red | `#F87171` |

### Dark Mode Structure

```text
Background       #0B0B0B
Secondary        #121212
Cards            #181818
Elevated cards   #202020
Text             #FFFFFF
Secondary text   #A1A1AA
Brand            #F95C4B
Brand hover      #FF7060
Borders          #2A2A2A
Inputs           #181818
```

---

# 4. Recommended Color Usage

Do not use the coral color everywhere.

Recommended visual balance:

- **70–80%** neutral colors
- **10–15%** surface/background variations
- **5–10%** brand coral

The coral should draw attention to important actions and information.

### Good Usage

```text
Primary Button       #F95C4B
Button Hover         #E84B3A
Active Navigation    #F95C4B
Important Link       #F95C4B
Selected Tab         #F95C4B
Brand Icon           #F95C4B
```

### Avoid

- Large full-page coral backgrounds
- Making every button coral
- Using coral for ordinary body text
- Using multiple unrelated accent colors
- Excessive gradients

---

# 5. UI Examples

## Light Mode

```text
Page
└── Background: #FAFAF9

    Card
    ├── Background: #FFFFFF
    ├── Border: #E5E7EB
    ├── Heading: #111111
    └── Secondary text: #6B7280

    Primary Button
    ├── Background: #F95C4B
    └── Hover: #E84B3A
```

## Dark Mode

```text
Page
└── Background: #0B0B0B

    Card
    ├── Background: #181818
    ├── Border: #2A2A2A
    ├── Heading: #FFFFFF
    └── Secondary text: #A1A1A1

    Primary Button
    ├── Background: #F95C4B
    └── Hover: #FF7060
```

---

# 6. CSS Variables

```css
:root {
  /* Brand */
  --color-primary: #F95C4B;
  --color-primary-hover: #E84B3A;

  /* Backgrounds */
  --color-background: #FAFAF9;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F5F5F4;

  /* Typography */
  --color-text: #111111;
  --color-text-secondary: #6B7280;

  /* Borders */
  --color-border: #E5E7EB;

  /* Feedback */
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-error: #DC2626;
}

.dark {
  /* Brand */
  --color-primary: #F95C4B;
  --color-primary-hover: #FF7060;

  /* Backgrounds */
  --color-background: #0B0B0B;
  --color-surface: #181818;
  --color-surface-muted: #202020;

  /* Typography */
  --color-text: #FFFFFF;
  --color-text-secondary: #A1A1AA;

  /* Borders */
  --color-border: #2A2A2A;

  /* Feedback */
  --color-success: #22C55E;
  --color-warning: #FBBF24;
  --color-error: #F87171;
}
```

---

# 7. Tailwind CSS Reference

```text
Primary:          #F95C4B
Primary Hover:    #E84B3A
Light Background: #FAFAF9
Light Surface:    #FFFFFF
Light Text:       #111111
Light Muted:      #6B7280
Light Border:     #E5E7EB

Dark Background:  #0B0B0B
Dark Surface:     #181818
Dark Elevated:    #202020
Dark Text:        #FFFFFF
Dark Muted:       #A1A1AA
Dark Border:      #2A2A2A
```

---

# 8. Design Direction

The overall design should feel:

- Professional
- Modern
- Clean
- Trustworthy
- Premium
- Minimal
- Strong brand recognition

The Reliable Touch coral should function as an **accent color**, while black, white and neutral grays form the foundation of the interface.

Avoid introducing another primary brand color unless there is a specific functional reason.

---

## Final Primary Palette

```text
RELIABLE CORAL   #F95C4B
CORAL HOVER      #E84B3A
BLACK            #000000
NEAR BLACK       #111111
DARK BACKGROUND  #0B0B0B
DARK SURFACE     #181818
WHITE            #FFFFFF
LIGHT BACKGROUND #FAFAF9
MUTED GRAY       #6B7280
LIGHT BORDER     #E5E7EB
DARK BORDER      #2A2A2A
```
