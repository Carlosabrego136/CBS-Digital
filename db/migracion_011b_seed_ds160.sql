-- db/migracion_011b_seed_ds160.sql
--
-- Contenido oficial del DS-160 (secciones A-J).
-- Ejecutar DESPUÉS de migracion_011_modulo10.sql, en bloques (ver mensaje del chat).

-- ===== Secciones (10) =====
INSERT INTO ds160_secciones (id, codigo_letra, nombre, orden) VALUES
  ('6a66bbad-ce54-510a-8c2a-20cc31851264', 'A', 'Información Personal', 1),
  ('a3676790-850a-5621-85e5-b8bd2acc4a59', 'B', 'Información del Viaje', 2),
  ('bd0eecfe-12fe-558c-9076-20ca5923c1ef', 'C', 'Compañeros de Viaje', 3),
  ('c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', 'D', 'Viajes Anteriores a Estados Unidos', 4),
  ('8f015471-3a84-5a97-a57b-7b71162d6e8b', 'E', 'Domicilio, Teléfonos, Correo y Redes Sociales', 5),
  ('3f0853bd-ee71-5705-aa38-330355df9d7e', 'F', 'Pasaporte', 6),
  ('07c7ec65-ffe4-5479-912b-6646afd0eae3', 'G', 'Contacto en Estados Unidos', 7),
  ('6d15af31-4508-539c-a47c-d99dea25177a', 'H', 'Información Familiar', 8),
  ('1ffc1058-f593-54d9-9f98-73bc41ea8cce', 'I', 'Trabajo, Educación y Capacitación', 9),
  ('a391b0f0-8eee-5682-8911-99f4938bb661', 'J', 'Security and Background', 10)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 1 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('24123906-2c7e-5782-8c77-73967b5e4c55', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Surnames (Apellidos)', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_apellidos', TRUE, NULL, NULL, 1),
  ('2799da9c-b228-5b4a-af74-3077a7022854', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Given Names (Nombres)', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_nombres', TRUE, NULL, NULL, 2),
  ('ffa4677a-0e4d-5678-83f6-2dd0ab51771b', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Full Name in Native Alphabet', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 3),
  ('d7f61aae-0b08-5870-a18b-f2c18c52732f', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Other Names Used', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 4),
  ('0d94ee32-bc53-5542-a70c-aad66be42a87', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Telecode Name', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 5),
  ('73cd6c57-68d7-5f46-8d86-641d73fe7468', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Sex', 'seleccion_unica', '[{"value": "male", "label": "Male"}, {"value": "female", "label": "Female"}]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('9f24716a-23bd-5d5d-9348-99e9843f1005', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Marital Status', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_estado_civil', TRUE, NULL, NULL, 7),
  ('21a2b07f-7350-577b-8f98-5c412aa9c1f6', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Date of Birth', 'fecha', '[]'::jsonb, NULL, FALSE, 'persona_fecha_nacimiento', TRUE, NULL, NULL, 8),
  ('a2587bac-fe36-5844-81e9-85105f645259', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'City of Birth', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_lugar_nacimiento', TRUE, NULL, NULL, 9),
  ('93827e17-0f0b-5792-b118-72ac0c1eba09', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'State/Province of Birth', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 10),
  ('397f0dda-5bff-57b0-b9cb-44dce6f2d16e', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Country/Region of Birth', 'pais', '[]'::jsonb, NULL, FALSE, 'persona_pais_nacimiento', TRUE, NULL, NULL, 11),
  ('68b75ccf-c0db-5d31-b749-5d2cc73f5f67', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Nationality', 'pais', '[]'::jsonb, NULL, FALSE, 'persona_nacionalidad', TRUE, NULL, NULL, 12),
  ('128591bb-6ef6-53f7-b5e8-d2f1a1e51761', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Other Nationalities', 'texto_largo', '[]'::jsonb, NULL, FALSE, 'm3_otras_nacionalidades', FALSE, NULL, NULL, 13),
  ('e3aee61a-c3ca-52d7-9410-fa834b9b674a', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'Permanent Resident of Another Country/Region', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 14),
  ('1c1614c8-83c3-5206-a96c-ed7606ed2574', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'National Identification Number', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 15)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 2 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('7964cb94-b1b1-574b-8964-c7d58e688ba0', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'U.S. Social Security Number', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 16),
  ('912d86ae-0ee1-54df-ba37-398ab9bbc641', '6a66bbad-ce54-510a-8c2a-20cc31851264', NULL, 'U.S. Taxpayer ID Number', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 17),
  ('e556c3f3-3554-5c84-abb1-3fcdbc137e7a', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Purpose of Trip to the U.S.', 'seleccion_unica', '[{"value": "business_tourism", "label": "Business/Tourism (B)"}, {"value": "other", "label": "Otro"}]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 1),
  ('6b52a22e-e7a4-565b-b86d-d35080719b76', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Specific travel classification', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 2),
  ('0dff1c94-94df-5c2e-b742-6be5153ad7d6', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Intended Date of Arrival', 'fecha', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 3),
  ('e4966a59-a18c-516d-95c7-862b0c5dbac5', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Intended Length of Stay', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 4),
  ('d10f9356-1851-57f9-a53e-e72acc2f90f5', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Address Where You Will Stay in the U.S.', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 5),
  ('cf7cf432-5d0a-55be-94df-126b8f61b5bd', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Person/Entity Paying for the Trip', 'seleccion_unica', '[{"value": "self", "label": "Self"}, {"value": "other_person", "label": "Other Person"}, {"value": "other_company", "label": "Other Company/Organization"}]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('e4250d8a-1010-5545-8dcc-b039e62f345a', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Nombre de quien paga', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'cf7cf432-5d0a-55be-94df-126b8f61b5bd', 'other_person', 7),
  ('a0af4d06-7892-5537-ac4e-18c9d972287f', 'a3676790-850a-5621-85e5-b8bd2acc4a59', NULL, 'Nombre de la empresa/organización que paga', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'cf7cf432-5d0a-55be-94df-126b8f61b5bd', 'other_company', 8),
  ('e0b81bff-c59d-5491-8643-ce4708e3d0f2', 'bd0eecfe-12fe-558c-9076-20ca5923c1ef', NULL, '¿Viaja acompañado?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 1),
  ('7762e388-56ee-5976-ab1f-cf95fc4cfefd', 'bd0eecfe-12fe-558c-9076-20ca5923c1ef', NULL, '¿Forma parte de un grupo u organización?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 2),
  ('97f1a223-a5b3-5b09-96c6-d46720f227a1', 'bd0eecfe-12fe-558c-9076-20ca5923c1ef', NULL, 'Nombre del grupo/organización', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, '7762e388-56ee-5976-ab1f-cf95fc4cfefd', 'si', 3),
  ('23dc3fc5-7462-52b9-8bdd-20c612db5d47', 'bd0eecfe-12fe-558c-9076-20ca5923c1ef', NULL, 'Nombres de los acompañantes', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'e0b81bff-c59d-5491-8643-ce4708e3d0f2', 'si', 4),
  ('4d9aa07f-85c9-537c-9633-df90c6f1ee1d', 'bd0eecfe-12fe-558c-9076-20ca5923c1ef', NULL, 'Relación con el solicitante', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'e0b81bff-c59d-5491-8643-ce4708e3d0f2', 'si', 5)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 3 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('f6e3282b-5541-5e64-9c3f-460f32aa498b', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', 'nunca_viaje_eeuu', '¿Ha viajado anteriormente a Estados Unidos?', 'si_no', '[]'::jsonb, NULL, FALSE, 'm3_entradas_salidas', FALSE, NULL, NULL, 1),
  ('709851b7-1faa-539f-9644-f5bdee937f73', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, 'Fechas de viajes anteriores', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'f6e3282b-5541-5e64-9c3f-460f32aa498b', 'si', 2),
  ('27cf5dd6-2fb1-58d6-9695-fe0f8197896e', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, 'Duración de esos viajes', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'f6e3282b-5541-5e64-9c3f-460f32aa498b', 'si', 3),
  ('9612482d-f14d-5041-bda6-ae17565e769b', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, '¿Tiene licencia de conducir estadounidense?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 4),
  ('e2baa160-7591-51cb-ad73-0035057db26c', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, '¿Ha tenido visa estadounidense anteriormente?', 'si_no', '[]'::jsonb, NULL, FALSE, 'm3_visas_anteriores', FALSE, NULL, NULL, 5),
  ('ad0286d8-0454-583d-a37a-5a123cf0e96f', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, 'Fecha de expedición de la visa anterior', 'fecha', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'e2baa160-7591-51cb-ad73-0035057db26c', 'si', 6),
  ('ef8cc592-bf73-5460-8363-585e833eff8b', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, 'Número de visa, si está disponible', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'e2baa160-7591-51cb-ad73-0035057db26c', 'si', 7),
  ('5aeaa7bf-c7c9-501e-9a42-1a0df966239b', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, '¿Se perdió o fue robada alguna visa?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 8),
  ('2c650827-7782-5cb9-a21d-1f9424e72850', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', 'visa_cancelada_revocada', '¿Le han cancelado o revocado una visa?', 'si_no', '[]'::jsonb, NULL, FALSE, 'm3_cancelaciones', FALSE, NULL, NULL, 9),
  ('79a4d67a-14a3-5cf4-95ef-601b8393785e', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', 'negativa_previa', '¿Alguna vez le han negado una visa estadounidense?', 'si_no', '[]'::jsonb, NULL, FALSE, 'm3_negativas', FALSE, NULL, NULL, 10),
  ('dfd0a8d4-414d-5cbf-90b8-3b80b865d5a2', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, '¿Alguna vez le han negado la admisión a Estados Unidos?', 'si_no', '[]'::jsonb, NULL, FALSE, 'm3_deportaciones', FALSE, NULL, NULL, 11),
  ('4697fb91-56ed-5113-856a-0daf255e3787', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', NULL, '¿Ha retirado una solicitud de admisión en puerto de entrada?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 12),
  ('0ebd4c4c-1fb2-5e39-8d59-e97dfb306d48', 'c7ae8997-2431-570d-9d5e-dcfb7b0c8f91', 'peticion_migratoria', '¿Se ha presentado una petición migratoria a su favor?', 'si_no', '[]'::jsonb, NULL, FALSE, 'm3_peticiones', FALSE, NULL, NULL, 13),
  ('922375d6-69ac-5967-831b-0d8d5ef5eda3', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Home Address', 'texto_largo', '[]'::jsonb, NULL, FALSE, 'persona_domicilio_actual', FALSE, NULL, NULL, 1),
  ('ce6991be-3432-5f9c-950f-afbdfe134146', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, '¿El domicilio postal es diferente?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 2)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 4 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('755b6ad3-3343-5526-9b1b-08a3fcaebe12', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Domicilio postal', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, 'ce6991be-3432-5f9c-950f-afbdfe134146', 'si', 3),
  ('ddb6d237-0d59-5606-b3f3-9cdd227923de', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Teléfono principal', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_telefono_principal', TRUE, NULL, NULL, 4),
  ('3dc53818-4b4f-577a-a6b7-c1b8c789d817', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Teléfono secundario', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_telefono_alterno', TRUE, NULL, NULL, 5),
  ('e1bedd78-b951-524d-8955-fcfbcd4d3dcb', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Teléfono laboral', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('2f6280e4-524d-5ddc-84ff-afc0a833066c', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Correo electrónico', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_correo', TRUE, NULL, NULL, 7),
  ('1bb7731d-9cd4-5c04-9637-60542e275659', '8f015471-3a84-5a97-a57b-7b71162d6e8b', NULL, 'Identificadores de redes sociales', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 8),
  ('36b5f330-e1cf-52d5-91be-4e242c551de0', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Passport/Travel Document Type', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 1),
  ('51004446-ad4a-5ab9-b612-b7bfb64e8ae3', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Passport/Travel Document Number', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'persona_pasaporte_numero', TRUE, NULL, NULL, 2),
  ('ec48adec-878e-5cde-b0c2-71f0025cabed', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Passport Book Number', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 3),
  ('65a6bb2d-ec53-5fc9-9de1-061e5739cbba', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Country/Authority that Issued Passport', 'pais', '[]'::jsonb, NULL, FALSE, 'persona_pasaporte_pais_emisor', TRUE, NULL, NULL, 4),
  ('403e706e-5f09-5421-9218-6bdddd6f1b64', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'City (de expedición)', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 5),
  ('c79430f5-fba2-543c-a3d7-9b3c628097ed', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'State/Province (de expedición)', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('59d53aa6-77e7-5c71-b332-df95e76f19c3', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Country/Region (de expedición)', 'pais', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 7),
  ('c9fc2816-349d-5ddf-b659-d9e2b0f9f073', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Issuance Date', 'fecha', '[]'::jsonb, NULL, FALSE, 'persona_pasaporte_fecha_expedicion', TRUE, NULL, NULL, 8),
  ('449217ea-7e34-52c3-9830-e96585fd4f5d', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, 'Expiration Date', 'fecha', '[]'::jsonb, NULL, FALSE, 'persona_pasaporte_fecha_vencimiento', TRUE, NULL, NULL, 9)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 5 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('76a159ce-6823-529d-8572-10ca2727f83c', '3f0853bd-ee71-5705-aa38-330355df9d7e', NULL, '¿Perdió o le robaron un pasaporte anterior?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 10),
  ('fab6ebe1-0fc0-512f-bcc9-8aa5afa0a6ed', '07c7ec65-ffe4-5479-912b-6646afd0eae3', NULL, 'Contact Person', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 1),
  ('eb06d0d4-eb62-5359-b432-6d64921177e5', '07c7ec65-ffe4-5479-912b-6646afd0eae3', NULL, 'Organization Name', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 2),
  ('6acb4a51-6335-5dc7-9280-188135177807', '07c7ec65-ffe4-5479-912b-6646afd0eae3', NULL, 'Relationship', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 3),
  ('c293bf74-2e5b-53bf-8856-e055e15426b7', '07c7ec65-ffe4-5479-912b-6646afd0eae3', NULL, 'U.S. Address', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 4),
  ('ae207530-0693-518a-afa8-869a009ec206', '07c7ec65-ffe4-5479-912b-6646afd0eae3', NULL, 'Phone Number', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 5),
  ('997124ab-892b-587b-9719-a8c824d6ab59', '07c7ec65-ffe4-5479-912b-6646afd0eae3', NULL, 'Email Address', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('23c8cea1-4227-566c-8aa8-975dedd7f568', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, 'Familiares ya registrados en el expediente', 'texto_largo', '[]'::jsonb, NULL, FALSE, 'persona_familiares', FALSE, NULL, NULL, 1),
  ('768d9d9d-30a9-54bc-aaea-3e829eced180', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, 'Nombre y fecha de nacimiento del padre', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 2),
  ('1d199bd3-6baa-5c06-8d62-3af17aa71875', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, '¿El padre está en Estados Unidos?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 3),
  ('d082fc08-da5a-5158-a89b-2d8ca1209b80', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, 'Nombre y fecha de nacimiento de la madre', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 4),
  ('d35b9a84-50b9-574e-ba7a-8486c641fef7', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, '¿La madre está en Estados Unidos?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 5),
  ('12e81242-93c5-521d-82d7-2ef7d13aa475', '6d15af31-4508-539c-a47c-d99dea25177a', 'familiares_inmediatos_eeuu', '¿Tiene familiares inmediatos en Estados Unidos?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('f66b3fc4-07e1-5755-a9a1-b37adf15e872', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, 'Detalle de familiares inmediatos en EE. UU.', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, '12e81242-93c5-521d-82d7-2ef7d13aa475', 'si', 7),
  ('aaefa452-7a44-58b3-a9e6-b720bc3c1eaf', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, '¿Tiene otros familiares en Estados Unidos?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 8)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 6 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('6669f9c2-3069-58a3-9638-842e71423daf', '6d15af31-4508-539c-a47c-d99dea25177a', NULL, 'Información del cónyuge', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 9),
  ('51d4d0ce-0978-53a5-9eab-b7376bae9657', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Ocupación principal', 'texto_corto', '[]'::jsonb, NULL, FALSE, 'm3_ocupacion_declarada', FALSE, NULL, NULL, 1),
  ('e1b6774b-6e8a-5e61-a1d4-976beec2625c', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Empleador o institución', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 2),
  ('6e49aa8b-cc03-538b-843d-4d37407b1e65', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Domicilio del empleador', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 3),
  ('efe8e6f5-c767-516f-920c-680686b8f75e', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Teléfono del empleador', 'texto_corto', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 4),
  ('566b99c6-fdb9-52bc-a28c-c76bcea3e13a', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Fecha de inicio', 'fecha', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 5),
  ('21e91aa2-98bf-5283-a768-aae8bfa34608', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Ingreso mensual', 'numero', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 6),
  ('5e912c91-4f56-5b7e-ab8b-be06d4bde2e9', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Descripción de funciones', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 7),
  ('42e5f349-e22c-54e1-81ff-d3419cce35e7', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Empleadores anteriores, puestos y fechas', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 8),
  ('bddf1e62-1845-5ed7-9af4-1034218ef7ea', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Instituciones educativas, estudios y fechas', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 9),
  ('70c8f362-479c-5167-84e9-e2120391ec62', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Clubes u organizaciones a las que pertenece', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 10),
  ('44803922-7213-5a66-b184-87150fad4176', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Idiomas que habla', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 11),
  ('fce6228c-a95f-52a4-8818-f7426689140d', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, 'Países visitados en los últimos 5 años', 'texto_largo', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 12),
  ('034ff049-f8b1-5bea-82e3-b8a6aa97a7ff', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, '¿Tiene conocimiento especializado en armas, explosivos, energía nuclear, biológica o química?', 'si_no', '[]'::jsonb, NULL, TRUE, NULL, FALSE, NULL, NULL, 13),
  ('79833bf1-e68f-5ca9-8c69-82162ac650b0', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, '¿Ha prestado servicio militar?', 'si_no', '[]'::jsonb, NULL, FALSE, NULL, FALSE, NULL, NULL, 14)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 7 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('3f51ef88-75aa-5159-a375-cff8e855042e', '1ffc1058-f593-54d9-9f98-73bc41ea8cce', NULL, '¿Ha pertenecido a un grupo paramilitar, de vigilantes, rebelde, guerrillero o insurgente?', 'si_no', '[]'::jsonb, NULL, TRUE, NULL, FALSE, NULL, NULL, 15),
  ('f94bcd78-af8a-52b0-adb8-ecd289683cde', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Do you have a communicable disease of public health significance?', 'si_no', '[]'::jsonb, 'Health', TRUE, NULL, FALSE, NULL, NULL, 1),
  ('9aba664c-1705-5727-9140-e0e0979f5f69', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Do you have a mental or physical disorder that has posed or is likely to pose a threat to the safety or welfare of yourself or others?', 'si_no', '[]'::jsonb, 'Health', TRUE, NULL, FALSE, NULL, NULL, 2),
  ('c03d84be-8029-5690-82ba-a18595b251e3', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Are you or have you ever been a drug abuser or addict?', 'si_no', '[]'::jsonb, 'Health', TRUE, NULL, FALSE, NULL, NULL, 3),
  ('f38c102a-97d3-5dcd-be35-0fbc9299b291', 'a391b0f0-8eee-5682-8911-99f4938bb661', 'arresto_detencion', 'Have you ever been arrested or convicted for any offense or crime, even though subject of a pardon, amnesty, or other similar action?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, 'm3_antecedentes_penales', FALSE, NULL, NULL, 4),
  ('ffc74278-650e-5293-83e4-fcbd5e7f93ed', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever violated, or engaged in a conspiracy to violate, any law relating to controlled substances?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, NULL, FALSE, NULL, NULL, 5),
  ('0233917d-31d1-5f65-80b3-606ef26f4f4a', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Are you coming to the U.S. to engage in prostitution or unlawful commercialized vice, or have you been engaged in prostitution or procuring prostitutes within the past 10 years?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, NULL, FALSE, NULL, NULL, 6),
  ('ac7370ff-9dcd-5c9d-b856-b31a2c4cb550', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever been involved in, or do you seek to engage in, money laundering?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, NULL, FALSE, NULL, NULL, 7),
  ('1193bef9-1b8f-54f1-b8c1-ffb33fd4229f', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever committed or conspired to commit a human trafficking offense in the United States or outside the United States?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, NULL, FALSE, NULL, NULL, 8),
  ('20c96f04-48d7-5fe0-938f-8739b102d65f', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever knowingly aided, abetted, assisted or colluded with an individual who has committed or conspired to commit a severe human trafficking offense?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, NULL, FALSE, NULL, NULL, 9),
  ('db8532af-4614-5e90-8f98-6df64126a4cd', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Are you the spouse, son, or daughter of an individual who has committed or conspired to commit a human trafficking offense and have you within the last five years knowingly benefited from the trafficking activities?', 'si_no', '[]'::jsonb, 'Criminal', TRUE, NULL, FALSE, NULL, NULL, 10),
  ('6a4a7cb6-c6b2-5fc0-af29-db8aa1d2e3b3', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Do you seek to engage in espionage, sabotage, export control violations, or any other illegal activity while in the United States?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 11),
  ('17f6401b-8d23-53ff-a439-ff628a239ed6', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Do you seek to engage in terrorist activities while in the United States or have you ever engaged in terrorist activities?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 12),
  ('7b2d4100-5af8-54f7-a22e-e0d22b82dbc4', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever or do you intend to provide financial assistance or other support to terrorists or terrorist organizations?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 13),
  ('07cc4115-93d5-575a-982c-a6db28cc4c50', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Are you a member or representative of a terrorist organization?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 14)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 8 (15) =====
INSERT INTO ds160_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, categoria_seguridad, requiere_explicacion_si_si, fuente_reutilizacion, fuente_sincronizable, pregunta_condicional_id, valor_condicional, orden) VALUES
  ('d441c3e1-4fb5-5329-99f7-dabb0dd78cd5', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Are you the spouse, son, or daughter of an individual who has engaged in terrorist activity, including providing financial assistance or other support to terrorists, in the last five years?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 15),
  ('52a71282-9200-5b99-ac38-d7d566d70dcd', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever ordered, incited, committed, assisted, or otherwise participated in genocide?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 16),
  ('52c91249-2bb2-5230-b651-310800622e7c', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever committed, ordered, incited, assisted, or otherwise participated in torture?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 17),
  ('ca155177-02be-5822-9148-5a6a624cfcef', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you committed, ordered, incited, assisted, or otherwise participated in extrajudicial killings, political killings, or other acts of violence?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 18),
  ('6d09931e-73e9-5a11-a05a-802526731783', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever engaged in the recruitment or use of child soldiers?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 19),
  ('d7868cfa-af92-5a34-a57c-b230c24c6bba', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you, while serving as a government official, been responsible for or directly carried out, at any time, particularly severe violations of religious freedom?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 20),
  ('db95dd1f-fb8f-5af5-8876-519a37e2fcfe', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever been directly involved in the establishment or enforcement of population controls forcing a woman to undergo an abortion or a man or woman to undergo sterilization?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 21),
  ('eb1ecd7d-e6f1-53cb-9166-1a2c874b169f', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever been directly involved in the coercive transplantation of human organs or bodily tissue?', 'si_no', '[]'::jsonb, 'Security', TRUE, NULL, FALSE, NULL, NULL, 22),
  ('c16a92bb-3113-5340-ad9b-7ca0f1beda90', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever sought to obtain or assist others to obtain a visa, entry into the United States, or any other United States immigration benefit by fraud or willful misrepresentation or other unlawful means?', 'si_no', '[]'::jsonb, 'Immigration Law Violations', TRUE, NULL, FALSE, NULL, NULL, 23),
  ('8cf4b4b1-9a25-57db-ad15-d2bc6da7f52d', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever been removed or deported from any country?', 'si_no', '[]'::jsonb, 'Immigration Law Violations', TRUE, 'm3_deportaciones', FALSE, NULL, NULL, 24),
  ('54787417-d3cb-5e9f-bbb8-fcd355ee521a', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever failed to attend a hearing on removability or inadmissibility within the last five years?', 'si_no', '[]'::jsonb, 'Immigration Law Violations', TRUE, NULL, FALSE, NULL, NULL, 25),
  ('9661ca3a-f85e-5c16-b878-41f6483f0ffb', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever been unlawfully present, overstayed the amount of time granted by an immigration official or otherwise violated the terms of a U.S. visa?', 'si_no', '[]'::jsonb, 'Immigration Law Violations', TRUE, 'm3_permanencia_excedida', FALSE, NULL, NULL, 26),
  ('285dc76b-05c5-51cb-b8c1-84d9c14abbe5', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever withheld custody of a U.S. citizen child outside the United States from a person granted legal custody by a U.S. court?', 'si_no', '[]'::jsonb, 'Miscellaneous', TRUE, NULL, FALSE, NULL, NULL, 27),
  ('9a813cb0-0de1-56b0-884e-7f571061ba01', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you voted in the United States in violation of any law or regulation?', 'si_no', '[]'::jsonb, 'Miscellaneous', TRUE, NULL, FALSE, NULL, NULL, 28),
  ('45785026-fc8e-5047-83f7-5ccb782f3833', 'a391b0f0-8eee-5682-8911-99f4938bb661', NULL, 'Have you ever renounced United States citizenship for the purpose of avoiding taxation?', 'si_no', '[]'::jsonb, 'Miscellaneous', TRUE, NULL, FALSE, NULL, NULL, 29)
ON CONFLICT (id) DO NOTHING;

