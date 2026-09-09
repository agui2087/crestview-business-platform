"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./ownership-scene.module.css";

export function OwnershipScene({ locale }: { locale: string }) {
  const root = useRef<HTMLElement>(null);
  const es = locale === "es";
  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let current = 0;
    let target = 0;
    let lastTime = 0;
    const measure = () => {
      const box = section.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -box.top / Math.max(1, box.height - window.innerHeight)));
      // Ease into and out of assembly instead of stopping at a linear boundary.
      return reduced.matches ? 1 : progress * progress * (3 - 2 * progress);
    };
    const paint = (time: number) => {
      frame = 0;
      const elapsed = Math.min(64, Math.max(0, time - lastTime));
      lastTime = time;
      // Time-based damping makes wheel steps glide, equally at 60 or 120 Hz.
      current += (target - current) * (1 - Math.exp(-elapsed / 90));
      if (Math.abs(target - current) < 0.0005) current = target;
      section.style.setProperty("--journey", String(current));
      if (current !== target) frame = requestAnimationFrame(paint);
    };
    const update = () => {
      target = measure();
      if (reduced.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        current = target;
        section.style.setProperty("--journey", String(current));
      } else if (!frame && current !== target) {
        lastTime = performance.now();
        frame = requestAnimationFrame(paint);
      }
    };
    // Restore a scrolled page without animating in from the wrong position.
    current = target = measure();
    section.style.setProperty("--journey", String(current));
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    reduced.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  return <section ref={root} className={styles.journey} aria-labelledby="ownership-title">
    <div className={styles.stage}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{es ? "TU PRÓXIMO CAPÍTULO" : "YOUR NEXT CHAPTER"}</p>
        <h1 id="ownership-title">{es ? "Un negocio." : "A business."}<br /><em>{es ? "Un futuro tuyo." : "A future of your own."}</em></h1>
        <p className={styles.description}>{es ? "Detrás de cada negocio hay algo que vale la pena construir. Encuentra tu oportunidad y da el siguiente paso con claridad." : "Behind every business is something worth building. Find your opportunity. See its potential. Make your next move with clarity."}</p>
        <div className={styles.actions}>
          <Link href={`/${locale}/listings`}>{es ? "Explorar negocios" : "Explore businesses"} <span aria-hidden="true">↗</span></Link>
          <Link href={`/${locale}/how-it-works`}>{es ? "Cómo funciona" : "How it works"} <span aria-hidden="true">→</span></Link>
        </div>
        <p className={styles.scrollHint}><span aria-hidden="true">↓</span> {es ? "Una oportunidad empieza a tomar forma" : "Watch an opportunity take shape"}</p>
      </div>
      <div className={styles.art} aria-hidden="true">
        <div className={styles.orbit} />
        <svg viewBox="0 0 800 720" focusable="false">
          <defs>
            <pattern id="district-grain" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#174c3c" opacity=".09" /></pattern>
            <linearGradient id="district-ground" x2="0" y2="1"><stop stopColor="#dfE8d9"/><stop offset="1" stopColor="#c4d7c4"/></linearGradient>
          </defs>
          <ellipse cx="406" cy="594" rx="290" ry="68" fill="#244c38" opacity=".06" />
          <g className={styles.ground}>
            <path d="M70 450 393 278 738 453 411 638Z" fill="url(#district-ground)"/>
            <path d="m70 450 341 172 327-169v22L411 659 70 472Z" fill="#a9c2ad"/>
            <path d="M70 450 393 278 738 453 411 638Z" fill="url(#district-grain)"/>
            <path d="m163 463 238 120 241-131M396 583V471" fill="none" stroke="#f9f4e6" strokeWidth="24"/>
            <path className={styles.route} d="m163 463 238 120 241-131" fill="none" stroke="#527e65" strokeWidth="2" strokeDasharray="4 10"/>
          </g>
          <g className={styles.office}>
            <path d="m397 207 105-55 105 54-105 57Z" fill="#bba5cd"/>
            <path d="m397 207 105 56v216l-105-57Z" fill="#79588f"/>
            <path d="m502 263 105-57v215l-105 58Z" fill="#533c69"/>
            {[0,1,2].map(i => <g key={i} transform={`translate(0 ${i*55})`}><path d="m418 246 25 13v28l-25-13Zm44 23 24 13v28l-24-13Z" fill="#e6d7eb"/><path d="m521 280 25-13v29l-25 13Zm41-22 25-13v29l-25 13Z" fill="#bba5cd"/></g>)}
            <path d="m426 206 73-38 75 38-73 40Z" fill="#d9c8e2"/>
            <path d="m441 208 58-29 56 28-57 30Z" fill="#79588f"/>
          </g>
          <g className={styles.workshop}>
            <path d="m493 407 113-61 99 52-113 64Z" fill="#f3d78a"/>
            <path d="m493 407 99 55v90l-99-52Z" fill="#ddad4b"/>
            <path d="m592 462 113-64v92l-113 62Z" fill="#b78c3e"/>
            <path d="m503 407 39-80 104 53-44 79Z" fill="#ffedb6"/>
            <path d="m542 327 64 19 99 52-59-18Z" fill="#eac269"/>
            <path d="m513 448 54 29v61l-54-29Z" fill="#244e3e"/>
            <path d="m613 474 66-37v35l-66 37Z" fill="#f9e9ba"/>
            <path d="m522 463 35 19m-35-6 35 19m-35-6 35 19" stroke="#76977b" strokeWidth="2"/>
          </g>
          <g className={styles.store}>
            <path d="m135 348 134-71 128 67-134 75Z" fill="#87aa90"/>
            <path d="m135 348 128 71v141l-128-68Z" fill="#1b5742"/>
            <path d="m263 419 134-75v142l-134 74Z" fill="#123f32"/>
            <path d="m152 343 116-61 111 59-116 64Z" fill="#cce96f"/>
            <path d="m170 343 98-50 91 48-97 53Z" fill="#afcd63"/>
            <path d="m153 404 92 50v68l-92-48Z" fill="#f9efcd"/>
            <path d="m163 420 29 16v46l-29-15Zm40 22 30 16v46l-30-16Z" fill="#7eaa92"/>
            <path d="m282 464 34-19v84l-34 19Z" fill="#d9ebbb"/>
            <path d="m331 437 44-24v52l-44 25Z" fill="#7eaa92"/>
            <path d="m145 384 109 58 18-23-119-64Z" fill="#e0f28b"/>
            <path d="m145 384 109 58v15l-109-58Z" fill="#bed967"/>
            <path d="m166 367-8 23m33-10-8 23m33-9-8 23m33-10-8 23" stroke="#4b7852" strokeWidth="13"/>
          </g>
          <g className={styles.trees}>
            <path d="M112 440v-71m339 179v-61m206-107v-49" stroke="#31513a" strokeWidth="7"/>
            <ellipse cx="112" cy="356" rx="33" ry="47" fill="#87a98b"/><path d="M112 309v94a33 47 0 0 0 0-94" fill="#64886c"/>
            <ellipse cx="451" cy="474" rx="27" ry="37" fill="#cde96f"/><path d="M451 437v74a27 37 0 0 0 0-74" fill="#a6c95d"/>
            <ellipse cx="657" cy="324" rx="23" ry="32" fill="#86a88a"/>
          </g>
          <g className={styles.tokens}>
            <circle cx="196" cy="201" r="36" fill="#d1ec77"/>
            <path d="m658 187 28 16-28 16-28-16Z" fill="#b6a0c9"/>
            <path d="m91 258 12-6v37l-12 6Z" fill="#e5be60"/>
          </g>
        </svg>
        <div className={styles.caption}><span>CRESTVIEW</span><span>{es ? "POSIBILIDADES REALES." : "REAL-WORLD POSSIBILITY."}</span></div>
      </div>
      <div className={styles.progress} aria-hidden="true"><span>01 / {es ? "DESCUBRIR" : "DISCOVER"}</span><i/><span>02 / {es ? "DAR FORMA" : "BUILD YOUR NEXT CHAPTER"}</span></div>
    </div>
  </section>;
}
