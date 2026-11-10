import { useMemo, useRef } from "react";
import { BookCheck, GraduationCap, LoaderCircle, Upload } from "lucide-react";
import { useSelector } from "@tanstack/react-store";
import type { WordEntry, WordStatus } from "@/shared/api/commands.ts";
import {
  shownExamsAtom,
  shownNotationsAtom,
  type Exam,
  type Notation,
} from "@/shared/config/preferences.ts";
import { ExamLevels } from "@/entities/word/ui/ExamLevels.tsx";
import { pronunciationText, showsPronunciation } from "@/entities/word/model/pronunciation.ts";
import { ReadingPronunciation } from "@/entities/word/ui/Pronunciation.tsx";
import { SpeakButton } from "@/entities/word/ui/WordCard.tsx";
import { WordForms } from "@/entities/word/ui/WordForms.tsx";
import type { Messages } from "@/shared/i18n/messages-en.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatShortDate } from "@/shared/lib/date.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { type DataTableColumnDef, useDataTable } from "@/shared/lib/table.ts";
import { DataTableFacetedFilter } from "@/shared/ui/data-table/DataTableFacetedFilter.tsx";
import { DataTable } from "@/shared/ui/data-table/DataTable.tsx";
import { DebouncedSearchInput } from "@/shared/ui/DebouncedSearchInput.tsx";
import { RowActionButton, RowActions } from "@/shared/ui/data-table/RowActions.tsx";
import { CenteredEmpty, UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { StatusBadge } from "@/shared/ui/StatusBadge.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";
import { matchesWordSearch } from "@/pages/known-words/model/word-search.ts";
import {
  useIsChangingStatus,
  useKnownWordsManager,
} from "@/pages/known-words/model/use-known-words-manager.ts";

function KnownWordsManager() {
  const m = useMessages();
  const manager = useKnownWordsManager();
  const fileInput = useRef<HTMLInputElement>(null);
  const { setStatus } = manager;

  const exams = useSelector(shownExamsAtom);
  const notations = useSelector(shownNotationsAtom);
  const columns = useMemo(
    () => wordColumns(m, setStatus, exams, notations),
    [m, setStatus, exams, notations]
  );
  const table = useDataTable({
    data: manager.words,
    columns,
    ...manager.viewState,
    getRowId: (entry) => entry.word,
    globalFilterFn: (row, _columnId, query) => matchesWordSearch(row.original, String(query)),
  });

  return (
    <>
      <PageHeader
        title={m.knownWords.title}
        center={
          <>
            <DebouncedSearchInput
              aria-label={m.knownWords.search}
              placeholder={m.knownWords.search}
              value={typeof table.state.globalFilter === "string" ? table.state.globalFilter : ""}
              onValueChange={(value) => table.setGlobalFilter(value)}
              className="w-full sm:w-72"
            />
            <DataTableFacetedFilter
              column={table.getColumn("status")}
              title={m.knownWords.status}
              options={[
                {
                  value: "known",
                  label: `${m.knownWords.known} (${formatInteger(manager.counts.known)})`,
                },
                {
                  value: "learning",
                  label: `${m.knownWords.learning} (${formatInteger(manager.counts.learning)})`,
                },
              ]}
            />
          </>
        }
        action={
          <TooltipIconButton
            label={m.knownWords.loadFile}
            tooltip={m.knownWords.loadFileTooltip}
            variant="outline"
            size="icon"
            onClick={() => fileInput.current?.click()}
            disabled={manager.importing}
          >
            {manager.importing ? <Spinner /> : <Upload />}
          </TooltipIconButton>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.csv,.tsv,text/plain"
        className="hidden"
        aria-label={m.knownWords.file}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) manager.importFile(file);
          event.target.value = "";
        }}
      />

      {manager.loadFailed ? (
        <CenteredEmpty className="min-h-0 grow">
          <UnavailableState description={m.knownWords.loadFailed} onRetry={manager.retry} />
        </CenteredEmpty>
      ) : (
        <DataTable
          className="min-h-0 grow"
          table={table}
          isLoading={manager.isLoading}
          skeletonRowCount={8}
          emptyStateMessage={
            manager.words.length === 0 ? m.knownWords.empty : m.knownWords.noMatches
          }
        />
      )}
    </>
  );
}

type SetStatus = (change: { entry: WordEntry; status: WordStatus }) => void;

/** Sorts by the shown exams in order, easiest first; undefined for a word on neither list. */
function levelRank(entry: WordEntry, exams: Exam[]): number | undefined {
  const ranks = exams.map((exam) => (exam === "hsk" ? entry.hskLevel : entry.tbclLevel));
  if (ranks.every((rank) => rank === null)) return undefined;
  return ranks.reduce<number>((sum, rank) => sum * 10 + (rank ?? 9), 0);
}

