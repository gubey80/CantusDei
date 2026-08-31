# Paso a paso para instalar el backend de CantusDei

Esta guía instala solamente el backend de CantusDei: API Express + Prisma + base de datos PostgreSQL.

## 1. Requisitos

Necesitás tener instalado:

- Node.js
- npm
- PostgreSQL

Para verificar Node y npm:

```bash
node --version
npm --version
```

## 2. Ubicar la carpeta del backend

Abrir una terminal en:

```bash
C:\Users\Gabriel Kardasz\Documents\Codex\2026-06-08\nuevo-proyecto-una-web-de-acordes\outputs\cantusdei-fullstack\backend
```

O entrar con:

```bash
cd "C:\Users\Gabriel Kardasz\Documents\Codex\2026-06-08\nuevo-proyecto-una-web-de-acordes\outputs\cantusdei-fullstack\backend"
```

## 3. Crear la base de datos

En PostgreSQL crear una base llamada:

```text
cantusdei
```

Si usás pgAdmin:

1. Abrir pgAdmin.
2. Entrar al servidor PostgreSQL.
3. Click derecho en **Databases**.
4. Crear nueva base.
5. Nombre: `cantusdei`.

## 4. Configurar conexión

En la carpeta `backend` existe este archivo:

```text
.env
```

Debe tener algo así:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cantusdei?schema=public"
PORT=4100
```

Si tu usuario o contraseña de PostgreSQL son distintos, cambiar esta parte:

```text
postgres:postgres
```

Formato:

```text
usuario:contraseña
```

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:MiClave123@localhost:5432/cantusdei?schema=public"
PORT=4100
```

## 5. Instalar dependencias

Dentro de la carpeta `backend`, ejecutar:

```bash
npm install
```

Esto instala Express, Prisma y las librerías necesarias.

## 6. Validar Prisma

Ejecutar:

```bash
npx prisma validate
```

Si todo está bien, debería indicar que el esquema es válido.

## 7. Crear las tablas

Ejecutar:

```bash
npx prisma migrate dev --name init
```

Esto crea las tablas:

- Usuarios
- Cancioneros
- Canciones
- Versiones
- Acordes
- Acordes usados por versión
- Setlists
- Tutoriales
- Historial

## 8. Generar Prisma Client

Ejecutar:

```bash
npx prisma generate
```

## 9. Importar datos iniciales

Ejecutar:

```bash
npm run seed
```

Esto importa los cancioneros JSON actuales:

```text
outputs\acordia\importaciones\cancionero-ibbn-acordia.json
outputs\acordia\importaciones\cancionero-escuela-biblica-cantusdei.json
```

También crea acordes en la tabla `Chord` y relaciona los acordes usados con cada versión de canción.

## 10. Levantar el backend

Ejecutar:

```bash
npm run dev
```

El backend debería quedar corriendo en:

```text
http://localhost:4100
```

## 11. Probar que funciona

Abrir en el navegador:

```text
http://localhost:4100/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "app": "CantusDei"
}
```

## 12. Probar endpoints principales

Canciones:

```text
http://localhost:4100/api/songs
```

Acordes más usados:

```text
http://localhost:4100/api/chords/usage
```

Tutoriales:

```text
http://localhost:4100/api/tutorials
```

Setlists:

```text
http://localhost:4100/api/setlists
```

Usuarios:

```text
http://localhost:4100/api/users
```

## 13. Comandos útiles

Abrir editor visual de base de datos Prisma:

```bash
npx prisma studio
```

Resetear base de datos y volver a cargar datos:

```bash
npx prisma migrate reset
npm run seed
```

Levantar backend en modo normal:

```bash
npm start
```

Levantar backend en modo desarrollo:

```bash
npm run dev
```

## 14. Problemas frecuentes

### Error de conexión a la base

Revisar:

- PostgreSQL está iniciado.
- Existe la base `cantusdei`.
- Usuario y contraseña en `.env` son correctos.
- El puerto PostgreSQL es `5432`.

### Error `database does not exist`

Crear la base `cantusdei` en PostgreSQL.

### Error de Prisma después de cambiar el esquema

Ejecutar:

```bash
npx prisma migrate dev
npx prisma generate
```

### El puerto 4100 está ocupado

Cambiar en `.env`:

```env
PORT=4101
```

Y volver a ejecutar:

```bash
npm run dev
```

## 15. Orden recomendado completo

```bash
cd "C:\Users\Gabriel Kardasz\Documents\Codex\2026-06-08\nuevo-proyecto-una-web-de-acordes\outputs\cantusdei-fullstack\backend"
npm install
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
npm run seed
npm run dev
```

Con eso el backend queda instalado, con tablas creadas y datos iniciales cargados.
