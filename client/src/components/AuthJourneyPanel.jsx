import {
  IconArrowUpRight,
  IconBook2,
  IconBriefcase,
  IconBulb,
  IconCompass,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react'

function AuthJourneyPanel({ heading, supportingText }) {
  return (
    <aside className="group relative isolate min-h-[270px] overflow-hidden rounded-[30px] border border-orange-300/35 bg-[linear-gradient(145deg,#fb923c_0%,#f97316_46%,#dc5b16_100%)] p-6 text-white shadow-[0_28px_80px_-34px_rgba(194,65,12,0.6)] sm:min-h-[330px] sm:p-8 lg:min-h-[650px] lg:p-10 xl:p-12">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      <div className="pointer-events-none absolute -right-28 top-10 h-72 w-72 rounded-full bg-amber-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-red-700/20 blur-3xl" />

      <div className="relative z-10 max-w-md">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-100">
          <span className="h-px w-7 bg-orange-100/75" />
          LearnMatch pathway
        </div>
        <h2 className="max-w-sm text-3xl font-bold leading-[1.08] tracking-[-0.025em] sm:text-4xl">{heading}</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-orange-50/90 sm:text-base">{supportingText}</p>
      </div>

      <div className="relative z-10 mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:hidden">
        <div className="rounded-2xl border border-white/30 bg-white/90 p-3 text-gray-800 shadow-lg shadow-orange-900/10 backdrop-blur-xl">
          <IconBulb className="mb-2 text-orange-600" size={20} stroke={1.8} />
          <p className="text-xs font-bold">Understand yourself</p>
        </div>
        <IconArrowUpRight className="rotate-45 text-orange-100/75" size={20} />
        <div className="rounded-[20px] border border-white/30 bg-orange-50/95 p-3 text-gray-800 shadow-lg shadow-orange-900/10 backdrop-blur-xl">
          <IconCompass className="mb-2 text-orange-600" size={20} stroke={1.8} />
          <p className="text-xs font-bold">Build your direction</p>
        </div>
      </div>

      <div className="absolute inset-x-8 bottom-8 top-[225px] hidden lg:block xl:inset-x-11 xl:bottom-11">
        <svg aria-hidden="true" viewBox="0 0 560 390" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <path d="M92 285 C150 220 128 145 210 132 S340 184 373 103 S450 42 507 58" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeDasharray="4 9" />
          <circle cx="92" cy="285" r="5" fill="#fff" fillOpacity=".9" />
          <circle cx="210" cy="132" r="5" fill="#fff" fillOpacity=".9" />
          <circle cx="373" cy="103" r="5" fill="#fff" fillOpacity=".9" />
          <circle cx="507" cy="58" r="7" fill="#fed7aa" />
        </svg>

        <div className="absolute left-[2%] top-[54%] w-[48%] rounded-[24px] border border-white/35 bg-white/92 p-5 text-gray-800 shadow-[0_18px_42px_-20px_rgba(124,45,18,.55)] backdrop-blur-xl transition duration-200 motion-safe:group-hover:-translate-y-1">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><IconTargetArrow size={23} stroke={1.7} /></span>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600">Start here</span>
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Your foundation</p>
          <p className="mt-1 text-lg font-bold tracking-tight">Understand yourself</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">Interests</span>
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">Strengths</span>
          </div>
        </div>

        <div className="absolute left-[40%] top-[24%] w-[43%] rotate-[-2deg] rounded-[22px] border border-white/25 bg-white/20 p-4 shadow-[0_18px_38px_-22px_rgba(124,45,18,.7)] backdrop-blur-xl transition duration-200 motion-safe:hover:rotate-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-orange-600"><IconBook2 size={20} stroke={1.8} /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-100">Explore</p>
              <p className="text-sm font-bold">Discover possibilities</p>
            </div>
          </div>
        </div>

        <div className="absolute right-[1%] top-[3%] flex h-24 w-24 flex-col items-center justify-center rounded-full border border-white/35 bg-amber-100 text-center text-orange-800 shadow-[0_16px_34px_-18px_rgba(124,45,18,.65)] transition duration-200 motion-safe:hover:-translate-y-1">
          <IconBriefcase size={23} stroke={1.7} />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">Direction</span>
        </div>

        <div className="absolute bottom-[4%] right-[2%] flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2.5 text-xs font-semibold shadow-sm backdrop-blur-xl">
          <IconSparkles size={15} /> Skills become possibilities
        </div>
      </div>
    </aside>
  )
}

export default AuthJourneyPanel
