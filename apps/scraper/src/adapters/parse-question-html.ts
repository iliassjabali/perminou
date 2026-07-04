// PURE: input is a captured exam-question HTML page; output is the question
// WITHOUT correctness (the correct answer set comes from the correction step
// — see parse-correction-html.ts). No I/O; failure is typed.
import { Effect } from 'effect';
import * as cheerio from 'cheerio';
import { ScrapeShapeError } from '../domain/errors';
import type { RawQuestion } from '../domain/ports/source-gateway';

const IMAGE_SELECTOR = 'img[src*="/media/uploads/questions/images/"]';
const AUDIO_SELECTOR =
  'source[src*="/media/uploads/questions/son/"], audio[src*="/media/uploads/questions/son/"]';
// Question images are served as .png, .gif, or .jpg/.jpeg.
const IMAGE_ID = /\/media\/uploads\/questions\/images\/[a-z]+\/([A-Za-z0-9]+)\.(?:png|gif|jpe?g)/;
const AUDIO_ID = /\/media\/uploads\/questions\/son\/[a-z]+\/([A-Za-z0-9]+)\.mp3/;

export const parseQuestionHtml = (html: string, url = 'exam-question') =>
  Effect.gen(function* () {
    const $ = cheerio.load(html);

    const imgSrc = $(IMAGE_SELECTOR).attr('src');
    const audioSrc = $(AUDIO_SELECTOR).attr('src');
    const idMatch = imgSrc?.match(IMAGE_ID) ?? audioSrc?.match(AUDIO_ID);
    if (!idMatch) {
      return yield* Effect.fail(
        new ScrapeShapeError({ url, reason: 'no question id in media urls', htmlSnippet: html.slice(0, 400) }),
      );
    }

    // A handful of NARSA questions use an alphanumeric id (e.g. "IS014",
    // "ISR003") for a special-signage sub-bank. QuestionId is a non-empty
    // string, so both numeric and alphanumeric ids are kept as-is.
    const id = idMatch[1]!;

    // The "Catégorie" label and its value sit in sibling rows, not a shared
    // cell: <div class="categorie-row">Catégorie</div><div class="categorie-row"><span class="font-text">B</span></div>
    const category = $('.categorie-content span.font-text').first().text().trim();
    if (!category) {
      return yield* Effect.fail(
        new ScrapeShapeError({ url, reason: 'no category text found', htmlSnippet: html.slice(0, 400) }),
      );
    }

    const answers = $('input[name="answers"]')
      .toArray()
      .map((el, i) => ({ narsaId: Number($(el).attr('value')), index: i + 1 }));
    if (!answers.length || answers.some((a) => !Number.isFinite(a.narsaId))) {
      return yield* Effect.fail(
        new ScrapeShapeError({ url, reason: 'no valid answer checkboxes found', htmlSnippet: html.slice(0, 400) }),
      );
    }

    const question: RawQuestion = {
      id,
      category,
      hasImage: Boolean(imgSrc),
      hasAudio: Boolean(audioSrc),
      answers,
    };
    return question;
  });
