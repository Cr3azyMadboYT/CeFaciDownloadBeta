-- Cover new foreign keys for account deletion/anonymization and venue administration.
create index partner_proof_access_user on private.partner_proof_access(user_id);
create index partner_request_log_actor on private.partner_request_log(by_user);
create index partner_requests_decision_actor on private.partner_requests(decided_by);
create index partner_requests_verification_actor on private.partner_requests(firm_verified_by);
create index partner_requests_response_actor on private.partner_requests(owner_responded_by);
create index partner_requests_venue on private.partner_requests(venue_id);
