// Misión saldo-decimal-e506: (1) `saldo` de CONSULTA se serializa como string decimal con 2 decimales
// (= centavos/100, sin separador de miles, nunca "-0.00") y (2) TRANSFER gana un tope E506 por operación:
// monto > 50000 con titulares de nombre distinto → 422. Cada valor esperado está copiado del log (ids citados);
// cada test arranca de /__reset con seq([...]) y compara status y cuerpo igual que el evaluador.
import { test } from "e2e";

import { err, firmar, igual, msg, reset, seq } from "./caja";

const SALDO_INSUFICIENTE = err("E507", "saldo insuficiente");
// 422, mensaje acentuado, sin campos extra (ids 795, 839, 1129, 1471, 1493, 1494, 1557).
const LIMITE_EXCEDIDO = err("E506", "límite excedido");
// Éxito: status (string) + operacionId (string); el log dice "recieved" (ids 838, 1490, 1491, 1556, 1565).
const ok = (operacionId: string) => ({ status: "recieved", operacionId });
const alta = (cuentaId: string) => ({ cuentaId });
const cuenta = (cuenta_id: string, saldo: string) => ({ cuenta_id, saldo });
// E510 añade `intentos` entero (ids 842, 843, 1353).
const bloqueada = (intentos: number) => err("E510", "cuenta bloqueada", { intentos });

test("CONSULTA: saldo es string decimal con 2 decimales (centavos/100) y la aritmética usa el monto 1:1 (ids 1489, 1539, 1540, 1542, 1543, 1544, 1545, 1546, 1547)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")],
    ["ALTA;Beto;11", 201, alta("AC-0002")],
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "0.00")], // 1489: 0 centavos
    ["DEPOSITO;AC-0001;12345;96", 200, ok("OP-0001")], // 1539
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "123.45")], // 1540: 12345 centavos
    ["DEPOSITO;AC-0002;7;77", 200, ok("OP-0002")], // 1541
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "0.07")], // 1542: 7 centavos
    ["TRANSFER;AC-0001;AC-0002;99;37", 200, ok("OP-0003")], // 1543
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "122.46")], // 1544: 12345-99
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "1.06")], // 1545: 99+7
    ["DEPOSITO;AC-0002;100;89", 200, ok("OP-0004")], // 1546
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "2.06")], // 1547: 106+100
  ]);
});

test("CONSULTA: 5.00, 100.00, 400.00 y 407.00, sin separador de miles ni ruido de float (ids 1107, 1084, 816, 827, 1503)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")],
    ["ALTA;Beto;11", 201, alta("AC-0002")],
    [firmar("DEPOSITO;AC-0001;500"), 200, ok("OP-0001")], // 1107: 500 centavos
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "5.00")], // 1107
    [firmar("DEPOSITO;AC-0001;9500"), 200, ok("OP-0002")],
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "100.00")], // 1084: 10000 centavos
    [firmar("DEPOSITO;AC-0002;40000"), 200, ok("OP-0003")],
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "400.00")], // 816, 1492
    [firmar("DEPOSITO;AC-0002;700"), 200, ok("OP-0004")],
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "407.00")], // 827, 1503: 40700 centavos
  ]);
});

test("saldo grande sin separador de miles: 9999999999→\"99999999.99\", +100→\"100000000.99\", 210000→\"2100.00\" (ids 832, 833, 862, 863, 864, 868, 869, 819, 1495)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 860
    ["ALTA;Beto;11", 201, alta("AC-0002")], // 861
    ["DEPOSITO;AC-0001;9999999999;4", 200, ok("OP-0001")], // 832, 862
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "99999999.99")], // 833
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, LIMITE_EXCEDIDO], // 863: no mueve saldo
    ["TRANSFER;AC-0001;AC-0002;60000;32", 422, LIMITE_EXCEDIDO], // 864
    ["DEPOSITO;AC-0001;100;82", 200, ok("OP-0002")], // 868
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "100000000.99")], // 869: 9999999999+100
    [firmar("DEPOSITO;AC-0002;210000"), 200, ok("OP-0003")],
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "2100.00")], // 819, 1495
  ]);
});

test("saldo negativo: -1 centavo → \"-0.01\" y 0 → \"0.00\", nunca \"-0.00\" (ids 1418-1427)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 1419
    ["ALTA;Beto;11", 201, alta("AC-0002")], // 1420
    ["DEPOSITO;AC-0001;1;28", 200, ok("OP-0001")], // 1421
    ["TRANSFER;AC-0001;AC-0002;1;41", 200, ok("OP-0002")], // 1422
    ["ANULA;OP-0001;72", 200, { ok: true, anulada: "OP-0001" }], // 1423
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "-0.01")], // 1424
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "0.01")], // 1425
    ["DEPOSITO;AC-0001;1;28", 200, ok("OP-0003")], // 1426
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "0.00")], // 1427: no "-0.00"
  ]);
});

