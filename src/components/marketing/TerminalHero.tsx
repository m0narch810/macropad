"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Interactive hero: a working regime terminal. Visitors type or click
 * commands and get the real live readings back, scored. Runs entirely on
 * data passed from the server (already scored, no sources, no method), so
 * it never touches the pipeline or leaks anything the app hides.
 */

export interface HeroIndicator {
  id: string;
  name: string;
  value: string;
  score: number | null;
  tone: "up" | "down" | "flat";
  category: string;
  note: string;
}

type Token = { t: string; c?: string };
type Line = { id: number; tokens: Token[] };

const toneColor = (tone: "up" | "down" | "flat") =>
  tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text-faint)";

const toneTag = (tone: "up" | "down" | "flat") => (tone === "up" ? "BULL" : tone === "down" ? "BEAR" : "FLAT");

function scoreToken(ind: HeroIndicator): Token {
  if (ind.score === null) return { t: "[ — ]", c: "var(--text-faint)" };
  const s = `[${toneTag(ind.tone)} ${ind.score > 0 ? "+" : ""}${ind.score.toFixed(2)}]`;
  return { t: s, c: toneColor(ind.tone) };
}

const SUGGESTIONS = ["scan", "read vix", "read cpi", "movers", "help"];

export default function TerminalHero({
  indicators,
  lastUpdated,
}: {
  indicators: HeroIndicator[];
  lastUpdated: string | null;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set(indicators.map((i) => i.category));
    return Array.from(set);
  }, [indicators]);

  const nextId = () => ++idRef.current;
  const emit = (batch: Token[][]) =>
    setLines((prev) => [...prev, ...batch.map((tokens) => ({ id: nextId(), tokens }))]);

  // 20+8 char columns keep a full row (with score tag) under ~40 monospace
  // chars, which fits a 320px phone without mid-token wrapping.
  function indicatorLine(ind: HeroIndicator): Token[] {
    return [
      { t: ind.name.padEnd(20).slice(0, 20), c: "var(--text)" },
      { t: ind.value.padStart(8).slice(0, 8) + " ", c: "var(--text-dim)" },
      scoreToken(ind),
    ];
  }

  function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    emit([[{ t: "› ", c: "var(--up)" }, { t: cmd, c: "var(--text)" }]]);

    const [verb, ...rest] = cmd.toLowerCase().split(/\s+/);
    const arg = rest.join(" ");

    if (verb === "help") {
      emit([
        [{ t: "commands", c: "var(--text-dim)" }],
        [{ t: "  scan [category]", c: "var(--text)" }, { t: "  overview of the regime, or one category", c: "var(--text-faint)" }],
        [{ t: "  read <name>", c: "var(--text)" }, { t: "     look up any indicator's live read", c: "var(--text-faint)" }],
        [{ t: "  movers", c: "var(--text)" }, { t: "          the strongest signals right now", c: "var(--text-faint)" }],
        [{ t: "  clear", c: "var(--text)" }, { t: "           wipe the screen", c: "var(--text-faint)" }],
        [{ t: `categories: ${categories.join(", ").toLowerCase()}`, c: "var(--text-faint)" }],
      ]);
      return;
    }

    if (verb === "clear") {
      setLines([]);
      return;
    }

    if (verb === "scan") {
      const pool = arg
        ? indicators.filter((i) => i.category.toLowerCase().includes(arg))
        : indicators;
      if (pool.length === 0) {
        emit([[{ t: `no category matching "${arg}". try: ${categories.join(", ").toLowerCase()}`, c: "var(--down)" }]]);
        return;
      }
      const bull = pool.filter((i) => i.tone === "up" && i.score !== null && Math.abs(i.score) >= 0.15).length;
      const bear = pool.filter((i) => i.tone === "down" && i.score !== null && Math.abs(i.score) >= 0.15).length;
      const strong = [...pool]
        .filter((i) => i.score !== null)
        .sort((a, b) => Math.abs(b.score as number) - Math.abs(a.score as number))
        .slice(0, 6);
      emit([
        [
          { t: `${pool.length} indicators`, c: "var(--text-dim)" },
          { t: "   " },
          { t: `${bull}▲`, c: "var(--up)" },
          { t: "  " },
          { t: `${bear}▼`, c: "var(--down)" },
        ],
        [{ t: "strongest reads", c: "var(--text-faint)" }],
        ...strong.map(indicatorLine),
      ]);
      return;
    }

    if (verb === "read" || verb === "get") {
      if (!arg) {
        emit([[{ t: "usage: read <name>  e.g. read cpi", c: "var(--text-faint)" }]]);
        return;
      }
      const hits = indicators.filter(
        (i) => i.name.toLowerCase().includes(arg) || i.id.toLowerCase().includes(arg)
      );
      if (hits.length === 0) {
        emit([[{ t: `no indicator matching "${arg}"`, c: "var(--down)" }]]);
        return;
      }
      const shown = hits.slice(0, 5);
      emit([
        ...shown.map(indicatorLine),
        ...(shown.length === 1 ? [[{ t: shown[0].note, c: "var(--text-faint)" }] as Token[]] : []),
        ...(hits.length > shown.length ? [[{ t: `…${hits.length - shown.length} more`, c: "var(--text-faint)" }] as Token[]] : []),
      ]);
      return;
    }

    if (verb === "movers") {
      const top = [...indicators]
        .filter((i) => i.score !== null)
        .sort((a, b) => Math.abs(b.score as number) - Math.abs(a.score as number))
        .slice(0, 6);
      emit([[{ t: "biggest signals right now", c: "var(--text-dim)" }], ...top.map(indicatorLine)]);
      return;
    }

    emit([[{ t: `unknown command: ${verb}`, c: "var(--down)" }, { t: "   type help", c: "var(--text-faint)" }]]);
  }

  // Auto-run a welcome + scan on mount so the hero is alive before any input.
  useEffect(() => {
    emit([
      [{ t: "yyy regime terminal", c: "var(--text)" }],
      [{ t: "type a command, or tap one below. try: read cpi", c: "var(--text-faint)" }],
      [{ t: "" }],
    ]);
    run("scan");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(input);
    setInput("");
  }

  return (
    <div
      className="hud border border-[var(--border)] bg-[var(--panel)]"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] px-4 py-2.5">
        <span className="eyebrow flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
          </span>
          Regime terminal — live
        </span>
        <span className="partno">
          {lastUpdated
            ? `SYNCED ${new Date(lastUpdated).toISOString().slice(0, 16).replace("T", " ")}Z`
            : "AWAITING FIRST SYNC"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="h-[300px] overflow-y-auto px-4 py-3 font-mono text-[0.76rem] leading-[1.55] sm:h-[340px]"
      >
        {lines.map((line) => (
          <div key={line.id} className="terminal-line whitespace-pre-wrap break-words">
            {line.tokens.map((tok, i) => (
              <span key={i} style={tok.c ? { color: tok.c } : undefined}>
                {tok.t}
              </span>
            ))}
          </div>
        ))}

        <form onSubmit={submit} className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-[var(--up)]">›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="go"
            aria-label="Terminal command"
            // 16px on phones: anything smaller makes iOS Safari zoom the whole
            // page when the input focuses.
            className="w-full bg-transparent font-mono text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] sm:text-[0.76rem]"
            placeholder="scan"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] px-4 py-2.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              run(s);
              inputRef.current?.focus();
            }}
            className="border border-[var(--border)] px-2.5 py-1 font-mono text-[0.64rem] text-[var(--text-dim)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
