import { test, expect } from './support/fixtures';
import { E2E } from './support/env';
import { saveFullPageScreenshot } from './support/page';

/**
 * Authority（variant_labels / UF）+ Thesaurus Visual Editor（tree depth）
 *
 * 你要求「查詢不要只靠 id，還要支援代名詞/同義詞」：
 * - seed-scale.py 會在 builtin-zh 權威款目塞入少量 variant_labels
 * - authority_terms list/suggest 會把 preferred_label + variant_labels 一起納入搜尋
 *
 * 同時，你也希望 thesaurus 視覺化介面「看起來像樹」且可展開多層：
 * - seed-scale.py 會建立 depth>1 的 deterministic BT/NT（例如：臺灣 → 北部 → 臺北市）
 */

test.describe('Authority variants + Thesaurus Visual Editor', () => {
  test.use({ storageState: E2E.staffStorageStatePath });

  test('Authority Terms：用 variant_labels 搜尋可命中 preferred_label', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/authority-terms`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Authority Terms' })).toBeVisible();
    await expect(page.locator('#authority_query')).toBeVisible();

    // 限定 builtin-zh（避免被 local terms 干擾）
    await page.locator('#authority_kind').selectOption('subject');
    await page.locator('#authority_vocab').fill('builtin-zh');

    // Information literacy 是 seed-scale 建給「資訊素養」的 UF/variant
    await page.locator('#authority_query').fill('Information literacy');

    const termLink = page.getByRole('link', { name: '資訊素養', exact: true }).first();
    await expect(termLink).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'authority-variant-search.png');
  });

  test('Thesaurus Visual Editor：geographic tree 可展開 depth>1（臺灣 → 北部 → 臺北市）', async ({ page, org }, testInfo) => {
    await page.goto(`/orgs/${org.id}/authority-terms/thesaurus/visual?kind=geographic&vocabulary_code=builtin-zh`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: 'Thesaurus Visual Editor' })).toBeVisible();
    await expect(page.locator('#thesaurus_query')).toBeVisible();

    // 用 roots query 限縮到「臺灣」這個 root（避免 roots 太多造成 selector 不穩）
    await page.locator('#thesaurus_query').fill('臺灣');
    await page.getByRole('button', { name: '套用 filters / 重新整理' }).click();

    const taiwan = page.getByRole('button', { name: '臺灣', exact: true }).first();
    await expect(taiwan).toBeVisible();

    // 展開「臺灣」→ 應看到 region：北部
    await taiwan.locator('xpath=preceding-sibling::button[1]').click();
    const north = page.getByRole('button', { name: '北部', exact: true }).first();
    await expect(north).toBeVisible();

    // 展開「北部」→ 應看到「臺北市」（代表 tree depth>1）
    await north.locator('xpath=preceding-sibling::button[1]').click();
    await expect(page.getByRole('button', { name: '臺北市', exact: true }).first()).toBeVisible();

    await saveFullPageScreenshot(page, testInfo, 'thesaurus-visual-tree-depth.png');
  });
});
