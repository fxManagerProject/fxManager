/* Important: Only insert on a clean database, otherwise IDs might conflict */

INSERT INTO players (id, name, playtime, first_seen, last_seen) VALUES
    (1, 'admin', 7200000, strftime('%s', datetime('now', '-30 days')), strftime('%s', datetime('now', '-1 hour'))),
    (2, 'StreetRacer99', 7200000, strftime('%s', datetime('now', '-30 days')), strftime('%s', datetime('now', '-1 hour'))),
    (3, 'NightOwlGamer', 27000000, strftime('%s', datetime('now', '-60 days')), strftime('%s', datetime('now', '-3 hours'))),
    (4, 'ShadowWalker', 5100000, strftime('%s', datetime('now', '-5 days')), strftime('%s', datetime('now', '-30 minutes'))),
    (5, 'IronFistMike', 55200000, strftime('%s', datetime('now', '-120 days')), strftime('%s', datetime('now', '-2 days'))),
    (6, 'QuickSilverX', 18600000, strftime('%s', datetime('now', '-45 days')), strftime('%s', datetime('now', '-5 hours'))),
    (7, 'DarkMatterZ', 900000, strftime('%s', datetime('now', '-1 days')), strftime('%s', datetime('now', '-10 minutes'))),
    (8, 'BlazingFury', 40200000, strftime('%s', datetime('now', '-90 days')), strftime('%s', datetime('now', '-1 day'))),
    (9, 'GhostProtocol', 13800000, strftime('%s', datetime('now', '-20 days')), strftime('%s', datetime('now', '-4 hours'))),
    (10, 'ThunderStrike', 72000000, strftime('%s', datetime('now', '-200 days')), strftime('%s', datetime('now', '-6 hours'))),
    (11, 'NeonViper', 3300000, strftime('%s', datetime('now', '-3 days')), strftime('%s', datetime('now', '-45 minutes')));

INSERT INTO player_identifiers (player_id, type, value) VALUES
    (1, 'license', 'license:mockd4e5f6a1c3d4e5f6b2c3d4b2c3d4e5f6a1b2'),
    (2, 'license', 'license:mockc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'),
    (3, 'license', 'license:mockd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3'),
    (4, 'license', 'license:mocke5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'),
    (5, 'license', 'license:mockf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'),
    (6, 'license', 'license:mocka1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'),
    (7, 'license', 'license:mockb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'),
    (8, 'license', 'license:mockc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6b2c3'),
    (9, 'license', 'license:mockd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6b2c3d4'),
    (10, 'license', 'license:mocke5f6a1b2c3d4e5f6a1b2c3d4e5f6c3d4e5f6'),
    (11, 'license', 'license:mockf6a1b2c3d4e5f6a1b2c3d4e5f6d4e5f6a1b2');

INSERT INTO admin_users (id, username, password_hash, player_id, permissions, created_at, last_login_at) VALUES
    /* password is "password" */
    (1, 'admin', '$2b$10$oirDDGH10Qiun.MpWRkYNu7QmKfXnGqm5ECS0ohfNrhUfde4fngsG', 1, 1073741824, 1773054660, null);

INSERT INTO bans (id, player_id, reason, issuer, expires_at, created_at, revoked_at) VALUES
    (1, 7, 'This is an example Perma-Ban', 1, NULL, 1777113143, NULL),
    (2, 10, 'Why ban ? Because I need mock data and he already got 3 mock warnings.', 1, 1777113941, 1777113913, NULL),
    (3, 10, 'I like bans and bans like this mock account. Slam him with a 2 week !', 1, 1778323541, 1777113941, NULL),
    (4, 1, 'This is going to be an accidental ban :D', 1, NULL, 1777113985, 1777114033),
    (6, 6, 'He shall be selected, why because randomness and also he''s clean without any punishments. Maybe also because I didn''t want mock data to have similar sections.', 1, 1777362503, 1777114103, NULL);

INSERT INTO kicks (id, player_id, reason, revoked, issuer, issued_at) VALUES
    (1, 5, 'An example kick', 0, 1, 1777113194),
    (2, 11, 'Attempted to evade mock data', 1, 1, 1777113223);

