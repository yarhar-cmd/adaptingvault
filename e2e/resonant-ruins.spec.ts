import { expect, test, type Page } from '@playwright/test';
import {
  createActiveRunRecord,
  type ActiveRunRecord,
} from '../apps/frontend/src/services/activeRunStorage';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../apps/frontend/src/services/playerProfileStorage';
import { gameplayReducer } from '../apps/frontend/src/utils/gameplayState';
import { generateDungeonRoom } from '../apps/frontend/src/utils/generatedRoomGenerator';
import { createRatFromSpawn } from '../apps/frontend/src/utils/enemySystem';
import { coordinateToGridPosition, findSafeSpawn } from '../apps/frontend/src/utils/roomGeometry';
import { createFreshRun } from '../apps/frontend/src/utils/runLifecycle';
import { evaluationRooms } from '../apps/frontend/src/data/rooms/evaluationRooms';
import { createCombatMetrics, type EnemyRoomState } from '../apps/frontend/src/types/enemies';
import { RAT_COMBAT_CONFIG } from '../apps/frontend/src/config/combat';
import type { TileCoordinate } from '../apps/frontend/src/types/rooms';

const ACTIVE_RUN_KEY = 'mirrorvault:active-run:v1';

function freshRecord(): ActiveRunRecord {
  const now = Date.now();
  const gameplay = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    startedAt: now,
    runId: `e2e-run-${now}`,
    runSeed: `e2e-seed-${now}`,
  });
  return createActiveRunRecord(gameplay, 'warden', now)!;
}

function combatRecord({
  player = { x: 3, y: 5 },
  rats = [{ x: 4, y: 5 }],
  telegraph = false,
  corpse = false,
  paused = false,
}: {
  player?: TileCoordinate;
  rats?: TileCoordinate[];
  telegraph?: boolean;
  corpse?: boolean;
  paused?: boolean;
} = {}): ActiveRunRecord {
  const now = Date.now();
  const room = evaluationRooms[3]!;
  const enemies: EnemyRoomState = {
    roomId: room.id,
    rats: rats.map((tile, index) =>
      createRatFromSpawn(
        {
          id: `e2e-rat-${index + 1}`,
          type: 'rat',
          tile,
          order: index + 1,
          source: 'authored',
          reason: 'Controlled Chromium fixture',
        },
        now,
      ),
    ),
    aiFrozen: false,
    countPlan: null,
    lastBlockAt: null,
    lastBlockKind: null,
    lastTickAt: now,
    awarenessGraceEndsAt: now + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs,
    combatMetrics: createCombatMetrics(),
  };
  let gameplay = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: now,
      runId: `combat-run-${now}`,
      runSeed: `combat-seed-${now}`,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: room.id,
      destinationRoomIndex: 3,
      destinationSpawn: coordinateToGridPosition(player),
      enteredFrom: 'west',
      exitedAtMs: 0,
      exitChoice: null,
      evaluationComplete: false,
      enemies,
    },
  );
  if (telegraph)
    gameplay = gameplayReducer(gameplay, {
      type: 'enemy-tick',
      timestamp: now + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs,
      room,
    });
  if (corpse) {
    gameplay = gameplayReducer(gameplay, {
      type: 'attack',
      id: 'e2e-sword-1',
      timestamp: now + 10,
      room,
    });
    gameplay = gameplayReducer(gameplay, {
      type: 'attack',
      id: 'e2e-sword-2',
      timestamp: now + 410,
      room,
    });
  }
  const recordTime = corpse
    ? now + 420
    : telegraph
      ? now + RAT_COMBAT_CONFIG.roomEntryAwarenessGraceMs + 100
      : now;
  if (paused)
    gameplay = gameplayReducer(gameplay, {
      type: 'pause-run',
      timestamp: recordTime,
      reason: 'pause-menu',
    });
  return createActiveRunRecord(gameplay, 'warden', recordTime)!;
}

function maximumRoomRecord(): ActiveRunRecord {
  const initial = freshRecord();
  const maximumProfile = { ...NEUTRAL_ADAPTIVE_PROFILE, pace: 1, exploration: 1 };
  let generated = generateDungeonRoom({
    runSeed: 'maximum-room-fixture',
    dungeonRoomNumber: 1,
    chosenExitId: 'maximum-exit-0',
    entranceDirection: 'west',
    experiencePreset: 'seasoned-adventurer',
    effectiveProfile: maximumProfile,
    mode: 'reinforce',
  });
  for (
    let index = 1;
    index < 10_000 && (generated.roomSnapshot.width !== 21 || generated.roomSnapshot.height !== 15);
    index += 1
  ) {
    generated = generateDungeonRoom({
      runSeed: `maximum-room-fixture-${index}`,
      dungeonRoomNumber: 1,
      chosenExitId: `maximum-exit-${index}`,
      entranceDirection: 'west',
      experiencePreset: 'seasoned-adventurer',
      effectiveProfile: maximumProfile,
      mode: index % 2 ? 'poke' : 'reinforce',
    });
  }
  if (generated.roomSnapshot.width !== 21 || generated.roomSnapshot.height !== 15)
    throw new Error('Unable to create deterministic 21x15 room fixture.');
  const restored = gameplayReducer(
    createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      startedAt: 1_000,
      runId: initial.runId,
      runSeed: generated.runSeed,
    }),
    {
      type: 'commit-room-transition',
      destinationRoomId: generated.roomSnapshot.id,
      destinationRoomIndex: 5,
      destinationSpawn: coordinateToGridPosition(findSafeSpawn(generated.roomSnapshot, 'west')),
      enteredFrom: 'west',
      exitedAtMs: 1_000,
      exitChoice: null,
      evaluationComplete: true,
      generatedRoom: generated,
      chosenExitId: 'maximum-room-entry',
    },
  );
  return createActiveRunRecord(restored, 'warden', 2_000)!;
}