test("saldo negativo de dos cifras: -990 centavos → \"-9.90\" (id 1204; mismo montaje que 1418-1423)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")],
    ["ALTA;Beto;11", 201, alta("AC-0002")],
    [firmar("DEPOSITO;AC-0001;990"), 200, ok("OP-0001")],
    [firmar("TRANSFER;AC-0001;AC-0002;990"), 200, ok("OP-0002")],
    ["ANULA;OP-0001;72", 200, { ok: true, anulada: "OP-0001" }], // 1180, 1423
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "-9.90")], // 1204
  ]);
});

test("TRANSFER: 50000 pasa; 50001, 99999 y 75000 dan 422 E506; E506 comparte contador con E507 y no consume OP ids (ids 834-846)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 835
    ["ALTA;Beto;11", 201, alta("AC-0002")], // 836
    ["DEPOSITO;AC-0001;9999999999;4", 200, ok("OP-0001")], // 837
    ["TRANSFER;AC-0001;AC-0002;50000;59", 200, ok("OP-0002")], // 838: 50000 inclusive PASA
    ["TRANSFER;AC-0001;AC-0002;50001;56", 422, LIMITE_EXCEDIDO], // 839
    ["TRANSFER;AC-0001;AC-0002;99999;24", 422, LIMITE_EXCEDIDO], // 840
    ["TRANSFER;AC-0001;AC-0002;75000;40", 422, LIMITE_EXCEDIDO], // 841
    ["TRANSFER;AC-0001;AC-0002;60000;32", 423, bloqueada(1)], // 842: 4º fallo del origen
    ["TRANSFER;AC-0001;AC-0002;45000;24", 423, bloqueada(2)], // 843: ya bloqueada, E510 sin mirar E506
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "500.00")], // 844: solo el TRANSFER de 50000 movió saldo
    ["DEPOSITO;AC-0002;1;95", 200, ok("OP-0003")], // 845: los rechazos no consumen operacionId
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "500.01")], // 846
  ]);
});

test("E506 gana a E507 con saldo insuficiente y comparte su contador: 3 rechazos → 423 E510 intentos 1 (ids 1347-1353)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 1348
    ["ALTA;Beto;11", 201, alta("AC-0002")], // 1349
    // saldo 0 en AC-0001: con monto > 50000 el error es E506, no E507.
    ["TRANSFER;AC-0001;AC-0002;50001;56", 422, LIMITE_EXCEDIDO], // 1350
    ["TRANSFER;AC-0001;AC-0002;100;24", 422, SALDO_INSUFICIENTE], // 1351
    ["TRANSFER;AC-0001;AC-0002;50001;56", 422, LIMITE_EXCEDIDO], // 1352
    ["TRANSFER;AC-0001;AC-0002;100;24", 423, bloqueada(1)], // 1353
  ]);
});

test("el tope E506 es por operación, no acumulado: dos TRANSFER de 30000 dan 200 y 200 (ids 1561-1568)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 1562
    ["ALTA;Beto;11", 201, alta("AC-0002")], // 1563
    ["DEPOSITO;AC-0001;9999999999;4", 200, ok("OP-0001")], // 1564
    ["TRANSFER;AC-0001;AC-0002;30000;16", 200, ok("OP-0002")], // 1565
    ["TRANSFER;AC-0001;AC-0002;30000;16", 200, ok("OP-0003")], // 1566: suma 60000, pero cada una ≤ 50000
    ["CONSULTA;AC-0001;14", 200, cuenta("AC-0001", "99999399.99")], // 1567
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "600.00")], // 1568
  ]);
});

