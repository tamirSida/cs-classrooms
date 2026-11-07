"use client";

import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRepeat } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

config.autoAddCss = false;

export function RepeatIcon({ className, title = "Recurring booking" }: { className?: string; title?: string }) {
  return <FontAwesomeIcon icon={faRepeat} className={cn("shrink-0", className)} title={title} aria-label={title} />;
}
