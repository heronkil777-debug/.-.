import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function ready(page: Page, route = 'overview') {
  await page.goto(`/#${route}`);
  await expect(page.locator('.sidebar-footer')).toContainText('Serviço local conectado');
}

test('painel mostra sensores reais e alterna atualização', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible();
  await expect(page.getByText('Processador', { exact: true })).toBeVisible();
  await expect(page.getByText('Prévia interativa', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ao vivo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausado', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar sistema' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Leitura do sistema atualizada.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('nota cria, salva, busca, fixa, exporta, reabre e exclui', async ({ page }) => {
  await ready(page, 'notes');
  await page.getByRole('button', { name: 'Nova nota', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título da nota' }).fill('E2E Arch persistente');
  await page
    .getByRole('textbox', { name: 'Texto da nota' })
    .fill('sudo pacman -Syu\nwl-clipboard é opcional');
  await expect(page.getByText('Salvo localmente', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cor Azul', exact: true }).click();
  await page.getByRole('button', { name: 'Fixar nota', exact: true }).click();
  await expect(page.getByText('Salvo localmente', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar nota em Markdown' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  await page.getByRole('button', { name: 'Concluir' }).click();
  await page.reload();
  await page.getByRole('textbox', { name: 'Buscar notas' }).fill('E2E Arch');
  await expect(page.getByRole('heading', { name: 'E2E Arch persistente' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir nota' }).click();
  await expect(page.getByRole('textbox', { name: 'Texto da nota' })).toHaveValue(/wl-clipboard/);
  await page.getByRole('button', { name: 'Excluir nota', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E Arch persistente' })).toHaveCount(0);
});

test('clipboard guarda, copia, fixa, limpa e mantém captura opt-in', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page, 'clipboard');
  const existing = await (await page.request.get('/api/clips')).json();
  for (const clip of existing.clips)
    await page.request.delete(`/api/clips/${clip.id}`, {
      headers: { 'X-NEXO-Request': '1', Origin: 'http://127.0.0.1:5174' },
    });
  await page.reload();
  await expect(page.getByText('Serviço local conectado')).toBeVisible();
  const toggle = page.getByRole('switch', { name: 'Captura automática da área de transferência' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar texto', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('comando-e2e-local');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Guardar texto', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Buscar no histórico' }).fill('comando-e2e-local');
  await expect(page.getByText('comando-e2e-local', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copiado', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('comando-e2e-local');
  await page.getByRole('button', { name: 'Guardar texto', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('texto-temporario-e2e');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Guardar texto', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Buscar no histórico' }).fill('');
  await expect(page.getByText('texto-temporario-e2e', { exact: true })).toBeVisible();
  const pinnedCard = page.getByRole('article').filter({ hasText: 'comando-e2e-local' });
  await pinnedCard.getByRole('button', { name: 'Fixar texto', exact: true }).click();
  await expect(
    pinnedCard.getByRole('button', { name: 'Desafixar texto', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Limpar histórico', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Limpar histórico' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('texto-temporario-e2e', { exact: true })).toHaveCount(0);
  await expect(page.getByText('comando-e2e-local', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir texto do histórico' }).click();
  await expect(page.getByText('comando-e2e-local', { exact: true })).toHaveCount(0);
  await expect(page.getByText('texto-temporario-e2e', { exact: true })).toHaveCount(0);
});

test('pacman gera comandos seguros e explica indisponibilidade fora do Arch', async ({ page }) => {
  await ready(page, 'pacman');
  await page.getByRole('button', { name: 'Gerar comando' }).click();
  await expect(page.locator('.command-output code')).toHaveText('$ sudo pacman -Syu');
  await page.getByRole('button', { name: 'Instalar pacote', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome exato do pacote' }).fill('firefox');
  await page.getByRole('button', { name: 'Gerar comando' }).click();
  await expect(page.locator('.command-output code')).toHaveText(
    '$ sudo pacman -S --needed -- firefox',
  );
  await expect(page.getByText('Pede senha de administrador no terminal.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome exato do pacote' }).fill('firefox; id');
  await page.getByRole('button', { name: 'Gerar comando' }).click();
  await expect(page.getByRole('alert')).toContainText('sem opções ou operadores');
  await expect(page.getByRole('heading', { name: 'O pacman mora no seu Arch.' })).toBeVisible();
});

test('paleta, atalhos, Escape e foco de diálogo', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Buscar ações' }).fill('privacidade');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Do seu jeito. No seu Linux.' })).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByRole('heading', { name: 'Notas rápidas.' })).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('?');
  await expect(page.getByRole('heading', { name: 'Menos cliques. Mais fluxo.' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('exportação JSON e transparência de dados', async ({ page }) => {
  await ready(page, 'settings');
  await expect(page.getByText('Você está explorando uma prévia hospedada.')).toBeVisible();
  await expect(page.getByText('Dados locais, sem criptografia')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar todos os dados' }).click();
  expect((await download).suggestedFilename()).toMatch(/^nexo-backup-.*\.json$/);
});

for (const route of ['overview', 'notes', 'clipboard', 'pacman', 'settings']) {
  test(`acessibilidade WCAG AA: ${route}`, async ({ page }) => {
    await ready(page, route);
    await page.waitForTimeout(350);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`sem overflow e navegação móvel: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['overview', 'notes', 'clipboard', 'pacman', 'settings']) {
      await ready(page, route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `overflow em ${route} a ${width}px`).toBe(false);
    }
    if (width < 800) {
      await page.getByRole('button', { name: 'Abrir navegação' }).click();
      await page.getByRole('link', { name: 'Assistente pacman' }).click();
      await expect(page.getByRole('heading', { name: 'Assistente pacman.' })).toBeVisible();
      await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
    }
  });
}
