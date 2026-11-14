import { test, expect, type Page } from '@playwright/test';
import { BIO_SEQUENCE, INITIAL_ROTATIONS, STORAGE_KEY } from '../../src/game';

async function setRange(page: Page, selector: string, value: number) {
  await page.locator(selector).evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Assumir o turno', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Há alguém no ruído.' })).toBeVisible();
}
async function next(page: Page) {
  await page.getByRole('button', { name: 'Continuar a investigação', exact: true }).click();
}
async function solveCircuit(page: Page) {
  for (const [index, rotation] of INITIAL_ROTATIONS.entries()) {
    if (index === 4) continue;
    for (let turn = rotation; turn < 4; turn++)
      await page.getByRole('button', { name: new RegExp(`Girar peça ${index + 1},`) }).click();
  }
  await expect(page.getByText('8 / 8 segmentos energizados')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar energia', exact: true }).click();
}

test('opening, help, accessibility settings, and deliberate audio opt-in', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/ÚLTIMO SINAL/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ÚLTIMOSINAL.');
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('switch', { name: 'Reduzir movimento' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.getByRole('switch', { name: 'Paisagem sonora' }).click();
  await expect(page.getByRole('switch', { name: 'Paisagem sonora' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Desligar áudio' })).toBeVisible();
  await page.getByRole('button', { name: 'Desligar áudio' }).click();
  await expect(page.getByRole('button', { name: 'Ligar áudio', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('all five puzzles solve through real controls; choices persist and can be revisited', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await page.getByRole('button', { name: 'Capturar transmissão' }).click();
  await expect(page.getByRole('alert')).toContainText('Ainda é ruído');
  await setRange(page, '#frequency', 96.4);
  await setRange(page, '#gain', 70);
  await expect(page.getByTestId('frequency-value')).toHaveText('96.4');
  await page.getByRole('button', { name: 'Capturar transmissão' }).click();
  await expect(page.getByRole('heading', { name: 'Uma voz familiar' })).toBeVisible();
  await next(page);
  await solveCircuit(page);
  await expect(page.getByRole('heading', { name: 'Vinte e três corações' })).toBeVisible();
  await next(page);
  const rotors = page.getByRole('slider', { name: 'Ajustar rotor' });
  await setRange(page, 'input[aria-label="Ajustar rotor 1"]', -3);
  await setRange(page, 'input[aria-label="Ajustar rotor 2"]', 1);
  await setRange(page, 'input[aria-label="Ajustar rotor 3"]', -4);
  await expect(rotors).toHaveCount(3);
  await page.getByRole('button', { name: 'Decifrar arquivo' }).click();
  await expect(page.getByRole('heading', { name: 'Seu último registro' })).toBeVisible();
  await next(page);
  await page.getByRole('button', { name: 'Reproduzir eco' }).click();
  await expect(page.getByRole('button', { name: 'Observe o eco…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reproduzir eco' })).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Ler sequência' }).click();
  await expect(page.getByRole('list', { name: 'Sequência biométrica completa' })).toBeVisible();
  await page.locator('.bio-pad.pad-1').click();
  await expect(page.getByRole('alert')).toContainText('Era Pulso');
  const names = ['Pulso', 'Íris', 'Voz', 'Neural'];
  for (const pad of BIO_SEQUENCE)
    await page.getByRole('button', { name: new RegExp(names[pad]) }).click();
  await expect(page.getByRole('heading', { name: 'Não foi um acidente' })).toBeVisible();
  await next(page);
  await setRange(page, '#azimuth', 132);
  await setRange(page, '#elevation', 24);
  await page.getByRole('button', { name: 'Fixar alinhamento' }).click();
  await expect(page.getByRole('heading', { name: 'Alguém está esperando' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir canal de resposta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirmar decisão' })).toBeDisabled();
  await page.getByRole('radio', { name: /Acordar a tripulação/ }).check();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await page.getByRole('button', { name: 'Pensar mais um pouco' }).click();
  await expect(page.getByRole('heading', { name: /O sinal era seu/ })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await page.getByRole('button', { name: 'Encerrar turno', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ninguém decide sozinho.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ninguém decide sozinho.' })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(saved.solved).toHaveLength(5);
  expect(saved.ending).toBe('together');
  await page.getByRole('button', { name: 'Explorar outro desfecho' }).click();
  await page.getByRole('radio', { name: /Responder ao resgate/ }).check();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await page.getByRole('button', { name: 'Encerrar turno', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A manhã voltou.' })).toBeVisible();
  await expect(page.getByText('2 DE 3 DESCOBERTOS', { exact: false })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar esta história' }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('ultimo-sinal-diario.txt');
  expect(errors).toEqual([]);
});

test('guided presentation reaches the last epilogue and restarts safely', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Modo apresentação' }).click();
  await expect(page.getByText('MODO APRESENTAÇÃO', { exact: true })).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Restaurar com assistência' }).click();
    await expect(page.getByText(/SISTEMA 0\d \/ RESTAURADO/)).toBeVisible();
    if (i < 4) await next(page);
  }
  await page.getByRole('button', { name: 'Abrir canal de resposta', exact: true }).click();
  await page.getByRole('radio', { name: /Manter o silêncio/ }).check();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await page.getByRole('button', { name: 'Encerrar turno', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'O último guardião.' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo turno', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar este turno' }).click();
  await expect(page.getByRole('heading', { name: 'O último guardião.' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo turno', exact: true }).click();
  await page.getByRole('button', { name: 'Recomeçar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assumir o turno', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Assumir o turno', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Há alguém no ruído.' })).toBeVisible();
  await expect(page.getByText('MODO APRESENTAÇÃO', { exact: true })).toHaveCount(0);
});

test('progress and controls survive reload; hints and locked modules give feedback', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Precisa de uma pista?' }).click();
  await expect(page.getByText('A frequência correta está anotada', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar ajuste exato' }).click();
  await expect(page.getByRole('button', { name: /Todas as pistas reveladas/ })).toBeDisabled();
  await setRange(page, '#frequency', 94.6);
  await page.getByRole('button', { name: 'Aumentar frequência em 0,1 MHz' }).click();
  await expect(page.getByTestId('frequency-value')).toHaveText('94.7');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Há alguém no ruído.' })).toBeVisible();
  await expect(page.getByTestId('frequency-value')).toHaveText('94.7');
  await expect(page.getByRole('button', { name: /Todas as pistas reveladas/ })).toBeDisabled();
  await page
    .getByRole('navigation', { name: 'Sistemas da estação' })
    .getByRole('button', { name: /Arquivo/ })
    .click({ force: true });
  await expect(page.locator('.toast')).toContainText('Ainda bloqueado');
  await expect(page.getByRole('heading', { name: 'Há alguém no ruído.' })).toBeVisible();
});

test('corrupt or unavailable storage never prevents playing', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{corrupted'), STORAGE_KEY);
  await start(page);
  await expect(page.getByRole('heading', { name: 'Há alguém no ruído.' })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await setRange(page, '#frequency', 96.4);
  await expect(page.getByText('SALVAMENTO INDISPONÍVEL · MANTENHA ESTA ABA ABERTA')).toBeVisible();
  await setRange(page, '#gain', 70);
  await page.getByRole('button', { name: 'Capturar transmissão' }).click();
  await expect(page.getByRole('heading', { name: 'Uma voz familiar' })).toBeVisible();
});

test('mobile layout has no horizontal overflow; map, clues, and assisted play work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/mobile-opening.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Modo apresentação' }).click();
  await page.getByRole('button', { name: 'Estação', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Rede de escuta: disponível', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Diário/ }).click();
  await expect(page.getByRole('dialog').getByText('PISTA ATUAL')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('96,4 MHz');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restaurar com assistência' }).click();
  await next(page);
  await expect(page.getByRole('heading', { name: 'Reacenda a Íris.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/mobile-circuit.png', fullPage: true });
});

test('reduced-motion preference is respected and keyboard focus stays in dialogs', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Como jogar', exact: true })).toBeFocused();
});
