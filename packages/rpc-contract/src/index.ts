export * from './question';
export * from './exam';

import { ExamRpcs } from './exam';
export type ExamRouter = typeof ExamRpcs;
