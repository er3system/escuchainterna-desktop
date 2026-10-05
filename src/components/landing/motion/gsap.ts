import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

/**
 * Registro ÚNICO de GSAP + ScrollTrigger. El guard evita el doble registro bajo
 * React 19 StrictMode / Fast Refresh. Este módulo SOLO lo importan componentes
 * 'use client' de la landing, así GSAP nunca entra al bundle global de la app.
 */
export function ensureGsap() {
  if (typeof window !== 'undefined' && !registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return { gsap, ScrollTrigger };
}

/** Curva y duración de marca, centralizadas para que toda la landing respire igual. */
export const REVERB_EASE = 'power3.out';
export const REVERB_DURATION = 0.7;
