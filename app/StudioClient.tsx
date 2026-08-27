"use client";

import { useEffect } from "react";
import { STUDIO_MARKUP } from "./studioMarkup";

export default function StudioClient() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__atelierStarted) return;
    window.__atelierStarted = true;
    void import("../js/main.js");
  }, []);

  return <div id="app" dangerouslySetInnerHTML={{ __html: STUDIO_MARKUP }} />;
}

declare global {
  interface Window {
    __atelierStarted?: boolean;
  }
}
