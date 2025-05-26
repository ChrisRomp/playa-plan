-- SQL script to CASCADE DELETE a user's registration and all related records
-- You only need to change the target email address in one place

DO $$
DECLARE
    email_to_delete TEXT := 'user@example.playaplan.app'; -- <<<< CHANGE THIS TO TARGET EMAIL
    user_id TEXT;
    registration_id TEXT;
    registration_count INT;
BEGIN
    -- Find the user ID from the email
    SELECT id INTO user_id 
    FROM users 
    WHERE email = email_to_delete;

    -- Check if user exists
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', email_to_delete;
    END IF;

    -- Find all registrations for this user
    WITH registrations_found AS (
        SELECT id FROM registrations WHERE "userId" = user_id
    )
    SELECT COUNT(*) INTO registration_count FROM registrations_found;
    
    -- Get the registration ID if it exists
    SELECT id INTO registration_id 
    FROM registrations 
    WHERE "userId" = user_id;

    IF registration_count = 0 THEN
        RAISE NOTICE 'No registrations found for user with email %', email_to_delete;
        RETURN;
    END IF;

    -- Output what we're deleting
    RAISE NOTICE 'Starting cascade deletion for user % (email: %)', user_id, email_to_delete;
    RAISE NOTICE 'Registration ID to delete: %', registration_id;

    -- This section performs the actual deletion in correct dependency order

    -- 1. Delete registration jobs (depends on registration)
    WITH deleted AS (
        DELETE FROM registration_jobs 
        WHERE "registrationId" = registration_id
        RETURNING *
    )
    SELECT COUNT(*) INTO registration_count FROM deleted;
    RAISE NOTICE '  Deleted % registration job records', registration_count;
    
    -- 2. Delete camping option field values (depends on registration)
    WITH deleted AS (
        DELETE FROM camping_option_field_values 
        WHERE "registrationId" = registration_id
        RETURNING *
    )
    SELECT COUNT(*) INTO registration_count FROM deleted;
    RAISE NOTICE '  Deleted % camping option field value records', registration_count;
    
    -- 3. Delete payments (depends on registration)
    WITH deleted AS (
        DELETE FROM payments 
        WHERE "registrationId" = registration_id
        RETURNING *
    )
    SELECT COUNT(*) INTO registration_count FROM deleted;
    RAISE NOTICE '  Deleted % payment records', registration_count;
    
    -- 4. Delete camping option registrations (depends on user ID)
    WITH deleted AS (
        DELETE FROM camping_option_registrations 
        WHERE "userId" = user_id
        RETURNING *
    )
    SELECT COUNT(*) INTO registration_count FROM deleted;
    RAISE NOTICE '  Deleted % camping option registration records', registration_count;
    
    -- 5. Finally delete the registration itself
    DELETE FROM registrations 
    WHERE id = registration_id;
    RAISE NOTICE '  Deleted the registration record';
    
    -- Transaction complete
    RAISE NOTICE 'Successfully completed cascade deletion for %', email_to_delete;
END$$;
