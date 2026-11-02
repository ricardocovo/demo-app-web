import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mock-api';

async function open(page: Page, resource: string, detail = '') {
  await page.goto(`/?clawpilotTheme=light#${resource}${detail ? `/${detail}` : ''}`);
  await expect(page.getByRole('main')).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible();
}
async function remove(page: Page, name: string) {
  await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

test('complete CRUD chain for all five resources and persistent refresh', async ({ page }) => {
  const { db } = await mockApi(page);
  await open(page, 'championships');
  await page.getByRole('button', { name: 'New championship' }).click();
  await page.getByLabel('Name', { exact: true }).fill('  Junior Stars  ');
  await page.getByLabel('Year', { exact: true }).fill('2027');
  await save(page);
  await page.getByRole('button', { name: 'Edit Junior Stars', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Junior Stars Cup');
  await save(page);
  await expect(page.getByRole('heading', { name: 'Junior Stars Cup', exact: true })).toBeVisible();

  await open(page, 'teams');
  await page.getByRole('button', { name: 'New team', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Little Lions');
  await page.getByLabel('Championship', { exact: true }).selectOption({ label: 'Junior Stars Cup / 2027' });
  await save(page);
  await page.getByRole('button', { name: 'Edit Little Lions', exact: true }).click();
  await expect(page.getByLabel('Championship', { exact: true })).toHaveValue('4');
  await page.getByLabel('Name', { exact: true }).fill('Junior Lions');
  await save(page);
  await page.getByRole('button', { name: 'New team', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Little Tigers');
  await page.getByLabel('Championship', { exact: true }).selectOption('4');
  await save(page);

  await open(page, 'players');
  await page.getByRole('button', { name: 'New player', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Casey Green');
  await page.getByLabel('Age', { exact: true }).fill('9');
  await page.getByLabel('Team', { exact: true }).selectOption({ label: 'Junior Lions / Junior Stars Cup' });
  await save(page);
  await page.getByRole('button', { name: 'Edit Casey Green', exact: true }).click();
  await page.getByLabel('Age', { exact: true }).fill('10');
  await expect(page.getByLabel('Team', { exact: true })).toHaveValue('4');
  await save(page);

  await open(page, 'games');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByLabel('Game date', { exact: true }).fill('2027-03-20');
  await page.getByLabel('Home team', { exact: true }).selectOption('4');
  await page.getByLabel('Away team', { exact: true }).selectOption('5');
  await save(page);
  await page.getByRole('button', { name: 'Edit Junior Lions vs Little Tigers', exact: true }).click();
  await expect(page.getByLabel('Game date', { exact: true })).toHaveValue('2027-03-20');
  await page.getByLabel('Game date', { exact: true }).fill('2027-03-21');
  await save(page);
  await expect(page.getByText('Mar 21, 2027', { exact: true })).toBeVisible();

  await open(page, 'player-stats');
  await page.getByRole('button', { name: 'New player stat', exact: true }).click();
  await page.getByLabel('Game', { exact: true }).selectOption('2');
  await page.getByLabel('Player', { exact: true }).selectOption({ label: 'Casey Green / Junior Lions' });
  await page.getByLabel('Position', { exact: true }).selectOption('Midfielder');
  await page.getByLabel('Minutes played', { exact: true }).fill('40');
  await page.getByLabel('Goals', { exact: true }).fill('1');
  await page.getByLabel('In the starting lineup').check();
  await save(page);
  await page.getByRole('button', { name: 'Edit Casey Green - 2027-03-21', exact: true }).click();
  await page.getByLabel('Goals', { exact: true }).fill('2');
  await save(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Casey Green - 2027-03-21' })).toBeVisible();
  expect(db['player-stats'].find(s => s.playerId === 4)).toMatchObject({ goals: 2, starter: true });

  await open(page, 'players', '4');
  await expect(page.getByRole('heading', { name: 'Player totals' })).toBeVisible();
  await expect(page.locator('.totals')).toContainText('40');
  await open(page, 'games', '2');
  await expect(page.getByRole('table')).toContainText('Casey Green');
  await open(page, 'teams', '4');
  await expect(page.getByRole('heading', { name: /Team roster/ })).toBeVisible();
  await expect(page.locator('.related-grid').first()).toContainText('Casey Green');
  await expect(page.locator('.related-grid').last()).toContainText('Junior Lions vs Little Tigers');
  await open(page, 'championships', '4');
  await expect(page.locator('.related-grid')).toContainText('Junior Lions');

  await open(page, 'player-stats'); await remove(page, 'Casey Green - 2027-03-21');
  await open(page, 'players'); await remove(page, 'Casey Green');
  await open(page, 'games'); await remove(page, 'Junior Lions vs Little Tigers');
  await open(page, 'teams'); await remove(page, 'Junior Lions'); await remove(page, 'Little Tigers');
  await open(page, 'championships'); await remove(page, 'Junior Stars Cup');
  await expect(page.getByRole('heading', { name: 'Junior Stars Cup', exact: true })).not.toBeVisible();
  expect(db.championships).toHaveLength(3);
});

test('filters, search, named related views, totals and reconciled dependent filters', async ({ page }) => {
  const { calls } = await mockApi(page);
  await open(page, 'teams');
  await page.getByLabel('Filter championships', { exact: true }).selectOption('1');
  await expect(page.getByRole('heading', { name: 'Riverside Foxes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northside Bears' })).not.toBeVisible();
  expect(calls).toContain('GET /api/teams?championshipId=1');
  await page.getByRole('searchbox').fill('owls');
  await expect(page.getByRole('heading', { name: 'Oakwood Owls' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Riverside Foxes' })).not.toBeVisible();
  await open(page, 'players');
  await page.getByLabel('Filter championships', { exact: true }).selectOption('1');
  await page.getByLabel('Filter teams', { exact: true }).selectOption('1');
  await expect(page.getByRole('heading', { name: 'Alex Morgan' })).toBeVisible();
  await page.getByLabel('Filter championships', { exact: true }).selectOption('2');
  await expect(page.getByLabel('Filter teams', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Sam Taylor' })).toBeVisible();
  await open(page, 'players', '1');
  await page.getByLabel('Totals championship').selectOption('2');
  await expect(page.locator('.totals').getByText('0', { exact: true })).toHaveCount(5);
  expect(calls).toContain('GET /api/players/1/totals?championshipId=2');
  await open(page, 'games');
  await page.getByLabel('Filter teams', { exact: true }).selectOption('1');
  await expect(page.getByRole('heading', { name: 'Riverside Foxes vs Oakwood Owls' })).toBeVisible();
  expect(calls).toContain('GET /api/games?teamId=1');
  await open(page, 'player-stats');
  await page.getByLabel('Filter games', { exact: true }).selectOption('1');
  await page.getByLabel('Filter players', { exact: true }).selectOption('2');
  await expect(page.getByRole('heading', { name: 'No matches this time' })).toBeVisible();
  expect(calls).toContain('GET /api/player-stats?gameId=1&playerId=2');
});

test('validation, protected deletes, move conflicts and duplicate stats preserve dialog data', async ({ page }) => {
  const { db } = await mockApi(page);
  db.teams.push({ id: 4, name: 'Southside Stars', championshipId: 1 });
  await open(page, 'championships');
  await page.getByRole('button', { name: 'New championship' }).click();
  await page.getByLabel('Name', { exact: true }).fill('   ');
  await page.getByLabel('Year', { exact: true }).fill('2101');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(page.getByText('Year must be a whole number between 1900 and 2100.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Delete Summer League', exact: true }).click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByText('Championship has teams; delete them first.')).toBeVisible();
  await page.getByRole('button', { name: 'Keep record' }).click();
  await open(page, 'teams');
  await page.getByRole('button', { name: 'Edit Riverside Foxes', exact: true }).click();
  await page.getByLabel('Championship', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Cannot move a team that has games to another championship.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Championship', { exact: true })).toHaveValue('2');
  await page.keyboard.press('Escape');
  await open(page, 'games');
  await page.getByRole('button', { name: 'Edit Riverside Foxes vs Oakwood Owls', exact: true }).click();
  await page.getByLabel('Home team', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Cannot change teams of a game that has recorded stats.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await open(page, 'player-stats');
  await page.getByRole('button', { name: 'New player stat', exact: true }).click();
  await page.getByLabel('Game', { exact: true }).selectOption('1');
  await expect(page.getByLabel('Player', { exact: true }).locator('option')).not.toContainText(['Sam Taylor']);
  await page.getByLabel('Player', { exact: true }).selectOption('1');
  await page.getByLabel('Position', { exact: true }).selectOption('Forward');
  await page.getByLabel('Minutes played', { exact: true }).fill('121');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Minutes must be a whole number between 0 and 120.')).toBeVisible();
  await page.getByLabel('Minutes played', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Stats for this player in this game already exist.')).toBeVisible();
});

test('loading, empty, retryable failures, missing records and 400 field errors', async ({ page }) => {
  await mockApi(page, { championships: [], teams: [], players: [], games: [], 'player-stats': [] });
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/championships', async route => {
    await gate;
    await route.fallback();
  });
  await page.goto('/?clawpilotTheme=light#championships');
  await expect(page.getByRole('status')).toContainText('Loading');
  release();
  await expect(page.getByRole('heading', { name: 'Your next championship starts here' })).toBeVisible();
  let fail = true;
  await page.route('**/api/teams', route => fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fallback());
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('(503)');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Your next championship starts here' })).toBeVisible();
  await page.route('**/api/championships', route => route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ errors: { name: ['Please use a unique league name.'] } }) }) : route.fallback());
  await page.getByRole('button', { name: 'New championship' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Test');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Please use a unique league name.')).toBeVisible();
  await page.keyboard.press('Escape');
  await open(page, 'players', '999');
  await expect(page.getByRole('alert')).toContainText('no longer exists');
});

test('responsive layout and keyboard-only focus-managed dialog', async ({ page }, testInfo) => {
  await mockApi(page);
  await open(page, 'championships');
  await expect(page.getByRole('heading', { name: 'Summer League', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const button = page.getByRole('button', { name: 'New championship', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(button).toBeFocused();
  await page.getByRole('main').focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/touchline-${testInfo.project.name}.png`, fullPage: true });
});