async function seedActiveRun(page: Page, record: ActiveRunRecord = freshRecord()) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: ACTIVE_RUN_KEY,
    value: record,
  });
}

test.beforeEach(async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('http://localhost:3001/api/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  (page as Page & { consoleErrors?: string[] }).consoleErrors = consoleErrors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { consoleErrors?: string[] }).consoleErrors).toEqual([]);
});

test('clean first descent reaches Awakening Chamber 1', async ({ page }) => {
  await page.goto('/dungeon');
  await page.getByLabel('Seasoned Adventurer').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Delve' }).click();
  await expect(page).toHaveURL(/\/dungeon\/run$/);
  await expect(page.getByText('Awakening Chamber 1 / 5').first()).toBeVisible();
});

test('paused run remains paused across refresh', async ({ page }) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ACTIVE_RUN_KEY),
    )
    .toMatchObject({ pauseState: { isPaused: true } });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
});

test('Main Menu preserves the run and Home resumes it directly', async ({ page }) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('button', { name: 'Return to Main Menu' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: /Resume Run/ }).click();
  await expect(page).toHaveURL(/\/dungeon\/run$/);
});

test('Restart Run requires confirmation and creates a fresh attempt', async ({ page }) => {
  const original = freshRecord();
  await seedActiveRun(page, original);
  await page.goto('/dungeon/run');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Restart Run' }).click();
  await expect(page.getByRole('dialog', { name: 'Restart Run?' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart Run' }).click();
  await expect(page.getByText('Awakening Chamber 1 / 5').first()).toBeVisible();
  const restarted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(restarted.runId).not.toBe(original.runId);
  expect(restarted.experiencePreset).toBe(original.experiencePreset);
});

test('defeat archives the attempt and Runs displays it', async ({ page }) => {
  await seedActiveRun(page, { ...freshRecord(), status: 'defeated', currentHealth: 0 });
  await page.goto('/dungeon/run');
  await expect(page.getByRole('dialog', { name: 'Game Over' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('mirrorvault:run-archive:v1')))
    .not.toBeNull();
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Recent Runs' })).toBeVisible();
  await expect(page.locator('.history-card')).toHaveCount(1);
});

test('maximum supported room fits inside the gameplay viewport', async ({ page }) => {
  await seedActiveRun(page, maximumRoomRecord());
  await page.goto('/dungeon/run');
  const grid = page.getByRole('application', { name: 'Resonant Ruins playable dungeon grid' });
  await expect(grid).toHaveAttribute('data-room-columns', '21');
  await expect(grid).toHaveAttribute('data-room-rows', '15');
  const viewport = page.locator('.dungeon-grid-viewport');
  await expect(viewport).toHaveJSProperty(
    'scrollWidth',
    await viewport.evaluate((node) => node.clientWidth),
  );
});

test('invalid stored position is repaired and resaved safely', async ({ page }) => {
  await seedActiveRun(page, { ...freshRecord(), playerPosition: { x: -50, y: 99 } });
  await page.goto('/dungeon/run');
  await expect(page.getByText(/saved position was invalid/i)).toBeVisible();
  await expect(page.locator('.player-token')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ACTIVE_RUN_KEY),
    )
    .not.toMatchObject({
      playerPosition: { x: -50, y: 99 },
    });
});

test('new runs use fixed Awakening order and authored Rat counts', async ({ page }) => {
  await page.goto('/dungeon');
  await page.getByLabel('Seasoned Adventurer').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Delve' }).click();
  await page.getByRole('button', { name: 'Debug' }).click();
  for (const chamber of [2, 3, 4]) {
    await page.getByRole('button', { name: 'Advance to Next Room' }).click();
    await expect(page.getByText(`Awakening Chamber ${chamber} / 5`).first()).toBeVisible();
    await page.waitForTimeout(350);
  }
  await expect(page.locator('.rat-token')).toHaveCount(2);
  await expect(page.getByLabel('2 enemies remaining')).toBeVisible();
  await page.getByRole('button', { name: 'Defeat All Enemies' }).click();
  await page.getByRole('button', { name: 'Advance to Next Room' }).click();
  await expect(page.getByText('Awakening Chamber 5 / 5').first()).toBeVisible();
  await expect(page.locator('.rat-token')).toHaveCount(2);
  await expect(page.locator('.tile--hazard')).toHaveCount(2);
  await expect(page.getByRole('application')).toHaveAttribute('data-room-columns', '21');
  await expect(page.getByRole('application')).toHaveAttribute('data-room-rows', '15');
});

test('Rat chases, telegraphs, locks its target, and misses a dodge', async ({ page }) => {
  await seedActiveRun(page, combatRecord({ player: { x: 2, y: 5 }, rats: [{ x: 5, y: 5 }] }));
  await page.goto('/dungeon/run');
  const rat = page.locator('[data-enemy-id="e2e-rat-1"]');
  await expect(rat).toHaveAttribute('data-enemy-x', '5');
  await expect(rat).toHaveAttribute('data-enemy-x', '4', { timeout: 1_000 });
  await expect(rat).toHaveAttribute('data-enemy-state', 'telegraphing', { timeout: 1_800 });
  await page.keyboard.press('ArrowLeft');
  await expect(rat).toHaveAttribute('data-enemy-state', 'recovering', { timeout: 1_000 });
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible();
});

test('directional shield blocks, two sword hits defeat, and the exit opens immediately', async ({
  page,
}) => {
  await seedActiveRun(page, combatRecord());
  await page.goto('/dungeon/run');
  const rat = page.locator('[data-enemy-id="e2e-rat-1"]');
  await page.keyboard.down('ShiftLeft');
  await expect(rat).toHaveAttribute('data-enemy-state', 'recovering', { timeout: 1_500 });
  await page.keyboard.up('ShiftLeft');
  await expect(page.getByLabel('6 of 6 health remaining.')).toBeVisible();

  await page.goto('/');
  await seedActiveRun(page, combatRecord());
  await page.goto('/dungeon/run');
  await page.keyboard.press('Space');
  await expect(page.locator('[data-enemy-id="e2e-rat-1"]')).toHaveAttribute(
    'data-enemy-health',
    '1',
  );
  await page.waitForTimeout(410);
  await page.keyboard.press('Space');
  await expect(page.getByLabel('0 enemies remaining')).toBeVisible();
  await expect(page.locator('.tile--exit-open')).toHaveCount(1);
});

test('simultaneous Rat attacks respect one universal invulnerability window', async ({ page }) => {
  await seedActiveRun(
    page,
    combatRecord({
      player: { x: 3, y: 5 },
      rats: [
        { x: 4, y: 5 },
        { x: 2, y: 5 },
      ],
    }),
  );
  await page.goto('/dungeon/run');
  await expect(page.getByLabel('5 of 6 health remaining.')).toBeVisible({ timeout: 2_000 });
  await expect(page.locator('.player-token--invulnerable')).toBeVisible();
});

test('paused telegraph and corpse state survive refresh without recounting defeat', async ({
  page,
}) => {
  await seedActiveRun(page, combatRecord({ telegraph: true, paused: true }));
  await page.goto('/dungeon/run');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(before.enemies.rats[0].telegraphRemainingMs).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(after.enemies.rats[0].telegraphRemainingMs).toBe(
    before.enemies.rats[0].telegraphRemainingMs,
  );

  await page.goto('/');
  await seedActiveRun(page, combatRecord({ corpse: true, paused: true }));
  await page.goto('/dungeon/run');
  await expect(page.locator('[data-enemy-state="corpse"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-enemy-state="corpse"]')).toBeVisible();
  const corpseRecord = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect(corpseRecord.enemiesDefeated).toBe(1);
});

test('development editor preview leaves active/profile/archive storage isolated', async ({
  page,
}) => {
  await seedActiveRun(page);
  await page.goto('/dungeon/run');
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  const beforeProfile = await page.evaluate(() =>
    localStorage.getItem('mirrorvault:player-profile:v1'),
  );
  const beforeArchive = await page.evaluate(() =>
    localStorage.getItem('mirrorvault:run-archive:v1'),
  );
  await page.getByRole('button', { name: 'Debug' }).click();
  await page
    .getByRole('combobox', { name: 'Awakening Chamber' })
    .selectOption('evaluation-room-04');
  await page.getByRole('button', { name: 'Validate Room' }).click();
  await expect(page.getByText('Room is valid.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preview Room' }).click();
  await expect(page.getByRole('region', { name: 'Preview Mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Preview' }).click();
  expect(await page.evaluate(() => localStorage.getItem('mirrorvault:run-archive:v1'))).toBe(
    beforeArchive,
  );
  expect(await page.evaluate(() => localStorage.getItem('mirrorvault:player-profile:v1'))).toBe(
    beforeProfile,
  );
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    ACTIVE_RUN_KEY,
  );
  expect({ ...after, elapsedMs: before.elapsedMs }).toEqual(before);
});
