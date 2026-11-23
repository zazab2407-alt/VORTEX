// Pure unit tests (no database)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildFilter, escapeRegex, pageMeta, parsePaging, SORTS, DEFAULT_LIMIT, MAX_LIMIT } from '../src/utils/productQuery.js';

describe('paging', () => {
  test('defaults and clamping', () => {
    assert.deepEqual(parsePaging({}), { page: 1, limit: DEFAULT_LIMIT, skip: 0 });
    assert.equal(parsePaging({ limit: '9999' }).limit, MAX_LIMIT);
    assert.equal(parsePaging({ limit: '-5' }).limit, 1);
    assert.equal(parsePaging({ page: 'abc' }).page, 1);
    assert.equal(parsePaging({ page: '3', limit: '10' }).skip, 20);
  });
  test('meta: totals, pages, next/prev', () => {
    assert.deepEqual(pageMeta({ page: 1, limit: 12 }, 16), { page: 1, limit: 12, total: 16, totalPages: 2, hasNext: true, hasPrev: false });
    assert.deepEqual(pageMeta({ page: 2, limit: 12 }, 16), { page: 2, limit: 12, total: 16, totalPages: 2, hasNext: false, hasPrev: true });
    assert.equal(pageMeta({ page: 1, limit: 12 }, 0).totalPages, 1, 'empty result still reports 1 page');
  });
});

describe('sorting', () => {
  test('every sort has a unique tie-breaker so pagination is stable', () => {
    for (const [name, sort] of Object.entries(SORTS)) assert.ok('_id' in sort, `${name} needs _id`);
  });
});

describe('buildFilter', () => {
  test('always restricts to active products', () => assert.deepEqual(buildFilter({}), { isActive: true }));
  test('gender includes unisex unless exactGender', () => {
    assert.deepEqual(buildFilter({ gender: 'men' }).$and[1], { gender: { $in: ['men', 'unisex'] } });
    assert.deepEqual(buildFilter({ gender: 'men', exactGender: true }).$and[1], { gender: 'men' });
    assert.deepEqual(buildFilter({ gender: 'unisex' }).$and[1], { gender: 'unisex' });
  });
  test('price range targets the stored effectivePrice (sale price aware)', () => {
    assert.deepEqual(buildFilter({ minPrice: 20, maxPrice: 60 }).$and[1], { effectivePrice: { $gte: 20, $lte: 60 } });
    assert.deepEqual(buildFilter({ maxPrice: 60 }).$and[1], { effectivePrice: { $lte: 60 } });
    assert.deepEqual(buildFilter({ minPrice: 0 }).$and[1], { effectivePrice: { $gte: 0 } }, 'a minimum of 0 is still a filter');
  });
  test('collections', () => {
    assert.deepEqual(buildFilter({ collection: 'best' }).$and[1], { isFeatured: true });
    assert.ok(buildFilter({ collection: 'sale' }).$and[1].salePrice.$ne === null);
    const since = buildFilter({ collection: 'new' }).$and[1].createdAt.$gte;
    assert.ok(Math.abs(Date.now() - 30 * 864e5 - since.getTime()) < 5000);
  });
  test('search escapes regex characters (no regex injection / ReDoS input)', () => {
    assert.equal(escapeRegex('a.b*c(d)[e]'), 'a\\.b\\*c\\(d\\)\\[e\\]');
    const or = buildFilter({ q: '.*' }).$and[1].$or;
    assert.ok(or[0].name.test('.*') && !or[0].name.test('anything'), 'dot-star is literal text');
    assert.ok(buildFilter({ q: '(' }).$and[1].$or[0].name.test('a (b)'));
  });
  test('search matches the start of words only', () => {
    const rx = buildFilter({ q: 'tee' }).$and[1].$or[0].name;
    assert.ok(rx.test('Apex Performance Tee') && rx.test('Teeny') && rx.test('x-tee'));
    assert.ok(!rx.test('Stainless steel') && !rx.test('Settee'));
    assert.ok(buildFilter({ q: 'legging' }).$and[1].$or[0].name.test('High-Waist Leggings'));
  });
  test('search also matches categories whose name matches', () => {
    const or = buildFilter({ q: 'bras' }, { searchCategoryIds: ['c1'] }).$and[1].$or;
    assert.deepEqual(or[2], { category: { $in: ['c1'] } });
  });
  test('combined filters are AND-ed together', () => {
    assert.equal(buildFilter({ gender: 'women', size: 'XS', color: 'Black' }, { categoryId: 'x' }).$and.length, 5);
  });
});
