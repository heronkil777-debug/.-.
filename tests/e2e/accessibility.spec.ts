import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
  }));
  expect(violations).toEqual([]);
}

test('opening and operator manual meet automated WCAG AA checks', async ({ page }) => {
  await page.goto('/');
  await audit(page);
  await page.getByRole('button', { name: 'Como jogar', exact: true }).click();
  await audit(page);
});

test('receiver mission control meets automated WCAG AA checks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Assumir o turno', exact: true }).click();
  await audit(page);
});

test('all assisted puzzle screens and final choice meet automated WCAG AA checks', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Modo apresentação' }).click();
  for (let i = 0; i < 5; i++) {
    await audit(page);
    await page.getByRole('button', { name: 'Restaurar com assistência' }).click();
    await audit(page);
    await page
      .getByRole('button', {
        name: i < 4 ? 'Continuar a investigação' : 'Abrir canal de resposta',
        exact: true,
      })
      .click();
  }
  await audit(page);
  await page.getByRole('radio', { name: /Responder ao resgate/ }).check();
  await page.getByRole('button', { name: 'Confirmar decisão' }).click();
  await audit(page);
  await page.getByRole('button', { name: 'Encerrar turno', exact: true }).click();
  await audit(page);
});
