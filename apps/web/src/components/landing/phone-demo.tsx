/** Looping, CSS-only walkthrough of a booking inside a phone frame. No JS, no real data. */
export function PhoneDemo() {
  return (
    <div className="lp-float relative mx-auto w-[270px] sm:w-[290px]" aria-hidden>
      <div className="relative rounded-[2.6rem] border border-white/15 bg-[#120a1f] p-2.5 shadow-[0_40px_90px_-20px_rgba(0,0,0,.7)]">
        <div className="absolute left-1/2 top-3.5 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-[540px] overflow-hidden rounded-[2.1rem] bg-[#f6f3fa] text-[#1e1b24]">
          {/* 1 · Discover */}
          <section className="lp-screen lp-s1 absolute inset-0 px-4 pt-12">
            <p className="text-[11px] font-semibold text-[#6b6577]">Near Kololo</p>
            <p className="mb-3 text-lg font-extrabold">Find a salon</p>
            <div className="mb-3 flex gap-1.5 text-[10px] font-semibold">
              <span className="rounded-full bg-[#5b2a86] px-2.5 py-1 text-white">All</span>
              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Salons</span>
              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Barbers</span>
            </div>
            {[["Velvet Crown Salon", "Kololo · 0.8 km", "#8447C4"], ["Fade Lab Barbers", "Nakasero · 1.4 km", "#3B1763"], ["Scalp Clinic", "Ntinda · 3.1 km", "#F7C948"], ["Braids & Beyond", "Bugolobi · 4.2 km", "#B48BE0"], ["Glow Home Visits", "Comes to you", "#6B33A0"]].map(([n, d, c], i) => (
              <div key={n} className={`mb-2.5 flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ${i === 0 ? "lp-tap" : ""}`}>
                <span className="h-12 w-12 rounded-xl" style={{ background: c }} />
                <span><b className="block text-[13px]">{n}</b><span className="text-[11px] text-[#6b6577]">{d}</span></span>
              </div>
            ))}
          </section>
          {/* 2 · Pick a time */}
          <section className="lp-screen lp-s2 absolute inset-0 px-4 pt-12">
            <p className="text-lg font-extrabold">Pick a time</p>
            <p className="mb-3 text-[11px] text-[#6b6577]">Silk press · 90 min · with Aisha</p>
            <div className="grid grid-cols-3 gap-2 text-center text-[12px] font-semibold">
              {["09:00", "10:30", "11:00", "12:30", "14:00", "15:30"].map((t, i) => (
                <span key={t} className={`rounded-xl py-2.5 ${i === 2 ? "lp-pick bg-[#5b2a86] text-white" : i === 1 || i === 4 ? "bg-[#e5dfec] text-[#6b6577] line-through" : "bg-white shadow-sm"}`}>{t}</span>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-white p-3 text-[12px] shadow-sm">
              <div className="flex justify-between"><span>Price</span><b>UGX 60,000</b></div>
              <div className="mt-1 flex justify-between text-[#5b2a86]"><span>Deposit today (20%)</span><b>UGX 12,000</b></div>
            </div>
            <span className="mt-4 block rounded-xl bg-[#5b2a86] py-3 text-center text-[13px] font-bold text-white">Pay deposit</span>
          </section>
          {/* 3 · Mobile money */}
          <section className="lp-screen lp-s3 absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="lp-pulse mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFCC00] text-xl font-black text-[#1e1b24]">MTN</span>
            <p className="text-lg font-extrabold">Approve on your phone</p>
            <p className="mt-1 text-[12px] text-[#6b6577]">Enter your Mobile Money PIN to pay UGX 12,000. Your slot is held for 10 minutes.</p>
            <span className="mt-5 flex gap-1.5"><i className="lp-dot" /><i className="lp-dot" style={{ animationDelay: ".2s" }} /><i className="lp-dot" style={{ animationDelay: ".4s" }} /></span>
          </section>
          {/* 4 · Confirmed */}
          <section className="lp-screen lp-s4 absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <svg viewBox="0 0 52 52" className="mb-4 h-20 w-20"><circle cx="26" cy="26" r="24" fill="#dcfae6" /><path className="lp-check" d="M15 27l8 8 14-16" fill="none" stroke="#067647" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <p className="text-lg font-extrabold">You&apos;re booked!</p>
            <p className="mt-1 text-[12px] text-[#6b6577]">Velvet Crown Salon · Sat 11:00</p>
            <span className="mt-5 rounded-2xl bg-white px-3.5 py-2.5 text-left text-[11px] shadow-sm">💬 <b>Reminder</b> arrives 2 hours before your appointment.</span>
          </section>
        </div>
      </div>
      {/* floating callouts */}
      <span className="lp-chip lp-chip-a absolute -left-14 top-24 hidden rounded-2xl bg-white px-3.5 py-2.5 text-[12px] font-semibold text-[#1e1b24] shadow-xl sm:block">✅ No double-booking</span>
      <span className="lp-chip lp-chip-b absolute -right-16 top-64 hidden rounded-2xl bg-white px-3.5 py-2.5 text-[12px] font-semibold text-[#1e1b24] shadow-xl sm:block">💰 UGX 12,000 received</span>
      <span className="lp-chip lp-chip-c absolute -left-10 bottom-16 hidden rounded-2xl bg-[#F7C948] px-3.5 py-2.5 text-[12px] font-bold text-[#3B1763] shadow-xl sm:block">⏰ SMS reminder sent</span>
    </div>
  );
}
