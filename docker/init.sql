-- Separate database so `npm test` (which TRUNCATEs tables) never wipes dev data.
CREATE DATABASE miniledger_test;
