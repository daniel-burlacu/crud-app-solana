// src/components/crudapp/JournalPaper.tsx
import { PropsWithChildren } from 'react'

export default function JournalPaper({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen">
      {/* Lined paper background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          // soft paper base
          background:
            'linear-gradient(0deg, rgba(255,255,255,0.95), rgba(255,255,255,0.95))',
        }}
      />
      {/* Blue horizontal lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            // 28px spaced blue ruled lines
            'repeating-linear-gradient( to bottom, transparent 0px, transparent 26px, rgba(88,147,234,0.25) 26px, rgba(88,147,234,0.25) 27px, transparent 27px, transparent 28px )',
        }}
      />
      {/* Red margin line (left) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[56px] w-px bg-[rgba(255,92,92,0.45)]"
      />

      {/* Glitter / sparkles */}
      <Sparkles />

      {/* Content card shadow mask to separate from bg a bit */}
      <div className="relative">
        {children}
      </div>
    </div>
  )
}

function Sparkles() {
  // A few radial-gradients that gently twinkle
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(255,215,0,0.4) 0 2px, transparent 3px),
          radial-gradient(circle at 35% 65%, rgba(255,105,180,0.35) 0 2px, transparent 3px),
          radial-gradient(circle at 70% 30%, rgba(135,206,250,0.35) 0 2px, transparent 3px),
          radial-gradient(circle at 85% 80%, rgba(144,238,144,0.35) 0 2px, transparent 3px),
          radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5) 0 1.5px, transparent 2.5px)
        `,
        backgroundRepeat: 'no-repeat',
        animation: 'twinkle 3.2s ease-in-out infinite',
      }}
    />
  )
}
