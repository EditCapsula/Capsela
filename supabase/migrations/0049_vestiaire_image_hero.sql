-- Visuel « hero » du catalogue (08/10/2026) : la même pièce posée à plat avec des plis naturels (flat lay), pour le hero
-- « Ton look du jour » de l'accueil. S'AJOUTE au visuel standard (url_image), qu'il ne remplace jamais.
--
-- Additif et idempotent. L'app fonctionne AVANT cette migration : le visuel hero est lu s'il existe (select *), sinon le visuel
-- standard sert. La colonne est écrite par l'Edge Function generate-hero-image (clé privilégiée), jamais par l'app.
alter table public.vestiaire_universel add column if not exists url_image_hero text;
