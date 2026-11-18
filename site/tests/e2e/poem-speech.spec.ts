import { expect, test } from "@playwright/test";

test("reads the poem with its text language and can stop", async ({ page }) => {
  await page.addInitScript(() => {
    const speechState = {
      canceled: 0,
      spoken: [] as Array<{ lang: string; text: string }>,
      utterances: [] as MockUtterance[],
      voices: [{ lang: "en-US", localService: true }],
      voicesChanged: null as (() => void) | null,
      staleOnEnd: null as (() => void) | null,
    };
    class MockUtterance {
      lang = "";
      voice: { lang: string } | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;

      constructor(public text: string) {}
    }

    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: MockUtterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        addEventListener: (name: string, listener: () => void) => {
          if (name === "voiceschanged") speechState.voicesChanged = listener;
        },
        cancel: () => { speechState.canceled += 1; },
        getVoices: () => speechState.voices,
        speak: (utterance: MockUtterance) => {
          speechState.spoken.push({ lang: utterance.lang, text: utterance.text });
          speechState.utterances.push(utterance);
        },
      },
    });
    Object.defineProperty(window, "__speechState", { configurable: true, value: speechState });
  });

  await page.clock.install({ time: new Date("2026-01-01T08:00:00Z") });
  await page.goto("poem/walt-whitman/o-captain-my-captain/");
  await page.clock.pauseAt(new Date("2026-01-01T10:00:00Z"));
  const button = page.locator("[data-poem-listen]");
  const status = page.locator("#poem-listen-status");
  const unavailable = page.locator("#poem-listen-unavailable");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { voices: unknown[]; voicesChanged: (() => void) | null } }).__speechState;
    state.voices = [];
    state.voicesChanged?.();
  });
  await expect(button).toBeDisabled();
  await expect(status).toBeEmpty();
  await expect(unavailable).toHaveText("No local voice is available for this poem's language.");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { voices: unknown[]; voicesChanged: (() => void) | null } }).__speechState;
    state.voices = [{ lang: "en-US", localService: true }];
    state.voicesChanged?.();
  });
  await expect(button).toBeEnabled();
  await expect(status).toHaveText("Ready to read this poem aloud.");
  await expect(unavailable).toBeEmpty();

  await button.click();
  await expect(page.getByRole("button", { name: "Stop listening" })).toHaveAttribute("data-listening", "true");
  const spoken = await page.evaluate(() => (window as typeof window & { __speechState: { spoken: Array<{ lang: string; text: string }> } }).__speechState.spoken);
  expect(spoken[0].lang).toBe("en");
  expect(spoken[0].text).toContain("O Captain! my Captain!");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }> } }).__speechState;
    state.utterances[0].onend?.();
  });
  await page.clock.runFor(549);
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(1);
  await page.clock.runFor(1);
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(2);

  for (let index = 0; index < 20 && await button.getAttribute("data-listening") === "true"; index += 1) {
    await page.evaluate(() => {
      const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }> } }).__speechState;
      state.utterances.at(-1)?.onend?.();
    });
    await page.clock.runFor(550);
  }
  await expect(button).toHaveAttribute("data-listening", "false");
  await expect(status).toHaveText("Finished reading the poem.");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { voicesChanged: (() => void) | null } }).__speechState;
    state.voicesChanged?.();
  });
  await expect(status).toHaveText("Finished reading the poem.");

  const spokenBeforeRestart = await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length);
  await button.click();
  await expect(page.getByRole("button", { name: "Stop listening" })).toHaveAttribute("data-listening", "true");
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(spokenBeforeRestart + 1);
  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }> } }).__speechState;
    state.utterances.at(-1)?.onend?.();
  });
  await page.clock.runFor(550);
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(spokenBeforeRestart + 2);

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }>; staleOnEnd: (() => void) | null; voices: unknown[]; voicesChanged: (() => void) | null } }).__speechState;
    state.staleOnEnd = state.utterances.at(-1)?.onend ?? null;
    state.voices = [];
    state.voicesChanged?.();
  });
  await expect(page.getByRole("button", { name: "Stop listening" })).toBeEnabled();

  const canceledBeforeStop = await page.evaluate(() => (window as typeof window & { __speechState: { canceled: number } }).__speechState.canceled);
  await page.getByRole("button", { name: "Stop listening" }).click();
  await expect(button).toHaveAttribute("data-listening", "false");
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { canceled: number } }).__speechState.canceled)).toBe(canceledBeforeStop + 1);
  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }> } }).__speechState;
    state.utterances.at(-1)?.onend?.();
  });
  await page.clock.runFor(1_000);
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(spokenBeforeRestart + 2);
  await expect(button).toBeDisabled();
  await expect(status).toHaveText("Reading stopped.");
  await expect(unavailable).toHaveText("No local voice is available for this poem's language.");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { voices: unknown[]; voicesChanged: (() => void) | null } }).__speechState;
    state.voices = [{ lang: "en-US", localService: true }];
    state.voicesChanged?.();
  });
  await expect(button).toBeEnabled();
  await expect(status).toHaveText("Reading stopped.");
  await expect(unavailable).toBeEmpty();

  await button.click();
  const spokenBeforeStaleCallback = await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length);
  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { staleOnEnd: (() => void) | null } }).__speechState;
    if (!state.staleOnEnd) throw new Error("Expected a saved callback from the stopped session");
    state.staleOnEnd();
  });
  await page.clock.runFor(550);
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(spokenBeforeStaleCallback);
  await expect(button).toHaveAttribute("data-listening", "true");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }>; voices: unknown[]; voicesChanged: (() => void) | null } }).__speechState;
    state.voices = [];
    state.voicesChanged?.();
    state.utterances.at(-1)?.onend?.();
  });
  await page.clock.runFor(550);
  await expect(button).toHaveAttribute("data-listening", "false");
  await expect(button).toBeDisabled();
  await expect(status).toHaveText("Reading stopped because no local voice is available for this poem's language.");
  await expect(unavailable).toBeEmpty();
});

test("disables read-aloud when the browser has no speech API", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  });

  await page.goto("fr/poem/walt-whitman/o-captain-my-captain/");
  await expect(page.getByRole("button", { name: "Listen to poem" })).toBeDisabled();
  await expect(page.locator("#poem-listen-status")).toContainText("unavailable");
});
