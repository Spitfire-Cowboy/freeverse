import { expect, test } from "@playwright/test";

test("reads the poem with its text language and can stop", async ({ page }) => {
  await page.addInitScript(() => {
    const speechState = {
      canceled: 0,
      spoken: [] as Array<{ lang: string; text: string }>,
      utterances: [] as MockUtterance[],
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
        cancel: () => { speechState.canceled += 1; },
        getVoices: () => [{ lang: "en-US" }],
        speak: (utterance: MockUtterance) => {
          speechState.spoken.push({ lang: utterance.lang, text: utterance.text });
          speechState.utterances.push(utterance);
        },
      },
    });
    Object.defineProperty(window, "__speechState", { configurable: true, value: speechState });
  });

  await page.goto("poem/walt-whitman/o-captain-my-captain/");
  const button = page.getByRole("button", { name: "Listen to poem" });

  await button.click();
  await expect(page.getByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
  const spoken = await page.evaluate(() => (window as typeof window & { __speechState: { spoken: Array<{ lang: string; text: string }> } }).__speechState.spoken);
  expect(spoken[0].lang).toBe("en");
  expect(spoken[0].text).toContain("O Captain! my Captain!");

  await page.evaluate(() => {
    const state = (window as typeof window & { __speechState: { utterances: Array<{ onend: (() => void) | null }> } }).__speechState;
    state.utterances[0].onend?.();
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __speechState: { spoken: unknown[] } }).__speechState.spoken.length)).toBe(2);

  await page.getByRole("button", { name: "Stop listening" }).click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
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
