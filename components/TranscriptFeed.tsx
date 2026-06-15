"use client";

import { useEffect, useRef } from "react";

import type { TranscriptLine } from "@/lib/types";

const HARDSHIP_TRIGGER = /lost my job|struggling to pay rent/i;

export function TranscriptFeed({ lines }: { lines: TranscriptLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);

  if (lines.length === 0) {
    return (
      <div className="transcript-empty">
        The live transcript will appear here. Press <strong>Start live demo</strong> or{" "}
        <strong>Advance one line</strong> to begin the call.
      </div>
    );
  }

  return (
    <div className="transcript-feed" role="log" aria-live="polite">
      {lines.map((line, i) => {
        const isNewest = i === lines.length - 1;
        const isHardship = HARDSHIP_TRIGGER.test(line.text);
        const speakerClass =
          line.speaker.toLowerCase() === "agent" ? "line--agent" : "line--customer";
        return (
          <div
            key={`${line.timestamp}-${i}`}
            className={[
              "line",
              speakerClass,
              isHardship ? "line--hardship" : "",
              isNewest ? "line--newest" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="line-time">{line.timestamp}</span>
            <span className="line-speaker">{line.speaker}</span>
            <span className="line-text">{line.text}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
