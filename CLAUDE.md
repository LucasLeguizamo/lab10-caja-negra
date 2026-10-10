# Lab 10 — La caja negra

Heredamos un servicio de 10 años en producción. Sin código, sin docs, sin autores.
Recibe mensajes y responde. Hay que entenderlo por completo y construir un
reemplazo que se comporte **exactamente igual, incluidos sus errores**.

## Reglas duras (romperlas = descalificación)

1. **Nada de herramientas que hagan el trabajo por nosotros.** Prohibido: inferidores
   automáticos de protocolo, fuzzers de terceros (AFL, boofuzz, Burp scanner, etc.),
   servicios que "aprenden" APIs. Permitido: primitivas (`nc`, `curl`, `tcpdump`,
   `openssl s_client`, `xxd`) y **scripts y fuzzers escritos por nosotros** en `tools/`.
2. **El reemplazo nunca llama al original ni a otro reemplazo.** Ni proxy, ni caché
   de respuestas grabadas, ni fallback. Todo el comportamiento sale de nuestra lógica.
   El verificador de paridad sí habla con ambos; el reemplazo no.
3. **Toda afirmación de la spec cita un experimento** (`EXP-NNN`). Sin evidencia, no entra.

## Entregables (formato exacto: `material/README.md` — leerlo antes de escribir cualquiera)

| Entregable | Dónde vive | Dueño |
|---|---|---|
| Reemplazo desplegado | `replacement/` + URL en `README.md` | implementer |
| Especificación | `spec/` | spec-writer |
| Log de experimentos | `experiments/` | recon-prober, fuzzer |

Si `material/README.md` no existe todavía: pedirlo al usuario, no inventar el formato.

## Flujo

```
recon-prober ──► experiments/ ──► spec-writer ──► spec/
      ▲                                              │
      │                                    system-designer ──► diseño del reemplazo
   fuzzer ◄── huecos ── parity-verifier ◄── implementer ◄──┘
```

1. **recon-prober**: superficie (transporte, framing, handshake, primeros mensajes).
2. **system-designer**: modelo del sistema (estado, máquina de estados, concurrencia,
   tiempos) y arquitectura del reemplazo. Decide stack y despliegue.
3. **fuzzer**: barre el espacio de entradas, sobre todo bordes y errores.
4. **spec-writer**: convierte evidencia en spec.
5. **implementer**: construye el reemplazo solo desde la spec.
6. **parity-verifier**: diferencial original vs reemplazo; cada diferencia es un bug
   o un hueco de la spec → vuelve al paso 3.

## Convenciones

- Experimentos: un archivo por experimento `experiments/EXP-NNN-slug.md`, append-only.
  Nunca se edita un experimento viejo: si estaba mal, uno nuevo lo refuta y lo cita.
- Capturas crudas en `experiments/raw/` (bytes exactos, nunca "limpiados").
- Scripts de sondeo y fuzzers en `tools/`, stdlib primero, sin dependencias salvo necesidad.
- Endpoint del original: variable `ORIGINAL_URL` (o host:puerto) en `.env`, nunca en código del reemplazo.
