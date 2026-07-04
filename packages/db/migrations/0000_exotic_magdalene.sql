CREATE TABLE IF NOT EXISTS "answers" (
	"question_id" integer NOT NULL,
	"narsa_id" integer NOT NULL,
	"index" integer NOT NULL,
	"correct" boolean NOT NULL,
	CONSTRAINT "answers_question_id_narsa_id_pk" PRIMARY KEY("question_id","narsa_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" integer PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"has_image" boolean NOT NULL,
	"has_audio" boolean NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
