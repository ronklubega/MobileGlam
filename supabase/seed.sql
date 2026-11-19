-- Sample data for local testing. Safe to re-run (fixed IDs, ON CONFLICT DO NOTHING).
-- Run in the Supabase SQL editor AFTER the three migrations.

insert into tenants (id, name, slug, type, description, address, area, location, offers_home_visits, commission_bps) values
 ('a0000000-0000-0000-0000-000000000001', 'Kololo Hair Studio', 'kololo-hair-studio', 'salon',
  'Braids, relaxers, colour and treatments in the heart of Kololo.', 'Plot 12, Acacia Avenue', 'Kololo',
  st_setsrid(st_makepoint(32.5900, 0.3340), 4326)::geography, true, 1000),
 ('a0000000-0000-0000-0000-000000000002', 'Ntinda Gents Barbers', 'ntinda-gents-barbers', 'barbershop',
  'Fades, shaves and beard grooming.', 'Ntinda Complex, Ground Floor', 'Ntinda',
  st_setsrid(st_makepoint(32.6170, 0.3530), 4326)::geography, false, 1000),
 ('a0000000-0000-0000-0000-000000000003', 'Muyenga Scalp & Hair Clinic', 'muyenga-scalp-clinic', 'clinic',
  'Specialist scalp analysis, hair-loss treatment and PRP therapy.', 'Tank Hill Road', 'Muyenga',
  st_setsrid(st_makepoint(32.6050, 0.2970), 4326)::geography, false, 1200),
 ('a0000000-0000-0000-0000-000000000004', 'Entebbe Lakeside Salon', 'entebbe-lakeside-salon', 'salon',
  'Full-service salon near the Entebbe Botanical Gardens.', 'Kitoro Road', 'Entebbe',
  st_setsrid(st_makepoint(32.4637, 0.0512), 4326)::geography, true, 1000)
on conflict (id) do nothing;

insert into staff (id, tenant_id, display_name, title) values
 ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sarah Nakato', 'Senior Stylist'),
 ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Brenda Akello', 'Braiding Specialist'),
 ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Moses Ssemanda', 'Master Barber'),
 ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Ivan Okello', 'Barber'),
 ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'Dr. Grace Namuli', 'Trichologist'),
 ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'Patricia Auma', 'Stylist'),
 ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004', 'Joan Nabirye', 'Stylist')
on conflict (id) do nothing;

insert into services (id, tenant_id, name, description, price_ugx, duration_minutes, deposit_percent, allows_home_visit) values
 ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Box Braids', 'Medium box braids, hair included.', 120000, 240, 20, false),
 ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Wash & Blow-dry', 'Shampoo, conditioning and blow-dry.', 35000, 60, 20, true),
 ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Hair Colour', 'Full colour with treatment.', 90000, 120, 20, false),
 ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Classic Haircut', 'Fade or taper with line-up.', 15000, 30, 20, false),
 ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Haircut & Beard', 'Haircut with beard shaping and hot towel.', 25000, 45, 20, false),
 ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Scalp Analysis (free consultation)', 'Free first consultation. No deposit.', 0, 30, 0, false),
 ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'PRP Hair-Loss Treatment', 'Platelet-rich plasma session.', 350000, 90, 30, false),
 ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'Cornrows', 'Neat cornrows, simple designs.', 40000, 90, 20, true),
 ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000004', 'Wash & Style', 'Wash, treatment and styling.', 30000, 60, 20, true)
on conflict (id) do nothing;

-- Every staff member can perform every service of their salon.
insert into staff_services (staff_id, service_id)
select st.id, sv.id from staff st join services sv on sv.tenant_id = st.tenant_id
on conflict do nothing;

-- Mon-Sat, 09:00-17:00 (0 = Sunday, so Sunday is off).
insert into staff_shifts (staff_id, weekday, start_time, end_time)
select st.id, d, time '09:00', time '17:00' from staff st, generate_series(1, 6) d
where not exists (select 1 from staff_shifts x where x.staff_id = st.id and x.weekday = d);
