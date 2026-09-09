"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./ownership-chapters.module.css";

export function OwnershipChapters({ locale }: { locale: string }) {
  const root = useRef<HTMLDivElement>(null);
  const es = locale === "es";
  useEffect(() => {
    const sections = root.current?.querySelectorAll<HTMLElement>("section");
    if (!sections) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const draw = () => {
      frame = 0;
      sections.forEach(section => {
        const top = section.getBoundingClientRect().top;
        const progress = motion.matches ? 1 : Math.max(0, Math.min(1, (innerHeight - top) / (innerHeight * 1.1)));
        section.style.setProperty("--reveal", `${progress}`);
      });
    };
    const update = () => { if (!frame) frame = requestAnimationFrame(draw); };
    draw();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    motion.addEventListener("change", update);
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", update); removeEventListener("resize", update); motion.removeEventListener("change", update); };
  }, []);
  return <div ref={root} className={styles.chapters}>
    <section className={styles.evaluate} aria-labelledby="evaluate-title">
      <div className={styles.inner}>
        <div className={styles.illustration} aria-hidden="true">
          <svg viewBox="0 0 680 640" focusable="false">
            <circle cx="330" cy="320" r="245" fill="none" stroke="#c8b9d3"/>
            <circle cx="330" cy="320" r="205" fill="none" stroke="#d5c9df"/>
            <path d="M60 512 320 374 619 516 344 635Z" fill="#c6b4d0"/>
            <g className={styles.backSheet}>
              <path d="m286 105 250 66v326l-250-66Z" fill="#79588f"/>
              <path d="m310 146 164 44m-164-17 123 33" stroke="#cbbbda" strokeWidth="8"/>
              <path d="m318 349 39-58 45 34 77-85" fill="none" stroke="#dbef8c" strokeWidth="12" strokeLinejoin="round"/>
              <path d="m318 389 161 43" stroke="#baa3cd" strokeWidth="3"/>
            </g>
            <g className={styles.frontSheet}>
              <path d="m118 208 237-53 4 321-238 57Z" fill="#faf6e9"/>
              <path d="m118 208 9 9 237-53-9-9Z" fill="#fffdf5"/>
              <path d="m355 155 9 9 3 318-8-6Z" fill="#dfd8c7"/>
              <path d="m148 257 122-27m-122 44 165-38" stroke="#194d3b" strokeWidth="7"/>
              {[0,1,2].map(i=><g key={i} transform={`translate(0 ${i*57})`}><path d="m150 316 9 7 15-22" fill="none" stroke="#52794c" strokeWidth="5"/><path d="m191 313 117-27m-117 41 84-19" stroke="#aab69a" strokeWidth="5"/></g>)}
            </g>
            <g className={styles.lens}>
              <path d="m461 419 91 108" stroke="#194d3b" strokeWidth="29" strokeLinecap="round"/>
              <circle cx="426" cy="375" r="78" fill="#dbef8c" fillOpacity=".84" stroke="#194d3b" strokeWidth="18"/>
              <path d="m390 374 23 23 45-51" stroke="#194d3b" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </g>
            <circle cx="108" cy="132" r="20" fill="#e4bd62"/>
            <path d="m558 289 22-13 22 13-22 13Z" fill="#79588f"/>
          </svg>
          <span className={styles.artLabel}>{es ? "DE CERCA, CON CLARIDAD." : "A CLOSER LOOK. A CLEARER PICTURE."}</span>
        </div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>02 / {es ? "ENTIENDE LA OPORTUNIDAD" : "LOOK BENEATH THE SURFACE"}</p>
          <h2 id="evaluate-title">{es ? "El potencial merece" : "Big potential."}<br/><em>{es ? "una mirada más profunda." : "A closer look."}</em></h2>
          <p>{es ? "Una buena primera impresión es solo el comienzo. Organiza los documentos, revisa los números y descubre las preguntas que importan antes de dar el siguiente paso." : "A good first impression is just the beginning. Bring the documents together, examine the numbers, and uncover the questions that matter before your next move."}</p>
          <div className={styles.steps}><span>{es ? "Documentos" : "Documents"}</span><i/><span>{es ? "Diligencia" : "Diligence"}</span><i/><span>{es ? "Claridad" : "Clarity"}</span></div>
          <Link href={`/${locale}/guides/business-due-diligence-checklist`}>{es ? "Explora la diligencia" : "Explore the diligence checklist"} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
    <section className={styles.own} aria-labelledby="own-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>03 / {es ? "TU SIGUIENTE CAPÍTULO" : "MAKE YOUR NEXT CHAPTER"}</p>
          <h2 id="own-title">{es ? "No es solo una compra." : "More than a purchase."}<br/><em>{es ? "Un nuevo comienzo." : "A new beginning."}</em></h2>
          <p>{es ? "De la primera pregunta al plan de adquisición. Conecta cada paso con el futuro que quieres construir, sin perder de vista lo que falta por resolver." : "From the first question to your acquisition plan. Connect each step to the future you want to build, without losing sight of what still needs to be resolved."}</p>
          <Link href={`/${locale}/how-it-works`}>{es ? "Traza tu camino" : "See your path to ownership"} <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.illustration} aria-hidden="true">
          <svg viewBox="0 0 680 640" focusable="false">
            <g className={styles.sun}><circle cx="444" cy="206" r="136" fill="#d9ee83"/><circle cx="444" cy="206" r="162" fill="none" stroke="#6c9478"/></g>
            <path d="m47 521 310-133 317 137-315 110Z" fill="#2b624c"/>
            <path d="m259 495 97-39 247 159-91 25Z" fill="#73977d"/>
            <g className={styles.door}>
              <path d="M183 500V278a112 112 0 0 1 224 0v222h-49V280a63 63 0 0 0-126 0v220Z" fill="#e8dfbf"/>
              <path d="M183 278a112 112 0 0 1 224 0v222l26-13V268a112 112 0 0 0-224-22Z" fill="#f5ecd0"/>
              <path d="m358 282-73-25v215l73 28Z" fill="#93b094"/>
              <path d="m285 257 8-5 73 25-8 5Z" fill="#c3d3b6"/>
              <circle cx="341" cy="397" r="5" fill="#194d3b"/>
            </g>
            <g className={styles.key} transform="rotate(-30 459 406)">
              <circle cx="456" cy="362" r="52" fill="none" stroke="#eac565" strokeWidth="25"/>
              <path d="M456 410v130h37v-23h-37m0-24h29" fill="none" stroke="#eac565" strokeWidth="23" strokeLinejoin="round"/>
            </g>
            <g className={styles.sprout}><path d="M127 538v-91" stroke="#b8cc95" strokeWidth="6"/><path d="M127 486q-65 0-54-57 54-1 54 57" fill="#91b280"/><path d="M127 466q-2-62 53-65 13 56-53 65" fill="#d9ee83"/></g>
          </svg>
          <span className={styles.artLabel}>{es ? "LO QUE SIGUE, EMPIEZA CONTIGO." : "WHAT COMES NEXT STARTS WITH YOU."}</span>
        </div>
      </div>
    </section>
  </div>;
}
