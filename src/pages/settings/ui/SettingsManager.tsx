import type { ReactNode } from "react";
import { Info, LoaderCircle, Volume2 } from "lucide-react";
import {
  BACKGROUNDS,
  EXAMS,
  LANGUAGES,
  NOTATIONS,
  READER_NOTATIONS,
  SCRIPTS,
  SPEAKERS,
  THEMES,
} from "@/shared/config/preferences.ts";
import { LANGUAGE_NAMES, useMessages } from "@/shared/i18n/messages.ts";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { TooltipIconButton, TooltipIconLink } from "@/shared/ui/TooltipIconButton.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/shadcn/toggle-group.tsx";
import { useSpeakWord } from "@/entities/word/model/use-speak-word.ts";
import { useSettingsManager } from "@/pages/settings/model/use-settings-manager.ts";

/** A sample of each script, written in itself. */
const SCRIPT_SAMPLES = { simplified: "汉语", traditional: "漢語", both: "汉/漢" } as const;
/** 中文 written in each notation: Cangjie as the radicals its keys type. */
const NOTATION_SAMPLES = {
  pinyin: "zhōngwén",
  zhuyin: "ㄓㄨㄥ ㄨㄣˊ",
  cangjie: "中 卜大",
} as const;
/** What a voice reads to show how it sounds. */
const VOICE_SAMPLE = "你好！我们一起来读这本书吧。";
/** Each voice's name as upstream gives it. */
const SPEAKER_NAMES = {
  lingyu: "Lingyu",
  weiguo: "Weiguo",
  junhao: "Junhao",
  zhiming: "Zhiming",
  xiaoyu: "Xiaoyu",
  yuewen: "Yuewen",
} as const;

function SettingsManager() {
  const m = useMessages();
  const {
    language,
    setLanguage,
    script,
    setScript,
    shownNotations,
    setShownNotations,
    readerNotation,
    setReaderNotation,
    speaker,
    setSpeaker,
    theme,
    setTheme,
    background,
    setBackground,
    shownExams,
    setShownExams,
  } = useSettingsManager();

  return (
    <>
      <PageHeader
        title={m.settings.title}
        action={
          <TooltipIconLink label={m.settings.about} to="/about">
            <Info />
          </TooltipIconLink>
        }
      />

      <div className="-m-1 flex min-h-0 flex-col items-center gap-4 overflow-y-auto p-1 scroll-fade">
        <SettingCard title={m.settings.language} description={m.settings.languageDescription}>
          <Choices
            label={m.settings.language}
            options={LANGUAGES}
            value={language}
            onChange={setLanguage}
            render={(option) => <span lang={option}>{LANGUAGE_NAMES[option]}</span>}
          />
        </SettingCard>

        <SettingCard title={m.settings.script} description={m.settings.scriptDescription}>
          <Choices
            label={m.settings.script}
            options={SCRIPTS}
            value={script}
            onChange={setScript}
            render={(option) => (
              <>
                <span lang="zh" aria-hidden>
                  {SCRIPT_SAMPLES[option]}
                </span>
                {m.settings.scripts[option]}
              </>
            )}
          />
        </SettingCard>

        <SettingCard title={m.settings.notations} description={m.settings.notationsDescription}>
          <Toggles
            label={m.settings.notations}
            options={NOTATIONS}
            value={shownNotations}
            onChange={setShownNotations}
            render={(option) => (
              <>
                <span lang="zh" aria-hidden className="text-muted-foreground">
                  {NOTATION_SAMPLES[option]}
                </span>
                {m.settings.notationNames[option]}
              </>
            )}
          />
        </SettingCard>

        <SettingCard
          title={m.settings.readerNotation}
          description={m.settings.readerNotationDescription}
        >
          <Choices
            label={m.settings.readerNotation}
            options={READER_NOTATIONS}
            value={readerNotation}
            onChange={setReaderNotation}
            render={(option) => m.settings.readerNotationNames[option]}
          />
        </SettingCard>

        <SettingCard
          title={m.settings.voice}
          description={m.settings.voiceDescription}
          action={<VoiceSample />}
        >
          <Choices
            label={m.settings.voice}
            options={SPEAKERS}
            value={speaker}
            onChange={setSpeaker}
            render={(option) => (
              <>
                {SPEAKER_NAMES[option]}
                <span className="text-muted-foreground">{m.settings.voices[option]}</span>
              </>
            )}
          />
        </SettingCard>

        <SettingCard title={m.settings.appearance} description={m.settings.appearanceDescription}>
          <Choices
            label={m.settings.appearance}
            options={THEMES}
            value={theme}
            onChange={setTheme}
            render={(option) => m.settings.appearances[option]}
          />
        </SettingCard>

        <SettingCard title={m.settings.background} description={m.settings.backgroundDescription}>
          <Choices
            label={m.settings.background}
            options={BACKGROUNDS}
            value={background}
            onChange={setBackground}
            render={(option) => m.settings.backgrounds[option]}
          />
        </SettingCard>

        <SettingCard title={m.settings.examLevels} description={m.settings.examLevelsDescription}>
          <Toggles
            label={m.settings.examLevels}
            options={EXAMS}
            value={shownExams}
            onChange={setShownExams}
            render={(exam) => m.settings.exams[exam]}
          />
        </SettingCard>
      </div>
    </>
  );
}

function VoiceSample() {
  const m = useMessages();
  const { speak, loading } = useSpeakWord(VOICE_SAMPLE);
  return (
    <TooltipIconButton
      label={m.settings.playSample}
      variant="outline"
      size="icon"
      disabled={loading}
      onClick={() => void speak()}
    >
      {loading ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Volume2 />}
    </TooltipIconButton>
  );
}

function SettingCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  /** A button at the card's top right. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => ReactNode;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      className="flex-wrap"
      value={[value]}
      // Pressing the chosen option again would leave nothing chosen.
      onValueChange={(next) => {
        const chosen = options.find((option) => option === next[0]);
        if (chosen) onChange(chosen);
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option} value={option} className="px-3">
          {render(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Options each turned on and off on their own, kept in `options` order. */
function Toggles<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  render: (option: T) => ReactNode;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      className="flex-wrap"
      multiple
      value={value}
      onValueChange={(next) => onChange(options.filter((option) => next.includes(option)))}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option} value={option} className="px-3">
          {render(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export default SettingsManager;
