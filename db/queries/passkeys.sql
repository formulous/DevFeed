-- F-034 issue challenge (server makes 32 random bytes, stores only SHA-256)
INSERT INTO webauthn_challenges (challenge_hash, purpose, user_id, expires_at)
VALUES (UNHEX(SHA2(@challenge, 256)), 'LOGIN', NULL, UTC_TIMESTAMP(3) + INTERVAL 5 MINUTE);

-- F-034 consume challenge: one-time and unexpired only when affected rows = 1
DELETE FROM webauthn_challenges
WHERE challenge_hash = UNHEX(SHA2(@challenge, 256)) AND purpose = 'LOGIN' AND expires_at > UTC_TIMESTAMP(3);

-- F-034 registration options: fill handle once (kept even if registration is abandoned)
UPDATE users SET webauthn_handle = @handle WHERE id = @uid AND webauthn_handle IS NULL;
SELECT webauthn_handle FROM users WHERE id = @uid;

-- F-034 register: lock user, check limit 10, then insert (same transaction)
START TRANSACTION;
SELECT id FROM users WHERE id = @uid FOR UPDATE;
SELECT COUNT(*) FROM user_passkeys WHERE user_id = @uid;
INSERT INTO user_passkeys (user_id, credential_id, public_key, sign_count, transports, aaguid, backup_eligible, backup_state, name)
VALUES (@uid, @cred, @pk, @count, 'internal,hybrid', NULL, TRUE, TRUE, 'MacBook Chrome');
COMMIT;

-- F-034 login: find by credential id, lock for sign count check
START TRANSACTION;
SELECT id, user_id, public_key, sign_count FROM user_passkeys WHERE credential_id = @cred FOR UPDATE;
UPDATE user_passkeys SET sign_count = @new_count, backup_state = @bs, last_used_at = UTC_TIMESTAMP(3)
WHERE id = @pkid AND (@new_count > sign_count OR (@new_count = 0 AND sign_count = 0));
COMMIT;

-- S-10 list
SELECT id, name, transports, aaguid, backup_state, created_at, last_used_at
FROM user_passkeys WHERE user_id = @uid ORDER BY created_at, id;

-- S-10 rename / delete (own only)
UPDATE user_passkeys SET name = @name WHERE id = @pkid AND user_id = @uid;
DELETE FROM user_passkeys WHERE id = @pkid AND user_id = @uid;

-- cleanup on each issue (no scheduler): small batch of expired rows
DELETE FROM webauthn_challenges WHERE expires_at < UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 100;
