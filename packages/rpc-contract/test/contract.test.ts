import { test, expect } from 'vitest';
import { Schema } from 'effect';
import { ExamRpcs, QuestionWire } from '../src';

const sampleQuestion = {
  id: '565', category: 'B', hasImage: true, hasAudio: false,
  answers: [
    { narsaId: 933, index: 1, correct: true },
    { narsaId: 934, index: 2, correct: false },
  ],
};

test('QuestionWire decodes a sample question mirroring the domain shape', () => {
  const decoded = Schema.decodeUnknownSync(QuestionWire)(sampleQuestion);
  expect(decoded).toEqual(sampleQuestion);
});

test('ExamRpcs exposes GetExam and GetAllQuestions', () => {
  const tags = [...ExamRpcs.requests.keys()];
  expect(tags).toContain('GetExam');
  expect(tags).toContain('GetAllQuestions');
  expect(tags).toHaveLength(2);
});

test('GetExam payload decodes { count }', () => {
  const getExam = ExamRpcs.requests.get('GetExam');
  const payloadSchema = (getExam as { payloadSchema: Schema.Schema<unknown, unknown, never> }).payloadSchema;
  const payload = Schema.decodeUnknownSync(payloadSchema)({ count: 20 });
  expect(payload).toEqual({ count: 20 });
});

test('GetAllQuestions payload decodes {}', () => {
  const getAllQuestions = ExamRpcs.requests.get('GetAllQuestions');
  const payloadSchema = (getAllQuestions as { payloadSchema: Schema.Schema<unknown, unknown, never> }).payloadSchema;
  const payload = Schema.decodeUnknownSync(payloadSchema)({});
  expect(payload).toEqual({});
});
