# Migración desde CantusDei estático

La versión estática actual sigue funcionando en `outputs/acordia`.

Esta nueva versión fullstack vive en `outputs/cantusdei-fullstack` y usa base de datos.

## Qué se migra

El seed inicial lee estos archivos:

- `outputs/acordia/importaciones/cancionero-ibbn-acordia.json`
- `outputs/acordia/importaciones/cancionero-escuela-biblica-cantusdei.json`

Por cada canción:

1. Crea o actualiza `Songbook`.
2. Crea o actualiza `Song`.
3. Crea o actualiza una `SongVersion` por tono/capo.
4. Lee los acordes entre corchetes.
5. Crea acordes faltantes en `Chord`.
6. Guarda el uso de acordes en `SongVersionChord`.

## Qué falta migrar después

- Datos guardados solo en `localStorage` del navegador.
- Setlists creados manualmente en la versión estática.
- Tutoriales editados localmente.
- Acordes personalizados creados desde la web estática.

Para migrar esos datos, primero hay que exportar un respaldo completo desde la app actual y luego crear un importador backend para ese JSON.
