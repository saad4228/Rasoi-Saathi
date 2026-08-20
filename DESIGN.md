# Design System Specification: Editorial Tactical

## 1. Overview & Creative North Star: "The Human Archive"
The Creative North Star for this design system is **"The Human Archive."** This is a move away from the cold, sterile "SaaS-blue" defaults of the modern web. We are building an experience that feels like a meticulously curated tactical journal—one that is high-trust, authoritative, and distinctly human-made.

The aesthetic marries the precision of a field operative's manual with the sophisticated layout of a premium editorial magazine. We achieve this by rejecting digital shortcuts like gradients and instead relying on **intentional asymmetry, flat tonal layering, and high-contrast typography.** The result is a UI that feels "analog-premium": tactile, grounded, and permanent.

---

## 2. Colors: The Earth & The Ink
This palette is rooted in the organic. We use deep browns and ochres to establish gravity, while cream and terracotta provide a warmth that invites the eye rather than fatiguing it.

### Color Principles
*   **The "No-Gradient" Mandate:** Gradients are strictly prohibited. Visual interest must be generated through flat color blocks and sharp, intentional transitions.
*   **Surface Hierarchy & Nesting:** Depth is created through a "Paper-on-Table" methodology. Use the `surface-container` tiers to nest content. 
    *   *Example:* A `surface-container-lowest` card (Pure White/Cream) sitting atop a `surface-container-low` section (Warm Grey) creates an immediate sense of physical layering without a single drop shadow.
*   **Tactical Accents:** Use `secondary` (Terracotta) and `tertiary` (Ochre) sparingly to draw attention to critical data or status changes.

### Key Tokens
*   **Background:** `#fcf9f4` (The Base Sheet)
*   **Primary:** `#553a34` (Deep Espresso - used for primary actions and high-authority text)
*   **Secondary:** `#974726` (Terracotta - used for tactical emphasis)
*   **Tertiary:** `#553d00` (Raw Sienna - used for warnings or high-trust labels)
*   **Surface Container High:** `#ebe8e3` (Used to "recede" secondary information)

---

## 3. Typography: Tactical Precision
The typography system is the backbone of the "Human-made" feel. We use a high-precision, geometric sans-serif to bridge the gap between "Story/Context" and "Data/Action."

*   **Cera Pro / Trebuchet MS (Sans-Serif):** This is our "Voice of Precision." Its geometric, slightly wider aperture ensures legibility in tactical lists, data-heavy tables, and hero headings alike.

### Typography Scale
*   **Display Large (Cera Pro, 3.5rem):** Reserved for hero impact.
*   **Headline Medium (Cera Pro, 1.75rem):** Used for section headers.
*   **Body Medium (Cera Pro, 0.875rem):** The workhorse for all instructional and secondary text.
*   **Label Medium (Cera Pro, 0.75rem):** Used for metadata, uppercase tactical tags, and micro-copy.

---

## 4. Elevation & Depth: Layered Physicality
Since gradients are banned, depth is achieved through **Tonal Layering** and **Stacked Shading.**

*   **The Layering Principle:** Treat the UI as a series of stacked sheets of high-gsm paper. Use `surface-container-lowest` (#ffffff) for the highest point of interest (like a focused card) and `surface-dim` (#dcdad5) for background foundations.
*   **Layered Ambient Shadows:** When an element must "float" (e.g., a floating action button or a modal), do not use a single dark shadow. Use a multi-layered shadow stack:
    1.  A very soft, wide blur of `on-surface` at 4% opacity.
    2.  A tighter, slightly more opaque (8%) shadow to define the edge. 
    *This mimics the soft diffusion of natural light across a desk.*
*   **The Ghost Border:** Sections should be separated by whitespace first. If a border is required, use `outline-variant` (#dac2b6) at 20-40% opacity. Forbid the use of 100% opaque black or high-contrast borders; they shatter the "editorial" softness.

---

## 5. Components: Tactile Utility

### Buttons
*   **Primary:** Solid `primary` (#553a34) with `on-primary` (#ffffff) text. Use `md` (0.375rem) roundedness. No glow, no gradient—just a heavy, flat block of color.
*   **Secondary:** Outline style using `outline` (#877369) at a 1px width.
*   **Tactical (Tertiary):** Text-only with a heavy underline in `secondary` (Terracotta) for a "notated" feel.

### Cards & Containers
*   **No Dividers:** Forbid the use of horizontal lines to separate list items. Instead, use a background shift (alternating `surface-container-low` and `surface-container-lowest`) or generous 24px-32px vertical spacing.
*   **Headers:** Every card or section header should use a `Newsreader` headline to maintain the high-end editorial feel.

### Inputs & Fields
*   **The "Field Note" Input:** Use a flat `surface-container-highest` background with a 1px bottom-border of `primary` only. This mimics a lined notebook, reinforcing the human-made aesthetic.

### Additional Signature Component: The "Archival Tag"
*   Use `label-sm` text in `on-tertiary-fixed` (#261900) on a `tertiary-fixed` (#ffdea0) background. These small, pill-shaped chips should feel like vintage library tags or tactical equipment labels.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Whitespace:** Use large, asymmetrical margins. If a column is 8 units wide, let the 4 units next to it be empty to create an editorial "breathing room."
*   **Use newsreader for Numbers:** In a data context, using Serif numbers makes metrics feel like "findings" rather than just "code."
*   **Layer Surfaces:** Use at least three different surface tones on a single screen to create architectural depth.

### Don’t:
*   **No Gradients:** Not even "subtle" ones. If it isn't a flat hex code, it doesn't belong.
*   **No 1px Solid Black Borders:** These feel "default" and "cheap." Use tonal shifts or lowered opacity borders instead.
*   **No Default "Blue" Links:** All interactive elements must stay within the Earth/Ochre/Terracotta palette to maintain the brand's visual soul.