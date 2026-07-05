-- Add rework transition: rejected operations can be restarted back to queued
INSERT INTO operation_transition (from_status, event_type, to_status)
VALUES ('REJECTED', 'RESTART', 'QUEUED');
