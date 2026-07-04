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

/**
 * Loop-until-dry harvest. The bank isn't enumerable (no API, no listing), so we
 * repeatedly take the random Examen Blanc, dedup by question id, and stop after
 * `dryRounds` consecutive exams that add nothing new. Correctness is joined by
 * the correction's 1-based index (see build-question / ADR 0002).
 */
export const harvest = (opts: { dryRounds: number }) =>
  Effect.gen(function* () {
    const gw = yield* SourceGateway;
    const repo = yield* QuestionRepository;
    const session = yield* gw.login();

    const seen = new Set<string>();
    let rounds = 0;
    let dry = 0;

    while (dry < opts.dryRounds) {
      rounds++;

      // --- run one exam, collecting its questions ---
      const collected: RawQuestion[] = [];
      let state: 'more' | 'done' = 'more';
      for (let i = 0; i < MAX_QUESTIONS_PER_EXAM && state === 'more'; i++) {
        const q = yield* gw.nextExamQuestion(session);
        collected.push(q);
        const first = q.answers[0]?.narsaId;
        state = yield* gw.submitAndAdvance(session, first !== undefined ? [first] : []);
      }
      const correction = yield* gw.fetchCorrection(session);

      // --- persist newly-seen questions; a single build failure never aborts ---
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

      yield* Effect.log(`round ${rounds}: +${newCount} new, ${seen.size} total`);
      dry = newCount === 0 ? dry + 1 : 0;
    }

    return { totalQuestions: seen.size, rounds } satisfies HarvestSummary;
  });
