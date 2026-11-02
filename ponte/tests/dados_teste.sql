-- Dados fictícios
INSERT INTO franquia VALUES (1, 'Multprofissoes de Rio Verde - Popular', 'MULT Profissoes', '26436081000160');
INSERT INTO s_cad_curso VALUES (1, 'HAR', 'Hardware'), (2, 'INF', 'Informática Administrativa');
INSERT INTO s_cad_turma VALUES (1, '001HAR', 'HAR'), (2, '001INF', 'INF');

-- Aluno que é o próprio responsável, 2 matrículas (como no print)
INSERT INTO s_cad_aluno VALUES (13882, NULL, 'EDILSON JOSE DA SILVA LIMA', '111.444.777-35', '111.444.777-35', 'Edilson Jose da Silva Lima',
  '(64) 98888-0002', '(64) 98888-0002', '(64) 98888-0002', '(64) 98888-0002', '', '', 'Ativo', '01/01/1990');
INSERT INTO s_cad_matricula VALUES ('MAT-HAR', '13882', 'HAR', '001HAR', 'Ativo', '05/11/2026'), ('MAT-INF', '13882', 'INF', '001INF', 'Ativo', '05/11/2026');
INSERT INTO s_cad_parcela (COD_PAR, COD_ALU, DAT_LAN, DAT_VEN, DAT_BAI, VLR_PAR, TIP_PAR, TIPO_PAR, NUM_MATRICULA, NUM_BOLETO) VALUES
  (326669, '13882', '2025-10-07', '2026-11-05', NULL, '120,00', 'Boleto', 'PARC', 'MAT-HAR', '1'),
  (326670, '13882', '2025-10-07', '2026-11-05', NULL, '120,00', 'Boleto', 'PARC', 'MAT-INF', '1'),
  (326700, '13882', '2025-10-07', '2026-12-05', NULL, '120,00', 'Boleto', 'PARC', 'MAT-HAR', '2'),
  (326701, '13882', '2025-10-07', '2026-12-05', '', '120,00', 'Boleto', 'PARC', 'MAT-INF', '2');

-- Pai com 3 filhos (CPF do responsável liga os três)
INSERT INTO s_cad_aluno VALUES
  (20001, NULL, 'ANA DA SILVA', '', '111.222.333-44', 'José da Silva', '', '(64) 97777-1001', '', '(64) 99999-0001', '', '', 'Ativo', ''),
  (20002, NULL, 'BRUNO DA SILVA', '', '111.222.333-44', 'José da Silva', '', '(64) 97777-1002', '', '(64) 99999-0001', '', '', 'Ativo', ''),
  (20003, NULL, 'CARLA DA SILVA', '', '11122233344', 'José da Silva', '', '', '', '64999990001', '', '', 'Ativo', '');
INSERT INTO s_cad_matricula VALUES ('MAT-A', '20001', 'INF', '001INF', 'Ativo', ''), ('MAT-B', '20002', 'INF', '001INF', 'Ativo', ''), ('MAT-C', '20003', 'HAR', '001HAR', 'Ativo', '');
INSERT INTO s_cad_parcela (COD_PAR, COD_ALU, DAT_LAN, DAT_VEN, DAT_BAI, VLR_PAR, TIP_PAR, TIPO_PAR, NUM_MATRICULA) VALUES
  (400001, '20001', '2026-01-01', '2026-09-10', NULL, '149,90', 'Boleto', 'PARC', 'MAT-A'),
  (400002, '20002', '2026-01-01', '2026-11-10', NULL, '149,90', 'Boleto', 'PARC', 'MAT-B'),
  (400003, '20003', '2026-01-01', '2026-11-10', NULL, '0.01', 'BOLETO', '', '');

INSERT INTO f_cad_saldo (TIPO, VALOR) VALUES ('C', '1234567.89'), ('G', '98765.43');
INSERT INTO s_cad_carta VALUES (9, 'F', 'Carta 1 - 15 dias - Envio Dia 10 e 30'), (4, 'F', 'Carta 2 - 30 dias - Envio Dia 15');
INSERT INTO s_cad_pres_aluno (COD_ALU, FAL_PRE, DAT_FAL, COD_TUR, COD_MATRICULA_PRES) VALUES
  ('13882', 'S', '2026-10-01', '001HAR', 'MAT-HAR'), ('13882', 'S', '2026-10-08', '001HAR', 'MAT-HAR'),
  ('13882', 'S', '2026-10-15', '001HAR', 'MAT-HAR'), ('13882', 'N', '2026-10-22', '001HAR', 'MAT-HAR'),
  ('13882', 'N', '2026-10-29', '001HAR', 'MAT-HAR');
