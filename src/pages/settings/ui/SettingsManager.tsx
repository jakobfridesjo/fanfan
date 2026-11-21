import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import { Info, LoaderCircle, Volume2 } from "lucide";
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
import { Icon } from "@/shared/ui/Icon.tsx";
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
import { DataExportCard } from "@/pages/settings/ui/DataExportCard.tsx";
import { OfflineModelsCard } from "@/pages/settings/ui/OfflineModelsCard.tsx";

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
  const settings = useSettingsManager();

  return (
    <>
      <PageHeader
        title={m.settings.title}
        action={
          <TooltipIconLink label={m.settings.about} to="/about">
            <Icon icon={Info} />
          </TooltipIconLink>
        }
      />

      <div class="-m-1 flex min-h-0 flex-col items-center gap-4 overflow-y-auto p-1 scroll-fade">
        <SettingCard title={m.settings.language} description={m.settings.languageDescription}>
          <Choices
            label={m.settings.language}
            options={LANGUAGES}
            value={settings.language}
            onChange={settings.setLanguage}
            render={(option) => <span lang={option}>{LANGUAGE_NAMES[option]}</span>}
          />
        </SettingCard>

        <SettingCard title={m.settings.script} description={m.settings.scriptDescription}>
          <Choices
            label={m.settings.script}
            options={SCRIPTS}
            value={settings.script}
            onChange={settings.setScript}
            render={(option) => (
              <>
                <span lang="zh" aria-hidden="true">
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
            value={settings.shownNotations}
            onChange={settings.setShownNotations}
            render={(option) => (
              <>
                <span lang="zh" aria-hidden="true" class="text-muted-foreground">
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
            value={settings.readerNotation}
            onChange={settings.setReaderNotation}
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
            value={settings.speaker}
            onChange={settings.setSpeaker}
            render={(option) => (
              <>
                {SPEAKER_NAMES[option]}
                <span class="text-muted-foreground">{m.settings.voices[option]}</span>
              </>
            )}
          />
        </SettingCard>

        <OfflineModelsCard />

        <SettingCard title={m.settings.appearance} description={m.settings.appearanceDescription}>
          <Choices
            label={m.settings.appearance}
            options={THEMES}
            value={settings.theme}
            onChange={settings.setTheme}
            render={(option) => m.settings.appearances[option]}
          />
        </SettingCard>

        <SettingCard title={m.settings.background} description={m.settings.backgroundDescription}>
          <Choices
            label={m.settings.background}
            options={BACKGROUNDS}
            value={settings.background}
            onChange={settings.setBackground}
            render={(option) => m.settings.backgrounds[option]}
          />
        </SettingCard>

        <SettingCard title={m.settings.examLevels} description={m.settings.examLevelsDescription}>
          <Toggles
            label={m.settings.examLevels}
            options={EXAMS}
            value={settings.shownExams}
            onChange={settings.setShownExams}
            render={(exam) => m.settings.exams[exam]}
          />
        </SettingCard>

        <DataExportCard />
      </div>
    </>
  );
}

function VoiceSample() {
  const m = useMessages();
  const speech = useSpeakWord(() => VOICE_SAMPLE);
  return (
    <TooltipIconButton
      label={m.settings.playSample}
      variant="outline"
      size="icon"
      disabled={speech.loading()}
      onClick={() => void speech.speak()}
    >
      <Show when={speech.loading()} fallback={<Icon icon={Volume2} />}>
        <Icon icon={LoaderCircle} class="animate-spin motion-reduce:animate-none" />
      </Show>
    </TooltipIconButton>
  );
}

function SettingCard(props: {
  title: string;
  description: string;
  /** A button at the card's top right. */
  action?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Card class="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
        <Show when={props.action}>
          <CardAction>{props.action}</CardAction>
        </Show>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

function Choices<T extends string>(props: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => JSX.Element;
}) {
  return (
    <ToggleGroup
      aria-label={props.label}
      variant="outline"
      class="flex-wrap"
      value={props.value}
      // Pressing the chosen option again would leave nothing chosen.
      onChange={(next) => {
        const chosen = props.options.find((option) => option === next);
        if (chosen) props.onChange(chosen);
      }}
    >
      <For each={props.options}>
        {(option) => (
          <ToggleGroupItem value={option} class="px-3">
            {props.render(option)}
          </ToggleGroupItem>
        )}
      </For>
    </ToggleGroup>
  );
}

/** Options each turned on and off on their own, kept in `options` order. */
function Toggles<T extends string>(props: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  render: (option: T) => JSX.Element;
}) {
  return (
    <ToggleGroup
      aria-label={props.label}
      variant="outline"
      class="flex-wrap"
      multiple
      value={props.value}
      onChange={(next) => props.onChange(props.options.filter((option) => next.includes(option)))}
    >
      <For each={props.options}>
        {(option) => (
          <ToggleGroupItem value={option} class="px-3">
            {props.render(option)}
          </ToggleGroupItem>
        )}
      </For>
    </ToggleGroup>
  );
}

export default SettingsManager;