function wordColumns(
  m: Messages,
  setStatus: SetStatus,
  exams: Exam[],
  notations: Notation[]
): DataTableColumnDef<WordEntry>[] {
  const pronunciationColumn: DataTableColumnDef<WordEntry> = {
    id: "pronunciation",
    accessorFn: (entry) => {
      const reading = entry.readings[0];
      return reading ? pronunciationText(reading, notations) : "";
    },
    header: m.knownWords.pronunciation,
    meta: { width: "9rem" },
    cell: ({ row }) => {
      const reading = row.original.readings[0];
      return reading ? <ReadingPronunciation reading={reading} /> : <EmptyCell />;
    },
  };
  const levelColumn: DataTableColumnDef<WordEntry> = {
    id: "level",
    accessorFn: (entry) => levelRank(entry, exams),
    header: m.knownWords.level,
    sortDescFirst: false,
    sortUndefined: "last",
    meta: { width: "12rem" },
    cell: ({ row }) => <ExamLevels levels={row.original} />,
  };
  return [
    {
      id: "word",
      accessorFn: (entry) => entry.displayWord,
      header: m.knownWords.word,
      meta: { primary: true, width: "8rem" },
      cell: ({ row }) => (
        <span lang="zh" className="text-lg">
          <WordForms word={row.original.displayWord} alternate={row.original.alternateWord} />
        </span>
      ),
    },
    ...(showsPronunciation(notations) ? [pronunciationColumn] : []),
    ...(exams.length > 0 ? [levelColumn] : []),
    {
      id: "meaning",
      accessorFn: (entry) => entry.readings[0]?.definitions.join("; ") ?? "",
      header: m.knownWords.meaning,
      enableSorting: false,
      meta: { mobileFullWidth: true },
      cell: ({ row }) => {
        const meaning = row.original.readings[0]?.definitions.join("; ");
        return meaning ? (
          <span className="line-clamp-2 whitespace-normal" title={meaning}>
            {meaning}
          </span>
        ) : (
          <EmptyCell />
        );
      },
    },
    {
      accessorKey: "status",
      header: m.knownWords.status,
      meta: { width: "7rem" },
      filterFn: "arrIncludes",
      cell: ({ row }) =>
        row.original.status === "known" ? (
          <StatusBadge tone="success">{m.knownWords.known}</StatusBadge>
        ) : (
          <StatusBadge tone="warning">{m.knownWords.learning}</StatusBadge>
        ),
    },
    {
      id: "nextReview",
      accessorFn: (entry) => entry.dueAt ?? Number.MAX_SAFE_INTEGER,
      header: m.knownWords.nextReview,
      meta: { width: "11rem" },
      cell: ({ row }) => {
        const { dueAt } = row.original;
        if (dueAt === null) return <EmptyCell />;
        return dueAt <= Date.now()
          ? m.knownWords.dueNow
          : formatShortDate(new Date(dueAt).toISOString());
      },
    },
    {
      accessorKey: "updatedAt",
      header: m.knownWords.changed,
      meta: { width: "7rem" },
      cell: ({ row }) => formatShortDate(new Date(row.original.updatedAt).toISOString()),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { actions: true, width: "6rem" },
      cell: ({ row }) => <WordActions entry={row.original} setStatus={setStatus} />,
    },
  ];
}

function WordActions({ entry, setStatus }: { entry: WordEntry; setStatus: SetStatus }) {
  const m = useMessages();
  const busy = useIsChangingStatus(entry.word);
  const busyIcon = <LoaderCircle className="animate-spin motion-reduce:animate-none" />;
  return (
    <RowActions>
      <SpeakButton word={entry.word} variant="ghost" />
      {entry.status === "known" ? (
        <RowActionButton
          label={`${m.knownWords.startLearning}: ${entry.displayWord}`}
          tooltip={m.knownWords.startLearning}
          disabled={busy}
          onClick={() => setStatus({ entry, status: "learning" })}
        >
          {busy ? busyIcon : <GraduationCap />}
        </RowActionButton>
      ) : (
        <RowActionButton
          label={`${m.knownWords.markKnown}: ${entry.displayWord}`}
          tooltip={m.knownWords.markKnown}
          disabled={busy}
          onClick={() => setStatus({ entry, status: "known" })}
        >
          {busy ? busyIcon : <BookCheck />}
        </RowActionButton>
      )}
    </RowActions>
  );
}

export default KnownWordsManager;

function EmptyCell() {
  return <span className="text-muted-foreground">—</span>;
}
