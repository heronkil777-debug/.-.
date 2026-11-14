import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function ready(page: Page, route = 'overview') {
  await page.goto(`/#${route}`);
  await expect(page.locator('.sidebar-footer')).toContainText('Serviço local conectado');
}

test('monitor mostra sensores reais e alterna atualização', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible();
  await expect(page.getByText('Processador', { exact: true })).toBeVisible();
  await expect(page.getByText('Prévia interativa', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Núcleos e carga' })).toBeVisible();
  await page.getByRole('button', { name: 'Ao vivo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausado', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar sistema' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Leitura do sistema atualizada.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('processos podem ser buscados e ordenados sem ações destrutivas', async ({ page }) => {
  await ready(page);
  const panel = page.locator('.process-panel');
  await expect(panel.getByRole('heading', { name: 'Processos' })).toBeVisible();
  await panel.getByRole('button', { name: 'CPU', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'CPU', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await panel
    .getByRole('textbox', { name: 'Buscar processos' })
    .fill('nenhum-processo-com-este-nome-xyz');
  await expect(panel.getByText('Nenhum processo corresponde à busca.')).toBeVisible();
  await expect(panel.getByRole('button', { name: /encerrar|matar|kill/i })).toHaveCount(0);
});

test('pacman gera comandos seguros, copia e explica indisponibilidade fora do Arch', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page, 'pacman');
  await page.getByRole('button', { name: 'Gerar comando' }).click();
  await expect(page.locator('.command-output code')).toHaveText('$ sudo pacman -Syu');
  await page.getByRole('button', { name: 'Copiar comando', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comando copiado', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sudo pacman -Syu');
  await page.getByRole('button', { name: 'Instalar pacote', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome exato do pacote' }).fill('firefox');
  await page.getByRole('button', { name: 'Gerar comando' }).click();
  await expect(page.locator('.command-output code')).toHaveText(
    '$ sudo pacman -S --needed -- firefox',
  );
  await expect(page.getByRole('button', { name: 'Ver informações', exact: true })).toHaveCount(0);
  await expect(page.getByText('Ler, entender, decidir.')).toHaveCount(0);
  await expect(page.locator('.sudo-note, .command-explanation')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Nome exato do pacote' }).fill('firefox; id');
  await page.getByRole('button', { name: 'Gerar comando' }).click();
  await expect(page.getByRole('alert')).toContainText('sem opções ou operadores');
  await expect(page.getByRole('heading', { name: 'O pacman mora no seu Arch.' })).toBeVisible();
});

test('diagnóstico pacman e detalhes de pacote com respostas simuladas', async ({ page }) => {
  // Mock explicito: exercita a UI de Arch sem fingir que o sandbox tem pacman.
  await page.route('**/api/pacman/insights', (route) =>
    route.fulfill(
      json({
        available: true,
        message: '',
        installed: 2,
        orphans: ['libfoo'],
        orphanCount: 1,
        foreignCount: 0,
        updates: [{ name: 'git', from: '2.49-1', to: '2.50-1' }],
        updateCount: 1,
        cacheBytes: 1024,
        cacheFiles: 1,
        lastSync: Math.floor(Date.now() / 1000) - 120,
      }),
    ),
  );
  await page.route('**/api/packages?**', (route) =>
    route.fulfill(
      json({
        available: true,
        total: 1,
        message: '',
        packages: [{ name: 'git', version: '2.50-1', description: 'Version control' }],
      }),
    ),
  );
  await page.route('**/api/pacman/package?**', (route) =>
    route.fulfill(
      json({
        available: true,
        found: true,
        name: 'git',
        fields: { Name: 'git', Version: '2.50-1', Description: 'Version control' },
        message: '',
      }),
    ),
  );
  await ready(page, 'pacman');
  await expect(page.getByLabel('Diagnóstico do pacman')).toContainText('Instalados');
  await page.getByRole('button', { name: 'Ver lista' }).click();
  await expect(page.locator('.update-list')).toContainText('2.49-1 → 2.50-1');
  await page
    .locator('.installed-packages')
    .getByRole('button', { name: 'git', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Version control');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('paleta, atalhos e foco de diálogo', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Buscar ações' }).fill('privacidade');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Do seu jeito. No seu Linux.' })).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByRole('heading', { name: 'Assistente pacman.' })).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible();
  await page.keyboard.press('?');
  await expect(page.getByRole('heading', { name: 'Menos cliques. Mais foco.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('diagnóstico JSON e transparência sem banco pessoal', async ({ page }) => {
  await ready(page, 'settings');
  await expect(page.getByText('Você está explorando uma prévia hospedada.')).toBeVisible();
  await expect(page.getByText('Sem banco de dados pessoal')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar diagnóstico JSON' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^nexo-diagnostico-.*\.json$/);
  const stream = await file.createReadStream();
  let text = '';
  for await (const chunk of stream!) text += chunk.toString();
  const data = JSON.parse(text);
  expect(data.app).toBe('NEXO');
  expect(data.system).toBeTruthy();
  expect(data).not.toHaveProperty('notes');
  expect(data).not.toHaveProperty('clips');
});

for (const route of ['overview', 'pacman', 'settings']) {
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
    for (const route of ['overview', 'pacman', 'settings']) {
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

function json(data: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(data) };
}
