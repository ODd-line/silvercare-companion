-- New personal member accounts receive one hour atomically with account creation.
-- Existing ledger entries and balances are preserved; this migration does not backfill.
DROP TRIGGER IF EXISTS verified_starter;
--> statement-breakpoint
DROP TRIGGER IF EXISTS verified_onboarding_only;
--> statement-breakpoint
CREATE TRIGGER signup_onboarding_guard BEFORE INSERT ON ledger WHEN NEW.type='onboarding'
BEGIN
 SELECT RAISE(ABORT,'invalid_signup_credit') WHERE NEW.amount<>3600 OR NEW.source_id IS NOT NULL OR NEW.destination_id IS NULL OR NEW.task_id IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.destination_id AND account_type='individual' AND role='member');
END;
--> statement-breakpoint
CREATE TRIGGER signup_starter AFTER INSERT ON users
WHEN NEW.account_type='individual' AND NEW.role='member'
BEGIN
 INSERT INTO ledger(id,destination_id,amount,type,metadata)
 VALUES(lower(hex(randomblob(16))),NEW.id,3600,'onboarding','One-time one-hour welcome credit at sign-up');
END;
--> statement-breakpoint
UPDATE settings SET value='3600' WHERE id='onboarding_seconds';
