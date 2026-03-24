INSERT INTO players (name, playtime, first_seen, last_seen) VALUES
    ('StreetRacer99', 120, strftime('%s', datetime('now', '-30 days')), strftime('%s', datetime('now', '-1 hour'))),
    ('NightOwlGamer', 450, strftime('%s', datetime('now', '-60 days')), strftime('%s', datetime('now', '-3 hours'))),
    ('ShadowWalker', 85, strftime('%s', datetime('now', '-5 days')), strftime('%s', datetime('now', '-30 minutes'))),
    ('IronFistMike', 920, strftime('%s', datetime('now', '-120 days')), strftime('%s', datetime('now', '-2 days'))),
    ('QuickSilverX', 310, strftime('%s', datetime('now', '-45 days')), strftime('%s', datetime('now', '-5 hours'))),
    ('DarkMatterZ', 15, strftime('%s', datetime('now', '-1 days')), strftime('%s', datetime('now', '-10 minutes'))),
    ('BlazingFury', 670, strftime('%s', datetime('now', '-90 days')), strftime('%s', datetime('now', '-1 day'))),
    ('GhostProtocol', 230, strftime('%s', datetime('now', '-20 days')), strftime('%s', datetime('now', '-4 hours'))),
    ('ThunderStrike', 1200, strftime('%s', datetime('now', '-200 days')), strftime('%s', datetime('now', '-6 hours'))),
    ('NeonViper', 55, strftime('%s', datetime('now', '-3 days')), strftime('%s', datetime('now', '-45 minutes')));

INSERT INTO player_identifiers (player_id, type, value) VALUES
    (2, 'license', 'license:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'),
    (3, 'license', 'license:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3'),
    (4, 'license', 'license:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'),
    (5, 'license', 'license:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'),
    (6, 'license', 'license:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'),
    (7, 'license', 'license:f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'),
    (8, 'license', 'license:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6b2c3'),
    (9, 'license', 'license:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6b2c3d4'),
    (10, 'license', 'license:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6c3d4e5f6'),
    (11, 'license', 'license:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6d4e5f6a1b2');
