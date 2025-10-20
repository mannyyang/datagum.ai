# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

- **ALWAYS use `pnpm`** for all package management tasks
- Never use npm or yarn
- Examples:
  - `pnpm install` (not npm install)
  - `pnpm add <package>` (not npm install)
  - `pnpm run build` (not npm run build)

## Development Commands

### Local Development
```bash
pnpm dev  # Runs dev server on port 4444 with Turbopack
```

### Build & Deploy
```bash
pnpm build              # Build Next.js app
pnpm lint               # Run ESLint
pnpm run deploy         # Build and deploy to Cloudflare
pnpm preview            # Build and preview on Cloudflare locally
pnpm cf-typegen         # Generate Cloudflare environment types
```

**Important**: Before your first deployment, you must run `pnpm cf-typegen` to generate the `cloudflare-env.d.ts` file. This file is required for TypeScript compilation and is referenced in `tsconfig.json`. Regenerate this file whenever you modify Cloudflare bindings in `wrangler.jsonc`.

### Code Quality
- **Pre-commit hooks**: Husky + lint-staged automatically runs ESLint and Prettier on staged files
- Lint staged files: ESLint fix + Prettier write on `.{js,jsx,ts,tsx}` files
- Format staged files: Prettier write on `.{json,md}` files

## Architecture Overview

This is a **Next.js 15** application configured to deploy on **Cloudflare** using **OpenNext for Cloudflare**. The stack:

- **Framework**: Next.js 15.4.6 with App Router
- **Runtime**: React 19.1.0
- **Deployment**: Cloudflare via `@opennextjs/cloudflare`
- **Styling**: Tailwind CSS v4 with shadcn/ui components (New York style)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **TypeScript**: Strict mode enabled

### Project Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── layout.tsx    # Root layout with Geist fonts
│   ├── page.tsx      # Home page
│   └── globals.css   # Global styles
└── lib/
    └── utils.ts      # Utility functions (cn for classnames)
```

### Key Configuration Files

- **next.config.ts**: Initialized with OpenNext Cloudflare dev mode via `initOpenNextCloudflareForDev()`
- **open-next.config.ts**: Cloudflare-specific OpenNext configuration (R2 cache commented out)
- **wrangler.jsonc**: Cloudflare Workers configuration with comprehensive inline documentation
- **components.json**: shadcn/ui config - use `@/` path aliases for imports
- **tsconfig.json**: Path alias `@/*` maps to `./src/*`, includes Cloudflare env types

### Cloudflare Integration

- Development mode calls `getCloudflareContext()` for local Cloudflare bindings
- Use `pnpm cf-typegen` to regenerate `cloudflare-env.d.ts` when adding Cloudflare bindings (KV, R2, D1, etc.)
- OpenNext handles Next.js → Cloudflare Workers adapter automatically

### UI Components

- **shadcn/ui** configured with:
  - Style: "new-york"
  - Base color: zinc
  - CSS variables: enabled
  - Icon library: lucide
  - Components path: `@/components/ui`

### Fonts

- **Geist Sans**: Primary sans-serif font (variable: `--font-geist-sans`)
- **Geist Mono**: Monospace font (variable: `--font-geist-mono`)

## Adding Components

Use the shadcn CLI to add new UI components:
```bash
pnpx shadcn@latest add <component-name>
```

Components will be added to `src/components/ui/` with proper path aliases.
