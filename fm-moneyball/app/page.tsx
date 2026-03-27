"use client";

import { useMemo, useState } from "react";

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ colIdx: number; dir: "asc" | "desc" } | null>(null);
  const [presetStriker, setPresetStriker] = useState(false);

  function parseFirstTable(html: string): ParsedTable {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tableEl = doc.querySelector("table");
    if (!tableEl) throw new Error("No <table> found in the file.");

    // Headers: prefer <thead> th, else first row th/td.
    const headCells =
      tableEl.querySelectorAll("thead th").length > 0
        ? Array.from(tableEl.querySelectorAll("thead th"))
        : Array.from(tableEl.querySelectorAll("tr")).slice(0, 1).flatMap((tr) => Array.from(tr.querySelectorAll("th,td")));

    const headers = headCells.map((c) => (c.textContent ?? "").trim()).filter((h) => h.length > 0);

    const bodyRows = Array.from(tableEl.querySelectorAll("tbody tr"));
    const fallbackRows = Array.from(tableEl.querySelectorAll("tr")).slice(headers.length > 0 ? 1 : 0);
    const rowEls = bodyRows.length > 0 ? bodyRows : fallbackRows;

    const rows = rowEls
      .map((tr) => Array.from(tr.querySelectorAll("td,th")).map((c) => (c.textContent ?? "").trim()))
      .filter((cells) => cells.some((v) => v.length > 0));

    if (headers.length === 0 && rows.length > 0) {
      const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
      return { headers: Array.from({ length: maxCols }, (_, i) => `Col ${i + 1}`), rows };
    }

    return { headers, rows };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    console.log("handleSubmit");
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Please choose a file first.");
      setFileName(null);
      setFileText(null);
      setTable(null);
      setSort(null);
      setPresetStriker(false);
      return;
    }

    try {
      setError(null);
      setFileName(file.name);
      const text = await file.text();
      setFileText(text);
      setTable(parseFirstTable(text));
      setSort(null);
      setPresetStriker(false);
    } catch (err) {
      setTable(null);
      setError(err instanceof Error ? err.message : "Failed to read/parse file.");
    }
  }

  function parseSortable(value: string) {
    const trimmed = value.trim();
    if (trimmed.length === 0) return { kind: "empty" as const, num: null as number | null, str: "" };

    const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n)) return { kind: "number" as const, num: n, str: trimmed.toLowerCase() };

    return { kind: "string" as const, num: null, str: trimmed.toLowerCase() };
  }

  function parseNumber(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  const percentilesByCell = useMemo(() => {
    if (!table) return null;

    const colCount = Math.max(table.headers.length, ...table.rows.map((r) => r.length));
    const perCol: Array<Map<number, number>> = Array.from({ length: colCount }, () => new Map());

    for (let c = 0; c < colCount; c++) {
      const values: Array<{ r: number; v: number }> = [];
      for (let r = 0; r < table.rows.length; r++) {
        const n = parseNumber(table.rows[r]?.[c] ?? "");
        if (n !== null) values.push({ r, v: n });
      }

      const nCount = values.length;
      if (nCount === 0) continue;

      values.sort((a, b) => a.v - b.v);

      if (nCount === 1) {
        perCol[c].set(values[0].r, 100);
        continue;
      }

      let i = 0;
      while (i < nCount) {
        let j = i;
        while (j + 1 < nCount && values[j + 1].v === values[i].v) j++;

        const avgRank = (i + j) / 2; // 0..(n-1)
        const p = (avgRank / (nCount - 1)) * 100;
        for (let k = i; k <= j; k++) perCol[c].set(values[k].r, p);

        i = j + 1;
      }
    }

    return perCol;
  }, [table]);

  const displayRows = (() => {
    if (!table) return null;
    if (!sort) return table.rows.map((row, originalIdx) => ({ row, originalIdx }));

    const dir = sort.dir === "asc" ? 1 : -1;
    const colIdx = sort.colIdx;

    return table.rows
      .map((row, originalIdx) => ({ row, originalIdx }))
      .sort((a, b) => {
        const av = parseSortable(a.row[colIdx] ?? "");
        const bv = parseSortable(b.row[colIdx] ?? "");

        if (av.kind === "empty" && bv.kind !== "empty") return 1;
        if (bv.kind === "empty" && av.kind !== "empty") return -1;

        if (av.num !== null && bv.num !== null) {
          const diff = av.num - bv.num;
          if (diff !== 0) return diff * dir;
        }

        const s = av.str.localeCompare(bv.str, undefined, { numeric: true, sensitivity: "base" });
        if (s !== 0) return s * dir;

        return a.originalIdx - b.originalIdx;
      })
      .map(({ row, originalIdx }) => ({ row, originalIdx }));
  })();

  function toggleSort(colIdx: number) {
    setSort((prev) => {
      if (!prev || prev.colIdx !== colIdx) return { colIdx, dir: "asc" };
      return { colIdx, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  function percentileTextClass(p: number): string {
    if (p >= 75) return "text-green-600 dark:text-green-400";
    if (p >= 50) return "text-yellow-600 dark:text-yellow-400";
    if (p >= 25) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  }

  const visibleColumns = useMemo(() => {
    if (!table) return null;
    const normalizeHeader = (value: string) => value.trim().toLowerCase();

    if (!presetStriker) {
      return table.headers.map((h, colIdx) => ({ header: h, colIdx }));
    }

    const wanted = ["name", "position", "age", "nat", "height", "weight", "personality", "gls", "mins", "np-xg/90", "xg/90"];
    const byNorm = new Map<string, number>();
    table.headers.forEach((h, idx) => {
      const norm = normalizeHeader(h);
      if (!byNorm.has(norm)) byNorm.set(norm, idx);
    });

    return wanted
      .map((w) => {
        const idx = byNorm.get(normalizeHeader(w));
        if (idx === undefined) return null;
        return { header: table.headers[idx] ?? w, colIdx: idx };
      })
      .filter((v): v is { header: string; colIdx: number } => v !== null);
  }, [presetStriker, table]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">FM Moneyball</h1>
        <p>Find the best players statistically</p>
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input type="file" name="file" id="file" accept=".html" />
          <input type="submit" value="Submit" />
        </form>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {table ? (
          <section className="w-full">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loaded: {fileName}</p>
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-50">
              <input
                type="checkbox"
                checked={presetStriker}
                onChange={(e) => setPresetStriker(e.currentTarget.checked)}
              />
              Striker
            </label>
            <div className="mt-2 max-h-[28rem] w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white dark:bg-black">
                  <tr>
                    {(visibleColumns ?? table.headers.map((h, colIdx) => ({ header: h, colIdx }))).map(({ header, colIdx }) => (
                      <th
                        key={`${header}-${colIdx}`}
                        className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(colIdx)}
                          className="inline-flex items-center gap-1 hover:underline"
                          title="Click to sort"
                        >
                          <span>{header}</span>
                          <span className="text-xs text-white">
                            {sort?.colIdx === colIdx ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(displayRows ?? table.rows.map((row, originalIdx) => ({ row, originalIdx }))).map(({ row, originalIdx }) => (
                    <tr key={originalIdx} className="odd:bg-zinc-50 dark:odd:bg-zinc-950">
                      {(visibleColumns ?? row.map((_, colIdx) => ({ header: "", colIdx }))).map(({ colIdx }) => {
                        const cell = row[colIdx] ?? "";
                        const p = percentilesByCell?.[colIdx]?.get(originalIdx);
                        return (
                        <td
                          key={`${originalIdx}-${colIdx}`}
                          className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50"
                        >
                          <span className="inline-flex items-baseline gap-2">
                            <span>{cell}</span>
                            {p !== undefined ? (
                              <span className={`text-[10px] font-medium ${percentileTextClass(p)}`}>{Math.round(p)}</span>
                            ) : null}
                          </span>
                        </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : fileText ? (
          <section className="w-full">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Loaded: {fileName}</p>
            <pre className="mt-2 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
              {fileText}
            </pre>
          </section>
        ) : null}
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        </div>
      </main>
    </div>
  );
}
