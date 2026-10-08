-- Run only on CeFaci2.0 to pause V2 mutations while investigating. Read/history and existing evidence remain.
update private.v2_release set writes_on=false where id;
-- Recovery after checks: update private.v2_release set writes_on=true where id;
-- Do NOT drop tables, delete visits, reset the DB or re-enable withdrawn V1 writes.
