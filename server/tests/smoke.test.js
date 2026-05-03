import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from './setup.js';

let app, closeDbFn, tempDir;
let adminCookie, judgeToken;
let eventId, judgeId, contestantId, categoryId, criteriaId1, criteriaId2;

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
  it('authenticates as admin', async () => {
    const res = await request(app)
      .post('/api/auth/admin')
      .send({ secret: 'test-admin-secret' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Capture set-cookie header
    const cookies = res.headers['set-cookie'];
    adminCookie = Array.isArray(cookies) ? cookies.join('; ') : cookies;
  });

  it('creates an event', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Cookie', adminCookie)
      .send({ name: 'Test Pageant' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Pageant');
    eventId = res.body.id;
  });

  it('creates judges', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/judges`)
      .set('Cookie', adminCookie)
      .send({ seat_number: 1, name: 'Judge One', pin: '1234' });
    expect(res.status).toBe(201);
    judgeId = res.body.id;
  });

  it('creates contestants', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/contestants`)
      .set('Cookie', adminCookie)
      .send({ number: 1, name: 'Alice' });
    expect(res.status).toBe(201);
    contestantId = res.body.id;
  });

  it('creates a category', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set('Cookie', adminCookie)
      .send({ name: 'Evening Gown', display_order: 1 });
    expect(res.status).toBe(201);
    categoryId = res.body.id;
  });

  it('creates criteria with weights summing to 100%', async () => {
    const c1 = await request(app)
      .post(`/api/categories/${categoryId}/criteria`)
      .set('Cookie', adminCookie)
      .send({ name: 'Poise', weight: 0.4, min_score: 0, max_score: 10, display_order: 1 });
    expect(c1.status).toBe(201);
    criteriaId1 = c1.body.id;

    const c2 = await request(app)
      .post(`/api/categories/${categoryId}/criteria`)
      .set('Cookie', adminCookie)
      .send({ name: 'Beauty', weight: 0.6, min_score: 0, max_score: 10, display_order: 2 });
    expect(c2.status).toBe(201);
    criteriaId2 = c2.body.id;
  });

  it('logs in as judge and submits a single score', async () => {
    const login = await request(app)
      .post('/api/auth/judge')
      .send({ event_id: eventId, seat_number: 1, pin: '1234' });
    expect(login.status).toBe(200);
    judgeToken = login.body.token;

    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({ judge_id: judgeId, contestant_id: contestantId, criteria_id: criteriaId1, category_id: categoryId, score: 9.5 });
    expect(res.status).toBe(201);
    expect(res.body.score).toBe(9.5);
  });

  it('submits batch scores', async () => {
    const res = await request(app)
      .post('/api/scores/batch')
      .set('Authorization', `Bearer ${judgeToken}`)
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
      .set('Authorization', `Bearer ${judgeToken}`)
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
    // Direct mode: Poise: 9.5, Beauty: 8.0, Total = 17.5
    expect(res.body.rankings[0].total_score).toBe(17.5);
    expect(res.body.rankings[0].rank).toBe(1);
  });

  it('rejects score for submitted category (10.1.1)', async () => {
    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({ judge_id: judgeId, contestant_id: contestantId, criteria_id: criteriaId1, category_id: categoryId, score: 7.0 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects score outside min/max range (10.1.2)', async () => {
    const j2 = await request(app)
      .post(`/api/events/${eventId}/judges`)
      .set('Cookie', adminCookie)
      .send({ seat_number: 2, name: 'Judge Two', pin: '5678' });
    const judge2Id = j2.body.id;

    const cat2 = await request(app)
      .post(`/api/events/${eventId}/categories`)
      .set('Cookie', adminCookie)
      .send({ name: 'Talent', display_order: 2 });
    const crit = await request(app)
      .post(`/api/categories/${cat2.body.id}/criteria`)
      .set('Cookie', adminCookie)
      .send({ name: 'Skill', weight: 1.0, min_score: 0, max_score: 10, display_order: 1 });

    // Log in as Judge Two to get a valid token
    const login = await request(app)
      .post('/api/auth/judge')
      .send({ event_id: eventId, seat_number: 2, pin: '5678' });
    expect(login.status).toBe(200);

    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ judge_id: judge2Id, contestant_id: contestantId, criteria_id: crit.body.id, category_id: cat2.body.id, score: 15.0 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects scoring mode change after scores exist', async () => {
    // Attempt to switch to weighted mode — should be rejected because scores exist
    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set('Cookie', adminCookie)
      .send({ scoring_mode: 'weighted' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Scoring mode cannot be changed');
  });

  it('computes weighted mode ranking correctly', async () => {
    // Create a new event in weighted mode
    const ev = await request(app)
      .post('/api/events')
      .set('Cookie', adminCookie)
      .send({ name: 'Weighted Test' });
    const wEventId = ev.body.id;

    // Switch to weighted mode (no scores yet, so it's allowed)
    const modeRes = await request(app)
      .patch(`/api/events/${wEventId}`)
      .set('Cookie', adminCookie)
      .send({ scoring_mode: 'weighted' });
    expect(modeRes.status).toBe(200);
    expect(modeRes.body.scoring_mode).toBe('weighted');

    // Create contestant
    const ct = await request(app)
      .post(`/api/events/${wEventId}/contestants`)
      .set('Cookie', adminCookie)
      .send({ number: 1, name: 'Bob' });
    const wContestantId = ct.body.id;

    // Create judge
    const j = await request(app)
      .post(`/api/events/${wEventId}/judges`)
      .set('Cookie', adminCookie)
      .send({ seat_number: 1, name: 'Weighted Judge', pin: '1111' });
    const wJudgeId = j.body.id;

    // Create category
    const cat = await request(app)
      .post(`/api/events/${wEventId}/categories`)
      .set('Cookie', adminCookie)
      .send({ name: 'Weighted Cat', display_order: 1 });
    const wCategoryId = cat.body.id;

    // Create criteria with weights (standard max_score = 10 in weighted mode)
    const c1 = await request(app)
      .post(`/api/categories/${wCategoryId}/criteria`)
      .set('Cookie', adminCookie)
      .send({ name: 'Criterion A', weight: 0.4, min_score: 0, max_score: 10, display_order: 1 });
    const wC1Id = c1.body.id;

    const c2 = await request(app)
      .post(`/api/categories/${wCategoryId}/criteria`)
      .set('Cookie', adminCookie)
      .send({ name: 'Criterion B', weight: 0.6, min_score: 0, max_score: 10, display_order: 2 });

    // Log in as judge
    const login = await request(app)
      .post('/api/auth/judge')
      .send({ event_id: wEventId, seat_number: 1, pin: '1111' });
    const wToken = login.body.token;

    // Submit scores: Criterion A = 9.5, Criterion B = 8.0
    await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${wToken}`)
      .send({ judge_id: wJudgeId, contestant_id: wContestantId, criteria_id: wC1Id, category_id: wCategoryId, score: 9.5 });

    await request(app)
      .post('/api/scores/batch')
      .set('Authorization', `Bearer ${wToken}`)
      .send({
        scores: [
          { judge_id: wJudgeId, contestant_id: wContestantId, criteria_id: c2.body.id, category_id: wCategoryId, score: 8.0 },
        ],
      });

    // Verify weighted ranking: 9.5 * 0.4 + 8.0 * 0.6 = 3.8 + 4.8 = 8.6
    const report = await request(app)
      .get(`/api/reports/${wEventId}/category/${wCategoryId}`);
    expect(report.status).toBe(200);
    expect(report.body.rankings.length).toBe(1);
    expect(report.body.rankings[0].total_score).toBe(8.6);
    expect(report.body.rankings[0].rank).toBe(1);
  });
});