INSERT INTO warns (id, player_id, reason, "read", revoked, issuer, issued_at) VALUES
    (1, 7, 'Warning him because I need test data.', 0, 0, 1, 1777113127),
    (2, 10, 'This is one example warn', 0, 0, 1, 1777113843),
    (3, 10, 'And another warn, because why not', 0, 0, 1, 1777113855),
    (4, 10, 'And a third warning, because 3 is a nice number. What''s next ? Well a ban of course', 0, 0, 1, 1777113874);

INSERT INTO player_notes (id, player_id, content, issuer, issued_at) VALUES
    (1, 4, 'Seems like a nice chap.', 1, 1777113158);

INSERT INTO event_logs (id, event, timestamp, player_id, player_name, data) VALUES
    (1,  'player_joined',    1787430420, 3, 'NightOwlGamer',  '{"identifiers":{"license":"license:mockd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"}}'),
    (2,  'player_joined',    1787434020, 4, 'ShadowWalker',   '{"identifiers":{"license":"license:mocke5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"}}'),
    (3,  'player_joined',    1787434320, 7, 'DarkMatterZ',    '{"identifiers":{"license":"license:mockb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1"}}'),
    (4,  'player_joined',    1787434920, 9, 'GhostProtocol',  '{"identifiers":{"license":"license:mockd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6b2c3d4"}}'),
    (5,  'player_left',      1787435220, 9, 'GhostProtocol',  '{"reason":"Disconnected"}'),
    (6,  'player_joined',    1787435520, 11,'NeonViper',       '{"identifiers":{"license":"license:mockf6a1b2c3d4e5f6a1b2c3d4e5f6d4e5f6a1b2"}}'),
    (7,  'player_joined',    1787435820, 2, 'StreetRacer99',   '{"identifiers":{"license":"license:mockc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"}}'),
    (8,  'player_death',     1787432220, 3, 'NightOwlGamer',  '{"killer":"ShadowWalker","weapon":"WEAPON_PISTOL","cause":453432689}'),
    (9,  'player_respawned', 1787432280, 3, 'NightOwlGamer',  '{"coords":{"x":215.3,"y":-812.1,"z":30.5}}'),
    (10, 'player_death',     1787433120, 4, 'ShadowWalker',   '{"killer":"NightOwlGamer","weapon":"WEAPON_ASSAULTRIFLE","cause":322957350}'),
    (11, 'player_respawned', 1787433180, 4, 'ShadowWalker',   '{"coords":{"x":-542.7,"y":-215.3,"z":37.6}}'),
    (12, 'player_death',     1787434020, 7, 'DarkMatterZ',    '{"killer":"Unknown","weapon":"WEAPON_EXPLOSION","cause":539292904}'),
    (13, 'player_respawned', 1787434080, 7, 'DarkMatterZ',    '{"coords":{"x":120.5,"y":-1800.2,"z":30.1}}'),
    (14, 'player_death',     1787436420, 2, 'StreetRacer99',  '{"killer":"NeonViper","weapon":"WEAPON_SMG","cause":736523874}'),
    (15, 'player_entered_vehicle', 1787432820, 3, 'NightOwlGamer', '{"vehicle":"adder","plate":"MOCK 01","seat":-1}'),
    (16, 'player_entered_vehicle', 1787432880, 4, 'ShadowWalker',  '{"vehicle":"adder","plate":"MOCK 01","seat":0}'),
    (17, 'player_exited_vehicle',  1787433420, 4, 'ShadowWalker',  '{"vehicle":"adder","plate":"MOCK 01"}'),
    (18, 'player_entered_vehicle', 1787434620, 7, 'DarkMatterZ',   '{"vehicle":"zentorno","plate":"FAST 42","seat":-1}'),
    (19, 'player_exited_vehicle',  1787434740, 7, 'DarkMatterZ',   '{"vehicle":"zentorno","plate":"FAST 42"}'),
    (20, 'player_entered_vehicle', 1787436120, 2, 'StreetRacer99', '{"vehicle":"banshee","plate":"DRIFT 88","seat":-1}'),
    (21, 'player_teleported', 1787433720, 3, 'NightOwlGamer', '{"from":{"x":215.3,"y":-812.1,"z":30.5},"to":{"x":120.0,"y":-1800.0,"z":30.0},"reason":"waypoint"}'),
    (22, 'player_teleported', 1787435220, 11,'NeonViper',     '{"from":{"x":-265.0,"y":-950.5,"z":31.0},"to":{"x":255.0,"y":-1200.0,"z":30.0},"reason":"admin","adminName":"admin"}'),
    (23, 'player_teleported', 1787437020, 2, 'StreetRacer99', '{"from":{"x":-120.0,"y":1250.0,"z":310.0},"to":{"x":-720.0,"y":-1550.0,"z":15.0},"reason":"marker"}'),
    (24, 'chat_message', 1787432520, 3, 'NightOwlGamer', '{"message":"Anyone up for a race?","channel":"global"}'),
    (25, 'chat_message', 1787432580, 4, 'ShadowWalker',  '{"message":"I''m in, meet at the airport","channel":"global"}'),
    (26, 'chat_message', 1787432640, 7, 'DarkMatterZ',   '{"message":"Can I join?","channel":"global"}'),
    (27, 'chat_message', 1787432700, 3, 'NightOwlGamer', '{"message":"Sure, the more the better!","channel":"global"}'),
    (28, 'chat_message', 1787436720, 11,'NeonViper',     '{"message":"selling adder hmu /call 555-0199","channel":"global"}'),
    (29, 'chat_message', 1787436900, 2, 'StreetRacer99', '{"message":"nice try Neon lol","channel":"global"}'),
    (30, 'player_shot',    1787436300, 11,'NeonViper',     '{"weapon":"WEAPON_SMG","targetId":2,"targetName":"StreetRacer99"}'),
    (31, 'player_damaged', 1787436300, 2, 'StreetRacer99', '{"attacker":"NeonViper","weapon":"WEAPON_SMG","damage":22,"bone":"right_leg"}'),
    (32, 'player_shot',    1787436360, 11,'NeonViper',     '{"weapon":"WEAPON_SMG","targetId":2,"targetName":"StreetRacer99"}'),
    (33, 'player_damaged', 1787436360, 2, 'StreetRacer99', '{"attacker":"NeonViper","weapon":"WEAPON_SMG","damage":34,"bone":"spine"}'),
    (34, 'resource_started', 1787426820, NULL, NULL, '{"resource":"es_extended","version":"1.10.0"}'),
    (35, 'resource_started', 1787426820, NULL, NULL, '{"resource":"ox_inventory","version":"2.40.0"}'),
    (36, 'resource_started', 1787426820, NULL, NULL, '{"resource":"ox_target","version":"1.15.0"}'),
    (37, 'resource_stopped', 1787432220, NULL, NULL, '{"resource":"old_garage_system","reason":"replaced_by_rx_garage"}'),
    (38, 'weather_changed', 1787430420, NULL, NULL, '{"from":"EXTRASUNNY","to":"CLEAR"}'),
    (39, 'weather_changed', 1787435820, NULL, NULL, '{"from":"CLEAR","to":"THUNDER"}'),
    (40, 'time_changed',    1787434020, NULL, NULL, '{"from":{"hour":0,"minute":0},"to":{"hour":12,"minute":0}}'),
    (41, 'admin_kick',      1787435220, 5, 'IronFistMike',   '{"adminId":1,"adminName":"admin","reason":"AFK farming"}'),
    (42, 'admin_warn',      1787437320, 11,'NeonViper',      '{"adminId":1,"adminName":"admin","reason":"Spamming chat"}'),
    (43, 'whitelist_added', 1787437380, 6, 'QuickSilverX',   '{"adminId":1,"adminName":"admin","type":"license"}'),
    (44, 'player_transaction', 1787433420, 4, 'ShadowWalker',  '{"type":"deposit","amount":5000,"balance":25000,"source":"job_payout"}'),
    (45, 'player_transaction', 1787434620, 7, 'DarkMatterZ',   '{"type":"withdraw","amount":2000,"balance":8000,"source":"vehicle_purchase"}'),
    (46, 'player_transaction', 1787436120, 11,'NeonViper',     '{"type":"deposit","amount":15000,"balance":35000,"source":"car_sale"}'),
    (47, 'player_started_job',  1787431920, 3, 'NightOwlGamer', '{"job":"trucker","route":"LS_DOCKS_TO_PALETO"}'),
    (48, 'player_finished_job', 1787432520, 3, 'NightOwlGamer', '{"job":"trucker","payout":3500,"bonus":500,"timeSec":600}'),
    (49, 'player_started_job',  1787434020, 4, 'ShadowWalker',  '{"job":"taxi","passengers":3}'),
    (50, 'player_finished_job', 1787434620, 4, 'ShadowWalker',  '{"job":"taxi","payout":1200,"bonus":200,"timeSec":480}');
