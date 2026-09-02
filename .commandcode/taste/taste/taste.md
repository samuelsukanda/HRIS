# Taste
- User communicates in Indonesian (Bahasa Indonesia); respond in Indonesian. Confidence: 0.9
- When asking for a review, expects the missing UI/features to actually be added/implemented in the code (not just a findings report) and the outcome delivered as a written review document (e.g., REVIEW.md). Confidence: 0.6
- In forms capturing technical values (e.g., GPS coordinates for work locations), prefers a visual/interactive input like an embedded map picker over raw coordinate entry ("bukan hanya koordinatnya saja"). Confidence: 0.6
- Develops on Windows via Laragon Herd; main project is an HRIS app at C:\Users\Admin\Herd\hris (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 via @tailwindcss/postcss, Vitest, ESLint, npm/package-lock). Confidence: 0.7
- On the user's machine, npm is globally configured to omit devDependencies (omit=dev / NODE_ENV=production), so `npm install` silently drops devDependencies; build-required packages must live in `dependencies`. Confidence: 0.85
- In this project, Turbopack fails to resolve Tailwind v4 native modules (@tailwindcss/oxide, lightningcss); `dev` and `build` scripts intentionally pin `next dev --webpack` / `next build --webpack`. Do not "fix" this by switching back to Turbopack. Confidence: 0.85
