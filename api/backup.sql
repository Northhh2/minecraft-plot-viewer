PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE zoning_types (
    id                   INTEGER PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    price_per_100_blocks INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(1,'Rolna',9);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(2,'Mieszkalno-usługowa',12);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(3,'Mieszkalna',8);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(4,'Publiczna',1);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(5,'Medyczna',1);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(6,'Parkowa',8);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(7,'Przemysłowo-biurowa',10);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(8,'Sakralna',0);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(9,'Hotelowa',15);
INSERT INTO "zoning_types" ("id","name","price_per_100_blocks") VALUES(10,'Usługowa',13);
CREATE TABLE districts (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
INSERT INTO "districts" ("id","name") VALUES(1,'Dzielnica #2');
INSERT INTO "districts" ("id","name") VALUES(2,'Dzielnica #3');
INSERT INTO "districts" ("id","name") VALUES(3,'Dzielnica #4');
INSERT INTO "districts" ("id","name") VALUES(4,'Stare Miasto');
INSERT INTO "districts" ("id","name") VALUES(5,'Magenta Town');
INSERT INTO "districts" ("id","name") VALUES(6,'Dzielnica #5');
INSERT INTO "districts" ("id","name") VALUES(7,'Dzielnica #6');
INSERT INTO "districts" ("id","name") VALUES(8,'Dzielnica Przemysłowa');
INSERT INTO "districts" ("id","name") VALUES(9,'Dzielnica #1');
INSERT INTO "districts" ("id","name") VALUES(10,'Dzielnica #7');
CREATE TABLE sectors (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    x1 INTEGER NOT NULL, z1 INTEGER NOT NULL, x2 INTEGER NOT NULL, z2 INTEGER NOT NULL
);
CREATE TABLE streets (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    x1 INTEGER NOT NULL, z1 INTEGER NOT NULL, x2 INTEGER NOT NULL, z2 INTEGER NOT NULL
);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(1,'Dworcowa',243,-68,245,127);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(2,'Zamkowa',246,82,400,84);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(3,'Krótka',214,7,242,9);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(4,'Ulica #3',214,-44,242,-42);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(5,'Ratuszowa',88,29,227,33);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(6,'Rynek',159,14,201,48);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(7,'Ulica #1',166,2,168,13);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(8,'Ulica #2',150,0,211,1);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(9,'Szpitalna',212,-78,213,9);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(10,'Ulica #4',228,-27,229,44);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(11,'Ulica #5',230,-27,242,-25);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(12,'Ulica #6',246,-68,260,-66);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(13,'Ulica #7',164,-19,211,-18);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(14,'Ulica #8',192,2,194,13);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(15,'Ulica #9',192,49,194,58);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(16,'Ulica #10',166,49,168,58);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(17,'Ulica #11',149,59,213,60);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(18,'Ulica #12',177,61,179,127);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(19,'Ulica #13',-13,128,258,130);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(20,'Ulica #14',212,69,214,164);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(21,'Ulica #15',195,163,211,164);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(22,'Ulica #16',195,165,196,201);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(23,'Ulica #17',180,69,211,71);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(24,'Ulica #18',261,-99,263,-66);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(25,'Ulica #19',233,40,235,68);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(26,'Ulica #20',228,45,232,46);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(27,'Ulica #21',118,84,119,130);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(28,'Ulica #22',120,109,154,111);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(29,'Ulica #23',81,84,82,127);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(30,'Ulica #24',362,65,364,101);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(31,'Ulica #25',365,100,399,101);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(32,'Ulica #26',398,65,399,101);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(33,'Ulica #27',365,65,397,66);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(34,'Ulica #28',155,61,157,114);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(35,'Ulica #29',149,120,151,145);
INSERT INTO "streets" ("id","name","x1","z1","x2","z2") VALUES(36,'Ulica #30',152,144,159,145);
CREATE TABLE citizens (
    number          INTEGER PRIMARY KEY,
    identity_number INTEGER UNIQUE,
    name            TEXT NOT NULL,
    nio             TEXT,
    age             TEXT,
    profession      TEXT,
    photo_url       TEXT,
    role            TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen','clerk','admin')),
    pin_salt        TEXT,
    pin_hash        TEXT
);
INSERT INTO "citizens" ("number","identity_number","name","nio","age","profession","photo_url","role","pin_salt","pin_hash") VALUES(1,NULL,'Northh7000','195740','2137','bezrobotny','https://lh3.googleusercontent.com/d/1wAcDe-yOMHjBLMV9nk16MNnEkGdYpooF','clerk',NULL,NULL);
INSERT INTO "citizens" ("number","identity_number","name","nio","age","profession","photo_url","role","pin_salt","pin_hash") VALUES(2,NULL,'Kobi3483','132714','70+','rodzicow',NULL,'citizen',NULL,NULL);
INSERT INTO "citizens" ("number","identity_number","name","nio","age","profession","photo_url","role","pin_salt","pin_hash") VALUES(3,NULL,'Ciaastek7619','117860','12','kierownik hotelu',NULL,'citizen',NULL,NULL);
INSERT INTO "citizens" ("number","identity_number","name","nio","age","profession","photo_url","role","pin_salt","pin_hash") VALUES(4,NULL,'Niekombi','198310','wiecej niz ty','dla rodzicow','https://lh3.googleusercontent.com/d/1Witb0JxbGKhlcz_JYvli9nsPUWLpj4vd','citizen',NULL,NULL);
CREATE TABLE companies (
    number     INTEGER PRIMARY KEY,
    gov_number INTEGER UNIQUE,            -- GovernmentBP company number; NULL until linked
    name       TEXT NOT NULL,
    legal_form TEXT,
    photo_url  TEXT
);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(1,NULL,'Kuria Metropolitarna','hieracha koscielny',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(2,NULL,'Nowy Fundusz Zdrowych','fundacja',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(3,NULL,'Partyjne Gospodarstwa Rolne','sp. z o.o.',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(4,NULL,'Caritas','GmbH',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(5,NULL,'Spoldzielnia Mieszkaniowa ''Twoja-Stara''','spoldzielnia mieszkaniowa',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(6,NULL,'Zarzad Betonu Miejskiego','sp. z o.o.',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(7,NULL,'Magenta Corp.','GmbH',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(8,NULL,'Homenta Corp.','GmbH',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(9,NULL,'Rita Chmiel Hotels & Resorts','sp. k.',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(10,NULL,'Urząd Miasta Amoguszowice','Skarb Miasta',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(11,NULL,'Systemy Usług Szybkiej Kolei i Transportu Torowego','Spólka',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(12,NULL,'KaEfSi','Sp. z o. o.',NULL);
INSERT INTO "companies" ("number","gov_number","name","legal_form","photo_url") VALUES(13,NULL,'BePGe','GmBH','https://lh3.googleusercontent.com/d/1yAXA5eP0BfPHtNyahEbXdwBFKT-UL7PH');
CREATE TABLE plots (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    zoning_type_id  INTEGER REFERENCES zoning_types(id),
    x1 INTEGER NOT NULL, z1 INTEGER NOT NULL, x2 INTEGER NOT NULL, z2 INTEGER NOT NULL,
    side_x          INTEGER NOT NULL,
    side_z          INTEGER NOT NULL,
    area            INTEGER NOT NULL DEFAULT 0,
    value           INTEGER NOT NULL DEFAULT 0,
    sector_id       INTEGER REFERENCES sectors(id),
    district_id     INTEGER REFERENCES districts(id),
    street_id       INTEGER REFERENCES streets(id),
    building_number TEXT,
    owner_kind      TEXT CHECK (owner_kind IN ('citizen','company')),
    owner_number    INTEGER,
    merged_into     INTEGER REFERENCES plots(id),
    version         INTEGER NOT NULL DEFAULT 1,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(1,'B3/001',1,122,-127,150,-92,29,36,1044,94,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(2,'B4/002',2,237,-97,260,-70,24,28,672,81,NULL,2,2,'1','citizen',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(3,'B4/003',3,264,-86,290,-70,27,17,459,37,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(4,'B3/004',1,98,-85,137,-46,40,40,1600,144,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(5,'B3/005',1,144,-85,174,-53,31,33,1023,93,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(6,'C3/006',1,177,-65,184,-53,8,13,104,10,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(7,'C4/007',1,216,-62,240,-56,25,7,175,16,NULL,3,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(8,'C4/008',4,247,-64,262,-40,16,25,400,4,NULL,2,1,'1','company',11,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(9,'C4/009',2,264,-64,290,-47,27,18,486,59,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(10,'C3/010',1,147,-51,160,-13,14,39,546,50,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(11,'C3/011',1,163,-51,176,-22,14,30,420,38,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(12,'C4/012',5,189,-51,211,-21,23,31,713,8,NULL,3,NULL,NULL,'company',2,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(13,'C4/013',3,215,-55,241,-32,27,24,648,52,NULL,3,9,'1','company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(14,'C3/014',1,150,-11,160,-1,11,11,121,11,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(15,'C3/015',1,164,-17,184,-1,21,17,357,33,NULL,1,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(16,'C4/016',6,185,-17,211,-1,27,17,459,37,NULL,3,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(17,'C4/017',4,215,-13,223,4,9,18,162,2,NULL,3,NULL,NULL,'company',9,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(18,'C4/018',3,231,-22,240,4,10,27,270,22,NULL,3,NULL,NULL,'company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(19,'C3/019',2,148,3,212,29,65,27,1209,146,NULL,4,NULL,NULL,'company',10,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(20,'C1/020',7,-90,12,-41,40,50,29,1450,145,NULL,5,NULL,NULL,'company',7,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(21,'C3/021',4,57,12,94,50,38,39,1482,15,NULL,4,NULL,NULL,'company',10,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(22,'C3/022',6,161,16,199,46,39,31,1209,97,NULL,4,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(23,'C4/023',3,231,12,240,38,10,27,270,22,NULL,4,NULL,NULL,'company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(24,'C3/024',2,148,33,212,59,65,27,1209,146,NULL,4,NULL,NULL,'company',10,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(25,'C4/025',3,246,36,252,44,7,9,63,6,NULL,4,NULL,NULL,'company',7,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(26,'C4/026',6,232,45,248,71,17,27,459,37,NULL,4,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(27,'C4/027',3,249,52,260,71,12,20,240,20,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(28,'D3/028',3,146,60,154,86,9,27,243,20,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(29,'D3/029',6,159,61,175,78,17,18,306,25,NULL,4,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(30,'D3/030',8,180,74,200,110,21,37,777,2,NULL,4,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(31,'D4/031',3,205,73,211,79,7,7,49,4,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(32,'D4/032',3,234,75,240,81,7,7,49,4,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(33,'D4/033',3,246,73,254,81,9,9,81,7,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(34,'D4/034',3,258,71,273,80,16,10,160,13,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(35,'D5/035',9,372,65,400,102,29,38,1102,166,NULL,6,NULL,NULL,'company',9,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(36,'D3/036',4,81,83,119,127,39,45,1755,18,NULL,4,NULL,NULL,'company',10,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(37,'D3/037',4,127,83,154,108,28,26,652,7,NULL,4,NULL,NULL,'company',10,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(38,'D4/038',3,217,85,228,93,12,9,108,9,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(39,'D4/039',3,236,87,241,93,6,7,42,4,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(40,'D4/040',6,247,86,254,93,8,8,64,6,NULL,6,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(41,'D4/041',3,258,86,269,93,12,8,96,8,NULL,6,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(42,'D4/042',3,271,86,282,97,12,12,144,12,NULL,6,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(43,'D4/043',2,298,86,321,98,24,13,312,38,NULL,6,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(44,'D5/044',3,349,86,361,100,13,15,195,16,NULL,6,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(45,'D3/045',1,159,100,165,108,7,9,63,6,NULL,4,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(46,'D3/046',3,170,103,175,109,6,7,42,4,NULL,4,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(47,'D4/047',3,201,96,210,122,10,27,270,22,NULL,4,NULL,NULL,'company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(48,'D4/048',3,216,96,225,122,10,27,270,22,NULL,4,NULL,NULL,'company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(49,'D4/049',8,246,98,263,127,18,30,540,2,NULL,6,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(50,'D3/050',3,127,113,145,125,19,13,247,20,NULL,4,NULL,NULL,'company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(51,'D3/051',3,127,132,145,144,19,13,247,20,NULL,7,NULL,NULL,'company',5,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(52,'D3/052',1,180,132,186,138,7,7,49,5,NULL,7,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(53,'D3/053',3,187,131,193,137,7,7,49,4,NULL,7,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(54,'D4/054',3,194,131,200,137,7,7,49,4,NULL,7,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(55,'D4/055',3,203,131,209,137,7,7,49,4,NULL,7,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(56,'D4/056',1,216,131,224,137,9,7,63,6,NULL,7,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(57,'D4/057',3,229,131,235,137,7,7,49,4,NULL,7,NULL,NULL,'company',8,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(58,'D4/058',9,244,133,257,155,14,23,322,49,NULL,6,NULL,NULL,'company',9,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(59,'D3/059',3,115,147,143,164,29,18,522,42,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(60,'D3/060',9,145,147,172,164,28,18,504,76,NULL,7,NULL,NULL,'company',9,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(61,'D3/061',3,180,144,193,161,14,18,252,21,NULL,7,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(62,'D4/062',3,196,144,210,161,15,18,270,22,NULL,7,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(63,'D4/063',3,216,144,237,163,22,20,440,36,NULL,7,NULL,NULL,'citizen',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(64,'D3/064',2,180,163,193,177,14,15,210,26,NULL,7,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(65,'D4/065',9,198,166,228,190,31,25,775,117,NULL,7,NULL,NULL,'company',9,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(66,'D3/066',3,157,172,171,186,15,15,225,18,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(67,'D3/067',2,173,179,193,200,21,22,462,56,NULL,7,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(68,'D3/068',3,157,188,171,196,15,9,135,11,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(69,'B4/069',8,296,-109,308,-102,13,8,104,1,NULL,2,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(70,'E3/070',2,150,198,171,214,22,17,374,45,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(71,'F2/071',7,-78,354,-32,389,47,36,1692,170,NULL,8,NULL,NULL,'company',7,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(72,'B4/072',7,217,-91,233,-70,17,22,374,38,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(73,'C4/073',2,296,-64,319,-51,24,14,336,41,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(74,'B4/074',3,296,-96,315,-70,20,27,540,44,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(75,'B4/075',3,310,-118,318,-102,9,17,153,13,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(76,'B4/076',6,283,-107,290,-90,8,18,144,12,NULL,2,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(77,'B4/077',3,296,-131,307,-113,12,19,228,19,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(78,'B4/078',1,303,-166,317,-136,15,31,465,42,NULL,2,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(79,'B4/079',5,310,-131,318,-121,9,11,99,1,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(80,'B4/080',6,298,-188,317,-169,20,20,400,32,NULL,2,NULL,NULL,'company',6,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(81,'B4/081',3,219,-191,262,-170,44,22,968,78,NULL,2,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(82,'B2/082',3,-29,-171,19,-113,49,59,2891,232,NULL,9,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(83,'B2/083',6,25,-198,40,-144,16,55,880,71,NULL,9,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(84,'B2/084',8,-29,-198,19,-177,49,22,1078,3,NULL,9,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(85,'B2/085',2,44,-196,66,-162,23,35,805,97,NULL,9,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(86,'D4/086',3,276,101,285,112,10,12,120,10,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(87,'D4/087',3,276,115,285,126,10,12,120,10,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(88,'D4/088',3,276,132,285,146,10,15,150,12,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(89,'D4/089',3,276,149,285,163,10,15,150,12,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(90,'D4/090',2,276,166,285,175,10,10,100,12,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(91,'D4/091',2,276,178,285,190,10,13,130,16,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(92,'D4/092',3,291,107,302,126,12,20,240,20,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(93,'D4/093',5,304,112,318,126,15,15,225,3,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(94,'D4/094',1,291,132,305,146,15,15,225,21,NULL,6,NULL,NULL,'company',3,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(95,'D4/095',3,308,132,317,140,10,9,90,8,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(96,'D4/096',3,308,143,317,160,10,18,180,15,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(97,'D4/097',8,308,163,317,172,10,10,100,1,NULL,6,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(98,'D4/098',3,301,175,317,189,17,15,255,21,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(99,'D3/099',8,94,132,103,144,10,13,130,1,NULL,7,NULL,NULL,'company',1,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(100,'D3/100',2,66,132,88,147,23,16,368,45,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(101,'D3/101',9,66,150,88,189,23,40,920,138,NULL,7,NULL,NULL,'company',9,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(102,'D3/102',3,94,147,106,164,13,18,234,19,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(103,'D3/103',2,103,173,125,189,23,17,391,47,NULL,7,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(104,'D5/104',2,324,86,346,98,23,13,299,36,NULL,6,NULL,NULL,'citizen',4,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(105,'D1/105',6,-130,102,-22,138,109,37,4033,323,NULL,10,NULL,NULL,'company',7,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(106,'D1/106',10,-156,102,-134,138,23,37,851,111,NULL,10,NULL,NULL,'company',13,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(107,'D2/107',2,-130,142,-22,252,109,111,12099,1452,NULL,10,NULL,NULL,'company',10,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(108,'D5/108',3,407,68,438,80,32,13,416,34,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(109,'D5/109',3,407,86,438,98,32,13,416,34,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(110,'D5/110',10,346,112,360,126,15,15,225,30,NULL,6,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(111,'D3/111',4,34,132,63,166,30,35,1050,11,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
INSERT INTO "plots" ("id","name","zoning_type_id","x1","z1","x2","z2","side_x","side_z","area","value","sector_id","district_id","street_id","building_number","owner_kind","owner_number","merged_into","version","updated_at") VALUES(112,'D3/112',8,-18,81,80,127,99,47,4653,10,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-10-17 19:24:29');
CREATE TABLE units (
    id               INTEGER PRIMARY KEY,
    plot_id          INTEGER NOT NULL REFERENCES plots(id),
    unit_number      TEXT,
    stairwell        TEXT,
    floor            TEXT,
    area             INTEGER NOT NULL DEFAULT 0,
    bed_count        INTEGER NOT NULL DEFAULT 0,
    workplace_count  INTEGER NOT NULL DEFAULT 0,
    tenant_kind      TEXT CHECK (tenant_kind IN ('citizen','company')),
    tenant_number    INTEGER,
    tenant_label     TEXT
);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(1,13,'1','A','0',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(2,13,'2','A','0',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(3,13,'3','A','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(4,13,'4','A','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(5,13,'5','A','2',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(6,13,'6','A','2',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(7,13,'7','A','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(8,13,'8','A','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(9,13,'1','B','0',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(10,13,'2','B','0',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(11,13,'3','B','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(12,13,'4','B','1',18,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(13,13,'5','B','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(14,13,'6','B','2',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(15,13,'7','B','2',18,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(16,13,'8','B','2',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(17,13,'9','B','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(18,13,'10','B','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(19,13,'1','C','0',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(20,13,'2','C','1',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(21,13,'3','C','1',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(22,13,'4','C','2',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(23,13,'5','C','2',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(24,13,'6','C','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(25,13,'7','C','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(26,13,'1','D','0',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(27,13,'2','D','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(28,13,'3','D','1',18,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(29,13,'4','D','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(30,13,'5','D','2',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(31,13,'6','D','2',18,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(32,13,'7','D','2',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(33,13,'8','D','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(34,13,'9','D','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(35,18,'1','A','0',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(36,18,'2','A','0',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(37,18,'3','A','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(38,18,'4','A','1',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(39,18,'5','A','2',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(40,18,'6','A','2',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(41,18,'7','A','3',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(42,18,'8','A','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(43,18,'1','B','0',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(44,18,'2','B','0',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(45,18,'3','B','1',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(46,18,'4','B','1',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(47,18,'5','B','2',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(48,18,'6','B','2',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(49,18,'7','B','3',12,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(50,18,'8','B','3',12,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(51,19,'1',NULL,'0/1/2',528,2,0,'citizen',3,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(52,19,'2',NULL,'0',30,0,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(53,19,'3',NULL,'0',42,0,1,'company',4,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(54,19,'4',NULL,'0',30,0,0,'company',12,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(55,19,'5',NULL,'0',30,0,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(56,19,'6',NULL,'0',78,0,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(57,19,'7',NULL,'1',15,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(58,19,'8',NULL,'1',24,2,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(59,19,'9',NULL,'1',18,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(60,19,'10',NULL,'1',9,0,1,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(61,19,'11',NULL,'1',6,0,1,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(62,19,'12',NULL,'1',15,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(63,19,'13',NULL,'1',15,1,0,NULL,NULL,NULL);
INSERT INTO "units" ("id","plot_id","unit_number","stairwell","floor","area","bed_count","workplace_count","tenant_kind","tenant_number","tenant_label") VALUES(64,19,'14',NULL,'1',18,1,0,NULL,NULL,NULL);
CREATE TABLE ownership_history (
    id                INTEGER PRIMARY KEY,
    plot_id           INTEGER NOT NULL REFERENCES plots(id),
    owner_kind        TEXT CHECK (owner_kind IN ('citizen','company')),
    owner_number      INTEGER,
    transaction_value TEXT,
    transaction_day   INTEGER,
    transaction_type  TEXT,
    check_number      TEXT,
    paid              INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(1,1,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(2,2,'citizen',3,NULL,0,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(3,4,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(4,5,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(5,6,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(6,7,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(7,8,'company',11,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(8,10,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(9,11,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(10,12,'company',2,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(11,13,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(12,14,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(13,15,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(14,16,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(15,18,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(16,19,'company',10,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(17,20,'company',7,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(18,21,'company',10,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(19,22,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(20,23,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(21,24,'company',10,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(22,25,'company',7,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(23,26,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(24,27,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(25,28,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(26,29,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(27,30,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(28,31,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(29,32,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(30,33,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(31,34,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(32,35,'company',9,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(33,36,'company',10,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(34,37,'company',10,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(35,38,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(36,39,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(37,40,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(38,41,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(39,42,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(40,43,'citizen',4,NULL,0,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(41,44,'citizen',4,NULL,0,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(42,45,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(43,46,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(44,47,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(45,48,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(46,49,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(47,50,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(48,51,'company',5,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(49,52,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(50,53,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(51,54,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(52,55,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(53,56,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(54,57,'company',8,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(55,58,'company',9,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(56,60,'company',9,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(57,63,'citizen',3,NULL,0,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(58,65,'company',9,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(59,69,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(60,71,'company',7,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(61,76,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(62,78,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(63,80,'company',6,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(64,82,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(65,83,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(66,84,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(67,85,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(68,94,'company',3,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(69,97,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(70,99,'company',1,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(71,101,'company',9,NULL,0,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(72,104,'citizen',4,NULL,0,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(73,17,'company',9,NULL,10500,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(74,106,'company',13,NULL,10500,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(75,105,'company',7,NULL,10500,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(76,107,'company',10,NULL,10500,'Darowizna',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(77,62,'citizen',4,'22',10794,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(78,61,'citizen',4,'21',10794,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(79,64,'citizen',4,'26',10794,'Sprzedaż',NULL,1);
INSERT INTO "ownership_history" ("id","plot_id","owner_kind","owner_number","transaction_value","transaction_day","transaction_type","check_number","paid") VALUES(80,67,'citizen',4,'56',10795,'Sprzedaż',NULL,1);
CREATE TABLE lottery (
    id            INTEGER PRIMARY KEY,
    plot_id       INTEGER NOT NULL REFERENCES plots(id),
    winner_kind   TEXT CHECK (winner_kind IN ('citizen','company')),
    winner_number INTEGER,
    amount        TEXT,
    check_number  TEXT,
    paid          INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(1,22,'citizen',1,'97','1998759308',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(2,47,'citizen',2,'22',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(3,50,'citizen',3,'20','1109036434',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(4,14,'citizen',4,'11',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(5,28,'citizen',1,'20','1643492239',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(6,30,'citizen',2,'2',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(7,39,'citizen',3,'4','1546939308',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(8,33,'citizen',4,'7',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(9,52,'citizen',1,'5','1645244338',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(10,105,'citizen',2,'205',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(11,46,'citizen',3,'4','1869641512',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(12,23,'citizen',4,'22',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(13,10,'citizen',1,'50','1425281247',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(14,83,'citizen',2,'71',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(15,11,'citizen',3,'38','2136349474',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(16,20,'citizen',4,'145',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(17,56,'citizen',1,'6','1757624073',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(18,58,'citizen',2,'49',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(19,106,'citizen',3,'111','1122630431',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(20,53,'citizen',4,'4',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(21,34,'citizen',1,'13','1118743544',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(22,51,'citizen',2,'20',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(23,32,'citizen',3,'4','1604707666',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(24,25,'citizen',4,'6',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(25,18,'citizen',1,'22','1424716794',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(26,17,'citizen',2,'2',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(27,94,'citizen',3,'21','1869041879',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(28,29,'citizen',4,'25',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(29,101,'citizen',1,'138','1400249077',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(30,8,'citizen',2,'4',NULL,0);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(31,82,'citizen',3,'232','1419166122',1);
INSERT INTO "lottery" ("id","plot_id","winner_kind","winner_number","amount","check_number","paid") VALUES(32,15,'citizen',4,'33',NULL,0);
CREATE TABLE merges (
    id              INTEGER PRIMARY KEY,
    main_plot_id    INTEGER NOT NULL REFERENCES plots(id),
    merging_plot_id INTEGER NOT NULL REFERENCES plots(id)
);
INSERT INTO "merges" ("id","main_plot_id","merging_plot_id") VALUES(1,44,104);
INSERT INTO "merges" ("id","main_plot_id","merging_plot_id") VALUES(2,104,43);
INSERT INTO "merges" ("id","main_plot_id","merging_plot_id") VALUES(3,61,62);
INSERT INTO "merges" ("id","main_plot_id","merging_plot_id") VALUES(4,64,67);
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value INTEGER NOT NULL
);
INSERT INTO "settings" ("key","value") VALUES('plot_lottery_enabled',1);
CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    at          TEXT NOT NULL DEFAULT (datetime('now')),
    actor       INTEGER,
    entity      TEXT NOT NULL,
    entity_id   INTEGER,
    action      TEXT NOT NULL,
    diff        TEXT
);
CREATE TABLE metro_stations (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    x INTEGER, y INTEGER, z INTEGER,       -- NULL when the station has no platform in the world
    platform_count  INTEGER NOT NULL DEFAULT 0,
    portal_edited   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE metro_lines (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    color          TEXT NOT NULL,           -- Minecraft formatting-code character, see METRO_PALETTE
    speed          INTEGER NOT NULL,
    dwell_seconds  INTEGER NOT NULL,
    train_count    INTEGER NOT NULL DEFAULT 1,
    circular       INTEGER NOT NULL DEFAULT 0,
    through_loops  INTEGER NOT NULL DEFAULT 0,
    shuttle        INTEGER NOT NULL DEFAULT 0,
    running        INTEGER NOT NULL DEFAULT 0,
    station_ids    TEXT NOT NULL DEFAULT '[]',   -- JSON array, in service order
    segments       TEXT NOT NULL DEFAULT '[]',   -- JSON: one [[x,z],...] polyline per compiled leg
    portal_edited  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
    token_hash    TEXT PRIMARY KEY,
    citizen_number INTEGER NOT NULL REFERENCES citizens(number),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at    TEXT NOT NULL
);
CREATE TABLE login_attempts (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    key    TEXT NOT NULL,            -- 'id:<identityNumber>' or 'ip:<address>'
    at     TEXT NOT NULL DEFAULT (datetime('now'))
);
DELETE FROM sqlite_sequence;
CREATE INDEX idx_plots_district ON plots(district_id);
CREATE INDEX idx_units_plot ON units(plot_id);
CREATE INDEX idx_ownership_plot ON ownership_history(plot_id);
CREATE INDEX idx_attempts_key ON login_attempts(key, at);
