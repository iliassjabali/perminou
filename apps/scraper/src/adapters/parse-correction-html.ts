// PURE: input is a captured end-of-exam correction HTML page; output is the
// correct answer *index* set per NARSA question id. No I/O; failure is typed.
//
// DISCOVERED MARKUP (2026-07-04 capture, apps/scraper/fixtures/exam-correction.html):
// the correction renders one `div#questionModal_<slot>` per exam question
// (slot = 1..40, the position within *this* exam run — not the NARSA id).
// Each block contains:
//   - `img#modalQuestionImage_<slot>` whose `src` embeds the NARSA question id
//     (same `/media/uploads/questions/images/<lang>/<id>.png` pattern as the
//     question page).
//   - zero or more `div.modal-answer > div.fw-bold1` nodes, one per CORRECT
//     answer, reading "<index>:  C'est la bonne réponse" — `index` is the
//     1-based position of the answer as it was presented on the question
//     page (matches `RawQuestion.answers[].index`).
//
// IMPORTANT: the correction reveals the correct answer's *index*, never its
// `narsaId` (the answer checkbox's own DB id) — that value never appears
// anywhere in the correction markup. Consumers (buildQuestion / harvest) must
// join `correctByQuestion[id]` against `RawQuestion.answers[].index`, not
// `.narsaId`.
import { Effect } from 'effect';
import * as cheerio from 'cheerio';
import { ScrapeShapeError } from '../domain/errors';
import type { RawCorrection } from '../domain/ports/source-gateway';

const MODAL_SELECTOR = 'div[id^="questionModal_"]';
const IMAGE_SELECTOR = 'img[id^="modalQuestionImage_"]';
// Question images are served as .png, .gif, or .jpg/.jpeg.
const QUESTION_ID = /\/media\/uploads\/questions\/images\/[a-z]+\/([A-Za-z0-9]+)\.(?:png|gif|jpe?g)/;
const CORRECT_INDEX = /^(\d+)\s*:/;

export const parseCorrectionHtml = (html: string, url = 'exam-correction') =>
  Effect.gen(function* () {
    const $ = cheerio.load(html);
    const modals = $(MODAL_SELECTOR).toArray();
    if (!modals.length) {
      return yield* Effect.fail(
        new ScrapeShapeError({ url, reason: 'no questionModal blocks found', htmlSnippet: html.slice(0, 400) }),
      );
    }

    const correctByQuestion: Record<string, number[]> = {};
    for (const modal of modals) {
      const imgSrc = $(modal).find(IMAGE_SELECTOR).attr('src');
      const idMatch = imgSrc?.match(QUESTION_ID);
      if (!idMatch) continue; // malformed slot — skip rather than fail the whole batch
      // A handful of ids are alphanumeric (e.g. "IS014", "ISR003") — a
      // special-signage sub-bank. QuestionId is a non-empty string, so these
      // join back to RawQuestion.id like any other id; keep them.
      const id = idMatch[1]!;

      const indices = $(modal)
        .find('.modal-answer .fw-bold1')
        .toArray()
        .map((el) => $(el).text().trim().match(CORRECT_INDEX)?.[1])
        .filter((n): n is string => n !== undefined)
        .map(Number);
      correctByQuestion[id] = indices;
    }

    const correction: RawCorrection = { correctByQuestion };
    return correction;
  });
