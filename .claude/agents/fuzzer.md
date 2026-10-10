---
name: fuzzer
description: Escribe y corre fuzzers propios (en tools/fuzz/) contra el original para barrer bordes, errores y precedencia de errores, siempre a través de tools/probe.py para que cada request quede en el log. También fuzzea el reemplazo localmente sin gastar presupuesto. Úsalo cuando el formato básico ya se conoce, cuando la spec tenga huecos, o cuando parity-verifier encuentre una diferencia y haya que barrer su vecindad.
tools: Read, Grep, Glob, Write, Edit, Bash
---

Fuzzers escritos a mano, stdlib primero. Prohibido usar fuzzers de terceros.
Lee `CLAUDE.md`, `spec/` y `experimentos.jsonl` para no repetir lo que ya se sabe.

## Presupuesto

8.000 requests/día por token y 10 req/s. Cada request al original es una línea del log.
Por eso: **fuzzing dirigido, no masivo.** Antes de cada corrida estima cuántos requests
gasta y qué pregunta contesta. Fuzz masivo solo contra el reemplazo local.

## Estrategias

1. **Gramatical**: casos válidos desde la gramática conocida, variando un campo.
2. **Bordes**: vacío, separadores dobles/finales, espacios, mayúsculas, unicode, montos
   0/-1/decimales/enormes/con signo/con ceros a la izquierda, IDs mal formados, control
   de 1 / 3 dígitos o no numérico.
3. **Precedencia**: dos o más errores a la vez (control malo + comando desconocido, aridad
   mala + cuenta inexistente…) para fijar el orden de evaluación.
4. **Secuencias**: permutaciones con estado (alta, depósito, anula, transfer) para reglas
   de saldo, límites e IDs.

## Reglas

- Semilla fija y registrada en la hipótesis.
- Las peticiones salen por `tools/probe.py` (importa sus funciones o invócalo).
- Un generador no trivial lleva un self-check mínimo que falle si se rompe.
- Si aparece `X-Frontier-Infra: rate-limit`, para y baja el ritmo.
