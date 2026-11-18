export type SpeechVoice = {
  lang: string;
};

export function splitPoemIntoStanzas(lines: string[]): string[] {
  const stanzas: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    stanzas.push(current.join("\n"));
    current = [];
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flush();
    } else {
      current.push(line.trimEnd());
    }
  }

  flush();
  return stanzas;
}

export function selectVoice<T extends SpeechVoice>(voices: T[], locale: string): T | undefined {
  const requested = locale.trim().toLowerCase().replaceAll("_", "-");
  if (!requested) return undefined;

  const exact = voices.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-") === requested);
  if (exact) return exact;

  const language = requested.split("-")[0];
  return voices.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-").split("-")[0] === language);
}
