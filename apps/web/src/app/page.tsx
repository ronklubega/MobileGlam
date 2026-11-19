import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { PhoneDemo } from "@/components/landing/phone-demo";
import { Reveal } from "@/components/landing/reveal";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "GlamDesk — Beauty bookings, simplified",
  description: "Online booking, Mobile Money deposits and SMS reminders for salons, barbershops and hair clinics in Uganda.",
};
export const dynamic = "force-dynamic";

const NAV = [["How it works", "#how"], ["Features", "#features"], ["For businesses", "#business"]] as const;

const STEPS = [
  { n: "1", title: "Find", text: "Clients discover salons, barbershops and hair clinics near them, with photos, services and prices." },
  { n: "2", title: "Book", text: "They pick a stylist and a live, open time. Taken slots disappear instantly, so double-booking can't happen." },
  { n: "3", title: "Pay a deposit", text: "A small deposit by MTN MoMo or Airtel Money secures the slot. No more empty chairs from no-shows." },
];

const FEATURES = [
  { icon: "📍", title: "Location-aware discovery", text: "Clients see the nearest open businesses first, filtered by category, distance and home visits." },
  { icon: "🗓️", title: "Live availability", text: "Each stylist's weekly shifts and time off drive the slots clients see. The database itself prevents overlaps." },
  { icon: "📲", title: "Mobile Money deposits", text: "Direct MTN MoMo and Airtel Money collections. Deposits are confirmed before the booking is." },
  { icon: "⏰", title: "SMS reminders", text: "Clients get a text two hours before they're due, which cuts no-shows without any effort from you." },
  { icon: "📊", title: "Revenue & clients", text: "Daily revenue, commission and a client book with visit history and private notes, in one dashboard." },
  { icon: "🛡️", title: "Secure by design", text: "Every salon's data is isolated. Payout changes need your password and an SMS code." },
];

const BUSINESS = ["Set up services, prices and deposits in minutes", "Add staff with their own schedules", "Upload photos so clients see your work", "Track bookings, deposits and refunds", "Get paid straight to your Mobile Money"];
const CLIENT = ["Browse salons near you, with real photos", "See open times instantly, no phone calls", "Pay a small deposit from your phone", "Get a reminder before you go", "Request a home visit where offered"];

