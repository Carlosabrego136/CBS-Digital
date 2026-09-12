-- db/migracion_007b_seed_cuestionarios.sql
--
-- Plantillas semilla del Módulo 6 (punto 15): B1/B2 completa y FOIA.
-- Ejecutar DESPUÉS de migracion_007_modulo6.sql, en bloques (ver mensaje del chat).

-- ===== Secciones (19) =====
INSERT INTO cuestionario_secciones (id, tipo_tramite_codigo, codigo_letra, nombre, orden) VALUES
  ('ddc7294d-15f7-5007-989a-c4888a9e9397', 'b1_b2', 'A', 'Datos personales', 1),
  ('a961f7e7-0cc3-5020-a311-fcd279758f9f', 'b1_b2', 'B', 'Domicilio e historial de domicilios', 2),
  ('786ebf60-4852-5425-b44b-aae89708fe1e', 'b1_b2', 'C', 'Información familiar', 3),
  ('e1f113d1-e916-5bda-9bec-05a80737b181', 'b1_b2', 'D', 'Empleo, actividad económica y estudios', 4),
  ('49263b72-9a73-5c2d-b443-d92fa4c5aba9', 'b1_b2', 'E', 'Información financiera relevante', 5),
  ('5868cc25-3bc6-5f18-8e78-d28627db64a1', 'b1_b2', 'F', 'Historial de viajes', 6),
  ('7c25efe9-e65e-5a21-b4b1-041990cb78a7', 'b1_b2', 'G', 'Historial migratorio', 7),
  ('2726d692-12c8-56e0-8490-689bb54dd056', 'b1_b2', 'H', 'Visas anteriores', 8),
  ('debb35fc-b43c-5c36-aaef-1468f53a572d', 'b1_b2', 'I', 'Negativas de visa', 9),
  ('8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', 'b1_b2', 'J', 'Cancelaciones o revocaciones', 10),
  ('4fe132bc-3781-5023-92d8-4f5937793f78', 'b1_b2', 'K', 'Deportaciones, remociones, retornos o salidas voluntarias', 11),
  ('c912dd72-8521-54b1-b086-96a85f632a08', 'b1_b2', 'L', 'Presencia ilegal o permanencias superiores a las autorizadas', 12),
  ('d90cef0d-3e0c-51f5-9147-63668157b369', 'b1_b2', 'M', 'Arrestos, procesos o antecedentes penales', 13),
  ('cb441941-4109-5235-a801-16a89b8e8746', 'b1_b2', 'N', 'Peticiones migratorias anteriores', 14),
  ('8e5e338c-0cea-5f81-b977-3eb3a7bc2546', 'b1_b2', 'O', 'Familiares en Estados Unidos', 15),
  ('bada07c9-5b4a-5afb-9bea-2a9b29609242', 'b1_b2', 'P', 'Motivo y características del trámite actual', 16),
  ('827e1750-e273-51ca-a8cb-b29d5253beb4', 'b1_b2', 'Q', 'Información adicional relevante', 17),
  ('9e8611bc-01c5-555b-978d-2a0926acb7d5', 'foia', 'A', 'Identificación del incidente', 1),
  ('c6104331-c55c-5f62-a6fc-c6e166ece42a', 'foia', 'B', 'Identificadores y objetivo de la solicitud', 2)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 1 (18) =====
