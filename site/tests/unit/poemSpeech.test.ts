import { describe, expect, it } from "vitest";
import { selectVoice, splitPoemIntoStanzas } from "../../src/lib/poemSpeech";

describe("splitPoemIntoStanzas", () => {
  it("groups lines and collapses repeated stanza breaks", () => {
    expect(splitPoemIntoStanzas(["First line", "Second line", "", "", "Final line", ""])).toEqual([
      "First line\nSecond line",
      "Final line",
    ]);
  });

  it("returns no utterances for blank text", () => {
    expect(splitPoemIntoStanzas(["", "  ", ""])).toEqual([]);
  });
});

describe("selectVoice", () => {
  const voices = [{ lang: "en-GB", name: "English UK" }, { lang: "fr-FR", name: "French" }];

  it("prefers an exact locale match", () => {
    expect(selectVoice(voices, "fr-FR")?.name).toBe("French");
  });

  it("falls back to the requested language", () => {
    expect(selectVoice(voices, "en-US")?.name).toBe("English UK");
  });

  it("does not choose an unrelated voice", () => {
    expect(selectVoice(voices, "es")).toBeUndefined();
  });
});
