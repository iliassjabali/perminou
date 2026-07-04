// Perminou — Plan 4, Task 4: the app's navigation shape.
//
// A single native-stack with no params — every screen reads its own data (via `useDeck`/the
// review store), so there's nothing to pass through route params. Shared so `App.tsx` (the
// `Stack.Navigator`) and each screen (typed `navigation`/`route` props) agree on the route names.
export type RootStackParamList = {
  Home: undefined;
  Practice: undefined;
  Exam: undefined;
  Review: undefined;
};