INSERT INTO cuestionario_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, obligatoria, orden, fuente_reutilizacion, pregunta_condicional_id, valor_condicional) VALUES
  ('d60367c5-a414-5053-b8ba-af43b8424dd0', 'ddc7294d-15f7-5007-989a-c4888a9e9397', NULL, 'Nombre completo', 'texto_corto', '[]'::jsonb, TRUE, 1, 'persona_nombre_completo', NULL, NULL),
  ('3ab122d3-3360-58d2-8b2a-25143ca6e7fb', 'ddc7294d-15f7-5007-989a-c4888a9e9397', NULL, 'Fecha de nacimiento', 'fecha', '[]'::jsonb, TRUE, 2, 'persona_fecha_nacimiento', NULL, NULL),
  ('820731e4-56f3-5b8a-8234-189d9dc3c069', 'ddc7294d-15f7-5007-989a-c4888a9e9397', NULL, 'Nacionalidad actual', 'texto_corto', '[]'::jsonb, TRUE, 3, 'persona_nacionalidad', NULL, NULL),
  ('9bd16cc7-21da-53b1-9065-3ea4f62b9f90', 'ddc7294d-15f7-5007-989a-c4888a9e9397', NULL, 'Estado civil', 'texto_corto', '[]'::jsonb, TRUE, 4, 'persona_estado_civil', NULL, NULL),
  ('9c597742-00a3-5732-9649-49d641031fa6', 'ddc7294d-15f7-5007-989a-c4888a9e9397', NULL, '¿Tiene otros nombres o alias no registrados en el expediente?', 'si_no', '[]'::jsonb, FALSE, 5, NULL, NULL, NULL),
  ('5a406c15-4bd7-576f-b7ae-45bb1a5a5e50', 'a961f7e7-0cc3-5020-a311-fcd279758f9f', NULL, 'Domicilio actual', 'texto_largo', '[]'::jsonb, TRUE, 1, 'persona_domicilio_actual', NULL, NULL),
  ('b0146805-f2ad-5f7f-8b12-878b68221c4e', 'a961f7e7-0cc3-5020-a311-fcd279758f9f', NULL, 'Comprobante de domicilio actualizado', 'documento', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('5835ae9c-a826-5b76-8176-43c047580c6a', '786ebf60-4852-5425-b44b-aae89708fe1e', NULL, 'Familiares ya registrados en el expediente', 'texto_largo', '[]'::jsonb, FALSE, 1, 'persona_familiares', NULL, NULL),
  ('eaa40146-59b2-59a5-bed5-7fb3733d4c23', '786ebf60-4852-5425-b44b-aae89708fe1e', NULL, '¿Tiene hijos dependientes económicos?', 'si_no', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('ec5bee23-e254-5f10-85cc-63149355d1c2', '786ebf60-4852-5425-b44b-aae89708fe1e', NULL, 'Número de hijos dependientes', 'numero', '[]'::jsonb, FALSE, 3, NULL, 'eaa40146-59b2-59a5-bed5-7fb3733d4c23', 'si'),
  ('e09ad21e-d8cf-57c5-9240-7a0355628caf', 'e1f113d1-e916-5bda-9bec-05a80737b181', NULL, 'Ocupación actual', 'texto_corto', '[]'::jsonb, TRUE, 1, NULL, NULL, NULL),
  ('b5f397ea-ca9c-5e18-b158-dfbbbe2a9ec0', 'e1f113d1-e916-5bda-9bec-05a80737b181', NULL, 'Nombre del empleador o negocio', 'texto_corto', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('9b246350-cd03-573c-b8d4-b7364722dcd4', 'e1f113d1-e916-5bda-9bec-05a80737b181', NULL, 'Antigüedad laboral', 'texto_corto', '[]'::jsonb, FALSE, 3, NULL, NULL, NULL),
  ('4f566339-bcac-5dc2-b589-91e4d835cdef', 'e1f113d1-e916-5bda-9bec-05a80737b181', NULL, '¿Es estudiante actualmente?', 'si_no', '[]'::jsonb, FALSE, 4, NULL, NULL, NULL),
  ('3f493c39-c1db-5a32-b152-0f4e81fc8993', 'e1f113d1-e916-5bda-9bec-05a80737b181', NULL, 'Institución educativa', 'texto_corto', '[]'::jsonb, FALSE, 5, NULL, '4f566339-bcac-5dc2-b589-91e4d835cdef', 'si'),
  ('6e12fb8a-d678-53d8-8a3d-11961e6d0dfb', '49263b72-9a73-5c2d-b443-d92fa4c5aba9', NULL, 'Ingreso mensual aproximado', 'moneda', '[]'::jsonb, FALSE, 1, NULL, NULL, NULL),
  ('5b06cb6e-ffd8-5df4-8ad4-9ad624532c24', '49263b72-9a73-5c2d-b443-d92fa4c5aba9', NULL, '¿Cuenta con bienes inmuebles a su nombre?', 'si_no', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('b01102a1-ef3a-5b48-ac5e-7dfd29cbbeb8', '49263b72-9a73-5c2d-b443-d92fa4c5aba9', NULL, '¿Cuenta con solvencia económica comprobable para el viaje?', 'si_no', '[]'::jsonb, TRUE, 3, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 2 (18) =====
INSERT INTO cuestionario_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, obligatoria, orden, fuente_reutilizacion, pregunta_condicional_id, valor_condicional) VALUES
  ('ca5a67a1-9954-5403-839f-883f917ef040', '49263b72-9a73-5c2d-b443-d92fa4c5aba9', NULL, 'Estados de cuenta bancarios', 'documento', '[]'::jsonb, FALSE, 4, NULL, NULL, NULL),
  ('860bdbdd-f257-5021-95cc-12414a88a473', '5868cc25-3bc6-5f18-8e78-d28627db64a1', 'nunca_ha_viajado_eeuu', '¿Ha viajado anteriormente a Estados Unidos?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_entradas_salidas', NULL, NULL),
  ('0a1c2f16-b1b5-550a-ad51-f98813fe8d5a', '5868cc25-3bc6-5f18-8e78-d28627db64a1', NULL, '¿Ha viajado a otros países en los últimos 5 años?', 'si_no', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('3ccc7825-960b-5f85-afe7-358186349395', '5868cc25-3bc6-5f18-8e78-d28627db64a1', NULL, '¿A cuáles países y con qué motivo?', 'texto_largo', '[]'::jsonb, FALSE, 3, NULL, '0a1c2f16-b1b5-550a-ad51-f98813fe8d5a', 'si'),
  ('4a51c54b-05e9-5da7-9502-8bc5a591a214', '7c25efe9-e65e-5a21-b4b1-041990cb78a7', NULL, '¿Tiene actualmente visa estadounidense vigente?', 'si_no', '[]'::jsonb, FALSE, 1, 'm3_perfil_visa_actual', NULL, NULL),
  ('ba55d79f-7371-5fec-b09d-85688e88481e', '7c25efe9-e65e-5a21-b4b1-041990cb78a7', NULL, '¿Tiene algún trámite migratorio pendiente en otro país?', 'si_no', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('c2109482-6e7e-54e4-8b39-08fe10e88ab2', '2726d692-12c8-56e0-8490-689bb54dd056', NULL, '¿Ha tenido otras visas estadounidenses anteriormente?', 'si_no', '[]'::jsonb, FALSE, 1, 'm3_visas_anteriores', NULL, NULL),
  ('fd2e52f1-6183-524d-999e-54dfea1c7129', 'debb35fc-b43c-5c36-aaef-1468f53a572d', 'nunca_le_han_negado_visa', '¿Alguna vez le han negado una visa estadounidense?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_negativas', NULL, NULL),
  ('11a865c6-ce45-5e5a-b571-41f220e2c8d9', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Tipo de visa solicitada', 'texto_corto', '[]'::jsonb, FALSE, 2, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('bd464656-5e90-5480-883e-c2f2e305f703', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Fecha aproximada', 'fecha', '[]'::jsonb, FALSE, 3, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('5afb3b2c-32b8-5573-bde3-9908dcaa388f', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Consulado', 'texto_corto', '[]'::jsonb, FALSE, 4, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('187405d4-1b64-574a-a5d4-44c870033e7d', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Motivo conocido', 'texto_largo', '[]'::jsonb, FALSE, 5, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('ddf1371f-8307-50e2-a5eb-39b1712a6386', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Sección legal indicada, si aparece en el documento', 'texto_corto', '[]'::jsonb, FALSE, 6, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('9b024cc7-7c9c-5441-8f73-70b6e5f5529f', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Número de negativas', 'numero', '[]'::jsonb, FALSE, 7, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('3d600452-83df-5bbf-9092-c2d429b2160a', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, '¿Volvió a solicitar después?', 'si_no', '[]'::jsonb, FALSE, 8, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('db7be43b-1e15-541b-9e48-003d215e0b50', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Resultado', 'texto_corto', '[]'::jsonb, FALSE, 9, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('50348414-818b-535b-8d00-ad73a7d1630e', 'debb35fc-b43c-5c36-aaef-1468f53a572d', NULL, 'Adjuntar documento de negativa', 'documento', '[]'::jsonb, FALSE, 10, NULL, 'fd2e52f1-6183-524d-999e-54dfea1c7129', 'si'),
  ('9a70cc40-b1cd-5f5c-bb29-12ac203241dd', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', 'visa_cancelada', '¿Alguna vez le cancelaron o revocaron una visa?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_cancelaciones', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 3 (18) =====
INSERT INTO cuestionario_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, obligatoria, orden, fuente_reutilizacion, pregunta_condicional_id, valor_condicional) VALUES
  ('9161a015-f6f3-5cea-8636-517b3a94af5e', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, 'Fecha', 'fecha', '[]'::jsonb, FALSE, 2, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('feea44cc-d2ad-5e92-af9b-f98ce9992acd', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, 'Lugar', 'texto_corto', '[]'::jsonb, FALSE, 3, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('f375e8a0-79f8-5a88-9c2e-5f4f4c4ad17d', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, 'Puerto de entrada o consulado', 'texto_corto', '[]'::jsonb, FALSE, 4, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('77a9e9d9-0f02-59bd-947c-af5ceaa6cde5', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, '¿Qué ocurrió?', 'texto_largo', '[]'::jsonb, FALSE, 5, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('4eb0cff0-20d9-5407-9064-336ae8dc053a', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, '¿Qué le manifestó el oficial?', 'texto_largo', '[]'::jsonb, FALSE, 6, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('ece8f221-0215-55f0-b491-4027f6b8f5e0', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, '¿Firmó documentos?', 'si_no', '[]'::jsonb, FALSE, 7, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('4b894cfe-8615-5f77-ba05-3dfcb30f5240', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, '¿Fue retornado o removido?', 'si_no', '[]'::jsonb, FALSE, 8, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('116eb15f-59aa-59a9-9624-ff15c56f7296', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, '¿Recibió algún documento?', 'si_no', '[]'::jsonb, FALSE, 9, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('af087201-ade1-5069-802f-825b75d23d27', '8a81c3a0-6a61-5f67-8d47-2fe82fdf0014', NULL, 'Adjuntar documento', 'documento', '[]'::jsonb, FALSE, 10, NULL, '9a70cc40-b1cd-5f5c-bb29-12ac203241dd', 'si'),
  ('fde16c72-5002-50d6-a486-250102d6d6ce', '4fe132bc-3781-5023-92d8-4f5937793f78', 'remocion_expulsion', '¿Alguna vez fue deportado, removido o salió de forma voluntaria bajo procedimiento migratorio?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_deportaciones', NULL, NULL),
  ('083f7e41-21a6-5c3a-a97d-ebdae2241c77', '4fe132bc-3781-5023-92d8-4f5937793f78', NULL, 'Tipo', 'texto_corto', '[]'::jsonb, FALSE, 2, NULL, 'fde16c72-5002-50d6-a486-250102d6d6ce', 'si'),
  ('45ec4cca-a1cc-50da-be12-f73a3747f250', '4fe132bc-3781-5023-92d8-4f5937793f78', NULL, 'Fecha', 'fecha', '[]'::jsonb, FALSE, 3, NULL, 'fde16c72-5002-50d6-a486-250102d6d6ce', 'si'),
  ('672d0971-0026-5729-a830-79b07d380bbf', '4fe132bc-3781-5023-92d8-4f5937793f78', NULL, 'Lugar', 'texto_corto', '[]'::jsonb, FALSE, 4, NULL, 'fde16c72-5002-50d6-a486-250102d6d6ce', 'si'),
  ('3c61ba47-b48c-50b2-9f22-a2390facaf89', '4fe132bc-3781-5023-92d8-4f5937793f78', NULL, 'Autoridad', 'texto_corto', '[]'::jsonb, FALSE, 5, NULL, 'fde16c72-5002-50d6-a486-250102d6d6ce', 'si'),
  ('f044eedc-c9ad-54c5-b2fa-824cdd2cf121', '4fe132bc-3781-5023-92d8-4f5937793f78', 'reingreso_tras_remocion', '¿Ha reingresado a Estados Unidos después de esto?', 'si_no', '[]'::jsonb, FALSE, 6, NULL, 'fde16c72-5002-50d6-a486-250102d6d6ce', 'si'),
  ('86d78023-6903-5c63-964d-00468fde2172', '4fe132bc-3781-5023-92d8-4f5937793f78', NULL, 'Adjuntar documento', 'documento', '[]'::jsonb, FALSE, 7, NULL, 'fde16c72-5002-50d6-a486-250102d6d6ce', 'si'),
  ('8d8310bd-17bb-5dca-a881-5a0a41f8afdc', 'c912dd72-8521-54b1-b086-96a85f632a08', 'permanencia_excedida', '¿Alguna vez permaneció en Estados Unidos después del tiempo autorizado?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_perfil_permanencia_excedida', NULL, NULL),
  ('2f12545d-db19-5582-9ac1-7d44840fa7c8', 'c912dd72-8521-54b1-b086-96a85f632a08', NULL, 'Fecha de entrada', 'fecha', '[]'::jsonb, FALSE, 2, NULL, '8d8310bd-17bb-5dca-a881-5a0a41f8afdc', 'si')
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 4 (18) =====
INSERT INTO cuestionario_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, obligatoria, orden, fuente_reutilizacion, pregunta_condicional_id, valor_condicional) VALUES
  ('4d89d768-4b59-5dc0-b98f-86545b51597e', 'c912dd72-8521-54b1-b086-96a85f632a08', NULL, 'Fecha hasta la cual estaba autorizado', 'fecha', '[]'::jsonb, FALSE, 3, NULL, '8d8310bd-17bb-5dca-a881-5a0a41f8afdc', 'si'),
  ('9f4311c1-abf8-529c-b16e-321cb8bc7df1', 'c912dd72-8521-54b1-b086-96a85f632a08', NULL, 'Fecha real de salida', 'fecha', '[]'::jsonb, FALSE, 4, NULL, '8d8310bd-17bb-5dca-a881-5a0a41f8afdc', 'si'),
  ('d50837cc-406c-5570-bbbc-c8954beec9bb', 'c912dd72-8521-54b1-b086-96a85f632a08', NULL, 'Explicación', 'texto_largo', '[]'::jsonb, FALSE, 5, NULL, '8d8310bd-17bb-5dca-a881-5a0a41f8afdc', 'si'),
  ('a845726f-ca03-5d1b-8c9e-a3f8fe3f3842', 'd90cef0d-3e0c-51f5-9147-63668157b369', 'arresto_antecedente', '¿Alguna vez ha sido arrestado, detenido o tuvo algún procedimiento penal?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_antecedentes_penales', NULL, NULL),
  ('f9574ef4-3a50-577c-902b-d3b80a1c768b', 'd90cef0d-3e0c-51f5-9147-63668157b369', NULL, 'País', 'texto_corto', '[]'::jsonb, FALSE, 2, NULL, 'a845726f-ca03-5d1b-8c9e-a3f8fe3f3842', 'si'),
  ('ec9c6329-ad86-5943-81e7-758bfed8feae', 'd90cef0d-3e0c-51f5-9147-63668157b369', NULL, 'Fecha', 'fecha', '[]'::jsonb, FALSE, 3, NULL, 'a845726f-ca03-5d1b-8c9e-a3f8fe3f3842', 'si'),
  ('c3bb0d24-e49e-580b-b8c7-96c0ac062bd1', 'd90cef0d-3e0c-51f5-9147-63668157b369', NULL, 'Delito o cargo', 'texto_corto', '[]'::jsonb, FALSE, 4, NULL, 'a845726f-ca03-5d1b-8c9e-a3f8fe3f3842', 'si'),
  ('b7bc897c-7aa0-5858-81f7-19f3db71f3bc', 'd90cef0d-3e0c-51f5-9147-63668157b369', 'condena', '¿Fue condenado?', 'si_no', '[]'::jsonb, FALSE, 5, NULL, 'a845726f-ca03-5d1b-8c9e-a3f8fe3f3842', 'si'),
  ('46f9895b-8087-54a4-a26b-9410d28cbd2c', 'd90cef0d-3e0c-51f5-9147-63668157b369', NULL, 'Adjuntar documentos (arresto, sentencia, disposición)', 'documento', '[]'::jsonb, FALSE, 6, NULL, 'a845726f-ca03-5d1b-8c9e-a3f8fe3f3842', 'si'),
  ('ba95393e-7925-5ea2-aa66-ace28d320ed1', 'cb441941-4109-5235-a801-16a89b8e8746', 'peticion_previa', '¿Alguien ha presentado anteriormente una petición migratoria a su favor?', 'si_no', '[]'::jsonb, TRUE, 1, 'm3_peticiones', NULL, NULL),
  ('eb595f50-2e01-5dc7-b7e4-abe586b537a0', 'cb441941-4109-5235-a801-16a89b8e8746', NULL, 'Tipo de petición', 'texto_corto', '[]'::jsonb, FALSE, 2, NULL, 'ba95393e-7925-5ea2-aa66-ace28d320ed1', 'si'),
  ('4e538b31-549d-59ff-a4fc-bc7bf84587ea', 'cb441941-4109-5235-a801-16a89b8e8746', NULL, 'Peticionario', 'texto_corto', '[]'::jsonb, FALSE, 3, NULL, 'ba95393e-7925-5ea2-aa66-ace28d320ed1', 'si'),
  ('d776b701-cf97-5661-adeb-222cd0d99656', 'cb441941-4109-5235-a801-16a89b8e8746', NULL, 'Resultado', 'texto_corto', '[]'::jsonb, FALSE, 4, NULL, 'ba95393e-7925-5ea2-aa66-ace28d320ed1', 'si'),
  ('eb7699c1-986d-5853-afdb-578c0046c6f2', '8e5e338c-0cea-5f81-b977-3eb3a7bc2546', NULL, '¿Tiene familiares viviendo en Estados Unidos?', 'si_no', '[]'::jsonb, FALSE, 1, NULL, NULL, NULL),
  ('5ae2b119-3a61-5956-b382-3478beb4f879', '8e5e338c-0cea-5f81-b977-3eb3a7bc2546', NULL, 'Relación y estatus migratorio del familiar', 'texto_largo', '[]'::jsonb, FALSE, 2, NULL, 'eb7699c1-986d-5853-afdb-578c0046c6f2', 'si'),
  ('2bda6ddf-2bac-5b83-a244-68298c86f609', 'bada07c9-5b4a-5afb-9bea-2a9b29609242', NULL, 'Motivo del viaje', 'seleccion_unica', '[{"value": "turismo", "label": "Turismo"}, {"value": "negocios", "label": "Negocios"}, {"value": "visita_familiar", "label": "Visita familiar"}, {"value": "medico", "label": "Tratamiento médico"}, {"value": "otro", "label": "Otro"}]'::jsonb, TRUE, 1, NULL, NULL, NULL),
  ('a5813b10-9f44-5fac-9ee2-1a282ab2474d', 'bada07c9-5b4a-5afb-9bea-2a9b29609242', NULL, 'Duración estimada de la estancia', 'texto_corto', '[]'::jsonb, TRUE, 2, NULL, NULL, NULL),
  ('1b0b716f-e05f-5ad1-8a32-7e604de5784d', 'bada07c9-5b4a-5afb-9bea-2a9b29609242', NULL, '¿Quién paga el viaje?', 'seleccion_unica', '[{"value": "solicitante", "label": "El solicitante"}, {"value": "familiar", "label": "Un familiar"}, {"value": "empresa", "label": "La empresa"}, {"value": "otro", "label": "Otro"}]'::jsonb, TRUE, 3, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ===== Preguntas parte 5 (16) =====
INSERT INTO cuestionario_preguntas (id, seccion_id, codigo, texto, tipo_respuesta, opciones, obligatoria, orden, fuente_reutilizacion, pregunta_condicional_id, valor_condicional) VALUES
  ('2a3ab994-9fdf-5863-98b3-91c64f8a458c', 'bada07c9-5b4a-5afb-9bea-2a9b29609242', NULL, 'Destino principal', 'texto_corto', '[]'::jsonb, TRUE, 4, NULL, NULL, NULL),
  ('affcb517-40c0-53e2-862f-a8f6484b0a37', 'bada07c9-5b4a-5afb-9bea-2a9b29609242', NULL, '¿Viaja acompañado?', 'si_no', '[]'::jsonb, FALSE, 5, NULL, NULL, NULL),
  ('f3382dee-cee9-59d7-88f3-29a2cea873d0', 'bada07c9-5b4a-5afb-9bea-2a9b29609242', NULL, '¿Con quién viaja?', 'texto_corto', '[]'::jsonb, FALSE, 6, NULL, 'affcb517-40c0-53e2-862f-a8f6484b0a37', 'si'),
  ('28e48b8a-158a-562f-adc5-0107fe8b921b', '827e1750-e273-51ca-a8cb-b29d5253beb4', NULL, 'Observaciones adicionales del solicitante', 'texto_largo', '[]'::jsonb, FALSE, 1, NULL, NULL, NULL),
  ('3965a872-4d24-5510-9136-10fc672d1790', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, 'Agencia o agencias involucradas', 'seleccion_multiple', '[{"value": "cbp", "label": "CBP"}, {"value": "uscis", "label": "USCIS"}, {"value": "ice", "label": "ICE"}, {"value": "eoir", "label": "EOIR"}, {"value": "dos", "label": "Department of State"}, {"value": "fbi", "label": "FBI"}, {"value": "obim", "label": "OBIM"}, {"value": "otra", "label": "Otra"}]'::jsonb, TRUE, 1, NULL, NULL, NULL),
  ('dff697d7-cc34-5764-8cc7-7d9679dca06d', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, 'Tipo de incidente', 'texto_corto', '[]'::jsonb, TRUE, 2, NULL, NULL, NULL),
  ('6f0d3c65-4560-59e8-ae49-892458f309ba', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, 'Fecha aproximada', 'fecha', '[]'::jsonb, FALSE, 3, NULL, NULL, NULL),
  ('6f628ba0-3d1e-5168-b366-091b5c44fe25', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, 'Lugar', 'texto_corto', '[]'::jsonb, FALSE, 4, NULL, NULL, NULL),
  ('6e99a99c-a82b-5331-91eb-acf342d0cef6', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, 'Puerto de entrada', 'texto_corto', '[]'::jsonb, FALSE, 5, NULL, NULL, NULL),
  ('8b39a040-1d33-5537-b751-ebfe9fa8f69b', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, '¿Hubo detención o inspección secundaria?', 'si_no', '[]'::jsonb, FALSE, 6, NULL, NULL, NULL),
  ('4bc3d5d1-d5e9-5466-afab-bcaf5fd38430', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, '¿Le tomaron huellas o fotografías (si lo recuerda)?', 'si_no', '[]'::jsonb, FALSE, 7, NULL, NULL, NULL),
  ('4a2866fa-8a7f-5b97-aba7-91c78bd2051e', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, '¿Recibió algún documento en ese momento?', 'si_no', '[]'::jsonb, FALSE, 8, NULL, NULL, NULL),
  ('e0d480f8-36ae-56b0-b0e5-6c81525cc736', '9e8611bc-01c5-555b-978d-2a0926acb7d5', NULL, 'Adjuntar documento recibido', 'documento', '[]'::jsonb, FALSE, 9, NULL, '4a2866fa-8a7f-5b97-aba7-91c78bd2051e', 'si'),
  ('f90704b8-282c-5ab4-b491-ec31b6e1377c', 'c6104331-c55c-5f62-a6fc-c6e166ece42a', NULL, 'Número A, si existe', 'texto_corto', '[]'::jsonb, FALSE, 1, NULL, NULL, NULL),
  ('5b629c5c-63ed-5118-bd2f-a3d57af2c3e1', 'c6104331-c55c-5f62-a6fc-c6e166ece42a', NULL, 'Otros identificadores disponibles', 'texto_largo', '[]'::jsonb, FALSE, 2, NULL, NULL, NULL),
  ('acf238a2-098e-57b7-96ca-9dcbf51c9367', 'c6104331-c55c-5f62-a6fc-c6e166ece42a', NULL, '¿Qué información o documentos se pretende obtener?', 'texto_largo', '[]'::jsonb, TRUE, 3, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

