import { getCertificateBody } from '../utils/certificatePdf'

function CornerStar({ color, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill={color} aria-hidden="true">
      <path d="M12 1.5L14.5 9.5L22.5 12L14.5 14.5L12 22.5L9.5 14.5L1.5 12L9.5 9.5L12 1.5Z" />
    </svg>
  )
}

function LearnMatchMonogram() {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 64 44" className="h-9 w-12 sm:h-11 sm:w-14" aria-hidden="true">
        <defs>
          <linearGradient id="lm-cert-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#e06918" />
          </linearGradient>
        </defs>
        <path
          d="M8 6h8v24h14v8H8V6zm22 0h8l8 13 8-13h8v32h-8V19l-8 12-8-12v19h-8V6z"
          fill="url(#lm-cert-brand-grad)"
        />
      </svg>
      <span className="mt-0.5 text-xs font-bold tracking-tight text-[#9a3412] sm:text-sm">
        LearnMatch
      </span>
    </div>
  )
}

export default function LearnMatchCertificate({
  studentName = 'Student Name',
  formattedDate = 'November 22, 2026',
  certificateId = 'LM-2026-000001',
  variant = 'standard',
  type = 'assessment',
}) {
  const isVerified = variant === 'verified'
  const outerStroke = '#e06918'
  const innerStroke = isVerified ? '#d4a017' : '#ea7a2a'
  const starColor = isVerified ? '#d4a017' : '#e06918'
  const accentText = '#b45309'
  const bodyText = getCertificateBody({ type, variant, formattedDate })

  return (
    <div
      className={`relative mx-auto aspect-[1.414/1] w-full max-w-4xl select-none overflow-hidden rounded-xl shadow-lg ${
        isVerified
          ? 'bg-gradient-to-br from-[#fffdf7] via-white to-[#fff8ee]'
          : 'bg-white'
      }`}
    >
      {/* Double-line outer frame */}
      <div
        className="pointer-events-none absolute inset-4 sm:inset-5"
        style={{ border: `${isVerified ? '2px' : '1.75px'} solid ${outerStroke}` }}
      />
      <div
        className="pointer-events-none absolute inset-[22px] sm:inset-[26px]"
        style={{ border: `1.25px solid ${innerStroke}` }}
      />

      {/* Corner cutouts + 4-point stars matching official LearnMatch certificate */}
      <div className={`absolute left-2 top-2 flex h-9 w-9 items-center justify-center sm:h-11 sm:w-11 ${isVerified ? 'bg-[#fffdf7]' : 'bg-white'}`}>
        <CornerStar color={starColor} />
      </div>
      <div className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center sm:h-11 sm:w-11 ${isVerified ? 'bg-[#fffdf7]' : 'bg-white'}`}>
        <CornerStar color={starColor} />
      </div>
      <div className={`absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center sm:h-11 sm:w-11 ${isVerified ? 'bg-[#fffaf2]' : 'bg-white'}`}>
        <CornerStar color={starColor} />
      </div>
      <div className={`absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center sm:h-11 sm:w-11 ${isVerified ? 'bg-[#fff8ee]' : 'bg-white'}`}>
        <CornerStar color={starColor} />
      </div>

      {/* Top center cutout for LM monogram */}
      <div
        className={`absolute left-1/2 top-2 -translate-x-1/2 px-6 py-1 sm:px-8 ${
          isVerified ? 'bg-[#fffdf8]' : 'bg-white'
        }`}
      >
        <LearnMatchMonogram />
      </div>

      {/* Bottom center cutout */}
      <div
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-6 py-1 text-center ${
          isVerified ? 'bg-[#fffaf2]' : 'bg-white'
        }`}
      >
        <span className="text-[9px] font-medium tracking-wider text-slate-400 sm:text-[10px]">
          Ref: {certificateId}
        </span>
      </div>

      {/* Verified Assessment Seal (Top-right inside frame) */}
      {isVerified && (
        <div className="absolute right-8 top-9 hidden sm:flex sm:right-11 sm:top-10">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-amber-500 bg-gradient-to-br from-emerald-800 to-emerald-950 p-1.5 text-center shadow-md ring-2 ring-emerald-700/20 ring-offset-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-amber-300">Official</span>
            <span className="mt-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white">
              Verified
            </span>
            <span className="text-[7px] font-semibold uppercase tracking-widest text-emerald-200">
              Monitored
            </span>
          </div>
        </div>
      )}

      {/* Main Centered Content */}
      <div className="relative flex h-full flex-col items-center justify-between px-10 pb-10 pt-20 text-center sm:px-16 sm:pb-12 sm:pt-24">
        <div className="w-full">
          <h2
            className="font-serif text-3xl font-normal tracking-[0.12em] text-slate-950 sm:text-5xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            CERTIFICATE
          </h2>
          <div className="mt-2 flex items-center justify-center gap-3 sm:gap-4">
            <span className="h-px w-12 sm:w-20" style={{ backgroundColor: outerStroke }} />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.34em] sm:text-sm"
              style={{ color: accentText }}
            >
              OF COMPLETION
            </span>
            <span className="h-px w-12 sm:w-20" style={{ backgroundColor: outerStroke }} />
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-700 sm:mt-7 sm:text-xs">
            PRESENTED TO
          </p>
          <div className="mx-auto mt-1.5 h-0.5 w-8" style={{ backgroundColor: outerStroke }} />

          {/* Recipient Name */}
          <div className="mx-auto mt-4 max-w-xl border-b border-slate-400/80 pb-2 sm:mt-5">
            <p
              className="truncate text-xl font-semibold tracking-wide text-slate-950 sm:text-3xl"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {studentName}
            </p>
          </div>

          {/* Body Paragraph */}
          <p className="mx-auto mt-4 max-w-xl text-[11px] leading-relaxed text-slate-700 sm:mt-5 sm:text-sm sm:leading-6">
            {bodyText}
          </p>
        </div>

        {/* Footer Signature & Date Columns */}
        <div className="mt-4 grid w-full max-w-2xl grid-cols-2 items-end gap-10 sm:gap-20">
          <div className="text-center">
            <p className="pb-1.5 text-xs font-medium italic text-slate-500 sm:text-sm">
              LearnMatch Platform
            </p>
            <div className="border-t border-slate-800 pt-1.5">
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.22em] sm:text-[11px]"
                style={{ color: accentText }}
              >
                LEARNMATCH TEAM
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="pb-1.5 text-xs font-semibold text-slate-900 sm:text-sm">
              {formattedDate}
            </p>
            <div className="border-t border-slate-800 pt-1.5">
              <p
                className="text-[9px] font-semibold uppercase tracking-[0.22em] sm:text-[11px]"
                style={{ color: accentText }}
              >
                DATE
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