test("E506 exento solo si el nombre del titular es EXACTO en origen y destino: 'ANA', 'Ana ' y otro nombre fallan (ids 1381-1391)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 1382
    ["ALTA;Ana;50", 201, alta("AC-0002")], // 1383
    ["ALTA;ANA;50", 201, alta("AC-0003")], // 1384
    ["ALTA;Ana ;50", 201, alta("AC-0004")], // 1385: nombre con espacio final
    ["ALTA;Bob;24", 201, alta("AC-0005")], // 1386
    ["DEPOSITO;AC-0001;9999999999;4", 200, ok("OP-0001")], // 1387
    ["TRANSFER;AC-0001;AC-0002;50001;56", 200, ok("OP-0002")], // 1388: "Ana" = "Ana"
    ["TRANSFER;AC-0001;AC-0003;50001;77", 422, LIMITE_EXCEDIDO], // 1389: "Ana" ≠ "ANA"
    ["TRANSFER;AC-0001;AC-0004;50001;98", 422, LIMITE_EXCEDIDO], // 1390: "Ana" ≠ "Ana "
    ["TRANSFER;AC-0001;AC-0005;50001;22", 422, LIMITE_EXCEDIDO], // 1391: "Ana" ≠ "Bob"
  ]);
});

test("E506 no aplica a DEPOSITO: 9999999999, 250000 y 700 dan 200 (ids 832, 1490, 1502)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")],
    ["ALTA;Beto;11", 201, alta("AC-0002")],
    ["DEPOSITO;AC-0001;9999999999;4", 200, ok("OP-0001")], // 832
    [firmar("DEPOSITO;AC-0002;250000"), 200, ok("OP-0002")], // 1490 (allí sobre AC-0001)
    ["DEPOSITO;AC-0002;700;35", 200, ok("OP-0003")], // 1502
  ]);
});

test("precedencia: E202 > E302 > E303 > E304 > E401 > E506 > E507, y 50000 es el límite (ids 1548-1560)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")], // 1549
    ["ALTA;Beto;11", 201, alta("AC-0002")], // 1550
    ["DEPOSITO;AC-0001;9999999999;4", 200, ok("OP-0001")], // 1551
    ["TRANSFER;AC-0001;AC-0001;60000;11", 400, err("E304", "origen y destino iguales")], // 1552: E304 antes que E506
    ["TRANSFER;AC-0009;AC-0002;60000;9", 404, err("E401", "cuenta inexistente")], // 1553: E401 antes que E506
    ["TRANSFER;AC-0001;AC-0002;10000000000;21", 400, err("E303", "monto inválido")], // 1554: 11 dígitos
    ["TRANSFER;AC-0001;AC-0002;500.5;50", 400, err("E303", "monto inválido")], // 1555
    ["TRANSFER;AC-0001;AC-0002;50000;59", 200, ok("OP-0002")], // 1556
    ["TRANSFER;AC-0001;AC-0002;50001;56", 422, LIMITE_EXCEDIDO], // 1557
    ["TRANSFER;AC-0001;83", 400, err("E302", "aridad inválida")], // 1558: 1 arg
    ["TRANSFER;AC-0001;AC-0002;50000;100;83", 400, err("E302", "aridad inválida")], // 1559: 4 args
    // El control se calcula sin el último segmento: "TRANSFER;AC-0001;AC-0002;50000" → 59; 58 es inválido.
    ["TRANSFER;AC-0001;AC-0002;50000;58", 400, err("E202", "control inválido")], // 1560: E202 antes que E506
  ]);
});

test("éxito de TRANSFER sin cambios y el rechazado E506 no consume operacionId ni mueve saldo (ids 1490-1494, 1502, 1503, 838, 1556, 1565, 1566)", async () => {
  await seq([
    ["ALTA;Ana;50", 201, alta("AC-0001")],
    ["ALTA;Beto;11", 201, alta("AC-0002")],
    ["DEPOSITO;AC-0001;250000;86", 200, ok("OP-0001")], // 1490
    ["TRANSFER;AC-0001;AC-0002;40000;86", 200, ok("OP-0002")], // 1491
    ["TRANSFER;AC-0001;AC-0002;120000;55", 422, LIMITE_EXCEDIDO], // 1493
    ["TRANSFER;AC-0001;AC-0002;100000;12", 422, LIMITE_EXCEDIDO], // 1494
    ["DEPOSITO;AC-0002;700;35", 200, ok("OP-0003")], // 1502: los E506 no crearon OP-0003/OP-0004
    ["CONSULTA;AC-0002;11", 200, cuenta("AC-0002", "407.00")], // 1503: 40000+700
  ]);
});

// INFERIDO/desconocido del informe: no se testea como hecho.
test(
  "DESCONOCIDO: normalización de la exención E506, montos con formatos raros y cap de DEPOSITO",
  { skip: "sin evidencia: solo se probó igualdad EXACTA de string en la exención; '+100', '0100', '1e3' y el cap de DEPOSITO no se sondearon" },
  async () => {
    await reset();
    igual(await msg("PING;64"), 200, { pong: true });
  },
);
