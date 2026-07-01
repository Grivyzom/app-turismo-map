-- Insertar nuevos Partners (Companies)
DO $$
DECLARE
    club_id int;
    deportes_id int;
    parques_id int;
    cafeteria_id int;
    b_club_id int;
    b_deportes_id int;
    b_parques_id int;
    b_cafeteria_id int;
BEGIN
    INSERT INTO public.companies (business_name, entity_type, verification_status) VALUES ('Club La Cueva', 'business', 'verified') RETURNING id INTO club_id;
    INSERT INTO public.companies (business_name, entity_type, verification_status) VALUES ('Deportes Valdivia', 'business', 'verified') RETURNING id INTO deportes_id;
    INSERT INTO public.companies (business_name, entity_type, verification_status) VALUES ('Parques Urbanos SA', 'business', 'verified') RETURNING id INTO parques_id;
    INSERT INTO public.companies (business_name, entity_type, verification_status) VALUES ('Cafetería El Novedoso', 'business', 'verified') RETURNING id INTO cafeteria_id;

    -- Sucursales
    INSERT INTO public.company_branches (company_id, branch_name, category, address, geom, target_audience)
    VALUES (club_id, 'Sede Principal Club', 'fiesta', 'Calle Condell 123', ST_GeomFromText('POINT(-73.245 -39.814)', 4326), 'local') RETURNING id INTO b_club_id;
    
    INSERT INTO public.company_branches (company_id, branch_name, category, address, geom, target_audience)
    VALUES (deportes_id, 'Coliseo Municipal', 'deporte', 'Pedro Montt 456', ST_GeomFromText('POINT(-73.238 -39.816)', 4326), 'local') RETURNING id INTO b_deportes_id;

    INSERT INTO public.company_branches (company_id, branch_name, category, address, geom, target_audience)
    VALUES (parques_id, 'Nuevo Parque Krahmer', 'naturaleza', 'Av. Krahmer', ST_GeomFromText('POINT(-73.230 -39.820)', 4326), 'all') RETURNING id INTO b_parques_id;

    INSERT INTO public.company_branches (company_id, branch_name, category, address, geom, target_audience)
    VALUES (cafeteria_id, 'Cafetería El Novedoso', 'gastronomia', 'Isla Teja 789', ST_GeomFromText('POINT(-73.250 -39.812)', 4326), 'all') RETURNING id INTO b_cafeteria_id;

    -- Eventos tipo Smart Notifications (usamos un campo existente o deducimos en base a la categoría)
    -- Invitación a club
    INSERT INTO public.events (title, description, start_time, end_time, category, emitter_type, branch_emitter_id, geom, target_audience, is_live, status)
    VALUES ('¡Noche Especial Invitación VIP!', 'Tienes una invitación exclusiva a Club La Cueva esta noche.', NOW(), NOW() + INTERVAL '1 day', 'invitation_club', 'branch', b_club_id, ST_GeomFromText('POINT(-73.245 -39.814)', 4326), 'local', true, 'active');

    -- Invitación a partido
    INSERT INTO public.events (title, description, start_time, end_time, category, emitter_type, branch_emitter_id, geom, target_audience, is_live, status)
    VALUES ('Partido de Básquetbol', '¡Súmate al partido de básquetbol cerca de tu zona!', NOW(), NOW() + INTERVAL '5 hours', 'invitation_sports', 'branch', b_deportes_id, ST_GeomFromText('POINT(-73.238 -39.816)', 4326), 'local', true, 'active');

    -- Nuevo spot / Parque
    INSERT INTO public.events (title, description, start_time, end_time, category, emitter_type, branch_emitter_id, geom, target_audience, is_live, status)
    VALUES ('Nuevo Spot Descubierto: Parque Krahmer', '¡Se acaba de inaugurar una nueva zona verde!', NOW(), NOW() + INTERVAL '7 days', 'new_spot', 'branch', b_parques_id, ST_GeomFromText('POINT(-73.230 -39.820)', 4326), 'all', false, 'active');

    -- Nuevo item
    INSERT INTO public.events (title, description, start_time, end_time, category, emitter_type, branch_emitter_id, geom, target_audience, is_live, status)
    VALUES ('¡Nuevos Postres en el Menú!', 'Pasa a probar la nueva tarta de frutos del bosque.', NOW(), NOW() + INTERVAL '3 days', 'new_item', 'branch', b_cafeteria_id, ST_GeomFromText('POINT(-73.250 -39.812)', 4326), 'all', false, 'active');

END $$;
