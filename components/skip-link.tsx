"use client";

export function SkipLink() {
  return <a className="site-skip-link" href="#main-content" onClick={event=>{
    const target=document.querySelector<HTMLElement>('main h1')??document.querySelector<HTMLElement>('main')??document.getElementById('main-content');
    if(!target)return;
    event.preventDefault();
    // Move sequential keyboard navigation past repeated site/sidebar controls.
    // Focusing the outer layout wrapper would merely restart that navigation.
    target.setAttribute('tabindex','-1');
    target.focus();
    target.scrollIntoView({block:'start',behavior:'instant'});
  }}>Skip to main content</a>;
}
