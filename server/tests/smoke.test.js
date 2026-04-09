import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './setup.js';

let app, closeDbFn, tempDir;
let eventId, judgeId, judge2Id, contestantId, categoryId, criteriaId1, criteriaId2;

beforeAll(async () => {
  const result = await setupTestDb();
  app = result.app;
  closeDbFn = result.closeDb;
  tempDir = result.tempDir;
});

afterAll(() => {
  teardownTestDb(closeDbFn, tempDir);
});

describe('Smoke Tests — Full Scoring Flow', () => {
  it('creates an event', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ name: 'Test Pageant' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Pageant');
    eventId = res.body.id;
  });

  it('creates judges', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/judges`)
      .send({ seat_number: 1, name: 'Judge One', pin: '1234' });
    expect(res.status).toBe(201);
    judgeId = res.body.id;
  });

  it('creates contestants', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/contestants`)
      .send({ number: 1, name: 'Alice' });
    expect(res.status).toBe(201);
    contestantId = res.body.id;
  });

  it('creates a category', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .send({ name: 'Evening Gown', display_order: 1 });
    expect(res.status).toBe(201);
    categoryId = res.body.id;
  });

  it('creates criteria with weights summing to 100%', async () => {
    const c1 = await request(app)
      .post(`/api/categories/${categoryId}/criteria`)
      .send({ name: 'Poise', weight: 0.4, min_score: 0, max_score: 10, display_order: 1 });
    expect(c1.status).toBe(201);
    criteriaId1 = c1.body.id;

    const c2 = await request(app)
      .post(`/api/categories/${categoryId}/criteria`)
      .send({ name: 'Beauty', weight: 0.6, min_score: 0, max_score: 10, display_order: 2 });
    expect(c2.status).toBe(201);
    criteriaId2 = c2.body.id;
  });

  it('submits a single score', async () => {
    const res = await request(app)
      .post('/api/scores')
      .send({ judge_id: judgeId, contestant_id: contestantId, criteria_id: criteriaId1, category_id: categoryId, score: 9.5 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(9.5);
  });

  it('submits batch scores', async () => {
    const res = await request(app)
      .post('/api/scores/batch')
      .send({
        scores: [
          { judge_id: judgeId, contestant_id: contestantId, criteria_id: criteriaId2, category_id: categoryId, score: 8.0 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(1);
    expect(res.body.errors).toEqual([]);
  });

  it('submits the category', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .send({ judge_id: judgeId, category_id: categoryId });
    expect(res.status).toBe(201);
    expect(res.body.submitted).toBe(1);
  });

  it('generates a report with correct rankings', async () => {
    const res = await request(app)
      .get(`/api/reports/${eventId}/category/${categoryId}`);
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('Evening Gown');
    expect(res.body.rankings.length).toBe(1);
    // Poise: 9.5 * 0.4 = 3.8, Beauty: 8.0 * 0.6 = 4.8, Total = 8.6
    expect(res.body.rankings[0].total_score).toBe(8.6);
    expect(res.body.rankings[0].rank).toBe(1);
  });

  it('rejects score for submitted category (10.1.1)', async () => {
    const res = await request(app)
      .post('/api/scores')
      .send({ judge_id: judgeId, contestant_id: contestantId, criteria_id: criteriaId1, category_id: categoryId, score: 7.0 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects score outside min/max range (10.1.2)', async () => {
    const j2 = await request(app)
      .post(`/api/events/${eventId}/judges`)
      .send({ seat_number: 2, name: 'Judge Two', pin: '5678' });
    judge2Id = j2.body.id;

    const cat2 = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .send({ name: 'Talent', display_order: 2 });
    const crit = await request(app)
      .post(`/api/categories/${cat2.body.id}/criteria`)
      .send({ name: 'Skill', weight: 1.0, min_score: 0, max_score: 10, display_order: 1 });

    const res = await request(app)
      .post('/api/scores')
      .send({ judge_id: judge2Id, contestant_id: contestantId, criteria_id: crit.body.id, category_id: cat2.body.id, score: 15.0 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
