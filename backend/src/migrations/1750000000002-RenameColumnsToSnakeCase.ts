import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameColumnsToSnakeCase1750000000002 implements MigrationInterface {
  name = 'RenameColumnsToSnakeCase1750000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    // users
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at"`);

    // knowledge_bases
    await queryRunner.query(`ALTER TABLE "knowledge_bases" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "knowledge_bases" RENAME COLUMN "createdAt" TO "created_at"`);

    // conversations
    await queryRunner.query(`ALTER TABLE "conversations" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "conversations" RENAME COLUMN "createdAt" TO "created_at"`);
    await queryRunner.query(`ALTER TABLE "conversations" RENAME COLUMN "updatedAt" TO "updated_at"`);

    // messages
    await queryRunner.query(`ALTER TABLE "messages" RENAME COLUMN "conversationId" TO "conversation_id"`);
    await queryRunner.query(`ALTER TABLE "messages" RENAME COLUMN "createdAt" TO "created_at"`);

    // folders
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "knowledgeBaseId" TO "knowledge_base_id"`);
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "parentId" TO "parent_id"`);
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "createdAt" TO "created_at"`);

    // files
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "knowledgeBaseId" TO "knowledge_base_id"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "originalName" TO "original_name"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "mimeType" TO "mime_type"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "s3Key" TO "s3_key"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "folderId" TO "folder_id"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "createdAt" TO "created_at"`);

    // tags
    await queryRunner.query(`ALTER TABLE "tags" RENAME COLUMN "userId" TO "user_id"`);
    await queryRunner.query(`ALTER TABLE "tags" RENAME COLUMN "knowledgeBaseId" TO "knowledge_base_id"`);
    await queryRunner.query(`ALTER TABLE "tags" RENAME COLUMN "createdAt" TO "created_at"`);

    // file_tags
    await queryRunner.query(`ALTER TABLE "file_tags" RENAME COLUMN "fileId" TO "file_id"`);
    await queryRunner.query(`ALTER TABLE "file_tags" RENAME COLUMN "tagId" TO "tag_id"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // file_tags
    await queryRunner.query(`ALTER TABLE "file_tags" RENAME COLUMN "tag_id" TO "tagId"`);
    await queryRunner.query(`ALTER TABLE "file_tags" RENAME COLUMN "file_id" TO "fileId"`);

    // tags
    await queryRunner.query(`ALTER TABLE "tags" RENAME COLUMN "knowledge_base_id" TO "knowledgeBaseId"`);
    await queryRunner.query(`ALTER TABLE "tags" RENAME COLUMN "user_id" TO "userId"`);
    await queryRunner.query(`ALTER TABLE "tags" RENAME COLUMN "created_at" TO "createdAt"`);

    // files
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "folder_id" TO "folderId"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "s3_key" TO "s3Key"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "mime_type" TO "mimeType"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "original_name" TO "originalName"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "knowledge_base_id" TO "knowledgeBaseId"`);
    await queryRunner.query(`ALTER TABLE "files" RENAME COLUMN "user_id" TO "userId"`);

    // folders
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "parent_id" TO "parentId"`);
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "knowledge_base_id" TO "knowledgeBaseId"`);
    await queryRunner.query(`ALTER TABLE "folders" RENAME COLUMN "user_id" TO "userId"`);

    // messages
    await queryRunner.query(`ALTER TABLE "messages" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "messages" RENAME COLUMN "conversation_id" TO "conversationId"`);

    // conversations
    await queryRunner.query(`ALTER TABLE "conversations" RENAME COLUMN "updated_at" TO "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "conversations" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "conversations" RENAME COLUMN "user_id" TO "userId"`);

    // knowledge_bases
    await queryRunner.query(`ALTER TABLE "knowledge_bases" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "knowledge_bases" RENAME COLUMN "user_id" TO "userId"`);

    // users
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "updated_at" TO "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "created_at" TO "createdAt"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "password_hash" TO "passwordHash"`);
  }
}
