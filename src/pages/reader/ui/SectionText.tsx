import type { ReactNode } from "react";
import type { ReaderSection, SpokenPhrase } from "@/shared/api/commands.ts";
import type { ReaderWordStatus } from "@/pages/reader/model/use-reader-manager.ts";
import { useSectionScroll } from "@/pages/reader/model/use-section-scroll.ts";
import { Paragraph, type SelectToken } from "@/pages/reader/ui/Paragraph.tsx";

interface SectionTextProps {
  section: ReaderSection;
  /** Scrolled to on mount; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  statusOf: (word: string) => ReaderWordStatus;
  selectedWord: string | null;
  onSelectToken: SelectToken;
  spokenPhrase: SpokenPhrase | null;
  footer: ReactNode;
}

/** Only the paragraphs in view are rendered: one EPUB chapter can be a whole book. */
export function SectionText({
  section,
  initialParagraph,
  onParagraphReached,
  statusOf,
  selectedWord,
  onSelectToken,
  spokenPhrase,
  footer,
}: SectionTextProps) {
  const { scrollRef, measureElement, items, totalSize } = useSectionScroll({
    paragraphCount: section.paragraphs.length,
    initialParagraph,
    onParagraphReached,
    spokenParagraph: spokenPhrase?.paragraph,
  });

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="reader-text">
      <div className="relative mx-auto w-full max-w-2xl" style={{ height: totalSize }}>
        {items.map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={measureElement}
            className="absolute inset-x-0 top-0 pb-5"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <Paragraph
              index={item.index}
              tokens={section.paragraphs[item.index] ?? []}
              statusOf={statusOf}
              selectedWord={selectedWord}
              onSelectToken={onSelectToken}
              spoken={spokenPhrase?.paragraph === item.index ? spokenPhrase : null}
            />
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