function Check({ dark }: { dark?: boolean }) {
  return <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dark ? "bg-[#F7C948] text-[#3B1763]" : "bg-[#5b2a86] text-white"}`}>✓</span>;
}

export default async function Home() {
  let signedIn = false;
  try {
    const { data } = await (await supabaseServer()).auth.getClaims();
    signedIn = !!data?.claims;
  } catch { /* landing page must render even if auth is unreachable */ }

  const bars = [38, 52, 44, 68, 60, 84, 96];

  return (
    <div className="bg-white text-[#1e1b24]" style={{ "--ink": "#1e1b24", "--brand": "#5b2a86", "--muted": "#6b6577" } as React.CSSProperties}>
      <noscript><style>{`[data-reveal],.lp-line,.lp-bar{opacity:1!important;transform:none!important}`}</style></noscript>

      {/* ───── Header ───── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#26103F]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" aria-label="GlamDesk home"><Logo inverted size={34} /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex" aria-label="Main">
            {NAV.map(([label, href]) => <a key={href} href={href} className="transition hover:text-white">{label}</a>)}
          </nav>
          <div className="flex items-center gap-2.5">
            {signedIn ? (
              <Link href="/dashboard" className="rounded-full bg-[#F7C948] px-4 py-2 text-sm font-bold text-[#3B1763] transition hover:brightness-105">Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-3.5 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10">Sign in</Link>
                <Link href="/register" className="rounded-full bg-[#F7C948] px-4 py-2 text-sm font-bold text-[#3B1763] transition hover:brightness-105">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ───── Hero ───── */}
        <section className="lp-hero relative overflow-hidden pt-16 text-white">
          <span className="lp-orb -left-24 top-32 h-80 w-80 bg-[#8447C4]" aria-hidden />
          <span className="lp-orb right-0 top-10 h-72 w-72 bg-[#F7C948]/40" style={{ animationDelay: "-6s" }} aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 md:py-28 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F7C948]" /> Built for Uganda · MTN MoMo &amp; Airtel Money
                </span>
              </Reveal>
              <Reveal delay={100}>
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                  Fill every chair.<br /><span className="lp-shine">Not a minute wasted.</span>
                </h1>
              </Reveal>
              <Reveal delay={200}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
                  GlamDesk lets clients find and book your salon, barbershop or hair clinic online, pay a deposit by Mobile Money, and get reminded by SMS. You get a calendar that never double-books and a dashboard that shows your money.
                </p>
              </Reveal>
              <Reveal delay={300} className="mt-9 flex flex-wrap gap-3">
                <Link href={signedIn ? "/dashboard" : "/register"} className="rounded-full bg-[#F7C948] px-6 py-3.5 text-base font-bold text-[#3B1763] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:brightness-105">
                  {signedIn ? "Open dashboard" : "Create your free account"}
                </Link>
                <a href="#how" className="rounded-full border border-white/25 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-white/10">See how it works</a>
              </Reveal>
              <Reveal delay={400}>
                <p className="mt-6 text-sm text-white/55">Clients book in the GlamDesk mobile app. Businesses run everything from this website.</p>
              </Reveal>
            </div>
            <Reveal delay={250}><PhoneDemo /></Reveal>
          </div>
          <svg className="relative block w-full text-white" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden><path fill="currentColor" d="M0 60V28C240 0 480 0 720 22s480 30 720 4v30z" /></svg>
        </section>

        {/* ───── Business types ticker ───── */}
        <section aria-label="Who GlamDesk is for" className="overflow-hidden border-b border-[#e5dfec] bg-white py-6">
          <div className="lp-marquee flex w-max gap-12 whitespace-nowrap text-sm font-bold uppercase tracking-widest text-[#5b2a86]/70">
            {Array.from({ length: 2 }).flatMap((_, k) => ["Hair salons", "Barbershops", "Hair clinics", "Braiding studios", "Home-visit stylists", "Trichology"].map((t) => <span key={`${k}-${t}`} className="flex items-center gap-12">{t}<span aria-hidden className="text-[#F7C948]">✦</span></span>))}
          </div>
        </section>

        {/* ───── How it works ───── */}
        <section id="how" className="relative scroll-mt-20 overflow-hidden bg-[#140a22] py-24 text-white sm:py-28">
          {/* Photo on a black backdrop + screen blending: the black drops out, so he sits "cut out" on the section. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(700px_520px_at_72%_38%,rgba(122,60,184,0.55),transparent_70%)]" />
            <div className="lp-how-photo absolute inset-0 mix-blend-screen lg:left-auto lg:w-[64%]">
              <Image src="/landing/afro-profile.jpg" alt="" fill sizes="(min-width: 1024px) 64vw, 100vw" className="object-cover object-[60%_center] opacity-40 lg:object-center lg:opacity-95" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#140a22]/70 via-[#140a22]/30 to-[#140a22] lg:hidden" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#140a22] to-transparent" />
            <div className="lp-orb left-[-120px] top-[30%] h-72 w-72 bg-[#F7C948]/20" />
          </div>

          <div className="relative mx-auto max-w-6xl px-5">
            <Reveal className="max-w-xl">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F7C948]">How it works</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl sm:leading-[1.08]">
                From “I need a trim” to <span className="lp-shine">booked</span> in under a minute
              </h2>
              <p className="mt-4 text-lg text-white/70">No calls, no waiting on WhatsApp replies. Three taps and the chair is yours.</p>
            </Reveal>

            <ol className="relative mt-12 max-w-xl space-y-4">
              <span aria-hidden className="absolute bottom-10 left-[39px] top-10 w-0.5 bg-gradient-to-b from-[#B27BE8] via-[#8447C4] to-[#F7C948]" />
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={i * 140} className="group relative flex gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md transition duration-300 hover:border-white/25 hover:bg-white/[0.1]">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold text-white shadow-lg shadow-black/40 ring-4 ring-[#140a22] transition group-hover:scale-110" style={{ background: "linear-gradient(135deg,#9A5FD6,#4A2273)" }}>{s.n}</span>
                    <div>
                      <h3 className="text-lg font-bold">{s.title}</h3>
                      <p className="mt-1 leading-relaxed text-white/70">{s.text}</p>
                    </div>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={450} className="mt-8 flex max-w-xl flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
              <span className="flex items-center gap-2"><span aria-hidden className="text-[#F7C948]">✦</span>Under 60 seconds</span>
              <span className="flex items-center gap-2"><span aria-hidden className="text-[#F7C948]">✦</span>MTN MoMo &amp; Airtel Money</span>
              <span className="flex items-center gap-2"><span aria-hidden className="text-[#F7C948]">✦</span>SMS reminder before you go</span>
            </Reveal>
          </div>

          {/* Floating confirmations beside the portrait (desktop) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-6xl lg:block">
            <div className="lp-float absolute right-2 top-[14%] flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFCB05] text-sm font-extrabold text-[#1e1b24]">M</span>
              <div><p className="text-xs text-white/60">Deposit received</p><p className="text-sm font-bold">UGX 5,000 · MTN MoMo</p></div>
            </div>
            <div className="lp-float absolute bottom-[12%] right-[10%] flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[#1e1b24] shadow-2xl shadow-black/50" style={{ animationDelay: "-3s" }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcfae6] text-[#067647]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              <div><p className="text-sm font-bold">Booking confirmed</p><p className="text-xs text-[#6b6577]">Sat 10:30 · Afro shape-up & trim</p></div>
            </div>
          </div>

          <p className="absolute bottom-3 right-4 text-[10px] text-white/35">Photo: Gift Habeshaw / Unsplash</p>
        </section>

        {/* ───── Features ───── */}
        <section id="features" className="scroll-mt-20 bg-[#f6f3fa] py-24">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-[#8447C4]">Features</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything a busy salon needs, nothing it doesn&apos;t</h2>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 90}>
                  <div className="group h-full rounded-2xl border border-[#e5dfec] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#5b2a86]/10">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1e8f9] text-2xl transition group-hover:scale-110 group-hover:rotate-3">{f.icon}</span>
                    <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#6b6577]">{f.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ───── For businesses (dashboard preview) ───── */}
        <section id="business" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-14 px-5 py-24 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-widest text-[#8447C4]">For businesses</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">See your day, and your money, at a glance</h2>
            <ul className="mt-7 space-y-3.5">
              {BUSINESS.map((t) => <li key={t} className="flex items-start gap-3"><Check />{t}</li>)}
            </ul>
            <Link href={signedIn ? "/dashboard" : "/register"} className="mt-9 inline-block rounded-full bg-[#5b2a86] px-6 py-3.5 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#4a2273]">
              {signedIn ? "Open dashboard" : "Register your business"}
            </Link>
          </Reveal>
          <Reveal delay={150}>
            <div className="rounded-3xl border border-[#e5dfec] bg-white p-5 shadow-2xl shadow-[#5b2a86]/15" aria-hidden>
              <div className="flex items-center gap-1.5 pb-4"><i className="h-2.5 w-2.5 rounded-full bg-[#fda29b]" /><i className="h-2.5 w-2.5 rounded-full bg-[#fedf89]" /><i className="h-2.5 w-2.5 rounded-full bg-[#6ce9a6]" /></div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["Today", "12", "bookings"], ["Deposits", "UGX 240k", "this week"], ["Reminders", "Auto SMS", "2 hours before"]].map(([a, b, c]) => (
                  <div key={a} className="rounded-2xl bg-[#f6f3fa] p-3"><p className="text-[11px] font-semibold text-[#6b6577]">{a}</p><p className="mt-1 text-lg font-extrabold text-[#5b2a86]">{b}</p><p className="text-[10px] text-[#6b6577]">{c}</p></div>
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold text-[#6b6577]">Revenue, last 7 days <span className="font-normal">(sample data)</span></p>
              <div className="mt-2 flex h-36 items-end gap-2.5 rounded-2xl bg-[#faf8fc] p-3">
                {bars.map((h, i) => <span key={i} className="lp-bar flex-1 rounded-t-lg" style={{ height: `${h}%`, transitionDelay: `${i * 90}ms`, background: i === bars.length - 1 ? "linear-gradient(#F7C948,#e6a800)" : "linear-gradient(#8447C4,#5b2a86)" }} />)}
              </div>
              <div className="mt-4 space-y-2 text-[13px]">
                {[["10:00", "Silk press · Aisha", "Confirmed"], ["11:30", "Fade & beard · Brian", "Confirmed"], ["13:00", "Scalp treatment · Dr. Mary", "Awaiting deposit"]].map(([t, n, s]) => (
                  <div key={t} className="flex items-center justify-between rounded-xl border border-[#e5dfec] px-3 py-2"><span><b>{t}</b> · {n}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s === "Confirmed" ? "bg-[#dcfae6] text-[#067647]" : "bg-[#fef0c7] text-[#b54708]"}`}>{s}</span></div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ───── For clients ───── */}
        <section className="bg-[#f6f3fa] py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
            <Reveal className="order-2 lg:order-1">
              <div className="rounded-3xl p-8 text-white" style={{ background: "linear-gradient(150deg,#6B33A0,#3B1763)" }}>
                <p className="text-sm font-bold uppercase tracking-widest text-[#F7C948]">For clients</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Your next appointment, a few taps away</h2>
                <ul className="mt-6 space-y-3.5 text-white/90">
                  {CLIENT.map((t) => <li key={t} className="flex items-start gap-3"><Check dark />{t}</li>)}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={150} className="order-1 lg:order-2">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">No more calling around, or waiting for a reply</h2>
              <p className="mt-5 text-lg leading-relaxed text-[#6b6577]">Clients open the GlamDesk app, see who is open near them, and book in a few taps. The deposit is paid with the Mobile Money they already use, and the slot is held while they approve it on their phone.</p>
            </Reveal>
          </div>
        </section>

        {/* ───── CTA ───── */}
        <section className="px-5 py-24">
          <Reveal className="lp-hero relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-8 py-16 text-center text-white">
            <span className="lp-orb -right-10 -top-10 h-64 w-64 bg-[#F7C948]/40" aria-hidden />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to fill your calendar?</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/75">Create your account, add your services and staff, and start taking bookings. It takes a few minutes.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href={signedIn ? "/dashboard" : "/register"} className="rounded-full bg-[#F7C948] px-7 py-3.5 font-bold text-[#3B1763] transition hover:-translate-y-0.5 hover:brightness-105">{signedIn ? "Open dashboard" : "Create account"}</Link>
              {signedIn ? null : <Link href="/login" className="rounded-full border border-white/25 px-7 py-3.5 font-semibold transition hover:bg-white/10">Sign in</Link>}
            </div>
          </Reveal>
        </section>
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-[#e5dfec] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-[#6b6577] sm:flex-row">
          <Logo size={28} />
          <p>© {new Date().getFullYear()} GlamDesk. Built for Uganda.</p>
          <div className="flex gap-5"><Link href="/login" className="hover:text-[#5b2a86]">Sign in</Link><Link href="/register" className="hover:text-[#5b2a86]">Create account</Link></div>
        </div>
      </footer>
    </div>
  );
}
