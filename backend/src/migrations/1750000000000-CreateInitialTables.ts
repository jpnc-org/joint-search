import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialTables1750000000000 implements MigrationInterface {
  name = 'CreateInitialTables1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password_hash" varchar(255) NOT NULL,
        "name" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "knowledge_bases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_bases_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" varchar(500) NOT NULL DEFAULT 'New Conversation',
        "capabilities" jsonb NOT NULL DEFAULT '{"code_interpreter":false,"rlm":false,"rag":false,"web_search":false}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_conversations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL,
        "content" text NOT NULL,
        "reasoning" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "folders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "knowledge_base_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "parent_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_folders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_folders_knowledge_base" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_folders_parent" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "knowledge_base_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "original_name" varchar(255) NOT NULL,
        "mime_type" varchar(255) NOT NULL,
        "size" integer NOT NULL,
        "s3_key" varchar(1024) NOT NULL,
        "folder_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "rag_status" varchar(20) NOT NULL DEFAULT 'pending',
        CONSTRAINT "FK_files_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_files_knowledge_base" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_files_folder" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "knowledge_base_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "color" varchar(7) NOT NULL DEFAULT '#6366f1',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_tags_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tags_knowledge_base" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "file_tags" (
        "file_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        CONSTRAINT "PK_file_tags" PRIMARY KEY ("file_id", "tag_id"),
        CONSTRAINT "FK_file_tags_file" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_file_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "file_tags"`);
    await queryRunner.query(`DROP TABLE "tags"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP TABLE "folders"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TABLE "knowledge_bases"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
