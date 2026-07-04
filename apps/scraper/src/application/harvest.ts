import { Effect } from 'effect';
import { QuestionRepository } from '@perminou/domain';
import { SourceGateway, type RawQuestion } from '../domain/ports/source-gateway';
import { buildQuestion } from '../domain/build-question';

export interface HarvestSummary {
  readonly totalQuestions: number;
  readonly rounds: number;
}

// Safety cap against a runaway exam that never returns 'done'.
const MAX_QUESTIONS_PER_EXAM = 60;
// Abort if this many exams in a row fail (e.g. the site is down) — don't hammer.
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Loop-until-dry harvest. The bank isn't enumerable (no API, no listing), so we
 * repeatedly take the random Examen Blanc, dedup by question id, and stop after
 * `dryRounds` consecutive exams that add nothing new. Correctness is joined by
 * the correction's 1-based index (see build-question / ADR 0002). A transient
 * network failure (`FetchError`) abandons that one exam and retries next round.
 */
export const harvest = (opts: { dryRounds: number }) =>
  Effect.gen(function* () {
    const gw = yield* SourceGateway;
    const repo = yield* QuestionRepository;
    const session = yield* gw.login();

    const seen = new Set<string>();
    let rounds = 0;
    let dry = 0;
    let failures = 0;

    while (dry < opts.dryRounds && failures < MAX_CONSECUTIVE_FAILURES) {
      rounds++;

      // One exam: collect its questions, then persist the newly-seen ones.
      // Returns the count of new questions, or -1 if the exam aborted (FetchError).
      const oneExam = Effect.gen(function* () {
        const collected: RawQuestion[] = [];
        let state: 'more' | 'done' = 'more';
        for (let i = 0; i < MAX_QUESTIONS_PER_EXAM && state === 'more'; i++) {
          const q = yield* gw.nextExamQuestion(session);
          collected.push(q);
          const first = q.answers[0]?.narsaId;
          state = yield* gw.submitAndAdvance(session, first !== undefined ? [first] : []);
        }
        const correction = yield* gw.fetchCorrection(session);

        let newCount = 0;
        for (const raw of collected) {
          if (seen.has(raw.id)) continue;
          const correctIndexes = correction.correctByQuestion[raw.id] ?? [];
          const built = yield* buildQuestion(raw, correctIndexes).pipe(
            Effect.catchAll((e) =>
              Effect.logWarning(`skip question ${raw.id}: ${e.reason}`).pipe(Effect.as(null)),
            ),
          );
          if (built === null) continue;
          yield* repo.upsertQuestion(built);
          seen.add(raw.id);
          newCount++;
        }
        return newCount;
      });

      const newCount = yield* oneExam.pipe(
        Effect.catchTag('FetchError', (e) =>
          Effect.logWarning(`round ${rounds}: exam aborted (${e.url}) — retrying next round`).pipe(Effect.as(-1)),
        ),
      );

      if (newCount < 0) {
        failures++;
        continue;
      }
      failures = 0;
      yield* Effect.log(`round ${rounds}: +${newCount} new, ${seen.size} total`);
      dry = newCount === 0 ? dry + 1 : 0;
    }

    return { totalQuestions: seen.size, rounds } satisfies HarvestSummary;
  });
