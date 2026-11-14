"use client";
interface Entry {
  speaker: "interviewer" | "you";
  text: string;
}

interface Props {
  entries: Entry[];
}

export function TranscriptPanel({ entries }: Props) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto max-h-80 pr-1">
      {entries.map((e, i) => (
        <div key={i} className={`flex gap-2 ${e.speaker === "you" ? "flex-row-reverse" : ""}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 bg-surface-3">
            {e.speaker === "interviewer" ? "🤖" : "👤"}
          </div>
          <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            e.speaker === "interviewer"
              ? "bg-surface-2 text-text-primary rounded-tl-sm"
              : "bg-accent text-white rounded-tr-sm"
          }`}>
            {e.text}
          </div>
        </div>
      ))}
    </div>
  );
}
