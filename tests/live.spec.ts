import { expect, test } from '@playwright/test';

// Explicit opt-in: run ONLY against an isolated, disposable API/database.
test('isolated real API: proxy, complete resource chain, conflicts and related views', async ({ page }) => {
  test.skip(!process.env.LIVE_WEB_URL, 'Set LIVE_WEB_URL to a frontend proxying a disposable API.');
  const base = process.env.LIVE_WEB_URL!;
  const client = page.request;
  const created: { resource: string; id: number }[] = [];
  const create = async (resource: string, payload: object) => {
    const response = await client.post(`${base}/api/${resource}`, { data: payload });
    expect(response.status(), await response.text()).toBe(201);
    const result = await response.json() as { id: number; [key: string]: unknown };
    created.push({ resource, id: result.id });
    return result;
  };
  const unique = `Disposable ${test.info().project.name} ${Date.now()}`;
  try {
    const championship = await create('championships', { name: unique, year: 2027 });
    const a = await create('teams', { name: `${unique} Lions`, championshipId: championship.id });
    const b = await create('teams', { name: `${unique} Owls`, championshipId: championship.id });
    const player = await create('players', { name: `${unique} Alex`, age: 10, teamId: a.id });
    const game = await create('games', { date: '2027-03-21', teamAId: a.id, teamBId: b.id });
    const statPayload = { gameId: game.id, playerId: player.id, position: 'Forward', minutesPlayed: 60, starter: true, goals: 2, assists: 1 };
    const stat = await create('player-stats', statPayload);
    expect((await client.post(`${base}/api/player-stats`, { data: statPayload })).status()).toBe(409);
    expect((await client.delete(`${base}/api/games/${game.id}`)).status()).toBe(409);
    const invalid = await client.post(`${base}/api/players`, { data: { name: 'Bad', age: 2, teamId: a.id } });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).errors.age).toBeDefined();

    await page.goto(`${base}/?clawpilotTheme=light#championships/${championship.id}`);
    await expect(page.getByRole('heading', { name: unique, exact: true })).toBeVisible();
    await expect(page.locator('.related-grid')).toContainText(`${unique} Lions`);
    await page.goto(`${base}/?clawpilotTheme=light#teams/${a.id}`);
    await expect(page.getByRole('heading', { name: /Team roster/ })).toBeVisible();
    await expect(page.locator('.related-grid').first()).toContainText(`${unique} Alex`);
    await page.goto(`${base}/?clawpilotTheme=light#players/${player.id}`);
    await expect(page.locator('.totals')).toContainText('60');
    await page.goto(`${base}/?clawpilotTheme=light#games/${game.id}`);
    await expect(page.getByRole('table')).toContainText(`${unique} Alex`);
    await expect(page.locator('.detail-summary')).toContainText('Mar 21, 2027');
    await page.goto(`${base}/?clawpilotTheme=light#player-stats/${stat.id}`);
    await expect(page.locator('.detail-summary')).toContainText('Forward');

    for (const { resource, id } of created) {
      await page.goto(`${base}/?clawpilotTheme=light#${resource}/${id}`);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      if (resource === 'championships') await page.getByLabel('Year', { exact: true }).fill('2028');
      if (resource === 'teams') await page.getByLabel('Name', { exact: true }).fill(`${unique} Updated ${id}`);
      if (resource === 'players') await page.getByLabel('Age', { exact: true }).fill('11');
      if (resource === 'games') await page.getByLabel('Game date', { exact: true }).fill('2027-03-22');
      if (resource === 'player-stats') await page.getByLabel('Goals', { exact: true }).fill('3');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible();
    }
    for (const { resource, id } of [...created].reverse()) {
      await page.goto(`${base}/?clawpilotTheme=light#${resource}/${id}`);
      await page.getByRole('button', { name: /^Delete / }).click();
      await page.getByRole('button', { name: 'Delete record', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      expect((await client.get(`${base}/api/${resource}/${id}`)).status()).toBe(404);
    }
  } finally {
    for (const { resource, id } of [...created].reverse()) {
      const response = await client.delete(`${base}/api/${resource}/${id}`);
      expect([204, 404], `${resource}/${id} cleanup: ${await response.text()}`).toContain(response.status());
    }
  }
});
