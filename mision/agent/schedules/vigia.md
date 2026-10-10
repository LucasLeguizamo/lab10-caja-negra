---
# UTC. Plan Hobby: un cron al día. Arranca a las 09:15 hora local (UTC-5); la sesión hace una pasada por hora
# (sleep durable entre pasadas) hasta las 19:15. Nada después de las 20:00 (lib/modelo.ts: proximaPasadaS).
cron: "15 14 * * *"
---

Turno del vigía de hoy. Sigue tus instrucciones: pasada con `vigia`, misión si hay un cambio real, y luego
`sleep` los segundos de `proximaPasadaSegundos` y otra pasada, hasta que `proximaPasadaSegundos` sea null.
