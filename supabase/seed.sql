-- Demo/test data: your real brand list, plus a couple of test customer
-- accounts so you can log in and see something real today. Safe to edit or
-- delete once you're onboarding real customers instead.
--
-- Run this AFTER the three migrations, in the SQL Editor. It only seeds
-- rows (admins/app_users) by email — nobody can log in until they visit the
-- app and create a password for that exact email.
--
-- IMPORTANT: change the admin email below to whoever should actually have
-- admin access before running this against a real project.
--
-- Brands are seeded with no modules yet — add modules/quizzes for each from
-- the admin panel once the admin screens are wired to this database.

do $$
declare
  v_brand_eleven uuid;
  v_brand_kevinmurphy uuid;
  v_brand_colorwow uuid;
  v_brand_aveda uuid;
  v_brand_davines uuid;
  v_brand_k18 uuid;
  v_brand_livingproof uuid;
  v_account_c1 uuid;
  v_account_c2 uuid;
  v_account_c3 uuid;
begin
  -- Brands
  insert into brands (name, tagline) values ('Eleven Australia', 'Haircare & styling') returning id into v_brand_eleven;
  insert into brands (name, tagline) values ('Kevin.Murphy', 'Haircare') returning id into v_brand_kevinmurphy;
  insert into brands (name, tagline) values ('Color Wow', 'Colour care & styling') returning id into v_brand_colorwow;
  insert into brands (name, tagline) values ('Aveda', 'Haircare & wellness') returning id into v_brand_aveda;
  insert into brands (name, tagline) values ('Davines', 'Sustainable haircare') returning id into v_brand_davines;
  insert into brands (name, tagline) values ('K18', 'Bond repair treatment') returning id into v_brand_k18;
  insert into brands (name, tagline) values ('Living Proof', 'Haircare technology') returning id into v_brand_livingproof;

  -- Admin — change this email to the real admin before running against production.
  insert into admins (name, email) values ('Chloe Murphy', 'chloe@nationalbeauty.ie')
    on conflict (email) do nothing;

  -- Demo customer accounts, each approved for a different slice of brands
  insert into accounts (company_name, customer_number, main_contact_name, main_contact_email, status, approved_brand_ids)
    values ('The Colour Room, Cork', 'CU-1001', 'Aisling Byrne', 'aisling@thecolourroom.ie', 'approved', array[v_brand_eleven, v_brand_colorwow])
    returning id into v_account_c1;
  insert into accounts (company_name, customer_number, main_contact_name, main_contact_email, status, approved_brand_ids)
    values ('Verve Studio, Galway', 'CU-1002', 'Marcus O''Neill', 'marcus@vervestudio.ie', 'approved', array[v_brand_k18])
    returning id into v_account_c2;
  insert into accounts (company_name, customer_number, main_contact_name, main_contact_email, status, approved_brand_ids)
    values ('Bloom Hair & Beauty, Dublin', 'CU-1003', 'Niamh Kelly', 'niamh@bloomhair.ie', 'approved', array[v_brand_eleven, v_brand_aveda, v_brand_livingproof])
    returning id into v_account_c3;

  insert into app_users (account_id, name, email, role) values
    (v_account_c1, 'Aisling Byrne', 'aisling@thecolourroom.ie', 'holder'),
    (v_account_c2, 'Marcus O''Neill', 'marcus@vervestudio.ie', 'holder'),
    (v_account_c3, 'Niamh Kelly', 'niamh@bloomhair.ie', 'holder'),
    (v_account_c3, 'Sarah Doyle', 'sarah@bloomhair.ie', 'staff'),
    (v_account_c3, 'Emma Walsh', 'emma@bloomhair.ie', 'staff')
  on conflict (email) do nothing;

  -- One pending account, to exercise the "not approved yet" screen.
  insert into accounts (company_name, customer_number, main_contact_name, main_contact_email, status, approved_brand_ids)
    values ('The Loft Salon, Limerick', 'CU-1004', 'Aoife Ryan', 'aoife@theloftsalon.ie', 'pending', array[]::uuid[]);
  insert into app_users (account_id, name, email, role)
    select id, 'Aoife Ryan', 'aoife@theloftsalon.ie', 'holder' from accounts where customer_number = 'CU-1004'
  on conflict (email) do nothing;
end $$;
